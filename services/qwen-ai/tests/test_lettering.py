from app.lettering import agreed_text, text_lines, logo_details


def test_ocr_keeps_shared_literal_labels_without_correcting_model():
    assert agreed_text("RAZER\nDEATHADDER V2 X HYPERSPEED", "Razer\nDEATHADDER V2 X HYPERSPEED") == ["RAZER", "DEATHADDER V2 X HYPERSPEED"]
    assert agreed_text("IPHONE 13", "IPHONE 14") == []
    assert agreed_text("LOCKNLOCK", "LOCK&LOCK") == []
    assert agreed_text("unknown", "Apple") == []


def test_private_identifiers_and_ocr_instructions_are_not_labels():
    assert text_lines("unknown\nIMEI 123456789123456\nS/N ABC123\nhttps://example.com\nPRODUCT RED") == ["PRODUCT RED"]


def test_logo_is_a_shape_not_an_invented_brand():
    assert logo_details("an apple with a bite", "apple silhouette") == ["Logo hình quả táo"]
    assert logo_details("Apple", "unknown") == []
    assert logo_details("three stripes", "a circle") == []
    assert logo_details("not an apple", "apple silhouette") == []
