# Florence-2 Phase 5 — Single-base-model VPS API

## Windows local setup

Use Python 3.11 and keep this service separate from the LNFS Node, MobileNet and matching services. From this directory in PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\start_local.ps1
```

The launcher creates an ignored `.env` with a random local API key on first run, then binds one worker to `127.0.0.1:8000`. It does not print the key. The first start downloads `florence-community/Florence-2-large-ft` to the Hugging Face cache; enough free disk and RAM are required. `PRELOAD_MODEL=1` means the HTTP server is not ready until model loading finishes. To inspect the local key without printing it, read `.env` into a local variable in PowerShell and send it only to localhost:

```powershell
$key = ((Get-Content .env | Where-Object { $_ -like 'API_KEY=*' }) -split '=',2)[1]
curl.exe -H "Authorization: Bearer $key" -F "file=@C:\path\to\photo.jpg" "http://127.0.0.1:8000/analyze?caption_mode=lora&include_dense=true"
```

Run tests and a local CPU benchmark after the model has loaded:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe scripts\benchmark_cpu.py --image C:\path\to\photo.jpg --repeat 3 --output local_benchmark.json
```

This service is not connected to the LNFS web/Node workflow by default. No production configuration or matching service is changed.

Swagger is available at `http://127.0.0.1:8000/docs`. `GET /health` returns `ok`, `loaded`, `adapter_loaded`, `device` and `status`; `ok=false` while the model is not ready. A single-request HTTP check with a real image is available via:

```powershell
.\.venv\Scripts\python.exe scripts\verify_local.py --image C:\path\to\photo.jpg
```

This verifier connects only to localhost, checks 401/422, and performs one expensive authenticated inference. Do not use sensitive documents as test images.

### Test from the LNFS web form (development only)

The Node integration is opt-in and does not replace DINOv2, MobileNet or Gemini. Start this Florence service first. In the repository root `.env`, configure `FLORENCE_ENABLED=true`, `FLORENCE_URL=http://127.0.0.1:8000` and `FLORENCE_API_KEY` to the **same private value** as this service's `.env` `API_KEY`. Do not commit either file. Put `VITE_FLORENCE_ENABLED=true` in `apps/web/.env.local` and restart the web and Node dev servers:

```powershell
npm.cmd run dev --workspace=@lnfs/api-node
npm.cmd run dev --workspace=@lnfs/web
```

Sign in, open the LOST/FOUND post form, select exactly one non-sensitive item image and click **Thử Florence-2 (1 ảnh)**. Review the English visual caption and object labels before using them; the feature does not auto-select a category or confirm ownership. The existing **Phân tích ảnh** button still uses its configured provider. If the Florence service is unavailable, the form remains editable and shows an error; it does not silently fall back to another AI. Set both flags back to `false` when testing is done. Never use this path for identity documents.

## What this package contains

This project includes the **actual trained LoRA adapter** from Phase 3 (Flickr8k, 40 training steps), not a sample or empty adapter. It uses the checkpoint `florence-community/Florence-2-large-ft` and the adapter in `adapter/`.

**Routing:** `<DETAILED_CAPTION>` uses LoRA by default, while `<MORE_DETAILED_CAPTION>`, `<OD>` and optional `<DENSE_REGION_CAPTION>` run with LoRA disabled. There is **one** base model in RAM. This approach uses PEFT's `disable_adapter()` context manager; it does not merge weights or load two copies. The API is English-output; no translation service is bundled.

## GitHub preparation

This directory is part of the existing LNFS repository; do not initialize another Git repository. The 4.7 MB LoRA `adapter/adapter_model.safetensors` belongs in the Florence commit and is below GitHub's ordinary file limit. The multi-GB base model downloads to the ignored Hugging Face cache and must not be committed. Review staging because the parent repository may contain unrelated work:

```bash
git switch -c feature/florence2-phase5-vps
git add apps/Florence2_Phase5_VPS
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat(ai): prepare Florence-2 Phase 5 local and VPS service"
git push -u origin feature/florence2-phase5-vps
```

Run the final `git push` only after review/approval. `.env`, `.venv`, cache, logs, uploads and benchmark artifacts are ignored. If a future adapter exceeds GitHub's file limit, use Git LFS or private artifact storage rather than removing or replacing the trained weights.

## Ubuntu VPS preparation (not executed)

**Do not use the existing LNFS 2 GB VPS for Florence-2-large.** Windows local sampling observed roughly 3.55 GB steady RSS and about 5 GB peak process memory. Prefer at least 8 GB real RAM plus headroom for the OS; swap is only an emergency buffer. CPU latency on Ubuntu must be benchmarked separately. Do not modify the existing DINOv2, Node.js, PM2, Nginx or database deployment while preparing this service.

After the feature branch is reviewed and available on GitHub, an administrator on a suitable Ubuntu host can run these commands. Replace `<branch>` with the reviewed branch. The installed Python must be 3.11 or a separately verified compatible version:

```bash
git clone --branch <branch> --single-branch https://github.com/LNFSYS/lost-and-found-management-system-main.git lnfs-source
cd lnfs-source
python3 --version
sudo useradd --system --create-home --shell /usr/sbin/nologin lnfs-ai
sudo install -d -o lnfs-ai -g lnfs-ai /opt/lnfs-florence2
sudo rsync -a --exclude .venv --exclude .env apps/Florence2_Phase5_VPS/ /opt/lnfs-florence2/
sudo chown -R lnfs-ai:lnfs-ai /opt/lnfs-florence2
sudo -u lnfs-ai python3 -m venv /opt/lnfs-florence2/.venv
sudo -u lnfs-ai /opt/lnfs-florence2/.venv/bin/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
sudo -u lnfs-ai /opt/lnfs-florence2/.venv/bin/python -m pip install -r /opt/lnfs-florence2/requirements.txt
sudo install -d -m 0700 /etc/lnfs
sudo install -m 0600 /opt/lnfs-florence2/deploy/florence2.env.example /etc/lnfs/florence2.env
sudoedit /etc/lnfs/florence2.env
```

Set a new high-entropy `API_KEY` in the private environment file before startup. Do not put the key in Git, shell history, screenshots or chat. Confirm `PRELOAD_MODEL=1`, `REQUIRE_LORA=1` and `FLORENCE_ADAPTER_DIR=adapter`. The script `scripts/start_vps.sh` anchors paths to its own directory, uses one worker, CPU-only inference and `127.0.0.1:8000`. Its first run downloads the base checkpoint into `/opt/lnfs-florence2/.cache/huggingface`; allow disk space and network access. The directory must remain writable by `lnfs-ai`.

The sample `deploy/florence2.service` assumes `/opt/lnfs-florence2` and `lnfs-ai`; edit those paths in a copy if installing elsewhere. Only after local review on the target host:

```bash
sudo install -m 0644 /opt/lnfs-florence2/deploy/florence2.service /etc/systemd/system/florence2.service
sudo systemctl daemon-reload
sudo systemctl enable --now florence2
sudo systemctl status florence2
sudo journalctl -u florence2 -f
curl --fail http://127.0.0.1:8000/health
```

The optional `deploy/nginx-florence2.conf.example` is a **location snippet**, not a complete TLS site. Add it only inside an existing HTTPS server block, configure Basic Auth and test Nginx before reload. Keep the upstream on loopback; `/analyze` additionally requires its bearer key. Do not expose `/health` or `/docs` publicly without the proxy auth boundary. Consider rate limits because one worker serializes inference and has no bounded queue. For rollback, disable the new `florence2` unit and remove its Nginx location; leave the existing LNFS services untouched.

### API contract and test

```bash
curl http://127.0.0.1:8000/health
curl -X POST 'http://127.0.0.1:8000/analyze?caption_mode=lora&include_dense=true' \
 -H 'Authorization: Bearer YOUR_SECRET' -F 'file=@test.jpg'
```

`caption_mode=base` disables LoRA for the short detailed caption. The `objects` result includes `bboxes` and `labels` in pixel coordinates, when objects are detected. The regex removes spaces before `<loc_...>` in Florence generated text, matching the Phase 1 fix.

Before any public routing, verify locally on the Ubuntu host with one non-sensitive JPG/PNG image:

```bash
sudo /opt/lnfs-florence2/.venv/bin/python /opt/lnfs-florence2/scripts/verify_local.py --image /path/to/test.jpg --env-file /etc/lnfs/florence2.env
```

The verifier reads the protected environment file without printing the key; only a local administrator should run that command. It checks health/docs, 401, 422 and exactly one successful caption/OD/dense-region request. Verify `loaded=true`, `adapter_loaded=true`, `device=cpu` and bounded boxes. Never log the key.

### CPU benchmark without HTTP

```bash
python scripts/benchmark_cpu.py --image test.jpg --repeat 3 --output cpu_benchmark.json
```

The script warms both base and LoRA, then records per-iteration elapsed time, process CPU seconds, sampled RSS and median/p95. With only two repeats, p95 is not statistically meaningful. It **does not** capture OS peak RSS, full VPS CPU utilization or complete swap history. For monitoring run `free -h`, `vmstat 1`, `journalctl -u florence2` and `ps -o rss,vsz -p PID`. For quality comparisons inspect the same images manually.

### Optional Ubuntu SSD Swap

Before enabling swap, check `free -h`, `swapon --show`, `df -h /` and hosting restrictions. The optional script refuses to overwrite an existing `/swapfile` and reserves at least 2GB disk space:

```bash
sudo bash scripts/setup_swap_ubuntu.sh 8
```

Do not use this step when swap is already set up or your VPS provider prohibits it. Some filesystems do not support `fallocate` swap files; this script assumes a compatible filesystem.

## Limits / safety

- One inference at a time inside each worker, no request queue size limit: add rate limiting/queueing and reverse proxy limits for production.
- API key required on `/analyze`, `/health` is public without secret details.
- Image size/file byte limits enforced; avoid uploading private/sensitive images to public VPS instances.
- Ubuntu CPU speed is unverified; benchmark on a suitable host before enabling any proxy route.
- Model and adapter cannot be shipped as one combined small model: the adapter still needs base weights downloaded once.
