# LNFS Qwen3-VL image analysis

Independent FastAPI service for `Qwen/Qwen3-VL-2B-Instruct`. It does not import,
modify, or start Florence. This checkout contains DINOv2 matching and Gemini
adapters; Florence/LoRA source was not found. Existing AI services and virtual
environments are preserved. Florence adapters cannot be applied to Qwen.

The supplied ZIP was reviewed as a starter, not executed as an installer. This
implementation replaces its unvalidated output and blocking async inference with
a strict response schema and a persistent isolated worker.

## Windows setup

Use Python 3.11 x64 and an NVIDIA driver supporting CUDA 12.6. The CUDA toolkit
does not need to be installed separately for these PyTorch binary wheels.
From `services/qwen-ai` in PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --no-cache-dir torch==2.8.0 torchvision==0.23.0 'pillow>=12.1.1,<13' --index-url https://download.pytorch.org/whl/cu126
.\.venv\Scripts\python.exe -m pip install --no-cache-dir -r requirements.txt
.\.venv\Scripts\python.exe scripts/preflight.py
.\.venv\Scripts\python.exe scripts/init_env.py
.\.venv\Scripts\python.exe scripts/download_model.py
```

Alternatively run `scripts/setup.ps1` for the install, preflight and secret setup,
then run `download_model.py` separately. No shell activation or system-wide
execution-policy change is necessary. Dependencies stay in `.venv`.

`init_env.py` creates a random key only when `.env` is absent, without printing it.
The downloader fetches only inference assets from the official repository, checks
disk space, and pins `MODEL_REVISION` in the local `.env`. Weights are about 4.26 GB
unquantized on disk; NF4 is applied at loading, not to the downloaded files. Keep
at least 12 GB free before setup to cover CUDA packages, weights and temporary
downloads. `.venv`, `.env`, `.cache`, logs and validation artifacts are ignored.

For a repeat installation, apply the generated `requirements.lock.txt` after the
CUDA install to reproduce the validated dependency versions. Do not install this
requirements file into an existing Florence environment.

## Start locally

```powershell
.\scripts\start.ps1
```

Or, if PowerShell script execution is disabled:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --limit-concurrency 8 --no-access-log
```

Keep one Uvicorn worker. Model loading is lazy on the first analysis; later calls
reuse it. `/health` is public on localhost and reports process/model status,
CUDA availability, active device and model name. `ok` with `model_loaded=false`
means the API is alive, not that inference has been verified. Hardware is probed
at startup in a short-lived process. `/ai/model-info` requires the key and reports
the actual device/quantization plus the last sampled VRAM metrics; these are not
a continuously refreshed global GPU monitor.

## API contract

- `GET /health`: no key, no model load.
- `GET /ai/model-info`: `Authorization: Bearer <AI_API_KEY>`.
- `POST /ai/analyze`: same header, multipart `image`, required `type=LOST|FOUND`,
  optional `user_description` (maximum 2,000 characters).

JPEG, PNG and WebP only; MIME must match decoded content. Animated files,
malformed files, oversized uploads and images above 20 megapixels are rejected.
The complete multipart body is bounded as well as the image file. Images are
EXIF-oriented, converted to RGB, resized, and stripped of metadata before inference.
No uploaded images, prompts, OCR, API keys or raw model output are written to logs.

Example PowerShell request (read the key locally; do not paste it into source):

```powershell
$keyLine = Get-Content .env | Where-Object { $_ -like 'AI_API_KEY=*' }
$qwenKey = $keyLine.Split('=', 2)[1]
curl.exe http://127.0.0.1:8000/ai/analyze -H "Authorization: Bearer $qwenKey" -F "image=@C:/photos/wallet.jpg;type=image/jpeg" -F "type=FOUND"
```

`example-response.json` is illustrative, not a measured model result. Successful
responses contain schema-validated `category`, `object_name`, `colors`,
`primary_color`, `secondary_colors`, `shape`, `pattern`, `material`, `brand`,
`visible_text`, `distinctive_features` and `caption`. Unknown
scalar attributes are null; unknown lists are empty. The prompt discourages
invented attributes and excludes private ID/contact text. This is not a guarantee
of factual correctness or comprehensive PII redaction: review all drafts before
publication. Image text and user descriptions are treated as untrusted evidence.
No result establishes ownership. The prompt requests Vietnamese descriptions and an
English object category for catalog mapping. `confidence=null` and
`confidence_source="unavailable"` mean there is no calibrated classification score.
LM Format Enforcer restricts generated tokens using the Pydantic JSON schema through
Transformers' `prefix_allowed_tokens_fn`. Pydantic and duplicate-key rejection still
validate the result: constrained JSON does not guarantee factual correctness, and
generation can still hit the token limit. There is no silent unconstrained fallback.

Draft wording capitalizes the item name and sentence starts without changing OCR.
Short coherent captions are kept; repetitive, list-like or speculative captions are
rebuilt from the existing colors/features as connected Vietnamese prose. Phrases
such as “có thể dùng để…” are excluded from descriptions and feature chips. This
cleanup does not make a second model call or verify that an asserted material is
visually correct; users must still review the observations.

Errors: 401 wrong/missing key; 413 upload/dimensions too large; 415 MIME mismatch;
422 invalid image/form; 429 busy (Retry-After: 5); 502 invalid model JSON;
503 unavailable model/CUDA/OOM; 504 model-load or inference timeout.
Raw exception strings and raw model text are not returned.

## 4 GB VRAM policy and failures

- Default: NF4 with double quantization, FP16 compute, SDPA, edge 448 px,
  640 output tokens, 88% PyTorch allocator cap. No Flash Attention build is needed.
- One active inference, immediate 429 for concurrent inference; there is no
  unbounded GPU queue. Uvicorn also bounds concurrent HTTP connections.
- A worker lock prevents duplicate Qwen workers across service instances.
  By default loading refuses another NVIDIA compute process (with a narrow list
  of Windows desktop clients excluded when WDDM reports their memory as N/A) and requires 2,800 MiB
  free VRAM. Stop Florence/DINO GPU workers before loading Qwen. Do not start them
  while Qwen is resident. External processes cannot be prevented from allocating
  GPU memory later, and Windows WDDM accounting can be incomplete.
- `MAX_IMAGE_EDGE`, `MAX_NEW_TOKENS`, `GPU_MEMORY_FRACTION`, `MIN_FREE_VRAM_MB`,
  and timeouts are configurable. The PyTorch cap does not cap driver/other-process memory.
- On generation OOM, drop temporary tensors, clear the CUDA cache, and retry once
  at edge 224. A second failure returns 503 and destroys the worker. Successful
  requests keep the model/cache resident; they do not unload and reload the model.
- Loading gets 600 seconds by default; generation gets 120 after loading. A
  timeout terminates the whole worker before releasing the inference slot. This
  avoids pretending that cancelling an HTTP request stops a CUDA kernel. Next
  request starts a fresh worker. A disconnected client may still consume its slot
  until completion or this timeout; avoid automatic retries after disconnects.
- `QWEN_DEVICE=cpu` is an explicit FP32 fallback. `ALLOW_CPU_FALLBACK=true` also
  permits CPU after CUDA/quantization load failures. It is off by default because
  FP32 weights alone can need roughly 8+ GB RAM and inference may be very slow.
  The actual fallback device is exposed in model-info. It has not necessarily been
  benchmarked just because the GPU mode passed; see VALIDATION.md.

If CUDA is unavailable, run `preflight.py`, inspect `nvidia-smi`, and confirm
`torch.__version__` includes `+cu126`. Do not replace it with a CPU-only wheel.
If BitsAndBytes fails, inspect the preflight NF4 kernel result and reinstall the
recorded compatible versions in this venv. Do not silently switch to unquantized
FP16 on a 4 GB GPU. If model JSON is truncated, raise the output-token limit within
the documented bounds, keeping resolution low, and retry explicitly.

## LNFS integration

The Node backend has an optional Qwen adapter for the existing post-image draft
analysis route. In the **root backend `.env`**, explicitly set:

```dotenv
LNFS_IMAGE_ANALYSIS_PROVIDER=qwen
QWEN_SERVICE_URL=http://127.0.0.1:8000
QWEN_API_KEY=<same private key as service AI_API_KEY>
QWEN_TIMEOUT_MS=180000
```

Restart only the local backend after editing. Default is `gemini`, preserving
existing behavior. DINOv2 feature extraction/embeddings and claim photo verification
are deliberately unchanged. Qwen does not provide compatible DINO embeddings,
and its descriptive output must not replace claim/ownership verification.
Multiple images are sent sequentially; per-image timeout is configurable. A cold
model should be warmed with `scripts/test_api.py` before serving Node requests,
or use a larger backend timeout (up to 1,800,000 ms).

The adapter validates upstream JSON, does not follow redirects with the secret,
maps busy/timeout/failure responses, and preserves the frontend response shape.
`confidence=null` denotes an unavailable calibrated score. Web/mobile show
"Chưa có điểm tin cậy" and retain editable descriptions. Repeated captions across
images are deduplicated. English/Vietnamese aliases resolve only against the live
leaf-category catalog, and conflicting/unknown categories remain unresolved.
Existing `ai_tags.confidence` is NOT NULL: unscored draft signals are not submitted
or persisted as fake scored tags. Description/category are still saved normally.
No automatic fallback starts another GPU model.
No real backend `.env` has been switched by this implementation.

The web and mobile draft forms now expose separate **Phân tích bằng Gemini** and
**Phân tích bằng Qwen** buttons. Each sends multipart `provider=gemini|qwen` to
`POST /api/posts/analyze-image`. The explicit choice overrides the default for that
request; older clients omitting `provider` retain the configured default. Both
providers can be configured at once. An unavailable Qwen service returns an error
for that choice and does not silently switch providers; Gemini remains selectable.

## VPS connectivity (documentation only)

No public listener, tunnel, production deployment or firewall change is made here.
Keep the Node client secret server-side; never put it in `EXPO_PUBLIC_*` or `VITE_*`.

Option A: put VPS and laptop in the same Tailscale tailnet. Restrict access with
tailnet grants/ACLs to the VPS identity. Proxy the localhost listener with Tailscale
Serve HTTPS, then set QWEN_SERVICE_URL to that private HTTPS name. Verify the Serve
URL is reachable only inside the tailnet. Do not enable Tailscale Funnel.

Option B: configure a named Cloudflare Tunnel with an ingress route to
`http://127.0.0.1:8000` and a deny-by-default Cloudflare Access service-token policy.
Keep Bearer authentication in this app as a second layer. An additional Node proxy
or adapter configuration must supply the Cloudflare Access client ID/secret headers;
the current Qwen adapter sends only the Qwen Bearer key. Do not use an unrestricted
quick tunnel. Configure upload limits/timeouts at the proxy, and do not log bodies.
Long inference may exceed provider HTTP timeouts; prefer the private Tailscale path
or add a durable asynchronous job API before production rather than weakening auth.

The laptop must remain awake, powered and reachable. Rotate secrets on both ends
if exposed. Never commit model weights, certificates, tunnel tokens or `.env`.

## Validation

```powershell
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe scripts/preflight.py
.\.venv\Scripts\python.exe -m pytest tests -q
# Start the service first, then use a real local JPEG/PNG/WebP:
.\.venv\Scripts\python.exe scripts/test_api.py C:/photos/wallet.jpg
```

Tests cover authentication before parsing, bounded chunked bodies, image content,
schema, failure responses, OOM downscaling, worker reuse and hard timeout/recovery.
`test_api.py` validates real HTTP results and writes measurements to ignored
`artifacts/smoke.json`, without saving image content or OCR. For Node tests, from
repository root run `node_modules/.bin/tsx.cmd --test apps/api-node/src/modules/posts/infrastructure/qwen-image-analyzer.test.ts`.
Actual environment results and limitations are recorded in VALIDATION.md.
Quality changes, regression coverage and resolution benchmarks are in QUALITY.md.

Additional opt-in checks (do not run GPU benchmarks concurrently):

```powershell
# With the local API running, exercise repeat calls and real 429 admission:
.\.venv\Scripts\python.exe scripts/benchmark_api.py ../../apps/web/tests/fixtures/appointment-item.png
# Stop the resident Qwen API/worker first; test two independent cold starts:
.\.venv\Scripts\python.exe scripts/test_cold_starts.py
# From repository root, exercise the real Node adapter against localhost:8000:
node_modules/.bin/tsx.cmd services/qwen-ai/scripts/test_node_integration.mts
```

References: [official model](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct),
[LM Format Enforcer Transformers integration](https://github.com/noamgat/lm-format-enforcer),
[BitsAndBytes Windows/CUDA support](https://huggingface.co/docs/bitsandbytes/installation),
[PyTorch install](https://pytorch.org/get-started/locally/),
[Tailscale Serve](https://tailscale.com/kb/1312/serve),
[Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).
