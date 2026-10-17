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

    @property
    def face_threshold(self) -> float:
        """
        Ngưỡng Cosine Similarity khuôn mặt:
        - 0.65 khi sử dụng mạng nơ-ron sâu FaceNet-PyTorch (InceptionResnetV1).
        - 0.38 khi sử dụng OpenCV SFace ONNX (MobileFaceNet - khuyến nghị ~0.363).
        - 0.40 khi sử dụng bộ mã hóa không gian / đạo hàm Laplacian 512-D dự phòng.
        """
        if self.facenet_ready:
            return 0.65
        if self.sface_ready:
            return 0.38
        return 0.40

    def __init__(self) -> None:
        self.speaker_model = None
        self.mtcnn = None
        self.facenet = None
        self.yunet_detector = None
        self.sface_recognizer = None
        self.speechbrain_ready = False
        self.facenet_ready = False
        self.sface_ready = False
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
        # 0. Khởi tạo OpenCV 5.0 YuNet DNN Face & 5-Landmark Detector + SFace Deep Recognizer
        try:
            import urllib.request
            import cv2  # type: ignore

            models_dir = os.path.join(os.path.dirname(__file__), "models")
            os.makedirs(models_dir, exist_ok=True)
            yunet_path = os.path.join(models_dir, "face_detection_yunet_2023mar.onnx")
            if not os.path.exists(yunet_path):
                url = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
                urllib.request.urlretrieve(url, yunet_path)
            if hasattr(cv2, "FaceDetectorYN"):
                self.yunet_detector = cv2.FaceDetectorYN.create(
                    yunet_path, "", (320, 320), 0.42, 0.3, 5000
                )
                logger.info("OpenCV 5.0 YuNet DNN Face & 5-Landmark Detector initialized.")

            sface_path = os.path.join(models_dir, "face_recognition_sface_2021dec.onnx")
            if not os.path.exists(sface_path):
                sface_url = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
                urllib.request.urlretrieve(sface_url, sface_path)
            if hasattr(cv2, "FaceRecognizerSF"):
                self.sface_recognizer = cv2.FaceRecognizerSF.create(sface_path, "")
                self.sface_ready = True
                logger.info("OpenCV SFace Deep CNN Face Recognizer (128-D ONNX) initialized.")
        except Exception as exc:
            self.sface_recognizer = None
            self.sface_ready = False
            logger.warning("YuNet / SFace init warning: %s", exc)

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
        if self.facenet_ready:
            face_model = "facenet-pytorch/vggface2 (512-D)"
            face_dim = 512
        elif self.sface_ready:
            face_model = "opencv-sface/mobilefacenet (128-D)"
            face_dim = 128
        else:
            face_model = "yunet-5landmarks + facenet-spatial (512-D)"
            face_dim = 512

        return {
            "speechbrain": "speechbrain/spkrec-ecapa-voxceleb (192-D)"
            if self.speechbrain_ready
            else "speechbrain-compatible-mfcc-cmvn (192-D)",
            "facenet": face_model,
            "asr": "vi-VN Google ASR Transcript" if self.asr_ready else "unavailable",
            "voiceDimension": 192,
            "faceDimension": face_dim,
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

    @staticmethod
    def _encode_samples_to_wav_bytes(samples: np.ndarray, sr: int = 16000) -> bytes:
        """Đóng gói mảng float32 [-1.0, 1.0] thành chuẩn 16-bit PCM WAV bytes."""
        import wave

        clipped = np.clip(samples, -1.0, 1.0)
        int16_samples = (clipped * 32767.0).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(int16_samples.tobytes())
        return buf.getvalue()

    def normalize_and_boost_voice(
        self,
        audio_bytes: bytes,
        target_rms: float = 0.14,
        max_gain_db: float = 28.0,
        peak_limit: float = 0.92,
    ) -> Tuple[bytes, np.ndarray, float]:
        """
        Tự động cân bằng & khuếch đại (Automatic Gain Control - AGC & Loudness Normalization)
        đưa toàn bộ âm lượng giọng nói về cùng mức Target RMS = 0.14 (~ -17 dBFS).
        Đảm bảo dù người dùng nói gần (10cm) hay nói xa (1m), to hay nhỏ,
        âm thanh đưa vào nhận diện người nói và nhận diện câu khẩu lệnh đều đồng nhất.
        """
        samples, sr = self._decode_audio_bytes(audio_bytes)
        if samples.size < int(0.35 * sr):
            raise ValueError("Đoạn âm thanh quá ngắn. Vui lòng nói rõ câu mật khẩu vào điện thoại.")

        # Khử DC offset
        samples = samples - float(np.mean(samples))

        # Phân tích năng lượng từng khung 25ms (hop 10ms) để xác định các khung có tiếng nói
        frame_len = int(0.025 * sr)
        hop_len = int(0.010 * sr)
        if samples.size < frame_len * 10:
            raise ValueError("Đoạn thu âm quá ngắn. Vui lòng nói câu mật khẩu dài hơn.")

        n_frames = 1 + (samples.size - frame_len) // hop_len
        frame_rms = np.empty(n_frames, dtype=np.float32)
        for i in range(n_frames):
            seg = samples[i * hop_len : i * hop_len + frame_len]
            frame_rms[i] = float(np.sqrt(np.mean(seg * seg)))

        noise_floor = float(np.percentile(frame_rms, 20))
        max_frame_rms = float(np.max(frame_rms)) if frame_rms.size > 0 else 0.0

        if max_frame_rms < 0.006:
            raise ValueError("Không phát hiện giọng nói (âm lượng quá nhỏ hoặc chỉ có tiếng ồn nền).")

        # Ngưỡng phát hiện tiếng nói thích ứng với nền nhiễu và tỷ lệ biên độ (Scale-Invariant)
        voice_thresh = max(0.003, noise_floor * 1.5, max_frame_rms * 0.10)
        voiced_mask = frame_rms >= voice_thresh
        voiced_indices = np.where(voiced_mask)[0]

        if len(voiced_indices) < 18:
            raise ValueError("Chưa phát hiện câu nói rõ ràng (chỉ có tạp âm ngắn).")

        # Tính toán Active Voiced RMS chỉ trên các khung có tiếng nói thực sự
        voiced_samples_list = []
        for idx in voiced_indices:
            start_i = idx * hop_len
            end_i = min(samples.size, start_i + frame_len)
            voiced_samples_list.append(samples[start_i:end_i])

        if voiced_samples_list:
            concatenated_voiced = np.concatenate(voiced_samples_list)
            active_rms = float(np.sqrt(np.mean(concatenated_voiced * concatenated_voiced)))
        else:
            active_rms = float(np.sqrt(np.mean(samples * samples)))

        active_rms = max(active_rms, 1e-5)

        # Tính hệ số khuếch đại (Gain) cần thiết để đưa active_rms về target_rms (0.14)
        desired_gain = target_rms / active_rms
        max_gain = float(10.0 ** (max_gain_db / 20.0))  # +28 dB ~ 25.1x
        min_gain = 0.20  # Hạ âm nếu nói quá to sát mic
        actual_gain = float(np.clip(desired_gain, min_gain, max_gain))

        # Khuếch đại toàn bộ chuỗi mẫu âm thanh
        scaled = samples * actual_gain

        # Áp dụng Soft-Knee Limiter (nén mềm qua hàm tanh) để chống vỡ tiếng (clipping)
        soft_knee_thresh = 0.70
        abs_scaled = np.abs(scaled)
        over_mask = abs_scaled > soft_knee_thresh
        boosted_samples = scaled.copy()
        if np.any(over_mask):
            margin = peak_limit - soft_knee_thresh
            over_val = abs_scaled[over_mask] - soft_knee_thresh
            boosted_samples[over_mask] = np.sign(scaled[over_mask]) * (
                soft_knee_thresh + margin * np.tanh(over_val / margin)
            )

        # Cắt lấy đoạn phát âm người nói (từ khung tiếng đầu tiên đến khung cuối cùng + padding 120ms)
        pad_samples = int(0.12 * sr)
        start_voiced = max(0, int(voiced_indices[0] * hop_len) - pad_samples)
        end_voiced = min(samples.size, int(voiced_indices[-1] * hop_len + frame_len) + pad_samples)
        boosted_voiced = boosted_samples[start_voiced:end_voiced]

        gain_db = round(float(20.0 * np.log10(max(actual_gain, 1e-4))), 1)
        final_rms = float(np.sqrt(np.mean(boosted_voiced * boosted_voiced))) if boosted_voiced.size > 0 else target_rms

        logger.info(
            "AGC Voice Boost: active_rms=%.4f -> boosted_rms=%.4f | Gain=%.2fx (%+.1f dB)",
            active_rms,
            final_rms,
            actual_gain,
            gain_db,
        )

        boosted_wav_bytes = self._encode_samples_to_wav_bytes(boosted_samples, sr)
        return boosted_wav_bytes, boosted_voiced, gain_db

    def _extract_voiced_frames(self, samples: np.ndarray, sr: int) -> np.ndarray:
        """
        Kiểm tra năng lượng tiếng nói thực tế và chỉ giữ lại các khung (frames) có giọng người.
        Hỗ trợ tiếp nhận cả giọng nói từ xa (âm lượng thấp) trước khi chuyển qua bộ AGC.
        """
        if samples.size < int(0.35 * sr):
            raise ValueError("Đoạn âm thanh quá ngắn. Vui lòng nói rõ câu mật khẩu vào điện thoại.")

        # Khử DC offset
        samples = samples - float(np.mean(samples))
        peak = float(np.max(np.abs(samples)))
        overall_rms = float(np.sqrt(np.mean(samples * samples)))

        if peak < 0.020 or overall_rms < 0.005:
            raise ValueError("Không phát hiện giọng nói (âm lượng quá nhỏ hoặc chỉ có tiếng ồn nền).")

        frame_len = int(0.025 * sr)
        hop_len = int(0.010 * sr)
        if samples.size < frame_len * 10:
            raise ValueError("Đoạn thu âm quá ngắn. Vui lòng nói câu mật khẩu dài hơn.")

        # Tính RMS từng frame 25ms
        n_frames = 1 + (samples.size - frame_len) // hop_len
        frame_rms = np.empty(n_frames, dtype=np.float32)
        for i in range(n_frames):
            seg = samples[i * hop_len : i * hop_len + frame_len]
            frame_rms[i] = float(np.sqrt(np.mean(seg * seg)))

        noise_floor = float(np.percentile(frame_rms, 20))
        voice_thresh = max(0.012, noise_floor * 1.8, float(np.max(frame_rms)) * 0.14)
        voiced_mask = frame_rms >= voice_thresh
        voiced_count = int(np.sum(voiced_mask))

        if voiced_count < 18:
            raise ValueError("Chưa phát hiện câu nói rõ ràng (chỉ có tạp âm ngắn).")

        voiced_indices = np.where(voiced_mask)[0]
        start_sample = max(0, int(voiced_indices[0] * hop_len))
        end_sample = min(samples.size, int(voiced_indices[-1] * hop_len + frame_len))
        trimmed = samples[start_sample:end_sample]

        if trimmed.size < int(0.30 * sr):
            raise ValueError("Câu nói quá ngắn. Vui lòng đọc rõ câu mật khẩu vào điện thoại.")

        max_abs = float(np.max(np.abs(trimmed)))
        if max_abs > 1e-6:
            trimmed = trimmed / max_abs
        return trimmed

    def transcribe_vietnamese(self, audio_bytes: bytes) -> str:
        """Nhận diện câu nói tiếng Việt (Transcript) từ đoạn ghi âm WAV sau khi chuẩn hóa AGC."""
        if not self.asr_ready or self._sr is None or self._recognizer is None:
            return ""
        try:
            # 1. Tự động chuẩn hóa & boost âm lượng về mức chuẩn (Target RMS = 0.14)
            boosted_wav_bytes, _, _ = self.normalize_and_boost_voice(audio_bytes)
        except ValueError:
            return ""
        except Exception as exc:
            logger.warning("normalize_and_boost_voice error in transcribe: %s", exc)
            boosted_wav_bytes = audio_bytes

        try:
            with self._sr.AudioFile(io.BytesIO(boosted_wav_bytes)) as source:
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
        Trích xuất vector đặc trưng giọng nói 192 chiều (L2-normalized, Zero-Mean)
        sau khi đã chuẩn hóa và boost âm lượng về cùng một mức Target RMS chuẩn.
        """
        # Tự động cân bằng & boost âm lượng về cùng mức Target RMS = 0.14
        _, voiced_samples, _ = self.normalize_and_boost_voice(audio_bytes)
        sr = 16000

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
            if float(np.sqrt(np.mean(seg * seg))) < 0.008:
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
    # XỬ LÝ ẢNH CAMERA SAU ĐỘ PHÂN GIẢI CAO & 5 THUẬT TOÁN KIỂM TRA KHUÔN MẶT CHUẨN
    # =========================================================================
    def evaluate_face_frame(
        self, img: Image.Image, target_pose: str = "center"
    ) -> Tuple[Image.Image | None, Dict[str, object]]:
        """
        Thực thi đồng thời 5 Thuật toán Kiểm tra Khuôn mặt Đạt chuẩn (trả về chi tiết từng thuật toán
        để hiển thị trực tiếp theo thời gian thực trên màn hình Camera điện thoại):
        1. YuNet DNN Face & 5-Landmark Detection (Phát hiện khuôn mặt & 5 điểm mốc mắt-mũi-miệng).
        2. Oval Model Center Alignment (Kiểm tra tâm khuôn mặt nằm trong khung mô hình bầu dục).
        3. Biometric Scale & Distance Ratio (Kiểm tra tỷ lệ khuôn mặt / khoảng cách 25-40cm).
        4. 5-Landmark 3D Pose Checking theo target_pose ("center", "left", "right", "up", "down").
        5. Luma Brightness & Laplacian Sharpness (Kiểm tra ánh sáng & độ sắc nét chống rung mờ).
        """
        width, height = img.size
        if width < 120 or height < 120:
            checks = [
                {
                    "id": "face_detect",
                    "name": "1. Phát hiện mặt (YuNet DNN)",
                    "passed": False,
                    "value": "Ảnh quá nhỏ",
                },
                {
                    "id": "center_align",
                    "name": "2. Căn tâm khung mô hình",
                    "passed": False,
                    "value": "Chờ khung hình...",
                },
                {
                    "id": "size_ratio",
                    "name": "3. Khoảng cách & Kích thước",
                    "passed": False,
                    "value": "Chờ khung hình...",
                },
                {
                    "id": "frontal_pose",
                    "name": "4. Tư thế nhìn thẳng (5 điểm mốc)",
                    "passed": False,
                    "value": "Chờ khung hình...",
                },
                {
                    "id": "image_quality",
                    "name": "5. Độ sáng & Độ nét (Laplacian)",
                    "passed": False,
                    "value": "Chờ khung hình...",
                },
            ]
            return None, {
                "width": width,
                "height": height,
                "aligned": False,
                "detail": "Ảnh chụp quá nhỏ. Vui lòng giữ điện thoại ổn định.",
                "checks": checks,
                "bbox": None,
                "landmarks": [],
            }

        rgb_np = np.asarray(img, dtype=np.uint8)
        import cv2  # type: ignore

        gray_full = cv2.cvtColor(rgb_np, cv2.COLOR_RGB2GRAY)
        bgr_full = cv2.cvtColor(rgb_np, cv2.COLOR_RGB2BGR)

        detected_row = None
        scale_x = 1.0
        scale_y = 1.0

        # Ưu tiên 1: OpenCV 5.0 YuNet DNN FaceDetectorYN (kèm 5 điểm mốc giải phẫu)
        if self.yunet_detector is not None:
            try:
                max_dim = 480
                scale = min(1.0, float(max_dim) / float(max(width, height)))
                work_w = max(64, int(round(width * scale)))
                work_h = max(64, int(round(height * scale)))
                scale_x = float(width) / float(work_w)
                scale_y = float(height) / float(work_h)

                work_bgr = (
                    cv2.resize(bgr_full, (work_w, work_h))
                    if scale < 1.0
                    else bgr_full
                )
                self.yunet_detector.setInputSize((work_w, work_h))
                _, faces = self.yunet_detector.detect(work_bgr)
                if faces is not None and len(faces) > 0:
                    best = max(
                        faces,
                        key=lambda r: float(r[2]) * float(r[3]) * float(r[14]),
                    )
                    detected_row = [float(v) for v in best]
                else:
                    # Thử xoay 90 độ theo chiều kim đồng hồ (nếu điện thoại gửi buffer landscape khi cầm dọc)
                    rot90 = cv2.rotate(work_bgr, cv2.ROTATE_90_CLOCKWISE)
                    self.yunet_detector.setInputSize((work_h, work_w))
                    _, faces90 = self.yunet_detector.detect(rot90)
                    if faces90 is not None and len(faces90) > 0:
                        bgr_full = cv2.rotate(bgr_full, cv2.ROTATE_90_CLOCKWISE)
                        gray_full = cv2.rotate(gray_full, cv2.ROTATE_90_CLOCKWISE)
                        img = img.rotate(-90, expand=True)
                        width, height = img.size
                        scale_x = float(width) / float(work_h)
                        scale_y = float(height) / float(work_w)
                        best = max(faces90, key=lambda r: float(r[2]) * float(r[3]) * float(r[14]))
                        detected_row = [float(v) for v in best]
                    else:
                        # Thử xoay 270 độ (90 độ ngược chiều kim đồng hồ)
                        rot270 = cv2.rotate(work_bgr, cv2.ROTATE_90_COUNTERCLOCKWISE)
                        self.yunet_detector.setInputSize((work_h, work_w))
                        _, faces270 = self.yunet_detector.detect(rot270)
                        if faces270 is not None and len(faces270) > 0:
                            bgr_full = cv2.rotate(bgr_full, cv2.ROTATE_90_COUNTERCLOCKWISE)
                            gray_full = cv2.rotate(gray_full, cv2.ROTATE_90_COUNTERCLOCKWISE)
                            img = img.rotate(90, expand=True)
                            width, height = img.size
                            scale_x = float(width) / float(work_h)
                            scale_y = float(height) / float(work_w)
                            best = max(faces270, key=lambda r: float(r[2]) * float(r[3]) * float(r[14]))
                            detected_row = [float(v) for v in best]
            except Exception as exc:
                logger.warning("YuNet detect error: %s", exc)

        # Dự phòng nếu chưa có mặt từ YuNet
        if detected_row is None:
            mean_global = float(np.mean(gray_full))
            checks = [
                {
                    "id": "face_detect",
                    "name": "1. Phát hiện mặt (YuNet DNN)",
                    "passed": False,
                    "value": "Chưa thấy mặt trong khung",
                },
                {
                    "id": "center_align",
                    "name": "2. Căn tâm khung mô hình",
                    "passed": False,
                    "value": "Đặt mặt vào giữa khung",
                },
                {
                    "id": "size_ratio",
                    "name": "3. Khoảng cách & Kích thước",
                    "passed": False,
                    "value": "Cách cam 25–35 cm",
                },
                {
                    "id": "frontal_pose",
                    "name": "4. Tư thế nhìn thẳng (5 điểm mốc)",
                    "passed": False,
                    "value": "Nhìn thẳng vào cam sau",
                },
                {
                    "id": "image_quality",
                    "name": "5. Độ sáng & Độ nét (Laplacian)",
                    "passed": mean_global >= 32.0,
                    "value": f"Ánh sáng nền: {int(mean_global)}",
                },
            ]
            return None, {
                "width": width,
                "height": height,
                "aligned": False,
                "detail": "Chưa phát hiện khuôn mặt. Hãy đặt khuôn mặt vào trong KHUNG MÔ HÌNH BẦU DỤC trên màn hình.",
                "checks": checks,
                "bbox": None,
                "landmarks": [],
            }

        # Giải mã tọa độ Bounding Box và 5 điểm mốc từ YuNet
        x = int(round(detected_row[0] * scale_x))
        y = int(round(detected_row[1] * scale_y))
        w_box = int(round(detected_row[2] * scale_x))
        h_box = int(round(detected_row[3] * scale_y))
        conf = float(detected_row[14])

        orig_detected_row = np.array(
            [
                detected_row[0] * scale_x,
                detected_row[1] * scale_y,
                detected_row[2] * scale_x,
                detected_row[3] * scale_y,
                detected_row[4] * scale_x,
                detected_row[5] * scale_y,
                detected_row[6] * scale_x,
                detected_row[7] * scale_y,
                detected_row[8] * scale_x,
                detected_row[9] * scale_y,
                detected_row[10] * scale_x,
                detected_row[11] * scale_y,
                detected_row[12] * scale_x,
                detected_row[13] * scale_y,
                detected_row[14],
            ],
            dtype=np.float32,
        )

        # 5 điểm mốc chuẩn hóa (0.0 -> 1.0): [Mắt phải, Mắt trái, Chóp mũi, Miệng phải, Miệng trái]
        landmarks_norm = [
            [
                round((detected_row[4] * scale_x) / float(width), 4),
                round((detected_row[5] * scale_y) / float(height), 4),
            ],
            [
                round((detected_row[6] * scale_x) / float(width), 4),
                round((detected_row[7] * scale_y) / float(height), 4),
            ],
            [
                round((detected_row[8] * scale_x) / float(width), 4),
                round((detected_row[9] * scale_y) / float(height), 4),
            ],
            [
                round((detected_row[10] * scale_x) / float(width), 4),
                round((detected_row[11] * scale_y) / float(height), 4),
            ],
            [
                round((detected_row[12] * scale_x) / float(width), 4),
                round((detected_row[13] * scale_y) / float(height), 4),
            ],
        ]
        bbox_norm = [
            round(max(0.0, x / float(width)), 4),
            round(max(0.0, y / float(height)), 4),
            round(min(1.0, w_box / float(width)), 4),
            round(min(1.0, h_box / float(height)), 4),
        ]

        cx = (x + w_box * 0.5) / float(width)
        cy = (y + h_box * 0.5) / float(height)
        size_ratio = max(w_box, h_box) / float(min(width, height))

        # --- THUẬT TOÁN 1: Độ tin cậy phát hiện khuôn mặt YuNet ---
        pass_detect = conf >= 0.40
        val_detect = f"Đạt ({int(round(conf * 100))}% AI)"

        # --- THUẬT TOÁN 2: Kiểm tra căn tâm trong Khung Mô Hình Bầu Dục ---
        pass_center = True
        center_reason = ""
        if cx < 0.22:
            pass_center = False
            center_reason = "Khuôn mặt đang lệch sang TRÁI khung mô hình."
            val_center = f"Lệch TRÁI (X:{int(cx * 100)}%)"
        elif cx > 0.78:
            pass_center = False
            center_reason = "Khuôn mặt đang lệch sang PHẢI khung mô hình."
            val_center = f"Lệch PHẢI (X:{int(cx * 100)}%)"
        elif cy < 0.16:
            pass_center = False
            center_reason = "Khuôn mặt đang ở QUÁ CAO so với khung mô hình."
            val_center = f"Quá CAO (Y:{int(cy * 100)}%)"
        elif cy > 0.84:
            pass_center = False
            center_reason = "Khuôn mặt đang ở QUÁ THẤP so với khung mô hình."
            val_center = f"Quá THẤP (Y:{int(cy * 100)}%)"
        else:
            val_center = f"Đạt chuẩn (Tâm {int(cx * 100)}%, {int(cy * 100)}%)"

        # --- THUẬT TOÁN 3: Kiểm tra khoảng cách & tỷ lệ kích thước khuôn mặt ---
        pass_size = True
        size_reason = ""
        if size_ratio < 0.16:
            pass_size = False
            size_reason = "Khuôn mặt hơi nhỏ. Hãy đưa điện thoại lại gần hơn (cách 25–35 cm)."
            val_size = f"Quá xa ({int(size_ratio * 100)}% < 16%)"
        elif size_ratio > 0.88:
            pass_size = False
            size_reason = "Khuôn mặt quá sát camera. Hãy đưa điện thoại ra xa một chút."
            val_size = f"Quá gần ({int(size_ratio * 100)}% > 88%)"
        else:
            val_size = f"Đạt chuẩn ({int(size_ratio * 100)}% khung)"

        # --- THUẬT TOÁN 4: Kiểm tra tư thế đầu (Pose) theo target_pose ---
        re_x, re_y = landmarks_norm[0]
        le_x, le_y = landmarks_norm[1]
        nt_x, nt_y = landmarks_norm[2]
        rm_x, rm_y = landmarks_norm[3]
        lm_x, lm_y = landmarks_norm[4]
        eye_dx = abs(le_x - re_x)
        eye_dy = abs(le_y - re_y)
        roll_deg = (
            float(math.degrees(math.atan2(eye_dy, max(eye_dx, 1e-4))))
            if eye_dx > 0.01
            else 0.0
        )
        eye_mid_x = 0.5 * (re_x + le_x)
        eye_mid_y = 0.5 * (re_y + le_y)
        mouth_mid_y = 0.5 * (rm_y + lm_y)
        face_vert = max(mouth_mid_y - eye_mid_y, 0.04)

        # Yaw signed: (nt_x - eye_mid_x) / eye_dx
        # nt_x lệch sang phải ảnh (tai trái người dùng) -> yaw > 0 (Quay Trái)
        # nt_x lệch sang trái ảnh (tai phải người dùng) -> yaw < 0 (Quay Phải)
        yaw_metric = float((nt_x - eye_mid_x) / max(eye_dx, 0.04))

        # Pitch metric: tỷ lệ độ cao mũi giữa trục mắt và trục miệng
        # Mũi nhích lên trục mắt -> pitch < 0.38 (Ngẩng lên)
        # Mũi chúc xuống trục miệng -> pitch > 0.62 (Cúi xuống)
        pitch_metric = float((nt_y - eye_mid_y) / face_vert)

        pass_pose = True
        pose_reason = ""
        pose_key = (target_pose or "center").strip().lower()

        if roll_deg > 30.0:
            pass_pose = False
            pose_reason = f"Đầu đang nghiêng ({round(roll_deg, 1)}°). Hãy giữ đầu thẳng không nghiêng cổ."
            val_pose = f"Nghiêng cổ {round(roll_deg, 1)}° (>30°)"
            pose_name = "4. Tư thế khuôn mặt"
        elif pose_key in ("center", "straight"):
            pose_name = "4. Tư thế nhìn thẳng"
            if abs(yaw_metric) > 0.22:
                pass_pose = False
                pose_reason = "Khuôn mặt đang quay nghiêng. Hãy nhìn thẳng trực diện vào camera sau."
                val_pose = f"Quay nghiêng (Yaw {yaw_metric:+.2f})"
            elif pitch_metric < 0.38:
                pass_pose = False
                pose_reason = "Đầu đang ngẩng cao. Hãy nhìn thẳng trực diện vào camera sau."
                val_pose = f"Đang ngẩng (Pitch {pitch_metric:.2f})"
            elif pitch_metric > 0.62:
                pass_pose = False
                pose_reason = "Đầu đang cúi thấp. Hãy nhìn thẳng trực diện vào camera sau."
                val_pose = f"Đang cúi (Pitch {pitch_metric:.2f})"
            else:
                val_pose = f"Trực diện (Góc {round(roll_deg, 1)}°)"
        elif pose_key == "left":
            pose_name = "4. Góc quay sang Trái"
            if yaw_metric < 0.16:
                pass_pose = False
                pose_reason = "Hãy quay mặt nhẹ sang TRÁI (khoảng 20°)."
                val_pose = f"Chưa đủ góc (Yaw {yaw_metric:+.2f} < +0.16)"
            elif pitch_metric < 0.32 or pitch_metric > 0.68:
                pass_pose = False
                pose_reason = "Hãy giữ độ cao đầu vừa phải khi quay sang TRÁI."
                val_pose = f"Lệch ngẩng/cúi ({pitch_metric:.2f})"
            else:
                val_pose = f"Đạt góc Trái (Yaw {yaw_metric:+.2f})"
        elif pose_key == "right":
            pose_name = "4. Góc quay sang Phải"
            if yaw_metric > -0.16:
                pass_pose = False
                pose_reason = "Hãy quay mặt nhẹ sang PHẢI (khoảng 20°)."
                val_pose = f"Chưa đủ góc (Yaw {yaw_metric:+.2f} > -0.16)"
            elif pitch_metric < 0.32 or pitch_metric > 0.68:
                pass_pose = False
                pose_reason = "Hãy giữ độ cao đầu vừa phải khi quay sang PHẢI."
                val_pose = f"Lệch ngẩng/cúi ({pitch_metric:.2f})"
            else:
                val_pose = f"Đạt góc Phải (Yaw {yaw_metric:+.2f})"
        elif pose_key == "up":
            pose_name = "4. Góc ngẩng Lên trên"
            if pitch_metric > 0.38:
                pass_pose = False
                pose_reason = "Hãy ngẩng nhẹ đầu LÊN TRÊN (khoảng 15°–25°)."
                val_pose = f"Chưa đủ ngẩng (Pitch {pitch_metric:.2f} > 0.38)"
            elif abs(yaw_metric) > 0.28:
                pass_pose = False
                pose_reason = "Hãy giữ mặt ở giữa khi ngẩng đầu lên trên."
                val_pose = f"Lệch quay ngang ({yaw_metric:+.2f})"
            else:
                val_pose = f"Đạt góc Ngẩng (Pitch {pitch_metric:.2f})"
        elif pose_key == "down":
            pose_name = "4. Góc cúi Xuống dưới"
            if pitch_metric < 0.62:
                pass_pose = False
                pose_reason = "Hãy cúi nhẹ đầu XUỐNG DƯỚI (khoảng 15°–25°)."
                val_pose = f"Chưa đủ cúi (Pitch {pitch_metric:.2f} < 0.62)"
            elif abs(yaw_metric) > 0.28:
                pass_pose = False
                pose_reason = "Hãy giữ mặt ở giữa khi cúi đầu xuống dưới."
                val_pose = f"Lệch quay ngang ({yaw_metric:+.2f})"
            else:
                val_pose = f"Đạt góc Cúi (Pitch {pitch_metric:.2f})"
        else:  # "any"
            pose_name = "4. Tư thế khuôn mặt"
            val_pose = f"Hợp lệ (Yaw {yaw_metric:+.2f} | Pitch {pitch_metric:.2f})"

        # --- THUẬT TOÁN 5: Kiểm tra Độ sáng Luma & Độ sắc nét Laplacian ---
        x0 = max(0, x)
        y0 = max(0, y)
        x1_crop = min(width, max(x0 + 16, x + w_box))
        y1_crop = min(height, max(y0 + 16, y + h_box))
        gray_face = gray_full[y0:y1_crop, x0:x1_crop]
        mean_luma = float(np.mean(gray_face)) if gray_face.size > 0 else 100.0
        lap_var = (
            float(cv2.Laplacian(cv2.resize(gray_face, (128, 128)), cv2.CV_64F).var())
            if gray_face.size > 0
            else 50.0
        )

        pass_quality = True
        quality_reason = ""
        if mean_luma < 30.0:
            pass_quality = False
            quality_reason = "Khuôn mặt bị thiếu sáng. Vui lòng đứng nơi đủ ánh sáng."
            val_quality = f"Thiếu sáng (Luma {int(mean_luma)})"
        elif mean_luma > 246.0:
            pass_quality = False
            quality_reason = "Khuôn mặt bị chói sáng mạnh. Vui lòng tránh ngược sáng."
            val_quality = f"Chói sáng (Luma {int(mean_luma)})"
        elif lap_var < 10.0:
            pass_quality = False
            quality_reason = "Ảnh khuôn mặt bị mờ rung. Vui lòng giữ yên điện thoại."
            val_quality = f"Mờ rung (Nét {round(lap_var, 1)})"
        else:
            val_quality = f"Đạt (Sáng {int(mean_luma)} | Nét {int(lap_var)})"

        checks = [
            {
                "id": "face_detect",
                "name": "1. Phát hiện mặt (YuNet DNN)",
                "passed": pass_detect,
                "value": val_detect,
            },
            {
                "id": "center_align",
                "name": "2. Căn tâm khung mô hình",
                "passed": pass_center,
                "value": val_center,
            },
            {
                "id": "size_ratio",
                "name": "3. Khoảng cách & Kích thước",
                "passed": pass_size,
                "value": val_size,
            },
            {
                "id": "frontal_pose",
                "name": pose_name,
                "passed": pass_pose,
                "value": val_pose,
            },
            {
                "id": "image_quality",
                "name": "5. Độ sáng & Độ nét (Laplacian)",
                "passed": pass_quality,
                "value": val_quality,
            },
        ]

        aligned = bool(
            pass_detect and pass_center and pass_size and pass_pose and pass_quality
        )
        if aligned:
            pose_labels = {
                "center": "Chính diện (nhìn thẳng)",
                "straight": "Chính diện (nhìn thẳng)",
                "left": "Quay sang Trái",
                "right": "Quay sang Phải",
                "up": "Ngẩng lên Trên",
                "down": "Cúi xuống Dưới",
            }
            lbl = pose_labels.get(pose_key, "Đa góc")
            detail_msg = f"✅ Đạt chuẩn góc {lbl}! Giữ yên để chụp..."
        else:
            detail_msg = (
                pose_reason
                or center_reason
                or size_reason
                or quality_reason
                or "Hãy đặt khuôn mặt khớp vào khung mô hình bầu dục."
            )

        pad_x = int(w_box * 0.10)
        pad_y = int(h_box * 0.10)
        cx1 = max(0, x - pad_x)
        cy1 = max(0, y - pad_y)
        cx2 = min(width, x + w_box + pad_x)
        cy2 = min(height, y + h_box + pad_y)
        face_crop_pil = img.crop((cx1, cy1, cx2, cy2)).resize(
            (64, 64), Image.Resampling.BICUBIC
        )

        meta: Dict[str, object] = {
            "width": width,
            "height": height,
            "aligned": aligned,
            "detail": detail_msg,
            "confidence": round(conf, 3),
            "cx": round(cx, 3),
            "cy": round(cy, 3),
            "sizeRatio": round(size_ratio, 3),
            "rollAngle": round(roll_deg, 1),
            "targetPose": pose_key,
            "yaw": round(yaw_metric, 3),
            "pitch": round(pitch_metric, 3),
            "brightness": round(mean_luma, 1),
            "sharpness": round(lap_var, 1),
            "bbox": bbox_norm,
            "landmarks": landmarks_norm,
            "checks": checks,
            "orig_detected_row": orig_detected_row,
            "bgr_full": bgr_full,
        }
        return face_crop_pil, meta

    def _validate_and_crop_face_in_guide(
        self, img: Image.Image, target_pose: str = "center"
    ) -> Tuple[Image.Image, Dict[str, object]]:
        """Kiểm tra khuôn mặt đạt đủ 5 thuật toán chuẩn trước khi trích xuất vector 512-D / 128-D."""
        face_crop_pil, meta = self.evaluate_face_frame(img, target_pose=target_pose)
        if not meta.get("aligned") or face_crop_pil is None:
            meta.pop("orig_detected_row", None)
            meta.pop("bgr_full", None)
            err = ValueError(str(meta.get("detail") or "Khuôn mặt chưa khớp khung mô hình."))
            setattr(err, "face_meta", meta)
            raise err
        return face_crop_pil, meta

    def check_face_guide(
        self, image_bytes: bytes, target_pose: str = "center"
    ) -> Dict[str, object]:
        """Trả về toàn bộ trạng thái 5 thuật toán kiểm tra khuôn mặt + 5 điểm mốc theo thời gian thực."""
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img).convert("RGB")
        _, meta = self.evaluate_face_frame(img, target_pose=target_pose)
        meta.pop("orig_detected_row", None)
        meta.pop("bgr_full", None)
        return meta

    def extract_face_embedding(
        self,
        image_bytes: bytes,
        target_dim: Optional[int] = None,
        target_pose: str = "center",
    ) -> Tuple[List[float], Dict[str, object]]:
        """
        Nhận ảnh chụp từ Camera sau của điện thoại (độ phân giải cao),
        bắt buộc khuôn mặt phải nằm đúng trong khung mô hình chuẩn (5/5 thuật toán),
        sau đó trích xuất vector đặc trưng (L2-normalized).
        - Nếu target_dim == 512: trích xuất vector không gian 512-D tương thích ngược.
        - Mặc định hoặc target_dim == 128: trích xuất SFace 128-D Deep CNN.
        """
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img).convert("RGB")
        width, height = img.size

        # Bước 1: Kiểm tra khuôn mặt đã đạt 5 thuật toán chuẩn hay chưa
        face_crop_pil, meta = self._validate_and_crop_face_in_guide(img, target_pose=target_pose)
        orig_row = meta.pop("orig_detected_row", None)
        bgr_full = meta.pop("bgr_full", None)

        # Bước 2: Trích xuất đặc trưng
        # 2a. Nếu yêu cầu 512-D hoặc cả SFace và FaceNet đều không sẵn sàng
        if target_dim == 512 or (not self.sface_ready and not self.facenet_ready):
            if self.facenet_ready and self.mtcnn is not None and self.facenet is not None:
                import torch  # type: ignore

                face_tensor = self.mtcnn(img)
                if face_tensor is None:
                    raise ValueError(
                        "Không tìm thấy khuôn mặt rõ nét trong khung mô hình. Vui lòng nhìn thẳng vào camera sau."
                    )
                if face_tensor.ndim == 3:
                    face_tensor = face_tensor.unsqueeze(0)
                with torch.no_grad():
                    emb = self.facenet(face_tensor).squeeze().cpu().numpy()
                return l2_normalize(emb), meta

            arr = np.asarray(face_crop_pil, dtype=np.float32) / 255.0
            if float(np.std(arr)) < 0.05:
                raise ValueError(
                    "Khung hình khuôn mặt thiếu độ tương phản. Vui lòng hướng camera sau vào khuôn mặt nơi đủ sáng."
                )

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
            return l2_normalize(emb_512), meta

        # 2b. Trích xuất bằng SFace Deep CNN (128-D) với 5-Landmark Affine Alignment
        if self.sface_ready and self.sface_recognizer is not None and bgr_full is not None and orig_row is not None:
            aligned_face = self.sface_recognizer.alignCrop(
                bgr_full, np.asarray(orig_row, dtype=np.float32)
            )
            feat = self.sface_recognizer.feature(aligned_face).flatten()
            return l2_normalize(feat), meta

        # 2c. Fallback FaceNet PyTorch nếu có
        if self.facenet_ready and self.mtcnn is not None and self.facenet is not None:
            import torch  # type: ignore

            face_tensor = self.mtcnn(img)
            if face_tensor is None:
                raise ValueError(
                    "Không tìm thấy khuôn mặt rõ nét trong khung mô hình. Vui lòng nhìn thẳng vào camera sau."
                )
            if face_tensor.ndim == 3:
                face_tensor = face_tensor.unsqueeze(0)
            with torch.no_grad():
                emb = self.facenet(face_tensor).squeeze().cpu().numpy()
            return l2_normalize(emb), meta

        raise ValueError("Không thể trích xuất đặc trưng khuôn mặt.")

