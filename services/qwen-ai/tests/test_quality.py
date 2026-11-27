import json
import pytest

from app.schema import parse_analysis


def test_backpack_evidence_and_duplicate_normalization():
    data = {"category": "backpack", "object_name": "Balo", "colors": [],
        "primary_color": "xanh đậm", "secondary_colors": ["đen", "trắng", " Trắng "],
        "material": "unknown", "brand": "Adidas", "visible_text": [],
        "shape": "đỉnh bo tròn", "pattern": "ba sọc trắng",
        "distinctive_features": ["quai đen", " Quai đen ", "túi khóa kéo phía trước"],
        "caption": "Balo xanh đậm có ba sọc trắng. Balo xanh đậm có ba sọc trắng."}
    result = parse_analysis(json.dumps(data))
    assert result.brand is None  # Stripes alone do not establish a brand.
    assert result.material is None
    assert result.colors == ["xanh đậm", "đen", "trắng"]
    assert result.distinctive_features == ["quai đen", "túi khóa kéo phía trước"]
    assert result.caption == "Balo xanh đậm có ba sọc trắng."
    assert result.shape == "đỉnh bo tròn"
    data["visible_text"] = ["adidas"]
    assert parse_analysis(json.dumps(data)).brand == "Adidas"


def test_duplicate_json_keys_are_rejected_instead_of_silently_losing_caption():
    with pytest.raises(json.JSONDecodeError):
        parse_analysis('{"caption":"first","caption":"second"}')


def test_missing_space_does_not_hide_repetition_and_colors_are_not_dropped():
    data = {"category": "backpack", "object_name": "Balo", "colors": ["đỏ", "đen"],
        "primary_color": " đỏ ", "secondary_colors": [], "material": None, "brand": None,
        "visible_text": [], "distinctive_features": [], "caption": "Balo đỏ.Balo đỏ."}
    result = parse_analysis(json.dumps(data))
    assert result.primary_color == "đỏ"
    assert result.secondary_colors == ["đen"]
    assert result.caption == "Balo đỏ."


def test_rambling_caption_uses_existing_distinctive_observations_without_guessing():
    data = {"category": "backpack", "object_name": "Balo", "colors": ["xanh đậm", "đen"],
        "material": None, "brand": None, "visible_text": [],
        "distinctive_features": ["quai đen", "túi khóa kéo phía trước"],
        "caption": "Câu một. Câu hai. Câu ba. Phần bị cắt dở"}
    result = parse_analysis(json.dumps(data))
    assert result.caption == "Balo màu xanh đậm và đen, có quai đen và túi khóa kéo phía trước."


def test_fluent_caption_filters_uses_and_preserves_visible_text():
    data = {"category": "water bottle", "object_name": "bình", "colors": ["xám"],
        "material": None, "brand": None, "visible_text": ["adidas", "USB-C"],
        "distinctive_features": ["có nắp vặn", "có logo adidas", "có thể dùng để giữ nhiệt", "có thể dùng làm đồ chơi"],
        "caption": "bình màu xám. có thể dùng để giữ nhiệt."}
    result = parse_analysis(json.dumps(data))
    assert result.object_name == "Bình"
    assert result.caption == "Bình màu xám, có nắp vặn và logo adidas."
    assert result.visible_text == ["adidas", "USB-C"]
    assert result.distinctive_features == ["có nắp vặn", "có logo adidas"]
    assert parse_analysis(result.model_dump_json()).caption == result.caption
    data["distinctive_features"] = ["được làm bằng nhôm", "có nắp vặn"]
    assert parse_analysis(json.dumps(data)).caption == "Bình màu xám, có chất liệu nhôm và nắp vặn."


def test_phone_subjects_and_duplicate_features_do_not_repeat_in_one_long_sentence():
    features = ["điện thoại có viền đỏ", "điện thoại có màn hình đen", "một chiếc điện thoại có màu đỏ",
        "một chiếc điện thoại có logo Apple ở mặt sau", "một chiếc điện thoại có camera ở mặt sau",
        "một chiếc điện thoại có vết mòn ở mặt sau", "điện thoại có viền màu đỏ"]
    data = {"category": "phone", "object_name": "điện thoại", "colors": ["đỏ"],
        "material": None, "brand": None, "visible_text": [], "distinctive_features": features,
        "caption": ", ".join(features)}
    result = parse_analysis(json.dumps(data))
    assert result.caption == "Điện thoại màu đỏ, có viền đỏ, màn hình đen, logo Apple ở mặt sau, camera ở mặt sau và vết mòn ở mặt sau."
    assert result.caption.casefold().count("điện thoại") == 1
    assert parse_analysis(result.model_dump_json()).caption == result.caption
