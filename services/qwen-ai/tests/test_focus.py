from PIL import Image
from app.focus import focus_crop
import pytest


@pytest.mark.parametrize("box", ["unknown", "[1,2,3]", "[900,100,200,500]",
    "[0,0,1001,1000]", "[0,0,1000,1000]", "[400,400,410,410]",
    "[100,100,800,800] [200,200,700,700]"])
def test_invalid_or_unhelpful_boxes_fall_back(box):
    assert focus_crop(Image.new("RGB", (1000, 1000)), box, 672) is None


def test_crop_preserves_original_and_caps_inference_resolution():
    image = Image.new("RGB", (1200, 1600))
    crop = focus_crop(image, "[200,300,800,900]", 672)
    assert image.size == (1200, 1600)
    assert max(crop.size) == 672
    assert crop.width < crop.height
    crop.close()
