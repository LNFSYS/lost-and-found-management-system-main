#!/bin/bash
set -e

echo "======================================================================"
echo "🚀 BẮT ĐẦU TRIỂN KHAI AI MATCHING MICROSERVICE TRÊN VPS (180.93.196.72)"
echo "======================================================================"

# 1. Kiểm tra Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Không tìm thấy python3! Đang cài đặt..."
    sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv libgl1 libglib2.0-0
else
    echo "✅ Python 3 đã sẵn sàng: $(python3 --version)"
fi

# Đảm bảo có thư viện hệ thống cần thiết cho OpenCV
echo "📦 Cài đặt thư viện hệ thống cho OpenCV..."
sudo apt-get update -qq && sudo apt-get install -y -qq libgl1 libglib2.0-0 python3-venv

# 2. Cài đặt Python Virtual Environment cho AI Service
echo "⚡ Thiết lập môi trường Python ảo (venv) tại services/ai-matching-service..."
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/services/ai-matching-service"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
echo "📦 Cài đặt PyTorch CPU (phiên bản siêu nhẹ, không tốn VRAM/GPU)..."
pip install --upgrade pip
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# 3. Tải trước mô hình DINOv2 vào cache để phản hồi tức thì
echo "📥 Tải trước mô hình DINOv2 (86 MB)..."
python3 -c "import torch; torch.hub.load('facebookresearch/dinov2', 'dinov2_vits14')"

# 4. Quản lý AI Microservice bằng PM2 trên cổng 5000
echo "⚡ Khởi động / Khởi động lại dịch vụ AI 'lnfs-ai' bằng PM2..."
if pm2 describe lnfs-ai > /dev/null 2>&1; then
    pm2 restart lnfs-ai
else
    pm2 start "venv/bin/uvicorn main:app --host 127.0.0.1 --port 5000" --name "lnfs-ai"
fi

cd "$ROOT_DIR"

# 5. Chạy Migration MySQL và Build API
echo "⚡ Đang chạy migration cơ sở dữ liệu MySQL (thêm cột image_embedding)..."
npm run migrate || true

echo "⚡ Đang biên dịch mã nguồn Node.js API..."
npm --workspace @lnfs/api-node run build

# 6. Khởi động lại Node.js API
echo "⚡ Khởi động lại 'lnfs-api' bằng PM2..."
if pm2 describe lnfs-api > /dev/null 2>&1; then
    pm2 restart lnfs-api
fi

pm2 save

echo "======================================================================"
echo "🎉 TRIỂN KHAI THÀNH CÔNG!"
echo "======================================================================"
echo "Kiểm tra tình trạng PM2:"
pm2 status

echo ""
echo "Kiểm tra sức khỏe AI Microservice (cổng 5000):"
curl -s http://127.0.0.1:5000/health || echo "Đang khởi động..."
echo ""
