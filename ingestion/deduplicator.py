import argparse
import json
import sys
import os
import urllib.parse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info
from utils.file_utils import read_json

def extract_root_domain(url):
    """Extract root domain, stripping www and subdomains."""
    try:
        netloc = urllib.parse.urlparse(url).netloc
        # Remove port if present
        netloc = netloc.split(":")[0]
        # Strip www
        netloc = netloc.replace("www.", "")
        # Get last two parts (e.g. "blog.openai.com" -> "openai.com")
        parts = netloc.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return netloc
    except Exception:
        return ""

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

    seen_ids = {}      # id -> index in unique list
    seen_domains = {}  # root_domain -> index in unique list
    unique = []
    duplicates_removed = 0

    for candidate in data:
        cid = candidate.get("id", "")
        domain = extract_root_domain(candidate.get("website", ""))
        tier = candidate.get("source_tier", 99)
        released = candidate.get("released_at", "")

        is_dup = False
        existing_idx = None

        # Check by id
        if cid in seen_ids:
            is_dup = True
            existing_idx = seen_ids[cid]
        # Check by domain
        elif domain and domain in seen_domains:
            is_dup = True
            existing_idx = seen_domains[domain]

        if is_dup and existing_idx is not None:
            existing = unique[existing_idx]
            existing_tier = existing.get("source_tier", 99)

            # Keep the one with higher source_tier (lower number)
            # If equal, keep more recent released_at
            replace = False
            if tier < existing_tier:
                replace = True
            elif tier == existing_tier and released > existing.get("released_at", ""):
                replace = True

            if replace:
                info(f"Dedup: replacing '{existing.get('name')}' ({existing.get('source')}) with '{candidate.get('name')}' ({candidate.get('source')})")
                unique[existing_idx] = candidate
                # Update index maps
                seen_ids[candidate.get("id", "")] = existing_idx
                if domain:
                    seen_domains[domain] = existing_idx
            else:
                info(f"Dedup: dropping duplicate '{candidate.get('name')}' ({candidate.get('source')}), keeping '{existing.get('name')}' ({existing.get('source')})")

            duplicates_removed += 1
        else:
            idx = len(unique)
            unique.append(candidate)
            seen_ids[cid] = idx
            if domain:
                seen_domains[domain] = idx

    info(f"Deduplicator: {len(unique)} unique candidates remaining ({duplicates_removed} duplicates removed)")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(unique, f, indent=2)

if __name__ == "__main__":
    main()
