"""Single-model CPU inference: PEFT adapter is enabled only for detailed captions."""
import os
import re
import threading
import time
from contextlib import nullcontext
from pathlib import Path

import psutil
import torch
from PIL import Image
from peft import PeftModel
from transformers import AutoProcessor, Florence2ForConditionalGeneration

MODEL_ID = "florence-community/Florence-2-large-ft"
ADAPTER_DIR = Path(os.getenv("FLORENCE_ADAPTER_DIR", "adapter")).expanduser()
if not ADAPTER_DIR.is_absolute():
    ADAPTER_DIR = Path(__file__).resolve().parent / ADAPTER_DIR
TOKENS = {
    "<DETAILED_CAPTION>": 160,
    "<MORE_DETAILED_CAPTION>": 256,
    "<OD>": 768,
    "<DENSE_REGION_CAPTION>": 768,
}

class FlorenceEngine:
    def __init__(self):
        self.lock = threading.Lock()
        self.load_lock = threading.Lock()
        self.model = None
        self.processor = None
        self.loaded = False
        self.adapter_loaded = False

    def load(self):
        if self.loaded:
            return
        with self.load_lock:
            if self.loaded:
                return
            self._load_once()

    def _load_once(self):
        torch.set_num_threads(max(1, int(os.getenv("TORCH_THREADS", "2"))))
        start = time.perf_counter()
        self.processor = AutoProcessor.from_pretrained(MODEL_ID, use_fast=False)
        base = Florence2ForConditionalGeneration.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float32,
            attn_implementation="eager",
            low_cpu_mem_usage=True,
        ).to("cpu")
        base.eval()
        adapter_present = (ADAPTER_DIR / "adapter_config.json").is_file() and (ADAPTER_DIR / "adapter_model.safetensors").is_file()
        if adapter_present:
            from peft import PeftConfig
            config = PeftConfig.from_pretrained(str(ADAPTER_DIR))
            if config.base_model_name_or_path != MODEL_ID:
                raise ValueError("LoRA checkpoint does not match Florence base model")
            self.model = PeftModel.from_pretrained(base, str(ADAPTER_DIR), is_trainable=False)
            self.adapter_loaded = True
        else:
            if os.getenv("REQUIRE_LORA", "1") == "1":
                raise FileNotFoundError(f"LoRA adapter not found in {ADAPTER_DIR}")
            self.model = base
        self.model.eval()
        self.loaded = True
        self.load_seconds = round(time.perf_counter() - start, 3)

    def _generate(self, image: Image.Image, task: str, use_lora: bool):
        inputs = self.processor(text=task, images=image, return_tensors="pt")
        # Only enable adapter for the task it was trained on.
        ctx = nullcontext() if use_lora or not self.adapter_loaded else self.model.disable_adapter()
        with ctx, torch.inference_mode():
            ids = self.model.generate(
                **inputs,
                max_new_tokens=TOKENS[task],
                num_beams=3,
                do_sample=False,
            )
        raw = self.processor.batch_decode(ids, skip_special_tokens=False)[0]
        raw = re.sub(r"\s+(?=<loc_\d+>)", "", raw)
        parsed = self.processor.post_process_generation(raw, task=task, image_size=image.size)
        del ids, inputs
        return parsed.get(task, parsed)

    def analyze(self, image: Image.Image, caption_mode="lora", include_dense=False):
        self.load()
        # Blocking lock protects adapter state and CPU resources across concurrent requests.
        with self.lock:
            before = psutil.Process().memory_info().rss
            start = time.perf_counter()
            output = {"image_size": [image.width, image.height], "caption_mode": caption_mode}
            runs = [
                ("caption", "<DETAILED_CAPTION>", caption_mode == "lora"),
                ("more_detailed_caption", "<MORE_DETAILED_CAPTION>", False),
                ("objects", "<OD>", False),
            ]
            if include_dense:
                runs.append(("dense_regions", "<DENSE_REGION_CAPTION>", False))
            durations = {}
            for label, task, lora in runs:
                tick = time.perf_counter()
                output[label] = self._generate(image, task, lora)
                durations[label] = round(time.perf_counter() - tick, 3)
            output["timing_seconds"] = durations
            output["total_seconds"] = round(time.perf_counter() - start, 3)
            after = psutil.Process().memory_info().rss
            output["process_rss_mb"] = round(after / (1024**2), 1)
            output["rss_change_mb"] = round((after-before) / (1024**2), 1)
            return output

engine = FlorenceEngine()
