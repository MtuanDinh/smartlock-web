"""
FastAPI Biometric Server cho Smart Lock IoT:
- Chạy song song cả 2 cổng:
  + HTTPS (cổng 8443): `https://<LAN-IP>:8443/kiosk` -> Bắt buộc cho trình duyệt điện thoại (Chrome/Safari)
    cấp quyền `navigator.mediaDevices.getUserMedia` (WebRTC Mic VAD + Camera sau Full HD) qua mạng LAN.
  + HTTP  (cổng 8000): `http://<LAN-IP>:8000/kiosk`  -> Tự động điều hướng sang HTTPS 8443 khi mở trên điện thoại.
- Luồng xử lý Giọng nói mới:
  1. Điện thoại thu tiếng nói thực tế (lọc nhiễu VAD) -> Xử lý Transcript (`/api/biometrics/transcribe`) trước.
  2. Khi Đăng ký (Enroll): Tự động lấy Transcript người dùng vừa nói để lưu làm `voicePassphrase` lên Server/Firebase
     mà Admin không cần nhập câu lệnh thủ công.
  3. Khi Mở khóa (Verify): Bắt buộc phải nhận diện được Transcript thực tế từ câu nói của người dùng VÀ khớp cả
     nội dung câu nói lẫn giọng nói (192-D) thì mới chuyển sang xác thực khuôn mặt. Tuyệt đối không tự xác nhận khi im lặng.
"""

from __future__ import annotations

import asyncio
import datetime
import ipaddress
import logging
import os
import secrets
import socket
import time
from pathlib import Path
from typing import Any, Dict, Optional

import requests
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from engine import (
    BiometricEngine,
    compute_phrase_similarity,
    cosine_similarity,
    normalize_vietnamese_phrase,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("biometric.server")

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
CERT_FILE = BASE_DIR / "cert.pem"
KEY_FILE = BASE_DIR / "key.pem"


def _get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def ensure_self_signed_ssl_cert(lan_ip: str) -> bool:
    """
    Tạo chứng chỉ SSL tự ký (SAN IP + localhost) để trình duyệt trên điện thoại
    cho phép bật Camera sau & Microphone (Secure Context HTTPS) khi truy cập qua IP LAN.
    """
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name(
            [
                x509.NameAttribute(NameOID.COUNTRY_NAME, "VN"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SmartLock IoT"),
                x509.NameAttribute(NameOID.COMMON_NAME, lan_ip),
            ]
        )

        san_list = [
            x509.DNSName("localhost"),
            x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
        ]
        try:
            san_list.append(x509.IPAddress(ipaddress.ip_address(lan_ip)))
        except ValueError:
            pass

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now_utc - datetime.timedelta(days=1))
            .not_valid_after(now_utc + datetime.timedelta(days=3650))
            .add_extension(x509.SubjectAlternativeName(san_list), critical=False)
            .sign(key, hashes.SHA256())
        )

        KEY_FILE.write_bytes(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
        CERT_FILE.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
        logger.info("Generated SSL certificate for https://%s:8443/kiosk", lan_ip)
        return True
    except Exception as exc:
        logger.warning("Could not generate SSL certificate: %s", exc)
        return False


def _load_firebase_db_url() -> str:
    env_url = os.environ.get("VITE_FIREBASE_DATABASE_URL", "").strip()
    if env_url:
        return env_url.rstrip("/")

    for env_file in [ROOT_DIR / ".env.local", ROOT_DIR / ".env"]:
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if line.startswith("VITE_FIREBASE_DATABASE_URL="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val:
                        return val.rstrip("/")

    return "https://lock-iot-2a021-default-rtdb.asia-southeast1.firebasedatabase.app"


FIREBASE_DB_URL = _load_firebase_db_url()
engine = BiometricEngine()

app = FastAPI(
    title="SmartLock Biometric AI Server (SpeechBrain + ASR Transcript + FaceNet)",
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VOICE_SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 35.0


def fb_get(path: str) -> Any:
    url = f"{FIREBASE_DB_URL}/{path.lstrip('/')}.json"
    resp = requests.get(url, timeout=6)
    resp.raise_for_status()
    return resp.json()


def fb_put(path: str, data: Any) -> Any:
    url = f"{FIREBASE_DB_URL}/{path.lstrip('/')}.json"
    resp = requests.put(url, json=data, timeout=6)
    resp.raise_for_status()
    return resp.json()


def fb_patch(path: str, data: Dict[str, Any]) -> Any:
    url = f"{FIREBASE_DB_URL}/{path.lstrip('/')}.json"
    resp = requests.patch(url, json=data, timeout=6)
    resp.raise_for_status()
    return resp.json()


def fb_post(path: str, data: Any) -> Any:
    url = f"{FIREBASE_DB_URL}/{path.lstrip('/')}.json"
    resp = requests.post(url, json=data, timeout=6)
    resp.raise_for_status()
    return resp.json()


@app.get("/kiosk")
def serve_phone_kiosk() -> FileResponse:
    kiosk_path = BASE_DIR / "static" / "kiosk.html"
    if not kiosk_path.exists():
        raise HTTPException(status_code=404, detail="Kiosk UI file not found.")
    return FileResponse(
        kiosk_path,
        media_type="text/html",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/api/biometrics/status")
def get_biometric_status() -> Dict[str, Any]:
    lan_ip = _get_lan_ip()
    control = fb_get("SmartLock/Control") or {}
    biometric_mode = bool(control.get("Biometric_Mode", True))
    lockdown = bool(control.get("Lockdown", False))
    enroll_state = control.get("Biometric_Enroll") or {"active": False, "step": "idle"}

    return {
        "ok": True,
        "firebaseUrl": FIREBASE_DB_URL,
        "biometricMode": biometric_mode,
        "lockdown": lockdown,
        "enrollState": enroll_state,
        "lanIp": lan_ip,
        "kioskUrl": f"https://{lan_ip}:8443/kiosk",
        "kioskHttpUrl": f"http://{lan_ip}:8000/kiosk",
        "models": engine.get_status(),
    }


@app.get("/api/biometrics/kiosk-state")
def get_kiosk_state() -> Dict[str, Any]:
    lan_ip = _get_lan_ip()
    control = fb_get("SmartLock/Control") or {}
    biometric_mode = bool(control.get("Biometric_Mode", True))
    lockdown = bool(control.get("Lockdown", False))
    enroll = control.get("Biometric_Enroll") or {}
    is_enrolling = bool(enroll.get("active", False))

    return {
        "mode": "enroll" if is_enrolling else "verify",
        "lanIp": lan_ip,
        "httpsKioskUrl": f"https://{lan_ip}:8443/kiosk",
        "biometricMode": biometric_mode,
        "lockdown": lockdown,
        "enroll": {
            "active": is_enrolling,
            "userId": str(enroll.get("userId", "")),
            "userName": str(enroll.get("userName", "")),
            "target": str(enroll.get("target", "both")),
            "expectedPassphrase": str(enroll.get("expectedPassphrase", "")),
            "step": str(enroll.get("step", "idle")),
            "message": str(enroll.get("message", "")),
            "updatedAt": int(enroll.get("updatedAt", 0) or 0),
        },
    }


@app.post("/api/biometrics/transcribe")
async def transcribe_voice_audio(audio: UploadFile = File(...)) -> JSONResponse:
    """
    Bước xử lý Transcript từ âm thanh thu trên điện thoại trước khi gửi lưu/đối chiếu:
    - Kiểm tra đoạn thu có thực sự chứa giọng nói con người hay chỉ là tiếng ồn nền/im lặng.
    - Trả về văn bản tiếng Việt nhận diện được (`transcript`). Nếu không nói gì -> `hasSpeech: False, transcript: ""`.
    """
    audio_bytes = await audio.read()
    try:
        samples, sr = engine._decode_audio_bytes(audio_bytes)
        engine._extract_voiced_frames(samples, sr)
    except ValueError as exc:
        return JSONResponse(
            content={
                "ok": False,
                "hasSpeech": False,
                "transcript": "",
                "detail": str(exc),
            }
        )

    transcript = engine.transcribe_vietnamese(audio_bytes)
    if not transcript:
        return JSONResponse(
            content={
                "ok": False,
                "hasSpeech": False,
                "transcript": "",
                "detail": "Chưa nhận diện được câu nói tiếng Việt rõ ràng. Vui lòng nói to và rõ hơn.",
            }
        )

    return JSONResponse(
        content={
            "ok": True,
            "hasSpeech": True,
            "transcript": transcript,
        }
    )


@app.post("/api/biometrics/enroll-voice")
async def enroll_voice_from_phone(
    audio: UploadFile = File(...),
    userId: Optional[str] = Form(None),
    transcript: Optional[str] = Form(None),
    passphrase: Optional[str] = Form(None),
) -> JSONResponse:
    """
    Thu mẫu giọng nói từ điện thoại:
    - Nhận file âm thanh `audio` và `transcript` đã xử lý (hoặc tự động nhận diện từ `audio`).
    - Tự động lưu `transcript` người dùng vừa nói làm `voicePassphrase` mà Admin không cần nhập trước.
    """
    enroll = fb_get("SmartLock/Control/Biometric_Enroll") or {}
    target_user_id = (userId or str(enroll.get("userId", ""))).strip()
    target_user_name = str(enroll.get("userName", "")).strip()
    enroll_target = str(enroll.get("target", "voice")).strip()

    if not target_user_id:
        raise HTTPException(
            status_code=400, detail="Không xác định được thành viên cần thu giọng nói."
        )

    audio_bytes = await audio.read()
    try:
        voice_emb = engine.extract_voice_embedding(audio_bytes)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"ok": False, "detail": str(exc)})

    # Lấy transcript đã xử lý từ điện thoại gửi lên hoặc trích xuất trực tiếp bằng ASR
    spoken_text = normalize_vietnamese_phrase(transcript or "")
    if not spoken_text:
        spoken_text = engine.transcribe_vietnamese(audio_bytes)

    # Bắt buộc phải nhận diện được câu nói thực tế (tối thiểu 2 từ), tuyệt đối không tự bịa câu mặc định khi im lặng!
    words = spoken_text.split() if spoken_text else []
    if not spoken_text or len(words) < 2:
        msg = (
            f"Câu vừa nhận diện (\"{spoken_text}\") quá ngắn. Vui lòng nói một câu mật khẩu từ 2 từ trở lên!"
            if spoken_text
            else "Chưa nhận diện được câu nói rõ ràng. Vui lòng nói một câu mật khẩu (VD: \"mở cửa cho tôi\") vào mic điện thoại!"
        )
        if enroll.get("active"):
            fb_patch(
                "SmartLock/Control/Biometric_Enroll",
                {"message": msg, "updatedAt": int(time.time() * 1000)},
            )
        return JSONResponse(status_code=400, content={"ok": False, "detail": msg})

    final_passphrase = spoken_text
    now_ms = int(time.time() * 1000)

    fb_patch(
        f"SmartLock/Biometrics/{target_user_id}",
        {
            "voiceEmbedding": voice_emb,
            "voicePassphrase": final_passphrase,
            "updatedAt": now_ms,
        },
    )
    fb_patch(
        f"SmartLock/Users/{target_user_id}",
        {
            "hasVoice": True,
            "voicePassphrase": final_passphrase,
            "biometricUpdatedAt": now_ms,
        },
    )

    if enroll.get("active") and str(enroll.get("userId")) == target_user_id:
        if enroll_target == "both":
            fb_patch(
                "SmartLock/Control/Biometric_Enroll",
                {
                    "step": "waiting_face",
                    "expectedPassphrase": final_passphrase,
                    "message": f"Đã lưu giọng nói & câu mật khẩu: \"{final_passphrase}\"! Đang mở Camera sau HD để chụp khuôn mặt...",
                    "updatedAt": now_ms,
                },
            )
            next_step = "waiting_face"
        else:
            fb_patch(
                "SmartLock/Control/Biometric_Enroll",
                {
                    "active": False,
                    "step": "completed",
                    "expectedPassphrase": final_passphrase,
                    "message": f"Đã đăng ký giọng nói với câu mật khẩu \"{final_passphrase}\" cho {target_user_name} thành công!",
                    "updatedAt": now_ms,
                },
            )
            next_step = "completed"
    else:
        next_step = "completed"

    logger.info(
        "Enrolled voice for user=%s (%s) with transcript passphrase='%s'",
        target_user_id,
        target_user_name,
        final_passphrase,
    )

    return JSONResponse(
        content={
            "ok": True,
            "userId": target_user_id,
            "voicePassphrase": final_passphrase,
            "spokenText": final_passphrase,
            "embeddingDim": len(voice_emb),
            "nextStep": next_step,
        }
    )


@app.post("/api/biometrics/check-face-frame")
async def check_face_frame_alignment(
    image: UploadFile = File(...),
) -> JSONResponse:
    """
    Kiểm tra trực tiếp theo thời gian thực (trong lúc đếm ngược 10s) toàn bộ 5 thuật toán
    khuôn mặt đạt chuẩn (YuNet DNN + Căn tâm + Khoảng cách + Tư thế 5 điểm mốc + Độ sáng/nét).
    """
    image_bytes = await image.read()
    try:
        meta = engine.check_face_guide(image_bytes)
        aligned = bool(meta.get("aligned", False))
        return JSONResponse(
            content={
                "ok": aligned,
                "aligned": aligned,
                "meta": meta,
                "checks": meta.get("checks", []),
                "bbox": meta.get("bbox"),
                "landmarks": meta.get("landmarks", []),
                "detail": str(
                    meta.get("detail")
                    or (
                        "✅ Đạt chuẩn 5/5 thuật toán sinh trắc học! Giữ yên khuôn mặt..."
                        if aligned
                        else "Hãy đặt khuôn mặt khớp vào khung mô hình bầu dục."
                    )
                ),
            }
        )
    except Exception as exc:
        logger.warning("check-face-frame error: %s", exc)
        return JSONResponse(
            content={
                "ok": False,
                "aligned": False,
                "checks": [],
                "bbox": None,
                "landmarks": [],
                "detail": str(exc),
            }
        )


@app.post("/api/biometrics/enroll-face")
async def enroll_face_from_phone(
    image: UploadFile = File(...),
    userId: Optional[str] = Form(None),
) -> JSONResponse:
    """
    Lưu khuôn mặt từ Camera sau HD lên Server:
    - Chờ đủ thời gian chuẩn bị để người dùng kịp căn chỉnh khuôn mặt vào khung mô hình.
    - Bắt buộc khuôn mặt phải đạt cả 5 thuật toán kiểm tra chuẩn (YuNet 5-Landmark + Căn tâm + Tỷ lệ + Trực diện + Độ nét).
    """
    enroll = fb_get("SmartLock/Control/Biometric_Enroll") or {}
    target_user_id = (userId or str(enroll.get("userId", ""))).strip()
    target_user_name = str(enroll.get("userName", "")).strip()

    if not target_user_id:
        raise HTTPException(
            status_code=400, detail="Không xác định được thành viên cần chụp khuôn mặt."
        )

    image_bytes = await image.read()
    now_ms = int(time.time() * 1000)

    try:
        face_emb, face_meta = engine.extract_face_embedding(image_bytes)
    except ValueError as exc:
        fail_meta = getattr(exc, "face_meta", {}) or {}
        return JSONResponse(
            status_code=400,
            content={
                "ok": False,
                "countingDown": False,
                "aligned": False,
                "meta": fail_meta,
                "checks": fail_meta.get("checks", []),
                "bbox": fail_meta.get("bbox"),
                "landmarks": fail_meta.get("landmarks", []),
                "detail": str(exc),
            },
        )

    w_res = int(face_meta.get("width", 1280))
    h_res = int(face_meta.get("height", 720))

    fb_patch(
        f"SmartLock/Biometrics/{target_user_id}",
        {
            "faceEmbedding": face_emb,
            "faceResolution": f"{w_res}x{h_res}",
            "updatedAt": now_ms,
        },
    )
    fb_patch(
        f"SmartLock/Users/{target_user_id}",
        {
            "hasFace": True,
            "biometricUpdatedAt": now_ms,
        },
    )

    if enroll.get("active") and str(enroll.get("userId")) == target_user_id:
        fb_patch(
            "SmartLock/Control/Biometric_Enroll",
            {
                "active": False,
                "step": "completed",
                "message": f"Đã lưu khuôn mặt chuẩn HD ({w_res}x{h_res}) cho {target_user_name} thành công!",
                "updatedAt": now_ms,
            },
        )

    logger.info(
        "Enrolled face HD (%dx%d) for user=%s (%s)",
        w_res,
        h_res,
        target_user_id,
        target_user_name,
    )

    return JSONResponse(
        content={
            "ok": True,
            "userId": target_user_id,
            "aligned": True,
            "embeddingDim": len(face_emb),
            "resolution": {"width": w_res, "height": h_res},
            "checks": face_meta.get("checks", []),
            "bbox": face_meta.get("bbox"),
            "landmarks": face_meta.get("landmarks", []),
            "nextStep": "completed",
        }
    )


@app.post("/api/biometrics/verify-voice")
async def verify_voice_step1(
    audio: UploadFile = File(...),
    transcript: Optional[str] = Form(None),
) -> JSONResponse:
    """
    Bước 1 mở khóa bằng Giọng nói:
    - BẮT BUỘC phải có `spoken_text` (Transcript nhận diện được từ tiếng nói thực tế).
    - Nếu người dùng không nói gì hoặc không nhận diện được chữ (`spoken_text == ""`),
      từ chối ngay lập tức (`matched: False, silence: True`), TUYỆT ĐỐI không tự gán câu mật khẩu đã lưu!
    - Khi có `spoken_text`, kiểm tra đồng thời độ khớp câu nói (`phraseScore >= 0.76`)
      VÀ độ khớp đặc trưng giọng nói 192 chiều (`voiceScore >= 0.70`).
    """
    control = fb_get("SmartLock/Control") or {}
    if bool(control.get("Lockdown", False)):
        return JSONResponse(
            content={
                "matched": False,
                "reason": "Hệ thống đang ở chế độ KHÓA CHẶT khẩn cấp!",
            }
        )
    if not bool(control.get("Biometric_Mode", True)):
        return JSONResponse(
            content={
                "matched": False,
                "reason": "Tính năng mở khóa Sinh trắc học hiện đang tắt.",
            }
        )

    audio_bytes = await audio.read()
    try:
        probe_voice = engine.extract_voice_embedding(audio_bytes)
    except ValueError as exc:
        return JSONResponse(
            content={
                "matched": False,
                "silence": True,
                "spokenText": "",
                "reason": str(exc),
            }
        )

    spoken_text = normalize_vietnamese_phrase(transcript or "")
    if not spoken_text:
        spoken_text = engine.transcribe_vietnamese(audio_bytes)

    # FIX TRIỆT ĐỂ: Nếu không nói gì hoặc không nhận diện được câu nói -> Dừng ngay lập tức!
    if not spoken_text:
        return JSONResponse(
            content={
                "matched": False,
                "silence": True,
                "voiceScore": 0.0,
                "phraseScore": 0.0,
                "spokenText": "",
                "reason": "Chưa nhận diện được câu nói rõ ràng. Hãy nói câu mật khẩu đã đăng ký vào điện thoại.",
            }
        )

    users_map = fb_get("SmartLock/Users") or {}
    bio_map = fb_get("SmartLock/Biometrics") or {}

    best_user_id: Optional[str] = None
    best_user_name: str = ""
    best_voice_score: float = 0.0
    best_phrase_score: float = 0.0
    best_combined_score: float = -1.0

    for uid, udata in users_map.items():
        if not isinstance(udata, dict) or udata.get("status") == "disabled":
            continue
        bdata = bio_map.get(uid)
        if not isinstance(bdata, dict):
            continue
        saved_voice = bdata.get("voiceEmbedding")
        if not isinstance(saved_voice, list) or len(saved_voice) == 0:
            continue

        expected_phrase = normalize_vietnamese_phrase(
            str(bdata.get("voicePassphrase") or udata.get("voicePassphrase") or "")
        )
        if not expected_phrase:
            continue

        v_score = max(0.0, cosine_similarity(probe_voice, saved_voice))
        p_score = compute_phrase_similarity(spoken_text, expected_phrase)
        combined = 0.55 * p_score + 0.45 * v_score

        if combined > best_combined_score:
            best_combined_score = combined
            best_voice_score = v_score
            best_phrase_score = p_score
            best_user_id = uid
            best_user_name = str(udata.get("name", uid))

    if (
        best_user_id is None
        or best_phrase_score < engine.PASSPHRASE_THRESHOLD
        or best_voice_score < engine.VOICE_THRESHOLD
    ):
        reason_parts = []
        if best_phrase_score < engine.PASSPHRASE_THRESHOLD:
            reason_parts.append(
                f"Câu nói \"{spoken_text}\" không khớp với mật khẩu đã lưu ({best_phrase_score*100:.0f}%)"
            )
        if best_voice_score < engine.VOICE_THRESHOLD:
            reason_parts.append(
                f"Giọng nói chưa khớp ({best_voice_score*100:.0f}%)"
            )
        return JSONResponse(
            content={
                "matched": False,
                "silence": False,
                "voiceScore": round(best_voice_score, 3),
                "phraseScore": round(best_phrase_score, 3),
                "spokenText": spoken_text,
                "reason": " • ".join(reason_parts)
                or "Giọng nói hoặc câu mật khẩu không khớp.",
            }
        )

    user_bio = bio_map.get(best_user_id) or {}
    if (
        not isinstance(user_bio.get("faceEmbedding"), list)
        or len(user_bio["faceEmbedding"]) == 0
    ):
        return JSONResponse(
            content={
                "matched": False,
                "silence": False,
                "voiceScore": round(best_voice_score, 3),
                "phraseScore": round(best_phrase_score, 3),
                "spokenText": spoken_text,
                "reason": f"Thành viên {best_user_name} chưa đăng ký dữ liệu khuôn mặt để xác thực Bước 2.",
            }
        )

    token = secrets.token_urlsafe(24)
    VOICE_SESSIONS[token] = {
        "userId": best_user_id,
        "userName": best_user_name,
        "voiceScore": round(best_voice_score, 3),
        "phraseScore": round(best_phrase_score, 3),
        "spokenText": spoken_text,
        "expiresAt": time.time() + SESSION_TTL_SECONDS,
    }

    logger.info(
        "Voice Step 1 MATCHED user=%s (%s) spoken='%s' voice=%.3f phrase=%.3f",
        best_user_id,
        best_user_name,
        spoken_text,
        best_voice_score,
        best_phrase_score,
    )

    return JSONResponse(
        content={
            "matched": True,
            "sessionToken": token,
            "userId": best_user_id,
            "userName": best_user_name,
            "voiceScore": round(best_voice_score, 3),
            "phraseScore": round(best_phrase_score, 3),
            "spokenText": spoken_text,
            "expiresInSeconds": int(SESSION_TTL_SECONDS),
        }
    )


@app.post("/api/biometrics/verify-face")
async def verify_face_step2(
    sessionToken: str = Form(...),
    image: UploadFile = File(...),
) -> JSONResponse:
    session = VOICE_SESSIONS.get(sessionToken)
    if not session or time.time() > float(session["expiresAt"]):
        VOICE_SESSIONS.pop(sessionToken, None)
        return JSONResponse(
            status_code=401,
            content={
                "unlocked": False,
                "expired": True,
                "reason": "Phiên xác thực giọng nói đã hết hạn (35s). Vui lòng đọc lại câu mật khẩu.",
            },
        )

    user_id = str(session["userId"])
    user_name = str(session["userName"])

    image_bytes = await image.read()
    try:
        probe_face, face_meta = engine.extract_face_embedding(image_bytes)
    except ValueError as exc:
        fail_meta = getattr(exc, "face_meta", {}) or {}
        return JSONResponse(
            content={
                "unlocked": False,
                "expired": False,
                "aligned": False,
                "checks": fail_meta.get("checks", []),
                "bbox": fail_meta.get("bbox"),
                "landmarks": fail_meta.get("landmarks", []),
                "reason": str(exc),
            }
        )

    user_bio = fb_get(f"SmartLock/Biometrics/{user_id}") or {}
    saved_face = user_bio.get("faceEmbedding")
    if not isinstance(saved_face, list) or len(saved_face) == 0:
        return JSONResponse(
            content={
                "unlocked": False,
                "expired": False,
                "aligned": True,
                "checks": face_meta.get("checks", []),
                "bbox": face_meta.get("bbox"),
                "landmarks": face_meta.get("landmarks", []),
                "reason": "Không tìm thấy mẫu khuôn mặt đã lưu của thành viên.",
            }
        )

    face_score = cosine_similarity(probe_face, saved_face)
    if face_score < engine.FACE_THRESHOLD:
        return JSONResponse(
            content={
                "unlocked": False,
                "expired": False,
                "aligned": True,
                "checks": face_meta.get("checks", []),
                "bbox": face_meta.get("bbox"),
                "landmarks": face_meta.get("landmarks", []),
                "faceScore": round(max(0.0, face_score), 3),
                "reason": f"Khuôn mặt chưa khớp với {user_name} ({max(0.0, face_score)*100:.0f}%). Đang tiếp tục quét...",
            }
        )

    VOICE_SESSIONS.pop(sessionToken, None)
    now_ms = int(time.time() * 1000)

    fb_put("SmartLock/Control/Remote_Open", False)
    fb_put("SmartLock/Control/Remote_Open", True)
    fb_post(
        "SmartLock/Logs",
        {
            "action": "Mở bằng Sinh trắc học",
            "user": user_name,
            "timestamp": now_ms,
        },
    )

    return JSONResponse(
        content={
            "unlocked": True,
            "aligned": True,
            "userId": user_id,
            "userName": user_name,
            "voiceScore": session["voiceScore"],
            "phraseScore": session["phraseScore"],
            "faceScore": round(face_score, 3),
            "checks": face_meta.get("checks", []),
            "bbox": face_meta.get("bbox"),
            "landmarks": face_meta.get("landmarks", []),
            "resolution": {
                "width": int(face_meta.get("width", 1280)),
                "height": int(face_meta.get("height", 720)),
            },
        }
    )


def _free_port_if_in_use(port: int) -> None:
    """
    Tự động giải phóng cổng (8000 / 8443) nếu có tiến trình cũ đang chiếm giữ,
    tránh hoàn toàn lỗi OSError [Errno 10048] khi khởi động lại server.
    """
    import subprocess

    my_pid = os.getpid()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.3)
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return
    except Exception:
        return

    try:
        out = subprocess.check_output(
            ["netstat", "-ano", "-p", "TCP"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        pids_to_kill = set()
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 5 and "LISTENING" in parts[3].upper():
                local_addr = parts[1]
                if local_addr.endswith(f":{port}"):
                    try:
                        pid = int(parts[4])
                        if pid > 0 and pid != my_pid:
                            pids_to_kill.add(pid)
                    except ValueError:
                        pass
        for pid in pids_to_kill:
            logger.info("Releasing port %d from previous process PID=%d...", port, pid)
            subprocess.run(
                ["taskkill", "/F", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        if pids_to_kill:
            time.sleep(0.4)
    except Exception as exc:
        logger.warning("Could not auto-free port %d: %s", port, exc)


async def _serve_dual_http_and_https() -> None:
    _free_port_if_in_use(8000)
    _free_port_if_in_use(8443)

    lan_ip = _get_lan_ip()
    has_ssl = ensure_self_signed_ssl_cert(lan_ip)

    http_config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
    http_server = uvicorn.Server(http_config)

    if has_ssl and CERT_FILE.exists() and KEY_FILE.exists():
        https_config = uvicorn.Config(
            app,
            host="0.0.0.0",
            port=8443,
            ssl_certfile=str(CERT_FILE),
            ssl_keyfile=str(KEY_FILE),
            log_level="info",
        )
        https_server = uvicorn.Server(https_config)
        logger.info(
            " Dual-stack active: HTTP on http://%s:8000/kiosk AND HTTPS on https://%s:8443/kiosk",
            lan_ip,
            lan_ip,
        )
        tasks = [
            asyncio.create_task(http_server.serve()),
            asyncio.create_task(https_server.serve()),
        ]
        try:
            await asyncio.gather(*tasks, return_exceptions=True)
        except (KeyboardInterrupt, asyncio.CancelledError, SystemExit):
            for t in tasks:
                t.cancel()
    else:
        try:
            await http_server.serve()
        except (KeyboardInterrupt, asyncio.CancelledError, SystemExit):
            pass


if __name__ == "__main__":
    try:
        asyncio.run(_serve_dual_http_and_https())
    except (KeyboardInterrupt, SystemExit):
        pass

