"""Actual HTTP smoke test. Stores measurements only; never writes OCR or secrets."""
import argparse
import json
import mimetypes
import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")
parser = argparse.ArgumentParser()
parser.add_argument("image", type=Path)
parser.add_argument("--url", default="http://127.0.0.1:8000")
parser.add_argument("--report", type=Path, default=root / "artifacts" / "smoke.json")
args = parser.parse_args()
headers = {"Authorization": "Bearer " + os.environ["AI_API_KEY"]}
report = {}
with httpx.Client(base_url=args.url, timeout=900) as client:
    report["health_before"] = client.get("/health").json()
    report["wrong_key_status"] = client.get("/ai/model-info", headers={"Authorization": "Bearer invalid"}).status_code
    assert report["wrong_key_status"] == 401
    malformed = client.post("/ai/analyze", headers=headers, data={"type": "FOUND"},
        files={"image": ("bad.png", b"invalid-image", "image/png")})
    report["malformed_status"] = malformed.status_code
    assert malformed.status_code == 422
    start = time.perf_counter()
    with args.image.open("rb") as image:
        response = client.post("/ai/analyze", headers=headers, data={"type": "FOUND"},
            files={"image": ("sample", image, mimetypes.guess_type(args.image.name)[0] or "image/jpeg")})
    report["wall_seconds"] = round(time.perf_counter() - start, 3)
    report["analyze_status"] = response.status_code
    report["model_info"] = client.get("/ai/model-info", headers=headers).json()
    if response.is_success:
        import sys
        sys.path.insert(0, str(root))
        from app.schema import AnalysisResponse
        parsed = AnalysisResponse.model_validate(response.json())
        report["schema_valid"] = True
        report["inference_seconds"] = parsed.inference_seconds
        report["service_elapsed_seconds"] = parsed.elapsed_seconds
    else:
        report["error"] = response.json()
args.report.parent.mkdir(parents=True, exist_ok=True)
args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
raise SystemExit(0 if report["analyze_status"] == 200 else 1)
