import argparse
import json
import sys
import os
import re

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, warning, error
from utils.file_utils import read_json

def matches_regex_list(text, regex_list):
    """Check if text matches any regex pattern in the list (case-insensitive boundary match)."""
    text_lower = text.lower()
    for pattern in regex_list:
        # If the pattern is a simple word, enforce word boundaries to avoid partial matches (e.g. anti-amazon matching amazon)
        # If it already contains regex characters like [0-9], compile it directly.
        try:
            if re.search(r'[\[\]\(\)\{\}\*\+\?\^\$\|]', pattern):
                # Complex regex pattern
                if re.search(pattern, text_lower):
                    return True
            else:
                # Simple word pattern, match as whole word/phrase
                boundary_pattern = r'\b' + re.escape(pattern) + r'\b'
                if re.search(boundary_pattern, text_lower):
                    return True
        except re.error as e:
            warning(f"Invalid regex pattern in filters: '{pattern}' ({e})")
            # Fallback to simple substring search
            if pattern in text_lower:
                return True
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to raw_candidates.json")
    parser.add_argument("--output", required=True, help="Path to write filtered output")
    args = parser.parse_args()

    data = read_json(args.input)
    if not data or not isinstance(data, list):
        warning("No candidates to signal filter.")
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        return

    filters_path = os.path.join(PROJECT_ROOT, "sources", "filters.json")
    if not os.path.exists(filters_path):
        error(f"Filters config missing at: {filters_path}")
        sys.exit(1)

    with open(filters_path, "r", encoding="utf-8") as f:
        filters = json.load(f)

    noise_blacklist = filters.get("noise_blacklist", [])

    passed = []
    dropped_noise = 0

    for candidate in data:
        title = candidate.get("name", "")

        if matches_regex_list(title, noise_blacklist):
            dropped_noise += 1
            info(f"Signal Filter: Dropped candidate (blacklisted keyword) -> '{title}'")
        else:
            passed.append(candidate)

    info(f"Signal Filter finished: {len(passed)} passed. (Dropped: {dropped_noise} noise)")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(passed, f, indent=2)

if __name__ == "__main__":
    main()
