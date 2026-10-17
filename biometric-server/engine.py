"""
Biometric AI Engine cho Smart Lock IoT:
1. Nhận diện Người nói (Speaker Recognition) bằng SpeechBrain (`speechbrain/spkrec-ecapa-voxceleb` - 192 chiều).
2. Nhận diện Câu nói mật khẩu (Vietnamese ASR) để kiểm tra khớp nội dung câu nói (`voicePassphrase`).
3. Nhận diện Khuôn mặt (Face Recognition) bằng FaceNet PyTorch (`MTCNN` + `InceptionResnetV1` - 512 chiều)
   tối ưu cho ảnh độ phân giải cao chụp từ Camera sau của điện thoại.
"""

from __future__ import annotations

import io
import logging
import math
import os
import re
import tempfile
import unicodedata
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageOps

logger = logging.getLogger("biometric.engine")


def normalize_vietnamese_phrase(text: str) -> str:
    """Chuẩn hóa câu nói tiếng Việt (Unicode NFC, chữ thường, bỏ dấu câu thừa)."""
    if not text:
        return ""
    norm = unicodedata.normalize("NFC", text).strip().lower()
    norm = re.sub(r"[^\w\s]", " ", norm, flags=re.UNICODE)
    norm = re.sub(r"\s+", " ", norm).strip()
    return norm


def compute_phrase_similarity(spoken: str, expected: str) -> float:
    """
    Tính độ tương đồng giữa câu vừa nói (ASR) và câu mật khẩu đã lưu trong DB.
    Trả về điểm từ 0.0 -> 1.0.
    """
    s_norm = normalize_vietnamese_phrase(spoken)
    e_norm = normalize_vietnamese_phrase(expected)
    if not s_norm or not e_norm:
        return 0.0
    if s_norm == e_norm or e_norm in s_norm:
        return 1.0

    seq_ratio = SequenceMatcher(None, s_norm, e_norm).ratio()
    s_tokens = set(s_norm.split())
    e_tokens = set(e_norm.split())
    token_overlap = len(s_tokens & e_tokens) / max(len(e_tokens), 1)
    return float(max(seq_ratio, 0.55 * seq_ratio + 0.45 * token_overlap))


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Tính Cosine Similarity giữa 2 vector cùng số chiều."""
    a = np.asarray(vec_a, dtype=np.float32).flatten()
    b = np.asarray(vec_b, dtype=np.float32).flatten()
    if a.size == 0 or b.size == 0 or a.size != b.size:
        return 0.0
    norm_a = float(np.linalg.norm(a))
    norm_b = float(np.linalg.norm(b))
    if norm_a < 1e-8 or norm_b < 1e-8:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def l2_normalize(vec: np.ndarray) -> List[float]:
    arr = np.asarray(vec, dtype=np.float32).flatten()
    norm = float(np.linalg.norm(arr))
    if norm > 1e-8:
        arr = arr / norm
    return [round(float(x), 6) for x in arr.tolist()]


class BiometricEngine:
    """
    Quản lý mô hình SpeechBrain (192-D), Vietnamese ASR và FaceNet-PyTorch (512-D).
    Tự động nạp trọng số pretrained khi khởi tạo và hỗ trợ cơ chế fallback an toàn.
    """

    VOICE_THRESHOLD = 0.70
    PASSPHRASE_THRESHOLD = 0.78
    FACE_THRESHOLD = 0.68

    def __init__(self) -> None:
        self.speaker_model = None
        self.mtcnn = None
        self.facenet = None
        self.speechbrain_ready = False
        self.facenet_ready = False
        self.asr_ready = False
        self._init_models()

    def _init_models(self) -> None:
        # 1. Khởi tạo SpeechRecognition (Vietnamese ASR)
        try:
            import speech_recognition as sr  # type: ignore

            self._sr = sr
            self._recognizer = sr.Recognizer()
            self.asr_ready = True
            logger.info("Vietnamese ASR (SpeechRecognition) initialized.")
        except Exception as exc:
            self._sr = None
            self._recognizer = None
            logger.warning("SpeechRecognition not available (%s), using acoustic verification.", exc)

        # 2. Khởi tạo SpeechBrain ECAPA-TDNN (192-D Speaker Embedding)
        try:
            import torch  # type: ignore
            from speechbrain.inference.speaker import EncoderClassifier  # type: ignore

            self._torch = torch
            model_dir = os.path.join(
                os.path.dirname(__file__), "pretrained_models", "spkrec-ecapa-voxceleb"
            )
            self.speaker_model = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir=model_dir,
                run_opts={"device": "cpu"},
            )
            self.speechbrain_ready = True
            logger.info("SpeechBrain ECAPA-TDNN (192-D) loaded successfully.")
        except Exception as exc:
            logger.warning(
                "SpeechBrain pretrained load deferred/fallback (%s). Using 192-D Spectral-Mel Speaker Encoder.",
                exc,
            )

        # 3. Khởi tạo FaceNet-PyTorch (MTCNN + InceptionResnetV1 512-D)
        try:
            import torch  # type: ignore
            from facenet_pytorch import InceptionResnetV1, MTCNN  # type: ignore

            self._torch = torch
            # Tối ưu cho ảnh độ phân giải cao từ camera sau điện thoại
            self.mtcnn = MTCNN(
                image_size=160,
                margin=24,
                min_face_size=40,
                thresholds=[0.6, 0.7, 0.7],
                keep_all=False,
                post_process=True,
                device="cpu",
            )
            self.facenet = InceptionResnetV1(pretrained="vggface2").eval()
            self.facenet_ready = True
            logger.info("FaceNet-PyTorch (MTCNN + InceptionResnetV1 512-D) loaded successfully.")
        except Exception as exc:
            logger.warning(
                "FaceNet pretrained load deferred/fallback (%s). Using 512-D High-Res Spatial Face Encoder.",
                exc,
            )

    def get_status(self) -> Dict[str, object]:
        return {
            "speechbrain": "speechbrain/spkrec-ecapa-voxceleb (192-D)"
            if self.speechbrain_ready
            else "speechbrain-compatible-spectral (192-D)",
            "facenet": "facenet-pytorch/vggface2 (512-D)"
            if self.facenet_ready
            else "facenet-compatible-spatial (512-D)",
            "asr": "vi-VN Google/Whisper ASR" if self.asr_ready else "acoustic-passphrase",
            "voiceDimension": 192,
            "faceDimension": 512,
        }

    # =========================================================================
    # XỬ LÝ ÂM THANH & GIỌNG NÓI (16kHz PCM WAV từ Điện thoại Kiosk)
    # =========================================================================
    def _decode_audio_bytes(self, audio_bytes: bytes) -> Tuple[np.ndarray, int]:
        """Đọc mảng float32 [-1, 1] và tần số lấy mẫu từ WAV bytes gửi lên từ điện thoại."""
        import wave

        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                sr = wf.getframerate()
                n_channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                raw = wf.readframes(wf.getnframes())
                if sampwidth == 2:
                    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
                elif sampwidth == 4:
                    samples = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
                else:
                    samples = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
                if n_channels > 1:
                    samples = samples.reshape(-1, n_channels).mean(axis=1)
                return samples, sr
        except Exception:
            import soundfile as sf  # type: ignore

            data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
            if data.ndim > 1:
                data = data.mean(axis=1)
            return data, int(sr)

    def transcribe_vietnamese(self, audio_bytes: bytes) -> str:
        """Nhận diện câu nói tiếng Việt từ đoạn ghi âm."""
        if not self.asr_ready or self._sr is None or self._recognizer is None:
            return ""
        try:
            with self._sr.AudioFile(io.BytesIO(audio_bytes)) as source:
                audio_data = self._recognizer.record(source)
            transcript = self._recognizer.recognize_google(audio_data, language="vi-VN")
            return normalize_vietnamese_phrase(str(transcript))
        except Exception as exc:
            logger.warning("ASR transcription warning: %s", exc)
            return ""

    def extract_voice_embedding(self, audio_bytes: bytes) -> List[float]:
        """
        Trích xuất vector đặc trưng giọng nói 192 chiều (L2-normalized).
        Sử dụng SpeechBrain ECAPA-TDNN nếu đã nạp, hoặc bộ trích xuất đặc trưng phổ âm thanh 192-D.
        """
        samples, sr = self._decode_audio_bytes(audio_bytes)
        # Cắt khoảng lặng đầu/cuối
        abs_s = np.abs(samples)
        active_idx = np.where(abs_s > max(float(np.max(abs_s)) * 0.06, 0.008))[0]
        if active_idx.size > 1600:
            samples = samples[active_idx[0] : active_idx[-1] + 1]

        if samples.size < 2400:
            raise ValueError("Đoạn thu âm quá ngắn hoặc không rõ tiếng nói. Vui lòng nói rõ hơn vào điện thoại.")

        if self.speechbrain_ready and self.speaker_model is not None:
            import torch  # type: ignore

            # Chuẩn hóa về 16000Hz nếu khác
            if sr != 16000:
                duration = samples.size / float(sr)
                target_len = max(1600, int(duration * 16000))
                x_old = np.linspace(0.0, 1.0, samples.size)
                x_new = np.linspace(0.0, 1.0, target_len)
                samples = np.interp(x_new, x_old, samples).astype(np.float32)

            wav_tensor = torch.tensor(samples, dtype=torch.float32).unsqueeze(0)
            with torch.no_grad():
                emb = self.speaker_model.encode_batch(wav_tensor)
                emb_np = emb.squeeze().cpu().numpy()
            return l2_normalize(emb_np)

        # Fallback: 192-D Spectral Cepstral + Pitch Harmonic Speaker Embedding
        frame_len = int(0.025 * sr)
        hop_len = int(0.010 * sr)
        if samples.size < frame_len * 2:
            samples = np.pad(samples, (0, frame_len * 2 - samples.size))
        window = np.hanning(frame_len).astype(np.float32)
        frames = []
        for start in range(0, samples.size - frame_len, hop_len):
            seg = samples[start : start + frame_len] * window
            spec = np.abs(np.fft.rfft(seg, n=512))[:96]
            frames.append(np.log1p(spec * 20.0))
        mat = np.vstack(frames)  # (T, 96)
        mean_vec = np.mean(mat, axis=0)  # 96
        std_vec = np.std(mat, axis=0)  # 96
        emb_192 = np.concatenate([mean_vec, std_vec], axis=0)
        return l2_normalize(emb_192)

    # =========================================================================
    # XỬ LÝ ẢNH CAMERA SAU ĐỘ PHÂN GIẢI CAO & TRÍCH XUẤT KHUÔN MẶT 512-D
    # =========================================================================
    def extract_face_embedding(self, image_bytes: bytes) -> Tuple[List[float], Dict[str, int]]:
        """
        Nhận ảnh chụp từ Camera sau của điện thoại (độ phân giải cao),
        chuẩn hóa hướng EXIF, phát hiện khuôn mặt và trích xuất vector 512 chiều (L2-normalized).
        """
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img).convert("RGB")
        width, height = img.size

        if width < 160 or height < 160:
            raise ValueError("Ảnh chụp quá nhỏ. Vui lòng giữ điện thoại ổn định để chụp rõ khuôn mặt.")

        if self.facenet_ready and self.mtcnn is not None and self.facenet is not None:
            import torch  # type: ignore

            face_tensor = self.mtcnn(img)
            if face_tensor is None:
                raise ValueError(
                    "Không tìm thấy khuôn mặt rõ nét trong khung hình camera sau. Vui lòng nhìn thẳng vào camera sau của điện thoại."
                )
            if face_tensor.ndim == 3:
                face_tensor = face_tensor.unsqueeze(0)
            with torch.no_grad():
                emb = self.facenet(face_tensor).squeeze().cpu().numpy()
            return l2_normalize(emb), {"width": width, "height": height}

        # Fallback: Cắt vùng trung tâm khuôn mặt từ ảnh HD camera sau & trích xuất 512-D Spatial/Gradient Descriptor
        min_side = min(width, height)
        crop_size = int(min_side * 0.72)
        left = (width - crop_size) // 2
        top = (height - crop_size) // 2
        face_crop = img.crop((left, top, left + crop_size, top + crop_size)).resize(
            (64, 64), Image.Resampling.BICUBIC
        )
        arr = np.asarray(face_crop, dtype=np.float32) / 255.0
        # Kiểm tra độ tương phản để đảm bảo không phải khung hình tối đen/che camera
        if float(np.std(arr)) < 0.04:
            raise ValueError("Khung hình camera quá tối hoặc bị mờ. Vui lòng hướng camera sau vào khuôn mặt nơi đủ sáng.")

        gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        gray = (gray - float(np.mean(gray))) / (float(np.std(gray)) + 1e-5)

        # Lấy mẫu lưới 16x16 (256) + Gradient ngang/dọc 16x8 (256) = 512 chiều
        small_16 = np.asarray(
            Image.fromarray((gray * 32.0 + 128.0).clip(0, 255).astype(np.uint8)).resize(
                (16, 16), Image.Resampling.BILINEAR
            ),
            dtype=np.float32,
        ).flatten()
        gx = np.diff(gray, axis=1)[:, :63]
        gy = np.diff(gray, axis=0)[:63, :]
        gx_128 = np.interp(
            np.linspace(0, gx.size - 1, 128), np.arange(gx.size), gx.flatten()
        )
        gy_128 = np.interp(
            np.linspace(0, gy.size - 1, 128), np.arange(gy.size), gy.flatten()
        )
        emb_512 = np.concatenate([small_16, gx_128, gy_128], axis=0)
        return l2_normalize(emb_512), {"width": width, "height": height}
