import argparse
import json
import re
import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info
from utils.file_utils import read_json

def normalize_title(title):
    """Normalize a title for near-duplicate comparison.
    Lowercase, strip punctuation, collapse whitespace."""
    title = title.lower().strip()
    title = re.sub(r'[^\w\s]', '', title)
    title = re.sub(r'\s+', ' ', title)
    return title

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to raw_candidates.json")
    parser.add_argument("--output", required=True, help="Path to write deduplicated output")
    args = parser.parse_args()

    data = read_json(args.input)
    if not data or not isinstance(data, list):
        info("No candidates to deduplicate.")
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        return

    seen_ids = set()
    seen_urls = set()
    seen_titles = set()
    unique = []
    duplicates_removed = 0

    for candidate in data:
        cid = candidate.get("id", "")
        url = candidate.get("website", "").rstrip("/")
        title_key = normalize_title(candidate.get("name", ""))

        is_dup = False
        dup_reason = ""

        # Level 1: Exact same ID
        if cid and cid in seen_ids:
            is_dup = True
            dup_reason = f"duplicate id '{cid}'"

        # Level 2: Exact same canonical URL
        elif url and url in seen_urls:
            is_dup = True
            dup_reason = f"duplicate url '{url[:80]}'"

        # Level 3: Near-identical normalized title
        elif title_key and title_key in seen_titles:
            is_dup = True
            dup_reason = f"duplicate title '{title_key[:60]}'"

        if is_dup:
            duplicates_removed += 1
            info(f"Dedup: dropping '{candidate.get('name')}' ({candidate.get('source')}) -> {dup_reason}")
        else:
            unique.append(candidate)
            if cid:
                seen_ids.add(cid)
            if url:
                seen_urls.add(url)
            if title_key:
                seen_titles.add(title_key)

    info(f"Deduplicator: {len(unique)} unique candidates remaining ({duplicates_removed} duplicates removed)")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(unique, f, indent=2)

if __name__ == "__main__":
    main()
