"""Repeat local HTTP requests and verify one-slot admission with a real model."""
import argparse
import json
import os
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")
parser = argparse.ArgumentParser()
parser.add_argument("image", type=Path)
parser.add_argument("--url", default="http://127.0.0.1:8000")
args = parser.parse_args()
headers = {"Authorization": "Bearer " + os.environ["AI_API_KEY"]}
raw = args.image.read_bytes()


def request(barrier=None):
    if barrier:
        barrier.wait()
    start = time.perf_counter()
    with httpx.Client(timeout=180) as client:
        response = client.post(args.url + "/ai/analyze", headers=headers,
            data={"type": "FOUND"}, files={"image": ("fixture.png", raw, "image/png")})
        payload = response.json()
        return {"status": response.status_code, "seconds": round(time.perf_counter() - start, 3),
                "inference_seconds": payload.get("inference_seconds"), "error": payload.get("error")}


report = {"warm_runs": [request() for _ in range(3)]}
barrier = threading.Barrier(2)
with ThreadPoolExecutor(2) as pool:
    report["concurrent"] = list(pool.map(lambda _: request(barrier), range(2)))
with httpx.Client(timeout=10) as client:
    report["model_info"] = client.get(args.url + "/ai/model-info", headers=headers).json()
report["nvidia_smi"] = subprocess.run(["nvidia-smi",
    "--query-gpu=name,memory.total,memory.used,memory.free", "--format=csv,noheader"],
    capture_output=True, text=True, check=True).stdout.strip()
path = root / "artifacts" / "benchmark.json"
path.parent.mkdir(exist_ok=True)
path.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
assert all(run["status"] == 200 for run in report["warm_runs"])
assert sorted(run["status"] for run in report["concurrent"]) == [200, 429]
