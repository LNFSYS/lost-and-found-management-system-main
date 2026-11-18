"""Run one authenticated end-to-end check against a local Florence-2 server."""
import argparse
import json
import os
import secrets
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def request(url, data=None, headers=None):
    try:
        with urlopen(Request(url, data=data, headers=headers or {}, method="POST" if data is not None else "GET"), timeout=300) as response:
            return response.status, response.read()
    except HTTPError as error:
        return error.code, error.read()


def upload(url, content, mime, key=None):
    boundary = secrets.token_hex(16)
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"item\"\r\n"
            f"Content-Type: {mime}\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return request(url, data=body, headers=headers)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    args = parser.parse_args()
    load_dotenv(args.env_file)
    if args.url.rstrip("/") not in ("http://127.0.0.1:8000", "http://localhost:8000"):
        parser.error("This verifier only connects to the local port 8000")
    key = os.getenv("API_KEY", "")
    if not key or key.startswith("REPLACE_WITH_"):
        parser.error("Configure a private API_KEY before verification")
    content = args.image.read_bytes()
    with Image.open(args.image) as image:
        image.verify()
    mime = "image/png" if args.image.suffix.lower() == ".png" else "image/jpeg"
    base = args.url.rstrip("/")
    status, body = request(base + "/health")
    health = json.loads(body)
    assert status == 200 and health["ok"] and health["loaded"] and health["adapter_loaded"]
    assert request(base + "/docs")[0] == 200
    endpoint = base + "/analyze?caption_mode=lora&include_dense=true"
    assert upload(endpoint, content, mime)[0] == 401
    assert upload(endpoint, b"not an image", mime, key)[0] == 422
    status, body = upload(endpoint, content, mime, key)
    assert status == 200, f"analyze returned HTTP {status}"
    result = json.loads(body)
    assert result.get("caption") and isinstance(result.get("objects"), dict)
    assert isinstance(result.get("dense_regions"), dict)
    width, height = result["image_size"]
    for group in ("objects", "dense_regions"):
        for left, top, right, bottom in result[group].get("bboxes", []):
            assert 0 <= left < right <= width and 0 <= top < bottom <= height
    print(json.dumps({"health": health["status"], "analyze_http": status, "caption": result["caption"],
                      "objects": len(result["objects"].get("labels", [])),
                      "dense_regions": len(result["dense_regions"].get("labels", [])),
                      "total_seconds": result["total_seconds"]}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, ValueError, KeyError) as error:
        print(f"Verification failed: {error}", file=sys.stderr)
        raise SystemExit(1)
