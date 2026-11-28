import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseModel):
    api_key: str = Field(default="", repr=False)
    model_id: str = "Qwen/Qwen3-VL-2B-Instruct"
    revision: str = "main"
    device: str = "cuda"
    allow_cpu_fallback: bool = False
    max_upload_bytes: int = Field(default=8 * 1024 * 1024, ge=1024, le=16 * 1024 * 1024)
    max_image_pixels: int = Field(default=20_000_000, ge=1024, le=40_000_000)
    image_edge: int = Field(default=672, ge=128, le=768)
    max_new_tokens: int = Field(default=640, ge=64, le=768)
    load_timeout: float = Field(default=600, gt=0, le=1800)
    inference_timeout: float = Field(default=120, gt=0, le=600)
    gpu_memory_fraction: float = Field(default=0.88, ge=0.5, le=0.95)
    min_free_vram_mb: int = Field(default=2800, ge=0)
    require_exclusive_gpu: bool = True

    @classmethod
    def from_env(cls):
        load_dotenv(ROOT / ".env", override=False)
        os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
        os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
        return cls(
            api_key=os.getenv("AI_API_KEY", ""),
            model_id=os.getenv("MODEL_ID", "Qwen/Qwen3-VL-2B-Instruct"),
            revision=os.getenv("MODEL_REVISION", "main"),
            device=os.getenv("QWEN_DEVICE", "cuda"),
            allow_cpu_fallback=os.getenv("ALLOW_CPU_FALLBACK", "false").lower() == "true",
            max_upload_bytes=int(os.getenv("MAX_UPLOAD_MB", "8")) * 1024 * 1024,
            image_edge=int(os.getenv("MAX_IMAGE_EDGE", "672")),
            max_new_tokens=int(os.getenv("MAX_NEW_TOKENS", "640")),
            load_timeout=float(os.getenv("MODEL_LOAD_TIMEOUT_SECONDS", "600")),
            inference_timeout=float(os.getenv("INFERENCE_TIMEOUT_SECONDS", "120")),
            gpu_memory_fraction=float(os.getenv("GPU_MEMORY_FRACTION", "0.88")),
            min_free_vram_mb=int(os.getenv("MIN_FREE_VRAM_MB", "2800")),
            require_exclusive_gpu=os.getenv("REQUIRE_EXCLUSIVE_GPU", "true").lower() == "true",
        )
