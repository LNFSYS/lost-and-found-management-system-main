import importlib.metadata
import json
import platform
import subprocess

import torch
import bitsandbytes as bnb
from transformers import Qwen3VLForConditionalGeneration

result = {"python": platform.python_version(), "torch": torch.__version__,
          "torch_cuda": torch.version.cuda, "cuda_available": torch.cuda.is_available(),
          "qwen_class": Qwen3VLForConditionalGeneration.__name__,
          "versions": {name: importlib.metadata.version(name) for name in
                       ["transformers", "accelerate", "bitsandbytes", "pillow", "fastapi"]}}
if torch.cuda.is_available():
    result["gpu"] = torch.cuda.get_device_name(0)
    result["compute_capability"] = torch.cuda.get_device_capability(0)
    result["vram_total_mb"] = round(torch.cuda.get_device_properties(0).total_memory / 2**20)
    layer = bnb.nn.Linear4bit(64, 32, bias=False, compute_dtype=torch.float16, quant_type="nf4").cuda()
    with torch.inference_mode():
        output = layer(torch.randn(1, 64, device="cuda", dtype=torch.float16))
    torch.cuda.synchronize()
    result["nf4_kernel_test"] = bool(torch.isfinite(output).all())
print(json.dumps(result, indent=2))
subprocess.run([__import__("sys").executable, "-m", "pip", "check"], check=True)
if not result["cuda_available"] or not result.get("nf4_kernel_test"):
    raise SystemExit(1)
