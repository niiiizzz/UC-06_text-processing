import json
from app.services.processor import process_records


def test_process_valid_fixture():
    with open("tests/fixtures/valid.json", "r") as f:
        data = json.load(f)
    out = process_records(data["records"])
    summary = out["summary"]
    rows = out["rows"]

    assert summary["input_rows"] == 2
    assert summary["output_characters"] == 16

    assert rows[0] == {"record_id": "T01", "output": "HELLO HELLO", "length": 11}
    assert rows[1] == {"record_id": "T02", "output": "world", "length": 5}
