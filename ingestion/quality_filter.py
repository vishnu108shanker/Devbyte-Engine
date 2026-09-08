import argparse
import json
import sys
import os
import re
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, warning
from utils.file_utils import read_json

VALID_PRICING = ["free", "freemium", "paid", "open_source", "unknown"]
VALID_EVENT_TYPES = ["new_tool", "major_update", "funding", "open_source_release",
                     "pricing_change", "acquisition", "research_paper", "other"]

def is_valid_iso8601(date_str):
    try:
        datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return True
    except (ValueError, AttributeError):
        return False

def validate_candidate(candidate):
    """Returns (is_valid, rejection_reason) tuple."""
    name = candidate.get("name", "")
    if not name or not name.strip():
        return False, "name is empty or missing"

    summary = candidate.get("summary", "")
    if not summary or not summary.strip():
        return False, "summary is empty or missing"

    website = candidate.get("website", "")
    if not website or not website.startswith("https://"):
        return False, f"website missing or does not start with https:// (got: {website[:50]})"

    pricing = candidate.get("pricing", "")
    if not pricing or pricing not in VALID_PRICING:
        return False, f"pricing missing or not in allowed values (got: {pricing})"

    tags = candidate.get("tags", [])
    if not tags or not isinstance(tags, list) or len(tags) == 0:
        return False, "tags array is empty"

    released_at = candidate.get("released_at", "")
    if not released_at or not is_valid_iso8601(released_at):
        return False, f"released_at missing or not valid ISO 8601 (got: {released_at})"

    event_type = candidate.get("event_type", "")
    if not event_type or event_type not in VALID_EVENT_TYPES:
        return False, f"event_type missing or not in allowed values (got: {event_type})"

    return True, None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to raw_candidates.json")
    parser.add_argument("--output", required=True, help="Path to write filtered output")
    args = parser.parse_args()

    data = read_json(args.input)
    if not data or not isinstance(data, list):
        warning("No candidates to filter.")
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        return

    passed = []
    rejected = 0

    for candidate in data:
        is_valid, reason = validate_candidate(candidate)
        if is_valid:
            passed.append(candidate)
        else:
            rejected += 1
            warning(f"Rejected '{candidate.get('name', 'UNKNOWN')}': {reason}")

    info(f"Quality filter: {len(passed)} passed, {rejected} rejected")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(passed, f, indent=2)

if __name__ == "__main__":
    main()
