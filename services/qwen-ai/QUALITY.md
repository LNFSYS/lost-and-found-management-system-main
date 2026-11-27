# LNFS Qwen quality changes — 2026-11-26

## Diagnosis

The original data flow was upload → Pillow EXIF/RGB/448 px resize → Qwen NF4/FP16
greedy generation → JSON/Pydantic → Node adapter → live catalog → web/mobile form.

Problems were not all model quality:

* The prompt requested short English phrases and only three distinguishing features.
* Node explicitly returned `confidence: 0`. Web multiplied it by 100. Mobile also
  substituted 0.85/0.9 for absent scores. None was calibrated Qwen confidence.
* Node concatenated every image caption, including identical captions/sentences.
* English `backpack` did not match the actual Vietnamese catalog entry `Balo`.
  Web already set both dependent dropdowns correctly when given a real leaf category.
* Raw-output inspection on opt-in local fixtures found duplicate `caption` JSON keys,
  repetitive OCR, and truncated output. `json.loads` previously silently kept the
  last duplicate key. The parser now rejects that ambiguity.

Read-only database verification found 40 active category rows and resolved backpack
to the existing Balo row under its existing parent. No category IDs were invented,
no catalog rows were changed. Aliases only resolve unique existing leaf names;
conflicting or unsupported detections remain unresolved.

## Implementation

`app/engine.py` contains the full Vietnamese LNFS prompt. It asks for visible object
type, colors, shape, pattern, straps/handles/zippers/pockets, wear and up to six
distinguishing details. It excludes hidden contents, inferred dimensions, ownership,
and brands inferred from stripes/logos. Unknown values are null/empty lists.

`app/schema.py` retains the original fields for clients and adds `primary_color`,
`secondary_colors`, `shape`, and `pattern`. Both primary/secondary and legacy colors
are retained during normalization. A conservative brand gate requires matching
visible text; readable text alone still does not prove authenticity or brand identity.

LM Format Enforcer 0.11.3 (interegular 0.3.3) supplies a JSON-schema token filter
through Transformers' supported prefix callback. This is **not a built-in Qwen
confidence or guaranteed factuality mechanism**. Pydantic and duplicate-key checks
remain mandatory; malformed/truncated output fails closed instead of being guessed.
Lists are capped at six items during generation, caption at 360 characters, total
generation at 640 tokens, greedy decoding, repeated 16-token sequences discouraged.
One worker, NF4/FP16, memory cap, timeout and OOM reduction remain in place.

Captions and evidence lists are normalized/deduplicated, including sentence boundaries
without spaces. If a caption rambles beyond two sentences or reaches its field cap,
the service builds a concise Vietnamese draft from the already-produced object,
colors and distinctive attributes, without inventing facts or translating unseen
content. Normal short captions are retained. All raw model output is excluded from
normal service logs; only `--include-output` benchmarks save it in ignored artifacts.

Node forwards shape/pattern and uses the current leaf catalog for bilingual mapping.
`confidence=null`, `confidence_source="unavailable"` propagate through the API.
Web/mobile display **Chưa có điểm tin cậy**, preserve manual editing, and never
substitute a numeric score for Qwen. Existing `ai_tags.confidence` is NOT NULL, so
unscored drafts do not submit/persist scored tags. Title/description/category are
still saved; adding nullable tag persistence would need a separate DB migration.
The contact-photo approval gate also explicitly rejects unknown confidence.

## Reproduce

Stop resident Qwen/Florence GPU workers before standalone benchmarking. From this
service directory:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts/benchmark_quality.py C:/photos/backpack.jpg --include-output --report artifacts/backpack-quality.json
```

The benchmark runs the preserved original prompt and the current prompt on identical
SHA256 images, at 448/576/672 px, sequentially on one loaded model. It records raw
output only with the explicit flag, schema status, latency, per-request peak CUDA
allocation, and an unfilled human-review rubric for identification/colors/OCR,
attribute recall, unsupported attributes, category and description usefulness.
`--reference-report` can attach separately measured Florence results. Compare only
identical image hashes and document hardware/settings; this script never starts
Florence or modifies its artifacts.

## Verification and limits

TypeScript checks passed for backend/web/mobile; mobile lint and web build passed.
Four Playwright tests passed: LOST and FOUND, each with resolved and unresolved
categories; image upload, parent/child dropdowns, null confidence label, colors,
description population, manual edits and submission were verified. Model results
in these browser tests are mocked. Node regression tests cover the supplied backpack
example with repeated captions, bilingual matching, null confidence and fail-closed
contact checks. Python tests cover schema/evidence normalization, no dropped colors,
duplicate keys, auth/uploads, timeout/recovery and OOM reduction.

GPU fixtures: one synthetic red bottle image (explicitly marked as a test asset),
and a real campus photograph. They are **not a representative lost-item dataset**.
The initial English-expanded prompt still produced duplicate keys and a truncated
OCR loop. The first constrained variant still produced long repetitive captions;
these observations led to the bounded generation and caption cleanup above.

Measured generation results (same NF4 model; seconds, peak allocated MiB):

| Variant | Bottle | Campus | Peak allocated |
| --- | ---: | ---: | ---: |
| Original prompt, 448 px | 9.973 | 8.651 | 1600.1 |
| Bounded schema, 448 px | 22.586 | 25.105 | 1699.1 |
| Bounded schema, 576 px | invalid JSON, 42.507 wall | 24.537 | 1753.6 |
| Bounded schema, 672 px | 27.095 | 25.062 | 1802.9 |

These timings exclude model load (21.682 seconds in this run). Structured output
and longer Vietnamese observations are slower than the short original prompt.
No percentage accuracy is computed from two non-representative images.

Final automated counts: **27 Python tests**, **23 Node regression tests**, **4 browser
tests** passed. Architecture check: 238 production files, zero violations. Existing
warnings: Starlette/httpx test-client deprecation and Vite bundle size, neither a
test failure.

Final real HTTP smoke after caption cleanup: campus image returned 200, schema valid,
CUDA/NF4 active, 55.539 seconds cold wall time / 30.626 seconds inference,
1698.8 MiB peak allocated and 1738 MiB reserved. Invalid API key returned 401;
malformed image returned 422. Real Node → Qwen adapter smoke passed in 20.802 seconds
on the synthetic bottle, including null confidence and unavailable source assertions.
The Qwen localhost service was left running with 448 px / 640 tokens. The web route
with a real signed-in user and an actual backpack photo, and mobile device rendering,
were not exercised; browser route tests used mocked model results.

Keep 448 px as default. The measured bounded 576 px bottle run failed JSON validation;
increasing resolution is not automatically an accuracy improvement. No measured OOM
occurred. See the local `artifacts/quality-final.json` for raw benchmark observations.
The final caption-cleanup fallback was added after that generation benchmark; it is
separately covered by regression and HTTP smoke tests.

The model still mistakes the synthetic test label for item semantics and sometimes
uses English field values despite the Vietnamese instruction. Materials, OCR and
brand identity require human review. JSON validity is not image accuracy. No claim
of superior performance to Florence is justified: no accessible Florence pipeline
or real backpack image was supplied, and no real-image backpack accuracy test ran.
The repository default provider remains Gemini; the user's existing local Qwen
selection was retained. No Florence weights, production settings, Git push or VPS
deployment were changed.

## Files

* Service: `app/{engine,schema,config,main,gpu_guard}.py`, requirements/lock,
  `.env.example`, example JSON, README, benchmark script and quality tests.
* Backend: Qwen adapter/tests; `domain/qwen-description.ts` and tests;
  image-analysis result/port; nullable-confidence guards in post/contact-photo use cases.
* Web: analysis API type, `story-post-form.tsx`, Playwright regression cases.
* Mobile: analysis API type, media-picker draft/display and post-create handling.

References: [official Qwen3-VL](https://github.com/QwenLM/Qwen3-VL),
[LM Format Enforcer](https://github.com/noamgat/lm-format-enforcer).
