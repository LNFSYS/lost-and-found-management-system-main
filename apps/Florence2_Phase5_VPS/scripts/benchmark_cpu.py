"""CLI benchmark: python scripts/benchmark_cpu.py --image test.jpg --repeat 3"""
import argparse
import json
import statistics
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import psutil
from PIL import Image
from engine import engine

parser = argparse.ArgumentParser()
parser.add_argument("--image", required=True)
parser.add_argument("--repeat", type=int, default=3)
parser.add_argument("--output", default="cpu_benchmark.json")
args = parser.parse_args()
if not 1 <= args.repeat <= 30:
    parser.error("--repeat must be 1..30")
image = Image.open(args.image).convert("RGB")
process = psutil.Process()
load_start = time.perf_counter()
engine.load()
load_s = time.perf_counter()-load_start
warmup = {mode: engine.analyze(image, caption_mode=mode, include_dense=False)["total_seconds"]
          for mode in ("base", "lora")}
samples = []
for i in range(args.repeat):
    for mode in ("base", "lora"):
        cpu_before = process.cpu_times()
        entry = engine.analyze(image, caption_mode=mode, include_dense=False)
        cpu_after = process.cpu_times()
        samples.append({"iteration":i+1,"mode":mode,"total_seconds":entry["total_seconds"],
                        "rss_mb":entry["process_rss_mb"],
                        "cpu_seconds":round((cpu_after.user+cpu_after.system)-(cpu_before.user+cpu_before.system),3),
                        "caption":entry["caption"],
                        "detected_labels":entry["objects"].get("labels",[]) if isinstance(entry["objects"],dict) else []})
        print(i+1, mode, entry["total_seconds"], "s", entry["process_rss_mb"], "MB RSS", flush=True)
def percentile(values, fraction):
    ordered = sorted(values)
    index = (len(ordered)-1)*fraction
    low = int(index)
    return ordered[low] + (ordered[min(low+1,len(ordered)-1)]-ordered[low])*(index-low)

summary = {"image":str(args.image), "model_load_seconds":round(load_s,3),
           "warmup_seconds":warmup,
           "memory_gb_total":round(psutil.virtual_memory().total/1024**3,2),
           "swap_gb_total":round(psutil.swap_memory().total/1024**3,2),
           "samples":samples,
           "latency_seconds":{
               mode:{"median":round(statistics.median(times),3), "p95":round(percentile(times,0.95),3)}
               for mode in ("base","lora")
               for times in [[x["total_seconds"] for x in samples if x["mode"]==mode]]
           },
           "peak_sampled_rss_mb":max(x["rss_mb"] for x in samples)}
Path(args.output).write_text(json.dumps(summary,ensure_ascii=False,indent=2), encoding="utf-8")
print("Saved",args.output)
