import argparse
import json
import sys
import os
import urllib.parse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error
from utils.file_utils import read_json
from evaluation.scoring import (
    calculate_freshness_score,
    calculate_popularity_score,
    calculate_source_trust_score,
    calculate_quality_score,
    calculate_confidence,
    calculate_total_score
)


def extract_root_domain(url):
    try:
        netloc = urllib.parse.urlparse(url).netloc.replace("www.", "")
        parts = netloc.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return netloc
    except Exception:
        return ""


def find_cross_source_counts(candidates):
    """Group candidates by root domain to detect cross-source mentions."""
    domain_sources = {}
    for c in candidates:
        domain = extract_root_domain(c.get("website", ""))
        if not domain:
            continue
        source = c.get("source", "")
        if domain not in domain_sources:
            domain_sources[domain] = set()
        domain_sources[domain].add(source)

    # Map domain -> number of distinct sources
    return {domain: len(sources) for domain, sources in domain_sources.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to raw_candidates.json")
    parser.add_argument("--output", required=True, help="Path to evaluated_candidates.json")
    args = parser.parse_args()

    data = read_json(args.input)
    if not data or not isinstance(data, list):
        error("No candidates to evaluate.")
        sys.exit(1)

    # Detect cross-source mentions
    cross_source_map = find_cross_source_counts(data)

    for candidate in data:
        domain = extract_root_domain(candidate.get("website", ""))
        cross_count = cross_source_map.get(domain, 1)

        # HN stories have "score" (points) we can use for popularity
        # Blog posts don't have raw popularity data
        raw_count = candidate.get("_hn_points", 0)

        candidate["score"] = calculate_total_score(candidate, raw_count=raw_count, cross_source_count=cross_count)
        candidate["confidence"] = calculate_confidence(candidate, cross_source_count=cross_count)

    # Sort by score descending
    data.sort(key=lambda c: c["score"], reverse=True)

    # Log top 3
    info("--- Top 3 Candidates ---")
    for i, c in enumerate(data[:3]):
        info(f"  #{i+1}: {c.get('name')} (score: {c['score']}, confidence: {c['confidence']:.2f}, source: {c.get('source')})")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    info(f"Evaluated {len(data)} candidates. Written to {args.output}")


if __name__ == "__main__":
    main()
