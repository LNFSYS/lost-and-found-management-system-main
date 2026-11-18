"""FastAPI serving Florence-2 on a VPS CPU with limited concurrency."""
import io
import os
import secrets
from contextlib import asynccontextmanager

import anyio
from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from PIL import Image, UnidentifiedImageError
from engine import engine

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "8"))
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "10000000"))
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("PRELOAD_MODEL", "1") == "1":
        await anyio.to_thread.run_sync(engine.load)
    yield

app = FastAPI(title="Florence-2 CPU Vision API", version="0.1.0", lifespan=lifespan)

def check_api_key(authorization: str | None):
    api_key = os.getenv("API_KEY", "")
    if not api_key:
        raise HTTPException(503, "Server API_KEY must be configured")
    wanted = "Bearer " + api_key
    if not authorization or not secrets.compare_digest(authorization, wanted):
        raise HTTPException(401, "Unauthorized")

@app.get("/health")
def health():
    ready = engine.loaded and (engine.adapter_loaded or os.getenv("REQUIRE_LORA", "1") != "1")
    return {"ok": ready, "loaded": engine.loaded, "adapter_loaded": engine.adapter_loaded,
            "model_id": engine.model and "florence-community/Florence-2-large-ft",
            "device": "cpu", "status": "ready" if ready else "loading"}

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    caption_mode: str = Query("lora", pattern="^(lora|base)$"),
    include_dense: bool = Query(False),
    authorization: str | None = Header(default=None),
):
    check_api_key(authorization)
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(422, "Unsupported image type")
    # Limit memory while reading untrusted upload.
    raw = await file.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, "Image upload too large")
    try:
        with Image.open(io.BytesIO(raw)) as original:
            original.verify()
        with Image.open(io.BytesIO(raw)) as original:
            if original.width * original.height > MAX_IMAGE_PIXELS:
                raise HTTPException(413, "Image dimensions too large")
            image = original.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, "Invalid image")
    return await anyio.to_thread.run_sync(engine.analyze, image, caption_mode, include_dense)
