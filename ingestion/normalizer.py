import argparse
import json
import sys
import os
from slugify import slugify
import urllib.parse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error, warning
from utils.file_utils import read_json

REQUIRED_FIELDS = ["id", "name", "category", "summary", "website", "pricing",
                    "event_type", "tags", "source", "source_tier", "released_at",
                    "collected_at", "score", "confidence"]

OPTIONAL_DEFAULTS = {
    "target_audience": "",
    "competitors": [],
    "use_cases": []
}

VALID_PRICING = ["free", "freemium", "paid", "open_source", "unknown"]
VALID_EVENT_TYPES = ["new_tool", "major_update", "funding", "open_source_release",
                     "pricing_change", "acquisition", "research_paper", "other"]

def normalize_candidate(candidate):
    """Ensure all required fields exist and apply defaults for optional fields."""
    # Generate id if missing
    if not candidate.get("id"):
        name = candidate.get("name", "unknown")
        website = candidate.get("website", "")
        domain = urllib.parse.urlparse(website).netloc.replace("www.", "") if website else "unknown"
        candidate["id"] = f"{slugify(name)}-{domain}"

    # Ensure name is capped at 120 chars
    if candidate.get("name"):
        candidate["name"] = candidate["name"][:120]

    # Ensure summary is capped at 500 chars
    if candidate.get("summary"):
        candidate["summary"] = candidate["summary"][:500]

    # Apply defaults for optional fields
    for field, default in OPTIONAL_DEFAULTS.items():
        if field not in candidate or candidate[field] is None:
            candidate[field] = default

    # Ensure pricing is valid
    if candidate.get("pricing") not in VALID_PRICING:
        candidate["pricing"] = "unknown"

    # Ensure event_type is valid
    if candidate.get("event_type") not in VALID_EVENT_TYPES:
        candidate["event_type"] = "other"

    # Ensure score and confidence are set to 0 (collector defaults)
    candidate["score"] = candidate.get("score", 0)
    candidate["confidence"] = candidate.get("confidence", 0.0)

    # Ensure tags is a list with at least one element
    if not candidate.get("tags") or not isinstance(candidate["tags"], list):
        candidate["tags"] = ["unknown"]

    # Never pass null values downstream (Conventions.md rule)
    for key in candidate:
        if candidate[key] is None:
            if isinstance(OPTIONAL_DEFAULTS.get(key), list):
                candidate[key] = []
            elif isinstance(OPTIONAL_DEFAULTS.get(key), dict):
                candidate[key] = {}
            else:
                candidate[key] = ""

    return candidate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", action="append", dest="inputs", required=True,
                        help="Path to a collector output JSON file (can be specified multiple times)")
    parser.add_argument("--output", required=True, help="Path to output raw_candidates.json")
    args = parser.parse_args()

    all_candidates = []
    source_count = 0

    for input_path in args.inputs:
        if not os.path.exists(input_path):
            warning(f"Input file not found, skipping: {input_path}")
            continue

        data = read_json(input_path)
        if not data or not isinstance(data, list):
            warning(f"Invalid or empty data in {input_path}, skipping")
            continue

        source_count += 1
        for candidate in data:
            normalized = normalize_candidate(candidate)
            all_candidates.append(normalized)

    info(f"Normalized {len(all_candidates)} candidates from {source_count} sources")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(all_candidates, f, indent=2)

if __name__ == "__main__":
    main()
