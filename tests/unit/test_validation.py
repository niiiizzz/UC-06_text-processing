import json
from app.services.validation import validate_records


def test_validation_valid_fixture():
    with open("tests/fixtures/valid.json", "r") as f:
        data = json.load(f)
    res = validate_records(data["records"])
    assert res["valid_rows"] == 2
    assert res["invalid_rows"] == 0
    assert len(res["issues"]) == 0


def test_validation_invalid_fixture():
    with open("tests/fixtures/invalid.json", "r") as f:
        data = json.load(f)
    res = validate_records(data["records"])
    assert res["valid_rows"] == 2
    assert res["invalid_rows"] == 4
    assert len(res["issues"]) == 4

    # Row 3 fails R1
    assert res["issues"][0] == {"row_index": 3, "field": "record_id", "rule_id": "R1"}
    # Row 4 fails R2
    assert res["issues"][1] == {"row_index": 4, "field": "text", "rule_id": "R2"}
    # Row 5 fails R3
    assert res["issues"][2] == {"row_index": 5, "field": "repeat", "rule_id": "R3"}
    # Row 6 fails R4
    assert res["issues"][3] == {"row_index": 6, "field": "mode", "rule_id": "R4"}


def test_validation_bool_trap():
    # In Python, bool is an int subclass (isinstance(True, int) is True).
    # R3 requires type(rp) is int to reject booleans.
    records = [{"record_id": "B1", "text": "Hello", "repeat": True, "mode": "UPPER"}]
    res = validate_records(records)
    assert res["invalid_rows"] == 1
    assert res["issues"][0]["rule_id"] == "R3"


def test_validation_numeric_string_trap():
    records = [{"record_id": "B2", "text": "Hello", "repeat": "2", "mode": "UPPER"}]
    res = validate_records(records)
    assert res["invalid_rows"] == 1
    assert res["issues"][0]["rule_id"] == "R3"
