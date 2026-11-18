import hashlib
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

SERVICE_ROOT = Path(__file__).resolve().parents[1]
def configured_path(variable: str, default: str) -> Path:
    value = Path(os.getenv(variable, default))
    return value if value.is_absolute() else (SERVICE_ROOT / value).resolve()


def preprocess(image: Image.Image, input_size: int, mean: list[float], std: list[float]) -> np.ndarray:
    image = ImageOps.exif_transpose(image).convert("RGB")
    width, height = image.size
    if width < 1 or height < 1:
        raise ValueError("Invalid image dimensions")

    resized_width = int(256 * width / min(width, height))
    resized_height = int(256 * height / min(width, height))
    image = image.resize((resized_width, resized_height), Image.Resampling.BILINEAR)
    left = int(round((resized_width - input_size) / 2.0))
    top = int(round((resized_height - input_size) / 2.0))
    image = image.crop((left, top, left + input_size, top + input_size))

    tensor = np.asarray(image, dtype=np.float32) / 255.0
    tensor = (tensor - np.asarray(mean, dtype=np.float32)) / np.asarray(std, dtype=np.float32)
    return np.transpose(tensor, (2, 0, 1))


class MobileNetClassifier:
    def __init__(self):
        self.session = None
        self.labels: list[str] = []
        self.input_size = 224
        self.mean: list[float] = []
        self.std: list[float] = []
        self.version = "unavailable"
        self.model_path = configured_path(
            "MOBILENET_MODEL_PATH", "models/mobilenetv3-small-v1/lnfs_mobilenetv3_small_v1.onnx"
        )
        self.labels_path = configured_path(
            "MOBILENET_LABELS_PATH", "models/mobilenetv3-small-v1/labels.json"
        )

    def load(self):
        import onnxruntime as ort

        metadata = json.loads(self.labels_path.read_text(encoding="utf-8"))
        labels = metadata.get("labels")
        mean, std, input_size = metadata.get("mean"), metadata.get("std"), metadata.get("input_size")
        if (not isinstance(labels, list) or len(labels) != 12 or len(set(labels)) != 12
                or any(not isinstance(label, str) or not label.strip() for label in labels)
                or input_size != 224 or len(mean or []) != 3 or len(std or []) != 3
                or any(not np.isfinite(x) for x in [*mean, *std]) or any(x <= 0 for x in std)):
            raise ValueError("Invalid MobileNet labels/preprocessing metadata")

        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        session = ort.InferenceSession(str(self.model_path), sess_options=options,
                                       providers=["CPUExecutionProvider"])
        model_input = session.get_inputs()[0]
        model_output = session.get_outputs()[0]
        if (model_input.name != "image" or model_input.shape[1:] != [3, 224, 224]
                or model_output.name != "logits" or model_output.shape[1] != len(labels)
                or session.get_providers() != ["CPUExecutionProvider"]):
            raise ValueError("ONNX input/output/provider contract mismatch")

        model_hash = hashlib.sha256(self.model_path.read_bytes()).hexdigest()
        self.labels = labels
        self.input_size = input_size
        self.mean = mean
        self.std = std
        self.session = session
        self.version = f"mobilenetv3-small-lnfs-v1:{model_hash[:16]}"

    def predict(self, images: list[Image.Image]) -> dict:
        if self.session is None:
            raise RuntimeError("MobileNet model is not loaded")
        batch = np.stack([preprocess(image, self.input_size, self.mean, self.std) for image in images])
        logits = self.session.run(["logits"], {"image": batch})[0].astype(np.float64)
        if not np.isfinite(logits).all():
            raise ValueError("Model returned non-finite logits")
        logits -= logits.max(axis=1, keepdims=True)
        probabilities = np.exp(logits)
        probabilities /= probabilities.sum(axis=1, keepdims=True)
        # Mean view probabilities so several photos can inform one editable suggestion.
        mean_probabilities = probabilities.mean(axis=0)
        top_indices = np.argsort(mean_probabilities)[::-1][:3]
        predictions = [{"label": self.labels[int(index)], "confidence": float(mean_probabilities[index])}
                       for index in top_indices]
        return {
            "schema_version": "1",
            "model_version": self.version,
            "category_name": predictions[0]["label"],
            "confidence": predictions[0]["confidence"],
            "top3": predictions,
            "requires_confirmation": True,
            "confidence_calibrated": False,
            "score_kind": "uncalibrated_softmax",
            "inference_images": len(images),
            "warnings": [
                "Model chỉ gợi ý trong 12 danh mục đã huấn luyện; hãy kiểm tra và xác nhận.",
                "Điểm softmax chưa được hiệu chuẩn; ngoài 12 danh mục có thể bị xếp nhầm vào một lớp.",
            ],
        }
