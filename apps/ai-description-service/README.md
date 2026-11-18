# LNFS AI Description (development)

This independent service runs MobileNetV3-Small V1 on CPU at `127.0.0.1:5001`. It classifies only 12 trained categories. Scores are uncalibrated softmax values, not real-world accuracy or open-set detection. Users must confirm the category and edit the Vietnamese draft before posting. No OCR, brand recognition, matching, or ownership decision occurs here.

The local ONNX checkpoint comes from `archive.zip`; place it at `models/mobilenetv3-small-v1/lnfs_mobilenetv3_small_v1.onnx`. Keep it out of Git. `labels.json` preserves the exact model output order and ImageNet preprocessing metadata. The supplied `evaluation.json` reports 68.66% accuracy on 67 test images; this does not establish production performance.

From `apps/ai-description-service` with Python 3.11 installed:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-test.txt
$env:AI_DESCRIPTION_API_KEY = "a-private-development-key"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 5001 --workers 1
```

Use the same key in the root `.env` with `AI_DESCRIPTION_ENABLED=true` and `AI_DESCRIPTION_URL=http://127.0.0.1:5001`, then start Node and web from the repo root with `npm.cmd run dev` in a second PowerShell terminal. The root `.env.example` keeps production disabled by default. The key is never sent to the browser.

`GET /health` checks process health. `GET /ready` and `POST /v1/describe` require `X-AI-Service-Key`. The latter accepts 1-5 multipart `files` (JPEG/PNG/WebP; max 8 MB each and 14 MB total) and returns `category_name`, `top3`, `confidence`, `score_kind=uncalibrated_softmax`, `requires_confirmation=true`, and `confidence_calibrated=false`. Failed inference returns a controlled 503; Node does not silently fall back to Gemini. Manual posting remains available.

Run `python -m pytest tests/test_service.py` inside the virtual environment. This service is separate from DINOv2 Matching on port 5000 and must not replace it. Do not enable production until local inference, privacy review, and memory/latency benchmark on target hardware have passed. Rollback is `AI_DESCRIPTION_ENABLED=false` in Node's environment; do not remove the ONNX file or alter Matching.

The archive metadata specifies label order, 224-pixel input and ImageNet mean/std. The current service uses a 256-pixel short-side resize and center crop from the earlier repository implementation; the archive contains no training notebook to independently verify that resize interpolation matches training exactly. Keep suggestions human-confirmed until that preprocessing is confirmed.
