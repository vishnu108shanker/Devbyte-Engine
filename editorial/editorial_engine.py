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

KNOWN_COMPANIES = [
    "nvidia", "google", "openai", "microsoft", "meta",
    "apple", "amazon", "anthropic", "ibm", "github",
    "intel", "amd", "oracle", "salesforce"
]

def extract_company_identity(candidate):
    """
    Extract key company name if candidate is from or about a major tech firm.
    Returns normalized company string or None.
    """
    tags = [t.lower() for t in candidate.get("tags", [])]
    source = candidate.get("source", "").lower()
    title = candidate.get("name", "").lower()

    for comp in KNOWN_COMPANIES:
        if comp in tags or comp in source:
            return comp
        if re.search(r'\b' + re.escape(comp) + r'\b', title):
            return comp

    return None

def build_editorial_queue(ranked_candidates, history, policy):
    """
    Apply operational editorial constraints to the ranked candidate list:
    1. Filter: only publishable items (decision == 'publish')
    2. History gate: skip already published unless event_type == 'major_update'
    3. Source diversity: max N stories per source (default: 3)
    4. Company diversity: max N stories per company (default: 2)
    5. Fill up to queue_size (default: 5)
    """
    queue_size = policy.get("queue_size", 5)
    max_per_source = policy.get("max_per_source", 3)
    max_per_company = policy.get("max_per_company", 2)

    published_ids = {entry.get("id") for entry in (history or [])}

    queue = []
    source_counts = {}
    company_counts = {}

    for c in ranked_candidates:
        if len(queue) >= queue_size:
            break

        cid = c.get("id")
        name = c.get("name", "Unknown")

        # Must be approved by Gemini editorial mission check
        if c.get("decision") != "publish":
            continue

        # History Gate
        if cid in published_ids and c.get("event_type") != "major_update":
            info(f"Editorial Engine: Skipping already-published -> '{name}'")
            continue

        # Source Diversity Gate
        source = c.get("source", "unknown")
        s_count = source_counts.get(source, 0)
        if s_count >= max_per_source:
            info(f"Source diversity cap ({max_per_source}): skipping '{name}' (source: {source})")
            continue

        # Company Diversity Gate
        company = extract_company_identity(c)
        if company:
            c_count = company_counts.get(company, 0)
            if c_count >= max_per_company:
                info(f"Company diversity cap ({max_per_company}): skipping '{name}' (company: {company})")
                continue

        # Candidate accepted into queue
        queue.append(c)
        source_counts[source] = s_count + 1
        if company:
            company_counts[company] = company_counts.get(company, 0) + 1

    # User specification: hardcode category to "update" for all selected candidates
    for c in queue:
        c["category"] = "update"

    return queue

def main():
    parser = argparse.ArgumentParser(description="DevByte Editorial Engine V2")
    parser.add_argument("--input", required=True, help="Path to evaluated_candidates.json")
    parser.add_argument("--output", required=True, help="Path to content_queue.json")
    parser.add_argument("--channel", required=True, help="Path to channel profile JSON")
    parser.add_argument("--policy", required=True, help="Path to editorial_policy.json")
    parser.add_argument("--history", required=True, help="Path to history.json")
    args = parser.parse_args()

    candidates = read_json(args.input)
    channel = read_json(args.channel)
    policy = read_json(args.policy) or {}
    history = read_json(args.history) or []

    if not candidates or not isinstance(candidates, list):
        warning("No evaluated candidates to process.")
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        return

    # Filter and rank candidates (candidates are already pre-ranked by evaluator)
    # Ensure items with rank are sorted ascending
    ranked_candidates = [c for c in candidates if c.get("rank") is not None]
    ranked_candidates.sort(key=lambda x: x.get("rank", 999))

    queue = build_editorial_queue(ranked_candidates, history, policy)

    info(f"Content queue generated with {len(queue)} stories (Target: {policy.get('queue_size', 5)}):")
    for idx, c in enumerate(queue):
        info(f"  #{idx + 1} [Rank {c.get('rank')}]: '{c.get('name')}' ({c.get('source')})")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(queue, f, indent=2)

    info(f"Content queue written to {args.output}")

if __name__ == "__main__":
    main()
