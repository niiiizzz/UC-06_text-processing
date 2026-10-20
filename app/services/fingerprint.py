import json
import hashlib
from typing import Any, Dict


def compute_fingerprint(operation: str, records: Any) -> str:
    """
    Canonical SHA-256 fingerprint per docs/01_PRD.md Section 8.7.
    Canonical JSON: sorted keys, no extra whitespace.
    """
    payload = {
        "operation": operation,
        "records": records,
    }
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
