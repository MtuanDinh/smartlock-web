"""
Biometric AI Engine cho Smart Lock IoT:
1. Nhận diện Người nói (Speaker Recognition) bằng SpeechBrain (`speechbrain/spkrec-ecapa-voxceleb` - 192 chiều)
   kèm bộ mã hóa Zero-Mean Mel-Cepstral & Pitch Harmonic 192 chiều (CMVN) chống nhiễu nền.
2. Nhận diện Câu nói tiếng Việt (Vietnamese ASR Transcript) để tự động lưu câu mật khẩu khi đăng ký
   và đối chiếu chính xác nội dung câu nói khi mở khóa.
3. Nhận diện Khuôn mặt (Face Recognition) bằng FaceNet PyTorch (`MTCNN` + `InceptionResnetV1` - 512 chiều)
   tối ưu cho ảnh độ phân giải cao chụp từ Camera sau của điện thoại.
"""

from __future__ import annotations

import io
import logging
import math
import os
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Dict, List, Tuple

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
    Tính độ tương đồng chặt chẽ giữa câu vừa nói (ASR Transcript) và câu mật khẩu đã lưu trong DB.
    Trả về điểm từ 0.0 -> 1.0. Nếu 1 trong 2 rỗng -> luôn trả về 0.0.
    """
    s_norm = normalize_vietnamese_phrase(spoken)
    e_norm = normalize_vietnamese_phrase(expected)
    if not s_norm or not e_norm:
        return 0.0
    if s_norm == e_norm:
        return 1.0

    s_list = s_norm.split()
    e_list = e_norm.split()
    if not s_list or not e_list:
        return 0.0

    # Nếu câu kỳ vọng có từ 2 từ trở lên và xuất hiện nguyên vẹn trong câu nói (với độ dài tương đương)
    if len(e_list) >= 2 and e_norm in s_norm and len(s_list) <= len(e_list) + 2:
        return 0.95

    seq_ratio = SequenceMatcher(None, s_norm, e_norm).ratio()
    s_tokens = set(s_list)
    e_tokens = set(e_list)
    common = len(s_tokens & e_tokens)
    if common == 0:
        # Không có bất kỳ từ nào trùng -> phạt nặng để tránh khớp nhầm âm tiết ngẫu nhiên
        return float(seq_ratio * 0.35)

    precision = common / max(len(s_tokens), 1)
    recall = common / max(len(e_tokens), 1)
    token_f1 = (2.0 * precision * recall) / max(precision + recall, 1e-6)
    return float(0.45 * seq_ratio + 0.55 * token_f1)


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
    """

    VOICE_THRESHOLD = 0.70
    PASSPHRASE_THRESHOLD = 0.76
    FACE_THRESHOLD = 0.68

    def __init__(self) -> None:
        self.speaker_model = None
        self.mtcnn = None
        self.facenet = None
        self.speechbrain_ready = False
        self.facenet_ready = False
        self.asr_ready = False
        self._dct_matrix = self._build_dct_matrix(n_mfcc=32, n_mels=64)
        self._init_models()

    @staticmethod
    def _build_dct_matrix(n_mfcc: int, n_mels: int) -> np.ndarray:
        """Tạo ma trận DCT-II trực giao để trích xuất hệ số Cepstral (MFCC) có trung bình bằng 0."""
        n = np.arange(n_mels, dtype=np.float32)
        k = np.arange(1, n_mfcc + 1, dtype=np.float32)[:, None]  # Bỏ thành phần DC k=0
        mat = np.cos(math.pi / n_mels * (n + 0.5) * k)
        mat *= math.sqrt(2.0 / n_mels)
        return mat.astype(np.float32)

    def _init_models(self) -> None:
        # 1. Khởi tạo SpeechRecognition (Vietnamese ASR)
        try:
            import speech_recognition as sr  # type: ignore

            self._sr = sr
            self._recognizer = sr.Recognizer()
            self._recognizer.dynamic_energy_threshold = False
            self._recognizer.energy_threshold = 220
            self.asr_ready = True
            logger.info("Vietnamese ASR (SpeechRecognition) initialized.")
        except Exception as exc:
            self._sr = None
            self._recognizer = None
            logger.warning("SpeechRecognition not available (%s).", exc)

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
                "SpeechBrain pretrained load deferred/fallback (%s). Using Zero-Mean 192-D MFCC-Cepstral Speaker Encoder.",
                exc,
            )

        # 3. Khởi tạo FaceNet-PyTorch (MTCNN + InceptionResnetV1 512-D)
        try:
            import torch  # type: ignore
            from facenet_pytorch import InceptionResnetV1, MTCNN  # type: ignore

            self._torch = torch
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
            else "speechbrain-compatible-mfcc-cmvn (192-D)",
            "facenet": "facenet-pytorch/vggface2 (512-D)"
            if self.facenet_ready
            else "facenet-compatible-spatial (512-D)",
            "asr": "vi-VN Google ASR Transcript" if self.asr_ready else "unavailable",
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

    def _extract_voiced_frames(self, samples: np.ndarray, sr: int) -> np.ndarray:
        """
        Kiểm tra năng lượng tiếng nói thực tế và chỉ giữ lại các khung (frames) có giọng người.
        Loại bỏ hoàn toàn trường hợp im lặng hoặc tiếng ồn nền kích hoạt nhầm.
        """
        if samples.size < int(0.45 * sr):
            raise ValueError("Đoạn âm thanh quá ngắn. Vui lòng nói rõ câu mật khẩu vào điện thoại.")

        # Khử DC offset
        samples = samples - float(np.mean(samples))
        peak = float(np.max(np.abs(samples)))
        overall_rms = float(np.sqrt(np.mean(samples * samples)))

        if peak < 0.045 or overall_rms < 0.012:
            raise ValueError("Không phát hiện giọng nói (âm lượng quá nhỏ hoặc chỉ có tiếng ồn nền).")

        frame_len = int(0.025 * sr)
        hop_len = int(0.010 * sr)
        if samples.size < frame_len * 15:
            raise ValueError("Đoạn thu âm quá ngắn. Vui lòng nói câu mật khẩu dài hơn.")

        # Tính RMS từng frame 25ms
        n_frames = 1 + (samples.size - frame_len) // hop_len
        frame_rms = np.empty(n_frames, dtype=np.float32)
        for i in range(n_frames):
            seg = samples[i * hop_len : i * hop_len + frame_len]
            frame_rms[i] = float(np.sqrt(np.mean(seg * seg)))

        # Ngưỡng tiếng nói động dựa trên nền nhiễu nhưng không thấp hơn 0.022
        noise_floor = float(np.percentile(frame_rms, 20))
        voice_thresh = max(0.022, noise_floor * 2.4, float(np.max(frame_rms)) * 0.18)
        voiced_mask = frame_rms >= voice_thresh
        voiced_count = int(np.sum(voiced_mask))

        # Yêu cầu tối thiểu 30 frames có tiếng nói (~0.32 giây phát âm thực sự)
        if voiced_count < 30:
            raise ValueError("Chưa phát hiện câu nói rõ ràng (chỉ có tạp âm ngắn).")

        voiced_indices = np.where(voiced_mask)[0]
        start_sample = max(0, int(voiced_indices[0] * hop_len))
        end_sample = min(samples.size, int(voiced_indices[-1] * hop_len + frame_len))
        trimmed = samples[start_sample:end_sample]

        if trimmed.size < int(0.40 * sr):
            raise ValueError("Câu nói quá ngắn. Vui lòng đọc rõ câu mật khẩu vào điện thoại.")

        # Chuẩn hóa biên độ (Peak normalization) trước khi đưa vào mô hình
        max_abs = float(np.max(np.abs(trimmed)))
        if max_abs > 1e-6:
            trimmed = trimmed / max_abs
        return trimmed

    def transcribe_vietnamese(self, audio_bytes: bytes) -> str:
        """Nhận diện câu nói tiếng Việt (Transcript) từ đoạn ghi âm WAV."""
        if not self.asr_ready or self._sr is None or self._recognizer is None:
            return ""
        try:
            # Kiểm tra trước xem có tiếng nói thực sự không, nếu chỉ là tiếng ồn/im lặng thì bỏ qua ngay
            samples, sr = self._decode_audio_bytes(audio_bytes)
            self._extract_voiced_frames(samples, sr)
        except ValueError:
            return ""
        except Exception:
            pass

        try:
            with self._sr.AudioFile(io.BytesIO(audio_bytes)) as source:
                audio_data = self._recognizer.record(source)
            transcript = self._recognizer.recognize_google(audio_data, language="vi-VN")
            normalized = normalize_vietnamese_phrase(str(transcript))
            if normalized:
                logger.info("ASR recognized transcript: '%s'", normalized)
            return normalized
        except self._sr.UnknownValueError:
            return ""
        except Exception as exc:
            logger.warning("ASR transcription error: %s", exc)
            return ""

    def extract_voice_embedding(self, audio_bytes: bytes) -> List[float]:
        """
        Trích xuất vector đặc trưng giọng nói 192 chiều (L2-normalized, Zero-Mean).
        Sử dụng SpeechBrain ECAPA-TDNN nếu đã nạp, hoặc bộ trích xuất MFCC-Cepstral + Harmonic 192-D.
        """
        samples, sr = self._decode_audio_bytes(audio_bytes)
        voiced_samples = self._extract_voiced_frames(samples, sr)

        if self.speechbrain_ready and self.speaker_model is not None:
            import torch  # type: ignore

            if sr != 16000:
                duration = voiced_samples.size / float(sr)
                target_len = max(1600, int(duration * 16000))
                x_old = np.linspace(0.0, 1.0, voiced_samples.size)
                x_new = np.linspace(0.0, 1.0, target_len)
                voiced_samples = np.interp(x_new, x_old, voiced_samples).astype(np.float32)

            wav_tensor = torch.tensor(voiced_samples, dtype=torch.float32).unsqueeze(0)
            with torch.no_grad():
                emb = self.speaker_model.encode_batch(wav_tensor)
                emb_np = emb.squeeze().cpu().numpy()
            emb_np = emb_np - float(np.mean(emb_np))
            return l2_normalize(emb_np)

        # Pre-emphasis filter giúp làm nổi bật formant âm sắc người nói
        emphasized = np.append(
            voiced_samples[0], voiced_samples[1:] - 0.97 * voiced_samples[:-1]
        ).astype(np.float32)

        frame_len = int(0.025 * sr)
        hop_len = int(0.010 * sr)
        window = np.hamming(frame_len).astype(np.float32)

        cepstral_frames = []
        harmonic_frames = []

        for start in range(0, emphasized.size - frame_len, hop_len):
            seg = emphasized[start : start + frame_len]
            if float(np.sqrt(np.mean(seg * seg))) < 0.03:
                continue
            win_seg = seg * window
            mag = np.abs(np.fft.rfft(win_seg, n=512))[:256]

            # Gom thành 64 dải băng tần (sub-bands)
            mel_64 = np.mean(mag.reshape(64, 4), axis=1)
            log_mel = np.log(mel_64 + 1e-6)
            # Trừ trung bình phổ của từng frame để khử độ lợi mic
            log_mel = log_mel - float(np.mean(log_mel))

            # Biến đổi DCT-II sang 32 hệ số MFCC (bỏ c0)
            mfcc_32 = self._dct_matrix @ log_mel
            cepstral_frames.append(mfcc_32)

            # Đặc trưng Pitch / Harmonic Autocorrelation (32 chiều)
            autocorr = np.correlate(win_seg, win_seg, mode="full")[frame_len - 1 :]
            autocorr = autocorr / (autocorr[0] + 1e-6)
            # Lấy vùng lag tương ứng tần số giọng người (75Hz -> 400Hz)
            min_lag = max(1, int(sr / 400.0))
            max_lag = min(frame_len - 1, int(sr / 75.0))
            pitch_slice = autocorr[min_lag:max_lag]
            pitch_32 = np.interp(
                np.linspace(0, max(1, pitch_slice.size - 1), 32),
                np.arange(max(1, pitch_slice.size)),
                pitch_slice if pitch_slice.size > 0 else np.zeros(1, dtype=np.float32),
            ).astype(np.float32)
            pitch_32 = pitch_32 - float(np.mean(pitch_32))
            harmonic_frames.append(pitch_32)

        if len(cepstral_frames) < 8:
            raise ValueError("Không đủ khung âm sắc giọng nói. Vui lòng nói rõ hơn.")

        cep_mat = np.vstack(cepstral_frames)  # (T, 32)
        harm_mat = np.vstack(harmonic_frames)  # (T, 32)
        delta_cep = np.diff(cep_mat, axis=0)  # (T-1, 32)

        # Tổng hợp 6 nhóm đặc trưng x 32 chiều = 192 chiều:
        # 1. Mean MFCC (32)
        # 2. Std MFCC Centered (32)
        # 3. Delta MFCC Mean (32)
        # 4. Delta MFCC Std Centered (32)
        # 5. Harmonic Pitch Profile Mean (32)
        # 6. Spectral Skew/Quantile Contrast (32)
        f1 = np.mean(cep_mat, axis=0)
        f2 = np.std(cep_mat, axis=0) - float(np.mean(np.std(cep_mat, axis=0)))
        f3 = np.mean(delta_cep, axis=0)
        f4 = np.std(delta_cep, axis=0) - float(np.mean(np.std(delta_cep, axis=0)))
        f5 = np.mean(harm_mat, axis=0)
        f6 = np.percentile(cep_mat, 80, axis=0) - np.percentile(cep_mat, 20, axis=0)
        f6 = f6 - float(np.mean(f6))

        emb_192 = np.concatenate([f1, f2, f3, f4, f5, f6], axis=0)
        emb_192 = emb_192 - float(np.mean(emb_192))
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
        if float(np.std(arr)) < 0.045:
            raise ValueError("Khung hình camera quá tối hoặc bị mờ. Vui lòng hướng camera sau vào khuôn mặt nơi đủ sáng.")

        gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        gray = (gray - float(np.mean(gray))) / (float(np.std(gray)) + 1e-5)

        small_16 = np.asarray(
            Image.fromarray((gray * 32.0 + 128.0).clip(0, 255).astype(np.uint8)).resize(
                (16, 16), Image.Resampling.BILINEAR
            ),
            dtype=np.float32,
        ).flatten()
        small_16 = small_16 - float(np.mean(small_16))
        gx = np.diff(gray, axis=1)[:, :63]
        gy = np.diff(gray, axis=0)[:63, :]
        gx_128 = np.interp(
            np.linspace(0, gx.size - 1, 128), np.arange(gx.size), gx.flatten()
        )
        gy_128 = np.interp(
            np.linspace(0, gy.size - 1, 128), np.arange(gy.size), gy.flatten()
        )
        emb_512 = np.concatenate([small_16 / 32.0, gx_128, gy_128], axis=0)
        emb_512 = emb_512 - float(np.mean(emb_512))
        return l2_normalize(emb_512), {"width": width, "height": height}
