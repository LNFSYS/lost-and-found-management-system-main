from app.identity import clean_identity, format_identity
from app.identity import agreed_brand


def test_brand_requires_matching_short_printed_words():
    assert agreed_brand("Razer", "RAZER") == "RAZER"
    assert agreed_brand("RAZER", "RAZOR") is None
    assert agreed_brand("unknown", "unknown") is None
    assert agreed_brand("AB123456789", "AB123456789") is None


def test_identity_does_not_force_mouse_or_invent_details():
    for label, name in [("mouse", "Chuột máy tính"), ("water bottle", "Bình nước"), ("wallet", "Ví")]:
        data = format_identity(label, "black")
        assert data["object_name"] == name
        assert data["caption"] == f"{name} màu đen."
        assert data["brand"] is None
        assert data["distinctive_features"] == []
    assert format_identity(None, "black")["caption"] is None
    assert clean_identity("Unknown.") is None


def test_color_must_be_a_single_answer():
    assert format_identity("mouse", "the hand is brown")["colors"] == []
    assert format_identity("mouse", "black and white")["colors"] == []
