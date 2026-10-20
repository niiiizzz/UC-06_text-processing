from typing import Any, Dict, List, Set


def validate_records(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validation specification per docs/05_API.md Section 8.1
    R1: record_id non-empty str, <= 20 chars, unique within batch (later occurrences duplicate)
    R2: text 1-80 ASCII chars after trimming spaces
    R3: repeat is an integer 1-3 inclusive. type() is int (rejects bool, numeric str)
    R4: mode is UPPER or LOWER
    """
    seen_ids: Set[str] = set()
    issues: List[Dict[str, Any]] = []
    invalid_rows_count = 0

    for i, rec in enumerate(records, start=1):
        row_issues = []

        # R1: record_id
        rid = rec.get("record_id")
        if type(rid) is not str or not rid.strip() or len(rid.strip()) > 20:
            row_issues.append({"row_index": i, "field": "record_id", "rule_id": "R1"})
        elif rid.strip() in seen_ids:
            row_issues.append({"row_index": i, "field": "record_id", "rule_id": "R1"})
        else:
            seen_ids.add(rid.strip())

        # R2: text
        txt = rec.get("text")
        if type(txt) is not str:
            row_issues.append({"row_index": i, "field": "text", "rule_id": "R2"})
        else:
            t = txt.strip()
            if not (1 <= len(t) <= 80) or not t.isascii():
                row_issues.append({"row_index": i, "field": "text", "rule_id": "R2"})

        # R3: repeat (strictly type(rp) is int to reject bool)
        rp = rec.get("repeat")
        if type(rp) is not int or not (1 <= rp <= 3):
            row_issues.append({"row_index": i, "field": "repeat", "rule_id": "R3"})

        # R4: mode
        mode = rec.get("mode")
        if type(mode) is not str or mode.strip() not in ("UPPER", "LOWER"):
            row_issues.append({"row_index": i, "field": "mode", "rule_id": "R4"})

        if row_issues:
            invalid_rows_count += 1
            issues.extend(row_issues)

    valid_rows_count = len(records) - invalid_rows_count
    return {
        "valid_rows": valid_rows_count,
        "invalid_rows": invalid_rows_count,
        "issues": issues,
    }
