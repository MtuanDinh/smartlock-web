# Dockerfile cho SmartLock Biometric AI Server
FROM python:3.11-slim

# Cài đặt các thư viện hệ thống cần thiết cho OpenCV, SoundFile và xử lý âm thanh
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Sao chép và cài đặt dependencies Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Sao chép toàn bộ mã nguồn server và mô hình ONNX
COPY . .

# Mở cổng HTTP (8000) và HTTPS (8443)
EXPOSE 8000 8443

# Chạy server
CMD ["python", "main.py"]
