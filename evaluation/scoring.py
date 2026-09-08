"""
evaluation/scoring.py — V2 Architecture

The 4-factor arithmetic scoring model (freshness/popularity/trust/quality points) has been scrapped.
In V2:
- Deterministic code handles hard gates (filters, deduplication, staleness).
- Gemini LLM acts as the editorial brain: evaluates factual evidence to decide PUBLISH/REJECT and relative rank.
- This module provides caching, hashing, and re-scoring trigger logic.
"""

import hashlib
import json

def compute_evidence_hash(candidate):
    """
    Generate a deterministic hash of candidate content and signals to detect meaningful updates.
    """
    evidence = candidate.get("evidence", {})
    payload = {
        "id": candidate.get("id", ""),
        "name": candidate.get("name", ""),
        "summary": candidate.get("summary", ""),
        "website": candidate.get("website", ""),
        "source": candidate.get("source", ""),
        "cross_source_count": evidence.get("cross_source_count", 1),
        # Round HN points to bucket to avoid thrashing on minor score fluctuations
        "hn_points": evidence.get("hn_points"),
    }
    encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()

def should_rescore(cached_entry, current_candidate):
    """
    Check if a cached candidate evaluation should be invalidated and re-scored.
    Triggers:
    1. HN points increased by > 50% (indicating viral momentum).
    2. Cross-source count increased (story picked up by new independent sources).
    """
    if not cached_entry:
        return True

    old_evidence = cached_entry.get("evidence", {})
    new_evidence = current_candidate.get("evidence", {})

    # Trigger 1: Cross-source mentions expanded
    old_sources = old_evidence.get("cross_source_count", 1)
    new_sources = new_evidence.get("cross_source_count", 1)
    if new_sources > old_sources:
        return True

    # Trigger 2: Viral engagement surge
    old_hn = old_evidence.get("hn_points") or 0
    new_hn = new_evidence.get("hn_points") or 0
    if old_hn > 0 and new_hn >= old_hn * 1.5:
        return True
    elif old_hn == 0 and new_hn >= 50:
        return True

    return False
