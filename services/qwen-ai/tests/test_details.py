from app.details import feature_lines, localized_features, add_details, confirmed, visual_candidates
from app.identity import format_identity


def test_observations_not_category_drive_details():
    assert localized_features(["A raised scroll wheel", "Minor scratches and wear", "A logo"]) == [
        "Có con lăn", "Bề mặt có vết trầy", "Bề mặt có dấu mòn", "Có logo"]
    assert localized_features(["Zipper and shoulder straps"]) == ["Có khóa kéo", "Có quai đeo vai"]
    assert localized_features(["No scratches", "Without a logo", "Something unusual"]) == []


def test_speculation_and_human_details_do_not_become_evidence():
    assert feature_lines("- Maybe leather\n- Human hand\n- Logo resembling a dragon\n- Scroll wheel") == ["Scroll wheel"]
    assert not confirmed("yes, probably")
    assert confirmed("Yes.")
    assert visual_candidates("A rectangular optical sensor and barcode") == ["optical sensor", "barcode", "rectangular"]
    assert visual_candidates("No scratches or logo") == []


def test_caption_contains_verified_features_without_inventing_brand():
    result = add_details(format_identity("mouse", "black"), ["Có con lăn", "Bề mặt có dấu mòn"])
    assert "con lăn" in result["caption"]
    assert "dấu mòn" in result["caption"]
    assert result["brand"] is None


def test_part_color_and_camera_count_survive_localization():
    values = localized_features(["black cap", "dual rear cameras", "peeling paint"])
    assert "Có nắp màu đen" in values
    assert "Có cụm camera kép" in values
    assert "Có chỗ bong tróc sơn" in values
    assert "Có nắp" not in values
