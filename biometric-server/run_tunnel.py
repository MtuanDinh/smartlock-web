"""
Tiện ích tự động chạy Cloudflare Tunnel cho Biometric Server:
1. Kiểm tra / Tự động tải `cloudflared.exe` chính hãng từ Cloudflare GitHub nếu chưa có.
2. Mở Quick Tunnel trỏ vào `http://127.0.0.1:8000` (Miễn phí, không cần đăng ký tài khoản Cloudflare).
3. Tự động lấy URL HTTPS (vd: `https://xxxx.trycloudflare.com/kiosk`) và đăng ký lên Firebase Realtime Database.
4. Web Admin trên GitHub Pages (`<user>.github.io`) tự động nhận diện và hiển thị mã QR cho điện thoại quét vào!
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
CLOUDFLARED_WIN_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
CLOUDFLARED_BIN_NAME = "cloudflared.exe" if sys.platform == "win32" else "cloudflared"


def find_or_download_cloudflared() -> Path:
    # 1. Kiểm tra trong PATH hệ thống
    in_path = shutil.which("cloudflared")
    if in_path:
        return Path(in_path)

    # 2. Kiểm tra trong thư mục hiện tại
    local_bin = BASE_DIR / CLOUDFLARED_BIN_NAME
    if local_bin.exists():
        return local_bin

    # 3. Tự động tải nếu trên Windows
    if sys.platform == "win32":
        print(" [1/3] Chưa tìm thấy cloudflared.exe. Đang tự động tải về từ Cloudflare Releases...")
        try:
            req = urllib.request.Request(
                CLOUDFLARED_WIN_URL,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            with urllib.request.urlopen(req) as response, open(local_bin, "wb") as out_file:
                shutil.copyfileobj(response, out_file)
            print(" [1/3] Đã tải cloudflared.exe thành công!")
            return local_bin
        except Exception as exc:
            print(f" [CẢNH BÁO] Không thể tự động tải: {exc}")
            print(f"       Vui lòng tải thủ công file: {CLOUDFLARED_WIN_URL}")
            print(f"       và đặt vào thư mục: {BASE_DIR}")
            sys.exit(1)
    else:
        print(" [LƯU Ý] Trên Linux/macOS, hãy cài đặt cloudflared bằng: brew install cloudflared hoặc apt install cloudflared")
        sys.exit(1)


def notify_server(kiosk_url: str) -> None:
    """Báo cho Biometric server local cập nhật URL."""
    try:
        data = urllib.parse.urlencode({"url": kiosk_url}).encode("utf-8")
        req = urllib.request.Request("http://127.0.0.1:8000/api/biometrics/set-public-url", data=data)
        with urllib.request.urlopen(req, timeout=3) as resp:
            pass
    except Exception:
        pass


def update_firebase_direct(kiosk_url: str) -> None:
    """Cập nhật trực tiếp lên Firebase Realtime Database nếu server local chưa chạy."""
    try:
        import json
        db_url = "https://lock-iot-2a021-default-rtdb.asia-southeast1.firebasedatabase.app"
        env_file = ROOT_DIR / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("VITE_FIREBASE_DATABASE_URL="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val:
                        db_url = val.rstrip("/")

        patch_url = f"{db_url}/SmartLock/System/Biometrics.json"
        payload = json.dumps({
            "online": True,
            "kioskUrl": kiosk_url,
            "updatedAt": int(time.time() * 1000),
            "tunnel": "cloudflare",
        }).encode("utf-8")

        req = urllib.request.Request(patch_url, data=payload, method="PATCH", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            pass
    except Exception as exc:
        print(f" [Lưu ý Firebase]: {exc}")


def main() -> None:
    bin_path = find_or_download_cloudflared()
    print("=" * 70)
    print("      SMARTLOCK IOT - KHỞI TẠO CLOUDFLARE HTTPS TUNNEL")
    print("=" * 70)
    print(f"  Thực thi: {bin_path}")
    print("  Đích trỏ: http://localhost:8000")
    print("  Đang khởi tạo đường truyền HTTPS bảo mật chuẩn Let's Encrypt...")
    print("=" * 70)

    cmd = [str(bin_path), "tunnel", "--url", "http://localhost:8000"]
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    tunnel_url = None
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    try:
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                match = url_pattern.search(line)
                if match and not tunnel_url:
                    tunnel_url = match.group(0)
                    kiosk_url = f"{tunnel_url}/kiosk"
                    print("\n" + "=" * 70)
                    print("  🌟 CLOUDFLARE TUNNEL ĐÃ SẴN SÀNG!")
                    print("=" * 70)
                    print(f"  👉 Kiosk URL (Điện thoại): {kiosk_url}")
                    print(f"  👉 Web Admin (GitHub.io) : Tự động đồng bộ URL qua Firebase")
                    print("=" * 70 + "\n")
                    notify_server(kiosk_url)
                    update_firebase_direct(kiosk_url)

                if "ERR" in line or "error" in line.lower():
                    print(f"  [Cloudflare]: {line.strip()}")
    except KeyboardInterrupt:
        print("\n  Đang đóng Cloudflare Tunnel...")
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("  Đã dừng tunnel an toàn.")


if __name__ == "__main__":
    main()
