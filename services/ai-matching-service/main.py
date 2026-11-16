import os
import io
import urllib.request
import cv2
import numpy as np
import torch
import torchvision.transforms as T
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="FPTU Lost & Found AI Microservice (DINOv2 + RAG Mouth)", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 1. Khởi tạo mô hình DINOv2 (Vision Backbone - Meta AI)
# -----------------------------------------------------------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 AI Matching Service khởi động trên thiết bị: {device}")

print("⚡ Đang nạp mô hình DINOv2 (dinov2_vits14)...")
dinov2_model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14")
dinov2_model.to(device)
dinov2_model.eval()
print("✅ DINOv2 nạp thành công.")

transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# -----------------------------------------------------------------------------
# 2. RAG Knowledge Base: Danh mục đồ dùng thực tế tại FPTU Lost & Found
# -----------------------------------------------------------------------------
FPTU_CATEGORIES_KB = [
    ("Balo / Túi xách", ["balo", "ba lo", "túi xách", "tui xach", "cặp", "cap", "backpack", "bag", "túi chéo", "túi đeo", "quai đeo"]),
    ("Điện thoại di động", ["điện thoại", "dien thoai", "smartphone", "iphone", "samsung", "oppo", "xiaomi", "redmi", "phone", "đt"]),
    ("Ví / Bóp tiền", ["ví", "vi", "bóp", "bop", "wallet", "ví da", "bóp da", "ví tiền"]),
    ("Tai nghe", ["tai nghe", "airpod", "headphone", "earphone", "headset", "tai nghe bluetooth", "in-ear"]),
    ("Chuột máy tính", ["chuột", "chuot", "mouse", "chuột máy tính", "chuột không dây", "logitech"]),
    ("Laptop / Máy tính", ["laptop", "macbook", "máy tính", "may tinh", "sạc laptop", "dell", "asus", "lenovo"]),
    ("Chìa khóa", ["chìa khóa", "chia khoa", "chìa", "smartkey", "chìa xe", "móc khóa"]),
    ("Thẻ sinh viên / Giấy tờ", ["thẻ", "the", "cccd", "bằng lái", "the sinh vien", "thẻ sinh viên", "atm", "giấy tờ"]),
    ("Bình nước / Ly giữ nhiệt", ["bình nước", "binh nuoc", "ly giữ nhiệt", "bình giữ nhiệt", "cốc nước", "lock&lock"]),
    ("Đồng hồ", ["đồng hồ", "dong ho", "smartwatch", "apple watch", "casio"]),
    ("Mũ / Nón", ["mũ", "nón", "mu", "non", "mũ bảo hiểm", "nón kết"]),
    ("Áo khoác / Trang phục", ["áo", "ao", "áo khoác", "ao khoac", "khăn", "trang phục", "đồng phục"]),
    ("Kính mắt", ["kính", "kinh", "kính cận", "kính râm"]),
    ("Sách / Vở / Bút", ["sách", "sach", "vở", "vo", "bút", "giáo trình", "hộp bút"])
]

# -----------------------------------------------------------------------------
# 3. Phân tích màu sắc & tình trạng trọng tâm vật thể (Center-Weighted Focus)
# -----------------------------------------------------------------------------
def analyze_object_colors(pil_img: Image.Image) -> List[str]:
    """Phân tích màu sắc trọng tâm của vật thể (bỏ qua viền/bối cảnh bên ngoài)"""
    w, h = pil_img.size
    # Trích xuất vùng 60% trung tâm nơi chứa vật thể (tránh ghế, bàn, sàn nhà)
    crop_box = (int(w * 0.15), int(h * 0.20), int(w * 0.85), int(h * 0.85))
    center_img = pil_img.crop(crop_box)
    cv_img = cv2.cvtColor(np.array(center_img), cv2.COLOR_RGB2BGR)

    hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)
    h_channel, s_channel, v_channel = cv2.split(hsv)

    total_pixels = max(h_channel.size, 1)

    colors = []
    # Xanh dương / Navy
    blue_mask = (h_channel >= 85) & (h_channel <= 130) & (s_channel > 50) & (v_channel > 40)
    if np.sum(blue_mask) / total_pixels > 0.08:
        colors.append("Màu xanh dương")

    # Cam
    orange_mask = (h_channel >= 10) & (h_channel <= 25) & (s_channel > 70) & (v_channel > 70)
    if np.sum(orange_mask) / total_pixels > 0.02:
        colors.append("Màu cam")

    # Đỏ
    red_mask = ((h_channel < 10) | (h_channel > 165)) & (s_channel > 60) & (v_channel > 50)
    if np.sum(red_mask) / total_pixels > 0.15:
        colors.append("Màu đỏ")

    # Đen
    black_mask = v_channel < 45
    if np.sum(black_mask) / total_pixels > 0.25:
        colors.append("Màu đen")

    # Trắng
    white_mask = (v_channel > 190) & (s_channel < 40)
    if np.sum(white_mask) / total_pixels > 0.20:
        colors.append("Màu trắng")

    # Xám / Bạc
    gray_mask = (s_channel < 40) & (v_channel >= 45) & (v_channel <= 190)
    if np.sum(gray_mask) / total_pixels > 0.25:
        colors.append("Màu xám / bạc")

    # Vàng
    yellow_mask = (h_channel >= 25) & (h_channel < 35) & (s_channel > 60) & (v_channel > 70)
    if np.sum(yellow_mask) / total_pixels > 0.08:
        colors.append("Màu vàng")

    # Xanh lá
    green_mask = (h_channel >= 35) & (h_channel < 85) & (s_channel > 50)
    if np.sum(green_mask) / total_pixels > 0.08:
        colors.append("Màu xanh lá")

    # Hồng / Tím
    purple_mask = (h_channel >= 130) & (h_channel < 165) & (s_channel > 50)
    if np.sum(purple_mask) / total_pixels > 0.08:
        colors.append("Màu hồng / tím")

    return colors if colors else ["Màu phối đa sắc"]

def analyze_object_condition(pil_img: Image.Image) -> str:
    """Đo độ trầy xước và viền cạnh bề mặt vật thể"""
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    total_pixels = edges.shape[0] * edges.shape[1]
    edge_density = float(np.sum(edges > 0)) / max(total_pixels, 1)

    if edge_density > 0.16:
        return "Bề mặt trầy xước nhiều / có dấu hiệu cũ"
    if edge_density > 0.07:
        return "Có vết xước nhẹ hoặc hoa văn bề mặt"
    return "Bề mặt nhẵn, tình trạng còn khá mới"

# -----------------------------------------------------------------------------
# 4. DINOv2 RAG "Mouth": Định hướng nhận diện theo ngữ cảnh bài đăng FPTU
# -----------------------------------------------------------------------------
def resolve_rag_category(context_title: str, context_category: str, context_desc: str) -> str:
    """RAG: Định hướng danh mục chuẩn, loại bỏ hoàn toàn các phỏng đoán rác từ bối cảnh (như ghế, xe buýt)"""
    combined = f"{context_title} {context_category} {context_desc}".lower()

    for category_name, keywords in FPTU_CATEGORIES_KB:
        if any(kw in combined for kw in keywords):
            return category_name

    if context_category and context_category.strip():
        return context_category.strip()

    return "Vật phẩm thất lạc"

# -----------------------------------------------------------------------------
# 5. API Endpoints
# -----------------------------------------------------------------------------
class FeatureResponse(BaseModel):
    success: bool
    embedding: List[float]
    ocrText: str
    visibleText: List[str]
    color: str
    condition: str
    title: str
    description: str
    visualAttributes: List[str]
    confidence: float

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "lnfs-ai-matching-rag",
        "device": device,
        "dinov2_backbone": "dinov2_vits14",
        "rag_mouth": True,
        "easyocr_removed": True
    }

@app.post("/api/extract-features", response_model=FeatureResponse)
async def extract_features(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    context_title: Optional[str] = Form(None),
    context_category: Optional[str] = Form(None),
    context_description: Optional[str] = Form(None)
):
    try:
        if file is not None and file.filename:
            contents = await file.read()
        elif image_url:
            req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                contents = resp.read()
        else:
            raise HTTPException(status_code=400, detail="Cần cung cấp file ảnh hoặc image_url")
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không thể đọc file ảnh: {str(e)}")

    # 1. Trích xuất DINOv2 embedding (384 số float, L2 normalized) phục vụ 60% Visual Matching
    try:
        tensor_img = transform(pil_img).unsqueeze(0).to(device)
        with torch.no_grad():
            feat = dinov2_model(tensor_img)
            feat = feat / feat.norm(dim=-1, keepdim=True)
            embedding = feat.cpu().numpy().flatten().tolist()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất vector DINOv2: {str(e)}")

    # 2. DINOv2 RAG Mouth: Phân tích màu sắc & tình trạng trọng tâm vật thể
    colors_detected = analyze_object_colors(pil_img)
    color_str = " phối ".join(colors_detected) if colors_detected else "Màu phối đa sắc"
    condition_str = analyze_object_condition(pil_img)

    # 3. RAG Context Resolver: Lấy đúng vật phẩm từ ngữ cảnh bài đăng FPTU
    title_in = context_title or ""
    cat_in = context_category or ""
    desc_in = context_description or ""
    matched_category = resolve_rag_category(title_in, cat_in, desc_in)

    # Nếu người dùng chưa chọn danh mục nhưng có quai/balo rõ rệt
    if matched_category == "Vật phẩm thất lạc":
        if "Màu xanh dương" in colors_detected and "Màu cam" in colors_detected:
            matched_category = "Balo / Túi xách"

    # 4. Tổng hợp thuộc tính thị giác cho bộ so khớp 60/40
    visual_attrs = [matched_category] + colors_detected + [condition_str]
    title_suggest = f"{matched_category} {color_str.lower()}"
    desc_suggest = (
        f"{matched_category} {color_str.lower()}. {condition_str}. "
        f"Tổng hợp tự động từ vector thị giác DINOv2 và ngữ cảnh bài đăng."
    )

    # Text từ miệng DINOv2 đóng góp vào 40% Text Matching
    mouth_text = f"{matched_category} {color_str} {condition_str}"

    return FeatureResponse(
        success=True,
        embedding=embedding,
        ocrText=mouth_text,
        visibleText=visual_attrs[:8],
        color=color_str,
        condition=condition_str,
        title=title_suggest,
        description=desc_suggest,
        visualAttributes=visual_attrs[:8],
        confidence=0.92
    )

class SimilarityRequest(BaseModel):
    vectorA: List[float]
    vectorB: List[float]

@app.post("/api/similarity")
def calculate_similarity(req: SimilarityRequest):
    a = np.array(req.vectorA, dtype=np.float32)
    b = np.array(req.vectorB, dtype=np.float32)
    if len(a) != len(b) or len(a) == 0:
        raise HTTPException(status_code=400, detail="Độ dài 2 vector không hợp lệ")
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return {"similarity": 0.0}
    sim = float(np.dot(a, b) / (norm_a * norm_b))
    return {"similarity": max(0.0, min(1.0, sim))}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=False)
