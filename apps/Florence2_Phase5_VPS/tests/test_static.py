import ast
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class StaticTests(unittest.TestCase):
    def test_python_syntax(self):
        for fname in ('app.py','engine.py','scripts/benchmark_cpu.py'):
            ast.parse((ROOT / fname).read_text())

    def test_adapter_metadata(self):
        cfg=json.loads((ROOT/'adapter/adapter_config.json').read_text())
        self.assertEqual(cfg['base_model_name_or_path'],'florence-community/Florence-2-large-ft')
        self.assertEqual(sorted(cfg['target_modules']),['k_proj','out_proj'])
        self.assertTrue((ROOT/'adapter/adapter_model.safetensors').stat().st_size > 1000000)

if __name__=='__main__': unittest.main()
