"""Download only inference assets from the official repository, pinning its revision."""
import json
import os
import re
import shutil
from pathlib import Path

from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")
os.environ.setdefault("HF_HOME", str(root / ".cache" / "huggingface"))
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
from huggingface_hub import HfApi, snapshot_download

repo = os.getenv("MODEL_ID", "Qwen/Qwen3-VL-2B-Instruct")
revision = os.getenv("MODEL_REVISION", "main")
info = HfApi().model_info(repo, revision=revision, files_metadata=True)
size = sum(file.size or 0 for file in info.siblings if file.rfilename.endswith(".safetensors"))
free = shutil.disk_usage(root).free
print(json.dumps({"model_id": repo, "revision": info.sha, "weights_gb": round(size / 1e9, 2),
                  "disk_free_gb": round(free / 1e9, 2)}), flush=True)
if free < size + 1024**3:
    raise SystemExit("Insufficient disk space: need weight size plus 1 GiB headroom.")
path = snapshot_download(repo, revision=info.sha,
    allow_patterns=["*.json", "*.safetensors", "*.txt", "*.jinja"], max_workers=2)
env = root / ".env"
if revision == "main" and env.exists():
    text = env.read_text(encoding="utf-8")
    env.write_text(re.sub(r"(?m)^MODEL_REVISION=main$", "MODEL_REVISION=" + info.sha, text), encoding="utf-8")
(root / ".cache" / "model-download.json").write_text(
    json.dumps({"model_id": repo, "revision": info.sha, "snapshot": path}, indent=2), encoding="utf-8")
print("Model assets downloaded; local .env revision pinned when previously main.", flush=True)
