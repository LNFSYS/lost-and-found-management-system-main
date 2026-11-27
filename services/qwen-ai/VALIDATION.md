# Local validation — 2026-11-24 (Asia/Bangkok)

## Result

Qwen3-VL-2B-Instruct successfully loaded and generated schema-valid image analysis
on this Windows laptop's RTX 3050 Laptop GPU (4 GB), using NF4 + FP16. This is
measured functionality for the tested images and settings, not a guarantee for
all images, resolutions, workloads, or machines.

Model: `Qwen/Qwen3-VL-2B-Instruct`, revision
`89644892e4d85e24eaac8bacfd4f463576704203`. Official weights downloaded: 4,255,140,312
bytes. No external model code was trusted/executed via `trust_remote_code`.

## Environment and dependencies

- Windows, Python 3.11.9 x64; dedicated `services/qwen-ai/.venv`.
- NVIDIA driver 616.64; GPU compute capability 8.6; 4,096 MiB VRAM.
- PyTorch `2.8.0+cu126`, torchvision `0.23.0+cu126` (CUDA runtime 12.6).
- Transformers 4.57.6, Accelerate 1.12.0, BitsAndBytes 0.49.2.
- FastAPI 0.165.0, Pillow 12.3.0, Pydantic 2.14.4, Uvicorn 0.54.0.
- Full installed dependency list: `requirements.lock.txt`.
- `pip check`: passed; CUDA available; real BitsAndBytes NF4 linear kernel: passed.
- No pre-existing global PyTorch was detected. No Florence environment was changed.

## Actual model measurements

Settings: image edge 448, max output 384 tokens, deterministic generation, SDPA,
single persistent worker, 88% allocator cap, no CPU fallback used.

| Test | Result |
| --- | --- |
| Real local campus photograph, warm HTTP call | 200; JSON schema valid; 8.441 s wall / 8.333 s inference |
| Real photograph, HTTP cold start | 200; JSON schema valid; 29.427 s wall / 9.782 s inference |
| Two additional independent cold loads | Success; 26.135 s and 23.896 s total |
| Final cold-start report after fixing a diagnostic snapshot alias | Success on CUDA; 23.401 s and 23.211 s total; 8.597 s and 8.729 s inference |
| Synthetic bottle fixture, 3 sequential warm requests | All 200; inference 9.414, 9.687, 9.645 s |
| Two simultaneous real-model HTTP requests | One 200 in 10.383 s, one 429 in 0.330 s |
| Actual Node adapter calling local Qwen HTTP API | Passed in 9.821 s; stable mapped response, no invented embedding |
| Incorrect API key | 401 |
| Malformed PNG bytes | 422; model not invoked |

Inputs:
- `apps/web/src/assets/fptu-da-nang-campus.jpg`: actual photograph already in repository.
- `apps/web/tests/fixtures/appointment-item.png`: explicitly synthetic bottle fixture,
  not a real lost/found claim. No private user images were used.

Last per-worker CUDA sample:
- allocated: **1,514.6 MiB**;
- reserved: **1,796.0 MiB**;
- peak allocated during inference: **1,599.9 MiB**;
- CUDA-reported free: 1,481.7 MiB.

`nvidia-smi` at the end of the warm benchmark reported **2,156 / 4,096 MiB used**,
including other desktop applications, and 1,807 MiB free. PyTorch and NVIDIA/WDDM
accounting differ; these samples do not represent a continuously sampled system
peak. After the final worker closed, memory returned near desktop baseline.

Reports with no OCR/images/secrets are in ignored `artifacts/`: `campus-warm.json`,
`campus-cold-retry.json`, `benchmark.json`, `cold-starts.json`. They are local
measurement artifacts, not model weights or public inference results.

## Automated checks

- Python: **23 passed**, no failures, no weights downloaded by unit tests.
  Includes bad/missing auth, missing service key, valid output, invalid MIME/content,
  upload size, chunked body limit, image dimensions, form validation, strict model
  JSON, simulated OOM downscaling, worker timeout/termination/recovery, process reuse,
  busy-slot protection, and WDDM desktop process classification.
- Node: **11 passed**: 7 new Qwen adapter cases and 4 existing Gemini/image-category
  regression cases. Includes sequential multi-image requests, auth headers,
  non-success HTTP status, invalid schema, timeout and configuration validation.
- TypeScript API project: `tsc --noEmit` passed.
- Architecture checker: 237 production files, **0 violations**.
- Scoped `git diff --check`: passed.
- Actual HTTP tests, GPU kernel and real inference are separate from mocked tests.

## Failures encountered and resolved/remaining

1. Initial conservative GPU check rejected desktop Windows processes because
   WDDM includes them in `--query-compute-apps`. Fixed by a narrow desktop-client
   allowlist only when their memory is N/A. Unknown processes and Python AI workers
   still block loading; free-memory checks remain. This is a coordination aid,
   not a security boundary or guarantee against another process starting later.
2. One early model worker exited without a Python error. The request correctly
   returned 503 and released its slot. The native root cause was not captured in
   that first attempt; subsequent independent loads and repeated inferences passed.
   Worker exit-code logging was added. This transient remains unexplained and
   should be monitored rather than claimed eliminated.
3. Two manual probes used deliberately short 3–5 second client timeouts but
   arrived after the preceding request finished. They were accepted as normal
   inference and timed out on the client, then finished server-side. The dedicated
   synchronized two-request benchmark subsequently verified 200/429 behavior.
4. Transformers warns that inherited sampling flags are ignored under deterministic
   generation. This did not prevent inference. TestClient reports an upstream
   httpx deprecation warning; tests pass.

## Limits / NOT TESTED

- CPU FP32 fallback is implemented and opt-in, but actual model CPU inference is
  **NOT TESTED**. Do not assume it is fast or fits available RAM with other apps.
- Real GPU OOM recovery was **NOT forced**; the retry branch is unit-tested using
  a simulated CUDA OOM. Real normal inference did not OOM.
- Hard timeout recovery is tested with real spawned fake workers, not by forcing
  a live CUDA hang. Native-driver crash recovery cannot be guaranteed.
- No representative Lost/Found photo dataset or recognition-accuracy benchmark.
  On the synthetic bottle, the model interpreted the printed fixture label as the
  object/brand and guessed a material. Schema validity is not factual accuracy.
  Descriptions remain drafts; brand/material/OCR and private text require review.
- Current prompt outputs English; Vietnamese catalog mapping may need evaluation.
- Full authenticated browser/mobile-to-Node workflow, production database,
  Florence coexistence, Tailscale/Cloudflare/VPS access, CPU fallback, long-duration
  soak/load testing: **NOT TESTED**.
- No Git push, deployment, public tunnel, firewall or VPS change was performed.
- Existing DINOv2/Gemini/claim verification code paths remain default. The real
  backend `.env` was not switched. Florence source was not present in this checkout.
- Validation servers/workers were stopped after testing to release GPU memory.
  Launch with `scripts/start.ps1` (or the README Uvicorn command) when needed.

## Files delivered

- `app/`: configuration, schema, image validation/auth API, process runner,
  GPU-process guard, quantized engine.
- `scripts/`: setup/start, secret creation, preflight, revision-pinned model download,
  API smoke/benchmark/cold-start tests, direct model-load diagnosis and Node HTTP smoke.
- `tests/`, `.env.example`, `.gitignore`, requirements and installed lock,
  illustrative response JSON, README and this report.
- Backend: new `qwen-image-analyzer.ts` and tests; optional provider selection in
  `main/services.ts`; correct Qwen attribution in `image-analysis.use-cases.ts`;
  documented settings in root `.env.example`.
- Earlier mobile/Android and root package changes predated this AI task and were
  left intact; they are not part of the Qwen implementation.
