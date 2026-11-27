import io
import logging
import multiprocessing as mp
import queue
import json
import subprocess
import sys
import threading
import time

from filelock import FileLock, Timeout as LockTimeout
from PIL import Image

from .config import ROOT, Settings

log = logging.getLogger("lnfs.qwen")


class ServiceError(Exception):
    def __init__(self, code, status=503):
        self.code, self.status = code, status
        super().__init__(code)


def inference_worker(settings_data, incoming, outgoing):
    settings = Settings.model_validate(settings_data)
    lock_dir = ROOT / ".cache"
    lock_dir.mkdir(exist_ok=True)
    # Guards multiple instances of this service, not unrelated Florence processes.
    lock = FileLock(lock_dir / "qwen-worker.lock")
    try:
        lock.acquire(timeout=0)
    except LockTimeout:
        outgoing.put({"event": "error", "code": "worker_already_running"})
        return
    engine = None
    try:
        while True:
            job = incoming.get()
            if job is None:
                return
            try:
                if engine is None:
                    from .engine import Engine
                    engine = Engine(settings)
                    outgoing.put({"event": "ready", "info": engine.info()})
                with Image.open(io.BytesIO(job["image"])) as image:
                    result = engine.predict(image, job["type"], job["description"])
                outgoing.put({"event": "result", **result})
            except Exception as error:
                # Never return exception text: it may contain prompts, OCR, URLs or keys.
                kind = type(error).__name__
                code = "model_load_failed" if engine is None else "inference_failed"
                if kind == "OutOfMemoryError":
                    code = "gpu_out_of_memory"
                elif kind in {"ValidationError", "JSONDecodeError"} and engine is not None:
                    code = "invalid_model_output"
                elif str(error) in {"cuda_unavailable", "gpu_in_use"}:
                    code = str(error)
                outgoing.put({"event": "error", "code": code, "exception_type": kind})
                # Drop potentially poisoned CUDA state; next request uses a fresh process.
                return
    finally:
        lock.release()


class Runner:
    def __init__(self, settings: Settings, worker=inference_worker):
        self.settings, self.worker = settings, worker
        self.lock = threading.Lock()
        self.process = self.incoming = self.outgoing = None
        self.loaded = False
        self.state = "unloaded"
        self.last_error = None
        self.info = {"device": None, "quantization": "none-fp32" if settings.device == "cpu" else "nf4-fp16",
                     "cuda_available": None, "gpu_name": None, "vram": None}

    def probe_hardware(self):
        # Probe in a short-lived process so the API process holds no CUDA context.
        code = "import json,torch; a=torch.cuda.is_available(); print(json.dumps({'cuda_available':a,'gpu_name':torch.cuda.get_device_name(0) if a else None}))"
        try:
            result = subprocess.run([sys.executable, "-c", code], capture_output=True,
                                    text=True, timeout=60, check=True)
            self.info.update(json.loads(result.stdout.strip()))
        except (subprocess.SubprocessError, ValueError, OSError):
            self.last_error = "hardware_probe_failed"
            log.warning("hardware_probe_failed")

    def _start(self):
        context = mp.get_context("spawn")
        self.incoming, self.outgoing = context.Queue(1), context.Queue(2)
        self.process = context.Process(target=self.worker,
            args=(self.settings.model_dump(), self.incoming, self.outgoing), daemon=True)
        self.process.start()

    def close(self):
        if self.process is not None:
            if self.process.is_alive():
                self.process.terminate()
                self.process.join(5)
                if self.process.is_alive():
                    self.process.kill()
                    self.process.join(5)
            self.process.close()
        for channel in (self.incoming, self.outgoing):
            if channel is not None:
                channel.cancel_join_thread()
                channel.close()
        self.process = self.incoming = self.outgoing = None
        self.loaded = False
        self.info["device"] = None
        self.state = "unloaded"

    def analyze(self, image: bytes, post_type: str, description: str):
        if not self.lock.acquire(blocking=False):
            raise ServiceError("inference_busy", 429)
        started = time.perf_counter()
        try:
            if self.process is None or not self.process.is_alive():
                self.close()
                self._start()
            self.state = "inferencing" if self.loaded else "loading"
            deadline = time.monotonic() + (self.settings.inference_timeout if self.loaded else self.settings.load_timeout)
            self.incoming.put({"image": image, "type": post_type, "description": description}, timeout=1)
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ServiceError("inference_timeout" if self.loaded else "model_load_timeout", 504)
                try:
                    event = self.outgoing.get(timeout=min(0.25, remaining))
                except queue.Empty:
                    if not self.process.is_alive():
                        log.error("worker_exit", extra={"error_code": str(self.process.exitcode)})
                        raise ServiceError("worker_exited")
                    continue
                if event["event"] == "ready":
                    self.loaded, self.state, self.info = True, "inferencing", event["info"]
                    self.last_error = None
                    deadline = time.monotonic() + self.settings.inference_timeout
                elif event["event"] == "error":
                    log.error("worker_failure", extra={"error_code": event["code"],
                        "exception_type": event.get("exception_type")})
                    raise ServiceError(event["code"], 502 if event["code"] == "invalid_model_output" else 503)
                elif event["event"] == "result":
                    self.info = event.pop("info")
                    self.state, self.last_error = "ready", None
                    event.pop("event")
                    return {"status": "success", "model": self.settings.model_id,
                            "elapsed_seconds": round(time.perf_counter() - started, 3), **event}
        except ServiceError as error:
            self.close()
            self.state, self.last_error = "error", error.code
            raise
        except Exception:
            self.close()
            self.state, self.last_error = "error", "worker_failed"
            raise ServiceError("worker_failed") from None
        finally:
            self.lock.release()
