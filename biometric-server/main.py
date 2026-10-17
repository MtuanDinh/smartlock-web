"""
FastAPI Biometric Server cho Smart Lock IoT:
- Cung cấp giao diện Kiosk cô lập cho điện thoại tại `/kiosk` (chỉ làm Camera sau HD + Mic thu âm, không có quyền Admin).
- Đồng bộ trực tiếp với Firebase Realtime Database:
  + Luồng 1 (Enroll từ Điện thoại khi Admin bấm Thêm/Đổi trên Web): Theo dõi `SmartLock/Control/Biometric_Enroll`.
  + Luồng 2 (Verify 2 bước tự động mở khóa): Xác thực Giọng nói + Câu nói mật khẩu (SpeechBrain + ASR) -> Xác thực Khuôn mặt từ Camera sau HD (FaceNet) -> Bật `Remote_Open = true`.
"""

from __future__ import annotations

import logging
import os
import secrets
import socket
import time
from pathlib import Path
from typing import Any, Dict, Optional

import requests
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
    title="SmartLock Biometric AI Server (SpeechBrain + ASR + FaceNet)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lưu các phiên đã qua Bước 1 (Giọng nói + Câu mật khẩu) chờ Bước 2 (Khuôn mặt Camera sau)
# sessionToken -> { userId, userName, voiceScore, phraseScore, spokenText, expiresAt }
VOICE_SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 35.0


def _get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


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


def fb_delete(path: str) -> None:
    url = f"{FIREBASE_DB_URL}/{path.lstrip('/')}.json"
    resp = requests.delete(url, timeout=6)
    resp.raise_for_status()


# =============================================================================
# GIAO DIỆN ĐIỆN THOẠI KIOSK (/kiosk) — CÔ LẬP HOÀN TOÀN KHỎI WEB ADMIN
# =============================================================================
@app.get("/kiosk")
def serve_phone_kiosk() -> FileResponse:
    kiosk_path = BASE_DIR / "static" / "kiosk.html"
    if not kiosk_path.exists():
        raise HTTPException(status_code=404, detail="Kiosk UI file not found.")
    return FileResponse(kiosk_path, media_type="text/html")


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
        "kioskUrl": f"http://{lan_ip}:8000/kiosk",
        "models": engine.get_status(),
    }


@app.get("/api/biometrics/kiosk-state")
def get_kiosk_state() -> Dict[str, Any]:
    """
    Endpoint dành riêng cho Điện thoại Kiosk (/kiosk) hỏi trạng thái mỗi 1.2 giây:
    - Nếu Admin đang bật lệnh thu mẫu tại `SmartLock/Control/Biometric_Enroll.active == true`,
      điện thoại tự động chuyển sang chế độ ĐĂNG KÝ (thu giọng nói / chụp khuôn mặt bằng cam sau HD).
    - Ngược lại, điện thoại ở chế độ TRỰC MỞ KHÓA tự động (Hands-free VAD + Rear Camera Face Scan).
    """
    control = fb_get("SmartLock/Control") or {}
    biometric_mode = bool(control.get("Biometric_Mode", True))
    lockdown = bool(control.get("Lockdown", False))
    enroll = control.get("Biometric_Enroll") or {}
    is_enrolling = bool(enroll.get("active", False))

    return {
        "mode": "enroll" if is_enrolling else "verify",
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


# =============================================================================
# LUỒNG A: ĐĂNG KÝ / CẬP NHẬT GIỌNG NÓI & KHUÔN MẶT TỪ ĐIỆN THOẠI
# =============================================================================
@app.post("/api/biometrics/enroll-voice")
async def enroll_voice_from_phone(
    audio: UploadFile = File(...),
    userId: Optional[str] = Form(None),
    passphrase: Optional[str] = Form(None),
) -> JSONResponse:
    """
    Nhận file ghi âm 16kHz WAV từ mic điện thoại khi đang ở chế độ Đăng ký:
    1. Trích xuất vector 192 chiều bằng SpeechBrain.
    2. Nhận diện câu nói mật khẩu tiếng Việt bằng ASR (hoặc dùng câu mật khẩu Admin đã nhập).
    3. Lưu vào `/SmartLock/Biometrics/{userId}` và cập nhật `/SmartLock/Users/{userId}`.
    4. Nếu `target == 'both'`, chuyển bước trên điện thoại sang `waiting_face` (chụp cam sau HD).
    """
    enroll = fb_get("SmartLock/Control/Biometric_Enroll") or {}
    target_user_id = (userId or str(enroll.get("userId", ""))).strip()
    target_user_name = str(enroll.get("userName", "")).strip()
    enroll_target = str(enroll.get("target", "voice")).strip()
    expected_phrase = normalize_vietnamese_phrase(
        passphrase or str(enroll.get("expectedPassphrase", ""))
    )

    if not target_user_id:
        raise HTTPException(status_code=400, detail="Không xác định được thành viên cần thu giọng nói.")

    audio_bytes = await audio.read()
    try:
        voice_emb = engine.extract_voice_embedding(audio_bytes)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"ok": False, "detail": str(exc)})

    spoken_text = engine.transcribe_vietnamese(audio_bytes)

    # Nếu Admin đã chỉ định câu mật khẩu trước, kiểm tra xem người dùng có đọc đúng câu đó không
    if expected_phrase and spoken_text:
        sim = compute_phrase_similarity(spoken_text, expected_phrase)
        if sim < 0.65:
            msg = f"Câu vừa đọc (\"{spoken_text}\") chưa khớp với câu mật khẩu yêu cầu (\"{expected_phrase}\"). Vui lòng đọc lại!"
            if enroll.get("active"):
                fb_patch(
                    "SmartLock/Control/Biometric_Enroll",
                    {"message": msg, "updatedAt": int(time.time() * 1000)},
                )
            return JSONResponse(status_code=400, content={"ok": False, "detail": msg})
        final_passphrase = expected_phrase
    else:
        final_passphrase = (
            expected_phrase
            or spoken_text
            or normalize_vietnamese_phrase(f"mở cửa cho {target_user_name or target_user_id}")
        )

    now_ms = int(time.time() * 1000)

    # Lưu vào /SmartLock/Biometrics/{userId} và /SmartLock/Users/{userId}
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

    # Cập nhật trạng thái điều khiển phiên thu mẫu trên điện thoại
    if enroll.get("active") and str(enroll.get("userId")) == target_user_id:
        if enroll_target == "both":
            fb_patch(
                "SmartLock/Control/Biometric_Enroll",
                {
                    "step": "waiting_face",
                    "expectedPassphrase": final_passphrase,
                    "message": f"Đã thu giọng nói (\"{final_passphrase}\")! Đang mở Camera sau HD để chụp khuôn mặt...",
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
                    "message": f"Đã đăng ký giọng nói & câu mật khẩu cho {target_user_name} thành công!",
                    "updatedAt": now_ms,
                },
            )
            next_step = "completed"
    else:
        next_step = "completed"

    return JSONResponse(
        content={
            "ok": True,
            "userId": target_user_id,
            "voicePassphrase": final_passphrase,
            "spokenText": spoken_text or final_passphrase,
            "embeddingDim": len(voice_emb),
            "nextStep": next_step,
        }
    )


@app.post("/api/biometrics/enroll-face")
async def enroll_face_from_phone(
    image: UploadFile = File(...),
    userId: Optional[str] = Form(None),
) -> JSONResponse:
    """
    Nhận ảnh chụp độ phân giải cao từ Camera sau của điện thoại khi đang ở chế độ Đăng ký:
    1. Phát hiện khuôn mặt & trích xuất vector 512 chiều bằng FaceNet.
    2. Lưu vào `/SmartLock/Biometrics/{userId}` và cập nhật `/SmartLock/Users/{userId}`.
    3. Hoàn tất phiên `Biometric_Enroll` (`active = false, step = 'completed'`).
    """
    enroll = fb_get("SmartLock/Control/Biometric_Enroll") or {}
    target_user_id = (userId or str(enroll.get("userId", ""))).strip()
    target_user_name = str(enroll.get("userName", "")).strip()

    if not target_user_id:
        raise HTTPException(status_code=400, detail="Không xác định được thành viên cần chụp khuôn mặt.")

    image_bytes = await image.read()
    try:
        face_emb, resolution = engine.extract_face_embedding(image_bytes)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"ok": False, "detail": str(exc)})

    now_ms = int(time.time() * 1000)

    fb_patch(
        f"SmartLock/Biometrics/{target_user_id}",
        {
            "faceEmbedding": face_emb,
            "faceResolution": f"{resolution['width']}x{resolution['height']}",
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
                "message": f"Đã lưu khuôn mặt HD ({resolution['width']}x{resolution['height']}) cho {target_user_name} thành công!",
                "updatedAt": now_ms,
            },
        )

    return JSONResponse(
        content={
            "ok": True,
            "userId": target_user_id,
            "embeddingDim": len(face_emb),
            "resolution": resolution,
            "nextStep": "completed",
        }
    )


# =============================================================================
# LUỒNG B: XÁC THỰC KÉP 2 BƯỚC KHÔNG CHẠM ĐỂ MỞ KHÓA TỪ ĐIỆN THOẠI KIOSK
# =============================================================================
@app.post("/api/biometrics/verify-voice")
async def verify_voice_step1(audio: UploadFile = File(...)) -> JSONResponse:
    """
    Bước 1 (Tự động qua VAD trên điện thoại):
    - Kiểm tra đồng thời:
      1. Vector giọng nói 192-D từ SpeechBrain khớp với thành viên đang `active`.
      2. Câu nói tiếng Việt nhận diện qua ASR khớp với `voicePassphrase` đã lưu của thành viên đó.
    - Chỉ khi cả 2 cùng khớp mới cấp `sessionToken` để điện thoại bật Camera sau HD quét khuôn mặt.
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
        return JSONResponse(content={"matched": False, "reason": str(exc)})

    spoken_text = engine.transcribe_vietnamese(audio_bytes)

    users_map = fb_get("SmartLock/Users") or {}
    bio_map = fb_get("SmartLock/Biometrics") or {}

    best_user_id: Optional[str] = None
    best_user_name: str = ""
    best_voice_score: float = -1.0
    best_phrase_score: float = 0.0
    best_expected_phrase: str = ""

    for uid, udata in users_map.items():
        if not isinstance(udata, dict) or udata.get("status") == "disabled":
            continue
        bdata = bio_map.get(uid)
        if not isinstance(bdata, dict):
            continue
        saved_voice = bdata.get("voiceEmbedding")
        if not isinstance(saved_voice, list) or len(saved_voice) == 0:
            continue

        v_score = cosine_similarity(probe_voice, saved_voice)
        expected_phrase = normalize_vietnamese_phrase(
            str(bdata.get("voicePassphrase") or udata.get("voicePassphrase") or "")
        )

        if expected_phrase:
            if spoken_text:
                p_score = compute_phrase_similarity(spoken_text, expected_phrase)
            else:
                # Nếu ASR không có internet tạm thời, yêu cầu điểm giọng nói SpeechBrain cực cao (>= 0.82)
                p_score = 0.80 if v_score >= 0.82 else 0.0
        else:
            p_score = 1.0

        if v_score > best_voice_score:
            best_voice_score = v_score
            best_phrase_score = p_score
            best_user_id = uid
            best_user_name = str(udata.get("name", uid))
            best_expected_phrase = expected_phrase

    if (
        best_user_id is None
        or best_voice_score < engine.VOICE_THRESHOLD
        or best_phrase_score < engine.PASSPHRASE_THRESHOLD
    ):
        reason_parts = []
        if best_voice_score < engine.VOICE_THRESHOLD:
            reason_parts.append(f"Giọng nói chưa khớp ({max(0.0, best_voice_score)*100:.0f}%)")
        elif best_phrase_score < engine.PASSPHRASE_THRESHOLD:
            reason_parts.append(
                f"Câu mật khẩu chưa đúng (Nghe được: \"{spoken_text or '...'}\")"
            )
        return JSONResponse(
            content={
                "matched": False,
                "voiceScore": round(max(0.0, best_voice_score), 3),
                "phraseScore": round(best_phrase_score, 3),
                "spokenText": spoken_text,
                "reason": " • ".join(reason_parts) or "Giọng nói hoặc câu mật khẩu không khớp.",
            }
        )

    # Kiểm tra thành viên này đã đăng ký khuôn mặt chưa
    user_bio = bio_map.get(best_user_id) or {}
    if not isinstance(user_bio.get("faceEmbedding"), list) or len(user_bio["faceEmbedding"]) == 0:
        return JSONResponse(
            content={
                "matched": False,
                "reason": f"Thành viên {best_user_name} chưa đăng ký dữ liệu khuôn mặt để xác thực Bước 2.",
            }
        )

    token = secrets.token_urlsafe(24)
    VOICE_SESSIONS[token] = {
        "userId": best_user_id,
        "userName": best_user_name,
        "voiceScore": round(best_voice_score, 3),
        "phraseScore": round(best_phrase_score, 3),
        "spokenText": spoken_text or best_expected_phrase,
        "expiresAt": time.time() + SESSION_TTL_SECONDS,
    }

    return JSONResponse(
        content={
            "matched": True,
            "sessionToken": token,
            "userId": best_user_id,
            "userName": best_user_name,
            "voiceScore": round(best_voice_score, 3),
            "phraseScore": round(best_phrase_score, 3),
            "spokenText": spoken_text or best_expected_phrase,
            "expiresInSeconds": int(SESSION_TTL_SECONDS),
        }
    )


@app.post("/api/biometrics/verify-face")
async def verify_face_step2(
    sessionToken: str = Form(...),
    image: UploadFile = File(...),
) -> JSONResponse:
    """
    Bước 2 (Tự động chụp từ Camera sau HD của điện thoại):
    - Kiểm tra `sessionToken` từ Bước 1 còn hiệu lực.
    - Trích xuất vector 512-D bằng FaceNet từ khung hình Camera sau độ phân giải cao.
    - So khớp 1:1 với `faceEmbedding` của đúng thành viên đã qua Bước 1.
    - Nếu đạt ngưỡng: Gửi tín hiệu mở khóa `/SmartLock/Control/Remote_Open = true` và ghi Log.
    """
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
        probe_face, resolution = engine.extract_face_embedding(image_bytes)
    except ValueError as exc:
        return JSONResponse(
            content={
                "unlocked": False,
                "expired": False,
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
                "reason": "Không tìm thấy mẫu khuôn mặt đã lưu của thành viên.",
            }
        )

    face_score = cosine_similarity(probe_face, saved_face)
    if face_score < engine.FACE_THRESHOLD:
        return JSONResponse(
            content={
                "unlocked": False,
                "expired": False,
                "faceScore": round(max(0.0, face_score), 3),
                "reason": f"Khuôn mặt chưa khớp với {user_name} ({max(0.0, face_score)*100:.0f}%). Đang tiếp tục quét...",
            }
        )

    # Xác thực 2 bước thành công -> Xóa sessionToken, kích hoạt Remote_Open và ghi nhật ký
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
            "userId": user_id,
            "userName": user_name,
            "voiceScore": session["voiceScore"],
            "phraseScore": session["phraseScore"],
            "faceScore": round(face_score, 3),
            "resolution": resolution,
        }
    )


if __name__ == "__main__":
    import uvicorn  # type: ignore

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
