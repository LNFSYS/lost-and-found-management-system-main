"""Local model-load diagnostics only; no user images or prompts are loaded."""
import faulthandler
import json
import sys
from pathlib import Path

faulthandler.enable()
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
settings = Settings.from_env()
print("Import engine", flush=True)
from app.engine import Engine
print("Load model", flush=True)
engine = Engine(settings)
print(json.dumps(engine.info()), flush=True)
