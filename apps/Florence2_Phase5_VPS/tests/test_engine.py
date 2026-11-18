import threading
import time
import unittest

from engine import FlorenceEngine


class EngineTests(unittest.TestCase):
    def test_concurrent_load_only_initializes_once(self):
        engine = FlorenceEngine()
        calls = []

        def fake_load():
            calls.append(1)
            time.sleep(0.02)
            engine.loaded = True

        engine._load_once = fake_load
        threads = [threading.Thread(target=engine.load) for _ in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
