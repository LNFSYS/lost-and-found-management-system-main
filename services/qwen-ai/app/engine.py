"""Loaded only in the inference subprocess; never import Florence or its adapters."""
import gc
import time
import os
import subprocess

import torch
from PIL import Image
from transformers import AutoProcessor, BitsAndBytesConfig, Qwen3VLForConditionalGeneration
from .identity import clean_identity, format_identity
from .details import visual_candidates, confirmed, add_details, localized_features
from .gpu_guard import competing_processes
from .subject import human_subject, unknown_object
from .focus import focus_crop
from .identity import agreed_brand
from .lettering import READ_TEXT, agreed_text, logo_details, tokens

PROMPT = ("What is the main portable object shown in this image? Ignore hands and background. "
          "Answer with only its common object name in English. If unclear, answer unknown.")


def gpu_stats():
    available = torch.cuda.is_available()
    result = {"cuda_available": available, "gpu_name": None, "vram": None}
    if available:
        free, total = torch.cuda.mem_get_info()
        result.update(gpu_name=torch.cuda.get_device_name(0), vram={
            "total_mb": round(total / 2**20, 1), "free_mb": round(free / 2**20, 1),
            "allocated_mb": round(torch.cuda.memory_allocated() / 2**20, 1),
            "reserved_mb": round(torch.cuda.memory_reserved() / 2**20, 1),
            "peak_allocated_mb": round(torch.cuda.max_memory_allocated() / 2**20, 1),
        })
    return result


class Engine:
    def __init__(self, settings):
        self.settings = settings
        self.device = settings.device
        self.quantization = "none-fp32" if self.device == "cpu" else "nf4-fp16"
        self.model = None
        self.processor = None
        self.fallback_used = False
        self.raw_output_observer = None  # Opt-in local benchmark only; never a server log.
        if self.device not in {"cpu", "cuda"}:
            raise ValueError("QWEN_DEVICE must be cuda or cpu")
        if self.device == "cuda":
            if not torch.cuda.is_available():
                if not settings.allow_cpu_fallback:
                    raise RuntimeError("cuda_unavailable")
                self.device, self.quantization, self.fallback_used = "cpu", "none-fp32", True
        if self.device == "cuda":
            if settings.require_exclusive_gpu:
                probe = subprocess.run(["nvidia-smi", "--query-compute-apps=pid,process_name,used_memory",
                    "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=10, check=True)
                if competing_processes(probe.stdout, os.getpid(), os.name == "nt"):
                    raise RuntimeError("gpu_in_use")
            free, _ = torch.cuda.mem_get_info()
            if free / 2**20 < settings.min_free_vram_mb:
                # Do not fight a resident Florence/DINO/game process for this GPU.
                raise RuntimeError("gpu_in_use")
            torch.cuda.set_per_process_memory_fraction(settings.gpu_memory_fraction)
        torch.set_num_threads(4)
        try:
            self._load()
        except (RuntimeError, ImportError, ValueError):
            if not settings.allow_cpu_fallback or self.device == "cpu":
                raise
            self.model = None
            gc.collect()
            torch.cuda.empty_cache()
            self.device, self.quantization, self.fallback_used = "cpu", "none-fp32", True
            self._load()

    def _load(self):
        opts = dict(revision=self.settings.revision, trust_remote_code=False)
        self.processor = AutoProcessor.from_pretrained(self.settings.model_id, **opts)
        # Bound visual tokens even if a processor's default would upsample.
        self.processor.image_processor.size = {
            "shortest_edge": 4096,
            "longest_edge": self.settings.image_edge**2,
        }
        quant = None if self.device == "cpu" else BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True,
        )
        self.model = Qwen3VLForConditionalGeneration.from_pretrained(
            self.settings.model_id, **opts, quantization_config=quant,
            device_map={"": "cpu" if self.device == "cpu" else 0},
            dtype=torch.float32 if self.device == "cpu" else torch.float16,
            low_cpu_mem_usage=True, attn_implementation="sdpa",
            use_safetensors=True,
        ).eval()

    def info(self):
        return {"device": self.device, "quantization": self.quantization,
                "cpu_fallback_used": self.fallback_used, **gpu_stats()}

    @torch.inference_mode()
    def _answer(self, image, prompt, max_tokens=24):
        content = ([{"type": "image", "image": image}] if image is not None else [])
        messages = [{"role": "user", "content": [*content, {"type": "text", "text": prompt}]}]
        batch = output = None
        try:
            batch = self.processor.apply_chat_template(messages, tokenize=True,
                add_generation_prompt=True, return_dict=True, return_tensors="pt").to(self.device)
            output = self.model.generate(**batch, max_new_tokens=max_tokens,
                do_sample=False, use_cache=True, temperature=None, top_p=None, top_k=None)
            text = self.processor.decode(output[0, batch["input_ids"].shape[-1]:],
                skip_special_tokens=True).strip()
            if self.raw_output_observer is not None:
                self.raw_output_observer(text)
            return text
        finally:
            del batch, output

    def _generate(self, image, post_type, description, *, focus_retry=False):
        overview = image.copy()
        edge = min(self.settings.image_edge, int(self.processor.image_processor.size["longest_edge"] ** 0.5))
        overview.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        try:
            return self._inspect_views(image, overview, edge, focus_retry)
        finally:
            overview.close()

    def _inspect_views(self, source, image, edge, focus_retry):
        # Fresh image-only contexts prevent user text or earlier requests from
        # supplying invented visual evidence. Keep each task short for the 2B model.
        prompt = PROMPT if not focus_retry else (
            "Name the inanimate portable item held by the person. Ignore the hand. "
            "Answer only with the common English object name, or unknown.")
        label = clean_identity(self._answer(image, prompt))
        if not label or human_subject({"category": label}):
            return format_identity(label, "")
        box = self._answer(image,
            f"Locate the {label}. Output its bounding box as [x1, y1, x2, y2] using coordinates "
            "normalized from 0 to 1000. Exclude the hand and background. Output only the box.", 64)
        focused = focus_crop(source, box, edge)
        if focused is not None:
            # A wrong region must not redirect analysis to a background object.
            crop_label = clean_identity(self._answer(focused, PROMPT))
            if crop_label != label:
                focused.close()
                focused = None
        try:
            return self._inspect_details(image, focused if focused is not None else image, label, source=source, edge=edge)
        finally:
            if focused is not None:
                focused.close()

    def _inspect_details(self, image, focused, label, *, source=None, edge=None):
        color = self._answer(image,
            f"What is the main color of the {label} in this image? "
            "Ignore the hand and background. Answer with ONE English color word, or unknown.", 8)
        data = format_identity(label, color)
        view = self._answer(image,
            "Which surface of the main object is facing the camera: top, bottom, front, back, or side? "
            "Answer one word.", 12).lower().strip(". \n")
        view_context = f"The visible view is {view}. " if view in {"top", "bottom", "front", "back", "side"} else ""
        parts = self._answer(focused, view_context +
            "Describe ONLY the physical parts actually visible in this view. Do not describe parts hidden "
            "on the other side. List up to four short English phrases.", 140)
        overview_parts = self._answer(image,
            "Describe the physical object in the foreground. List only its visible shapes, components and "
            "markings, not its use. Ignore hands. Use up to four short English phrases.", 140)
        surface = self._answer(focused,
            f"Inspect the surface of this {label}. Describe only visible texture, pattern, scratches, wear or damage. "
            "Ignore the hand and background. Do not guess material. Use up to three short English bullet points.", 120)
        candidates = list(dict.fromkeys(visual_candidates(parts) + visual_candidates(overview_parts)
            + visual_candidates(surface)))[:10]
        accepted = []
        for feature in candidates:
            check = self._answer(focused, view_context +
                f'Is this physical detail clearly visible on the main object: "{feature}"? '
                "Answer only yes, no, or unclear. Ignore the hand and background. "
                "Do not infer hidden parts.", 8)
            if confirmed(check):
                accepted.append(feature)
        lettering = self._read_lettering(source if source is not None else image, image, focused, edge or self.settings.image_edge)
        data["visible_text"] = lettering
        brand_prompt = ("Read the brand name printed on this object. Answer only that exact text, or unknown "
            "if not legible. Do not infer the brand from a logo or shape.")
        crop_brand = self._answer(focused, brand_prompt, 24)
        brand = None
        if focused is not image and crop_brand.strip().lower().strip(".") != "unknown":
            brand = agreed_brand(crop_brand, self._answer(image, brand_prompt, 24))
        if brand:
            data["brand"] = brand
            if not any(tokens(brand) == tokens(text) for text in lettering):
                data["visible_text"] = [brand, *lettering][:6]
        logos = []
        if any("logo" in feature.lower() for feature in accepted):
            logo_prompt = ("Describe ONLY the visible logo symbol on the object in a short English phrase. "
                "Describe its shape, not the brand name. If there is no clear symbol, answer unknown.")
            logos = logo_details(self._answer(focused, logo_prompt, 40), self._answer(image, logo_prompt, 40))
        # The 2B model mistranslates technical parts. Localize supported visual
        # concepts deterministically; do not guess translations of unknown text.
        return add_details(data, localized_features(accepted) + logos)

    def _read_lettering(self, source, overview, focused, edge):
        box = self._answer(overview,
            "Locate the largest printed brand/product label on the foreground object. Return only "
            "[x1, y1, x2, y2], normalized 0 to 1000. Do not include the background. "
            "If no label is visible answer unknown.", 64)
        region = focus_crop(source, box, edge, text_region=True)
        try:
            target = region if region is not None else focused
            first = self._answer(target, READ_TEXT, 120)
            second = self._answer(target if region is not None else overview,
                "Transcribe the legible printed words in the picture exactly. One line per text line. "
                "No explanation. Do not repair incomplete words. Ignore serial numbers. "
                "If unreadable, answer unknown.", 120)
            return agreed_text(first, second)
        finally:
            if region is not None:
                region.close()

    def predict(self, image: Image.Image, post_type: str, description: str):
        start = time.perf_counter()
        warnings = []
        if self.device == "cuda":
            torch.cuda.reset_peak_memory_stats()
        def generate_subject(target):
            data = self._generate(target, post_type, description)
            if human_subject(data):
                data = self._generate(target, post_type, description, focus_retry=True)
                if human_subject(data):
                    warnings.append("Không nhận diện chắc chắn món đồ; hãy chụp gần hoặc cắt ảnh quanh vật phẩm.")
                    return unknown_object()
                warnings.append("Đã kiểm tra lại chủ thể; vui lòng xác nhận tên và đặc điểm vật phẩm.")
            return data

        try:
            data = generate_subject(image)
        except torch.cuda.OutOfMemoryError:
            gc.collect()
            torch.cuda.empty_cache()
            smaller = image.copy()
            smaller.thumbnail((224, 224))
            old_size = self.processor.image_processor.size
            self.processor.image_processor.size = {"shortest_edge": 4096, "longest_edge": 224**2}
            try:
                data = generate_subject(smaller)
                warnings.append("Image resolution reduced after GPU OOM; inspect details manually.")
            finally:
                self.processor.image_processor.size = old_size
                smaller.close()
        return {"data": data, "inference_seconds": round(time.perf_counter() - start, 3),
                "warnings": warnings, "info": self.info()}
