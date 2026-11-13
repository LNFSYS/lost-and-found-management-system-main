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

app = FastAPI(title="FPTU Lost & Found AI Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 1. Khởi tạo mô hình DINOv2 (86 MB) & Transform
# -----------------------------------------------------------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 AI Matching Service khởi động trên thiết bị: {device}")

print("⚡ Đang nạp mô hình DINOv2 (dinov2_vits14)...")
dinov2_model = torch.hub.load('facebookresearch/dinov2', 'dinov2_vits14')
dinov2_model.to(device)
dinov2_model.eval()

transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# -----------------------------------------------------------------------------
# 2. Khởi tạo EasyOCR (Tiếng Việt + Tiếng Anh)
# -----------------------------------------------------------------------------
ocr_reader = None
try:
    import easyocr
    print("⚡ Đang nạp EasyOCR (vi + en)...")
    ocr_reader = easyocr.Reader(['vi', 'en'], gpu=(device == 'cuda'))
    print("✅ EasyOCR nạp thành công.")
except Exception as e:
    print(f"⚠️ Cảnh báo khởi tạo EasyOCR: {e}. Hệ thống sẽ chạy thuần Visual.")

# -----------------------------------------------------------------------------
# 3. Phân tích màu sắc & tình trạng bề mặt bằng OpenCV
# -----------------------------------------------------------------------------
def analyze_color(img_cv2: np.ndarray) -> str:
    """Xác định màu sắc chủ đạo bằng không gian màu HSV"""
    hsv = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    mean_s = float(np.mean(s))
    mean_v = float(np.mean(v))
    mean_h = float(np.mean(h))

    if mean_v < 45:
        return "Màu đen"
    if mean_v > 200 and mean_s < 35:
        return "Màu trắng"
    if mean_s < 40:
        return "Màu xám / bạc"
    if mean_h < 10 or mean_h > 170:
        return "Màu đỏ"
    if 10 <= mean_h < 25:
        return "Màu cam"
    if 25 <= mean_h < 35:
        return "Màu vàng"
    if 35 <= mean_h < 85:
        return "Màu xanh lá"
    if 85 <= mean_h < 130:
        return "Màu xanh dương / xanh navy"
    if 130 <= mean_h < 160:
        return "Màu hồng / tím"
    return "Màu phối đa sắc"

def analyze_condition(img_cv2: np.ndarray) -> str:
    """Đo độ trầy xước và viền cạnh bề mặt"""
    gray = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    total_pixels = edges.shape[0] * edges.shape[1]
    edge_density = float(np.sum(edges > 0)) / max(total_pixels, 1)

    if edge_density > 0.15:
        return "Bề mặt trầy xước nhiều / có dấu hiệu cũ qua thời gian"
    if edge_density > 0.07:
        return "Có vết xước nhẹ hoặc hoa văn bề mặt"
    return "Bề mặt nhẵn, tình trạng còn khá mới"

def extract_ocr_text(img_cv2: np.ndarray) -> List[str]:
    """Đọc chữ / logo / mã số trên ảnh"""
    if ocr_reader is None:
        return []
    try:
        results = ocr_reader.readtext(img_cv2)
        texts = []
        for res in results:
            if res[2] > 0.35:  # Confidence > 35%
                cleaned = str(res[1]).strip()
                if len(cleaned) >= 2:
                    texts.append(cleaned)
        return texts
    except Exception as e:
        print(f"Lỗi khi chạy OCR: {e}")
        return []

# -----------------------------------------------------------------------------
# 4. API Endpoints
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
        "service": "lnfs-ai-matching",
        "device": device,
        "ocr_available": ocr_reader is not None
    }

@app.post("/api/extract-features", response_model=FeatureResponse)
async def extract_features(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None)
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

    # 1. Trích xuất DINOv2 embedding (384 số float, L2 normalized)
    try:
        tensor_img = transform(pil_img).unsqueeze(0).to(device)
        with torch.no_grad():
            feat = dinov2_model(tensor_img)
            feat = feat / feat.norm(dim=-1, keepdim=True)
            embedding = feat.cpu().numpy().flatten().tolist()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất vector DINOv2: {str(e)}")

    # 2. Phân tích OpenCV
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    color = analyze_color(cv_img)
    condition = analyze_condition(cv_img)
    ocr_list = extract_ocr_text(cv_img)
    ocr_text = " ".join(ocr_list)

    # 3. Tạo thuộc tính thị giác (visualAttributes)
    visual_attrs = [color, condition]
    if ocr_list:
        for word in ocr_list[:4]:
            visual_attrs.append(f"Chữ: {word}")

    # 4. Sinh mô tả tiếng Việt chuẩn phong cách Lost & Found FPTU
    desc_sentences = [
        f"Vật phẩm có tông {color.lower()}.",
        f"Tình trạng ngoại quan: {condition.lower()}."
    ]
    if ocr_text:
        desc_sentences.append(f"Ký tự hoặc nhãn hiệu nhận diện được: '{ocr_text}'.")
    else:
        desc_sentences.append("Bề mặt trơn hoặc không phát hiện chữ in nổi bật.")

    generated_description = " ".join(desc_sentences)

    # Title gợi ý
    title_suggest = f"Vật phẩm {color.lower()}"
    if ocr_list:
        title_suggest += f" ({ocr_list[0]})"

    return FeatureResponse(
        success=True,
        embedding=embedding,
        ocrText=ocr_text,
        visibleText=ocr_list[:8],
        color=color,
        condition=condition,
        title=title_suggest,
        description=generated_description,
        visualAttributes=visual_attrs[:8],
        confidence=0.88 if ocr_text else 0.80
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
