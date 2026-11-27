"""Opt-in GPU test. Stop any resident Qwen server worker before running."""
import json
import copy
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from app.config import Settings
from app.main import decode_image
from app.runner import Runner
from app.schema import AnalysisResponse


def main():
    settings = Settings.from_env()
    raw = (root.parents[1] / "apps/web/src/assets/fptu-da-nang-campus.jpg").read_bytes()
    image = decode_image(raw, "image/jpeg", settings)
    report = []
    for _ in range(2):
        runner = Runner(settings)
        try:
            result = AnalysisResponse.model_validate(runner.analyze(image, "FOUND", ""))
            report.append({"status": result.status, "elapsed_seconds": result.elapsed_seconds,
                           "inference_seconds": result.inference_seconds, "info": copy.deepcopy(runner.info)})
        finally:
            runner.close()
        time.sleep(2)
    path = root / "artifacts" / "cold-starts.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
