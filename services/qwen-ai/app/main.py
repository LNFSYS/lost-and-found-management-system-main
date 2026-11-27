import hmac
import io
import json
import logging
import time
import uuid
import warnings
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from .config import Settings
from .runner import Runner, ServiceError
from .schema import AnalysisResponse


class JsonFormatter(logging.Formatter):
    def format(self, record):
        data = {"timestamp": time.time(), "level": record.levelname, "event": record.getMessage()}
        for key in ("request_id", "status_code", "elapsed_seconds", "error_code", "exception_type"):
            if hasattr(record, key):
                data[key] = getattr(record, key)
        return json.dumps(data)


log = logging.getLogger("lnfs.qwen")
if not log.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    log.addHandler(handler)
log.setLevel(logging.INFO)
log.propagate = False


class GuardMiddleware:
    """Authenticate before multipart parsing and bound the complete streamed body."""
    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/ai/"):
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        expected = ("Bearer " + self.settings.api_key).encode()
        if len(self.settings.api_key) < 32 or self.settings.api_key.startswith("CHANGE_ME"):
            return await JSONResponse({"error": "api_key_not_configured"}, 503)(scope, receive, send)
        if not hmac.compare_digest(headers.get(b"authorization", b""), expected):
            return await JSONResponse({"error": "unauthorized"}, 401)(scope, receive, send)
        limit = self.settings.max_upload_bytes + 65536
        try:
            if int(headers.get(b"content-length", b"0")) > limit:
                return await JSONResponse({"error": "request_too_large"}, 413)(scope, receive, send)
        except ValueError:
            return await JSONResponse({"error": "invalid_content_length"}, 400)(scope, receive, send)
        # A bounded buffer prevents unbounded multipart spool-to-disk, including chunked requests.
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > limit:
                return await JSONResponse({"error": "request_too_large"}, 413)(scope, receive, send)
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


def decode_image(raw, mime, settings):
    formats = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
    if mime not in formats:
        raise HTTPException(415, "Only JPEG, PNG and WebP are supported")
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(413, "Image too large")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as probe:
                if probe.format != formats[mime]:
                    raise HTTPException(415, "Image content does not match MIME type")
                if probe.width * probe.height > settings.max_image_pixels:
                    raise HTTPException(413, "Image dimensions too large")
                if getattr(probe, "is_animated", False):
                    raise HTTPException(422, "Animated images are not supported")
                probe.verify()
            with Image.open(io.BytesIO(raw)) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.thumbnail((settings.image_edge, settings.image_edge), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                image.save(buffer, format="PNG")
                image.close()
                return buffer.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning):
        raise HTTPException(422, "Invalid image") from None


def create_app(settings=None, runner=None):
    settings = settings or Settings.from_env()
    runner = runner or Runner(settings)

    @asynccontextmanager
    async def lifespan(app):
        if isinstance(runner, Runner):
            await run_in_threadpool(runner.probe_hardware)
        yield
        runner.close()

    app = FastAPI(title="LNFS Qwen image analysis", version="1.0.0", lifespan=lifespan)
    app.state.runner = runner
    app.add_middleware(GuardMiddleware, settings=settings)

    @app.get("/health")
    def health():
        return {"status": "degraded" if runner.state == "error" else "ok",
                "model_status": runner.state, "model_loaded": runner.loaded,
                "gpu_available": runner.info.get("cuda_available"),
                "active_device": runner.info.get("device"), "model": settings.model_id,
                "last_error": runner.last_error}

    @app.get("/ai/model-info")
    def model_info():
        return {"model_id": settings.model_id, "revision": settings.revision,
                "model_loaded": runner.loaded, "model_status": runner.state,
                "image_edge": settings.image_edge, "max_new_tokens": settings.max_new_tokens,
                "output_format": "json-schema-constrained", "prompt_version": "lnfs-v4-bounded",
                "metrics_note": "last worker sample; null before first load",
                **runner.info}

    @app.post("/ai/analyze", response_model=AnalysisResponse)
    async def analyze(image: UploadFile = File(...), type: Literal["LOST", "FOUND"] = Form(...),
                      user_description: str = Form(default="", max_length=2000)):
        request_id, started = uuid.uuid4().hex, time.perf_counter()
        try:
            raw = await image.read(settings.max_upload_bytes + 1)
            resized = await run_in_threadpool(decode_image, raw, image.content_type, settings)
            result = await run_in_threadpool(runner.analyze, resized, type, user_description)
            log.info("analysis_complete", extra={"request_id": request_id, "status_code": 200,
                "elapsed_seconds": round(time.perf_counter() - started, 3)})
            return AnalysisResponse.model_validate(result)
        except ServiceError as error:
            log.warning("analysis_failed", extra={"request_id": request_id,
                "status_code": error.status, "error_code": error.code})
            return JSONResponse({"status": "error", "error": error.code, "request_id": request_id},
                status_code=error.status, headers={"Retry-After": "5"} if error.status == 429 else None)
        finally:
            await image.close()

    return app


app = create_app()
