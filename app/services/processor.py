from typing import Any, Dict, List


def process_records(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Pure processor per docs/05_API.md Section 8.3
    Preserves row order, trims text, applies UPPER/LOWER, joins repeat copies with a single space.
    """
    out = []
    total = 0
    for r in rows:
        t = str(r["text"]).strip()
        t = t.upper() if r["mode"] == "UPPER" else t.lower()
        s = " ".join([t] * int(r["repeat"]))
        out.append({"record_id": r["record_id"], "output": s, "length": len(s)})
        total += len(s)
    return {
        "summary": {
            "input_rows": len(rows),
            "output_characters": total,
        },
        "rows": out,
        "issues": [],
    }
