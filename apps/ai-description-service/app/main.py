import asyncio
import hmac
import logging
import os
import time
from contextlib import asynccontextmanager
from io import BytesIO

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, UnidentifiedImageError

from app.classifier import MobileNetClassifier

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("lnfs.ai-description")
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_BATCH_BYTES = 14 * 1024 * 1024
MAX_PIXELS = 20_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
SUPPORTED_TYPES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def create_app(classifier: MobileNetClassifier | None = None, api_key: str | None = None):
    model = classifier or MobileNetClassifier()
    key = os.getenv("AI_DESCRIPTION_API_KEY", "") if api_key is None else api_key
    inference_lock = asyncio.Lock()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        load_started = time.perf_counter()
        try:
            await run_in_threadpool(model.load)
            model_load_ms = (time.perf_counter() - load_started) * 1000
            logger.info("model_loaded model=%s provider=CPUExecutionProvider model_load_ms=%.2f",
                        model.version, model_load_ms)
        except Exception as error:
            logger.error("model_unavailable error_type=%s", type(error).__name__)
        yield

    app = FastAPI(title="LNFS AI Description", version="1", lifespan=lifespan)

    def authorize(x_ai_service_key: str | None = Header(default=None)):
        if not key:
            raise HTTPException(status_code=503, detail="AI Description service is not configured")
        if not hmac.compare_digest(x_ai_service_key or "", key):
            raise HTTPException(status_code=401, detail="Invalid service key")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/ready", dependencies=[Depends(authorize)])
    def ready():
        if model.session is None:
            raise HTTPException(status_code=503, detail="Classifier is not ready")
        return {"status": "ready", "model_version": model.version,
                "labels": len(model.labels), "provider": "CPUExecutionProvider", "workers": 1,
                "cpu_threads": 1}

    async def read_images(files: list[UploadFile]):
        if not 1 <= len(files) <= 5:
            raise HTTPException(status_code=422, detail="Expected 1 to 5 images")
        images, total = [], 0
        for file in files:
            expected_format = SUPPORTED_TYPES.get(file.content_type or "")
            if not expected_format:
                raise HTTPException(status_code=415, detail="Expected JPEG, PNG or WebP")
            content = await file.read(MAX_IMAGE_BYTES + 1)
            total += len(content)
            if len(content) > MAX_IMAGE_BYTES or total > MAX_BATCH_BYTES:
                raise HTTPException(status_code=413, detail="Image upload limit exceeded")
            try:
                with Image.open(BytesIO(content)) as source:
                    if source.format != expected_format or source.width * source.height > MAX_PIXELS:
                        raise ValueError("Invalid image format or dimensions")
                    source.verify()
                with Image.open(BytesIO(content)) as source:
                    image = source.copy()
                    image.load()
                    images.append(image)
            except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError):
                raise HTTPException(status_code=400, detail="Invalid image") from None
        return images

    @app.post("/v1/describe", dependencies=[Depends(authorize)])
    async def describe(files: list[UploadFile] = File(...)):
        if model.session is None:
            raise HTTPException(status_code=503, detail="Classifier is not ready")
        images = await read_images(files)
        if inference_lock.locked():
            raise HTTPException(status_code=503, detail="AI Description service is busy")
        await inference_lock.acquire()
        started = time.perf_counter()
        try:
            result = await run_in_threadpool(model.predict, images)
        except Exception as error:
            logger.error("inference_failed model=%s error_type=%s", model.version, type(error).__name__)
            raise HTTPException(status_code=503, detail="Image classification unavailable") from None
        finally:
            inference_lock.release()
        elapsed = round((time.perf_counter() - started) * 1000, 2)
        logger.info("inference_success model=%s images=%d elapsed_ms=%.2f", model.version, len(images), elapsed)
        return {**result, "inference_ms": elapsed}

    return app


app = create_app()
