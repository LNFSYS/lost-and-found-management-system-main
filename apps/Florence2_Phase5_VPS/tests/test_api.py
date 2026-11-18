import io
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

os.environ["PRELOAD_MODEL"] = "0"
from app import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.key = "local-test-key"
        self.env = patch.dict(os.environ, {"API_KEY": self.key})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.client.close()

    def test_health_and_docs(self):
        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["ok"], False)
        self.assertEqual(health.json()["device"], "cpu")
        self.assertEqual(self.client.get("/docs").status_code, 200)

    def test_analyze_rejects_missing_key_and_invalid_image(self):
        png = io.BytesIO()
        Image.new("RGB", (8, 8), "white").save(png, format="PNG")
        files = {"file": ("item.png", png.getvalue(), "image/png")}
        self.assertEqual(self.client.post("/analyze", files=files).status_code, 401)
        headers = {"Authorization": f"Bearer {self.key}"}
        self.assertEqual(self.client.post("/analyze", headers=headers,
                                          files={"file": ("x.txt", b"hello", "text/plain")}).status_code, 422)
        self.assertEqual(self.client.post("/analyze", headers=headers,
                                          files={"file": ("item.png", b"bad image", "image/png")}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
