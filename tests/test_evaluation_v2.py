import pytest
import os
import sys
import json
from datetime import datetime, timezone, timedelta

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ingestion.staleness_gate import is_stale
from evaluation.evidence_builder import build_candidate_evidence, compute_cross_source_coverage
from evaluation.scoring import compute_evidence_hash, should_rescore
from evaluation.evaluator import validate_mission_check_output, validate_ranking_output
from editorial.editorial_engine import build_editorial_queue, extract_company_identity

def test_staleness_gate():
    now = datetime.now(timezone.utc)
    
    fresh_candidate = {
        "id": "fresh-tool",
        "name": "Fresh Tool",
        "released_at": (now - timedelta(days=2)).isoformat().replace("+00:00", "Z")
    }
    stale_candidate = {
        "id": "stale-tool",
        "name": "Stale Tool",
        "released_at": (now - timedelta(days=20)).isoformat().replace("+00:00", "Z")
    }
    
    stale1, days1, _ = is_stale(fresh_candidate, max_days=14)
    assert not stale1
    assert days1 == 2
    
    stale2, days2, reason2 = is_stale(stale_candidate, max_days=14)
    assert stale2
    assert days2 == 20
    assert "released 20 days ago" in reason2

def test_evidence_builder():
    now = datetime.now(timezone.utc)
    candidate = {
        "id": "cursor-v2",
        "name": "Cursor Agent V2 Released",
        "summary": "Cursor introduces background agents for VS Code.",
        "website": "https://cursor.com/blog/agents",
        "source": "hackernews",
        "_hn_points": 750,
        "event_type": "new_tool",
        "released_at": (now - timedelta(days=1)).isoformat().replace("+00:00", "Z")
    }
    
    enriched = build_candidate_evidence(candidate, cross_source_count=2)
    ev = enriched["evidence"]
    
    assert ev["days_ago"] == 1
    assert ev["is_this_week"] is True
    assert ev["hn_points"] == 750
    assert ev["source_label"] == "Hacker News (Community Discussion & Voting)"
    assert ev["cross_source_count"] == 2
    assert ev["independently_reported"] is True

def test_rescoring_triggers():
    base_entry = {
        "evidence": {
            "hn_points": 100,
            "cross_source_count": 1
        }
    }
    
    # Minor HN change (+20%) -> no rescore
    candidate_minor = {
        "evidence": {
            "hn_points": 120,
            "cross_source_count": 1
        }
    }
    assert not should_rescore(base_entry, candidate_minor)
    
    # Viral surge (+60%) -> triggers rescore
    candidate_viral = {
        "evidence": {
            "hn_points": 160,
            "cross_source_count": 1
        }
    }
    assert should_rescore(base_entry, candidate_viral)
    
    # Cross-source pick up -> triggers rescore
    candidate_multi_source = {
        "evidence": {
            "hn_points": 100,
            "cross_source_count": 2
        }
    }
    assert should_rescore(base_entry, candidate_multi_source)

def test_mission_check_invariants():
    expected_ids = ["tool-1", "tool-2"]
    
    # Valid output
    valid_output = [
        {"id": "tool-1", "decision": "publish", "editorial_reason": "Major developer tool release."},
        {"id": "tool-2", "decision": "reject", "editorial_reason": "Personal essay, not on mission."}
    ]
    is_valid, err = validate_mission_check_output(expected_ids, valid_output)
    assert is_valid
    assert err is None
    
    # Dropped item
    invalid_dropped = [
        {"id": "tool-1", "decision": "publish", "editorial_reason": "Major tool."}
    ]
    is_valid, err = validate_mission_check_output(expected_ids, invalid_dropped)
    assert not is_valid
    assert "Missing evaluations" in err

def test_ranking_invariants():
    expected_ids = ["tool-1", "tool-2", "tool-3"]
    
    # Valid unique sequential ranks
    valid_ranks = [
        {"id": "tool-1", "rank": 1},
        {"id": "tool-2", "rank": 2},
        {"id": "tool-3", "rank": 3}
    ]
    is_valid, err = validate_ranking_output(expected_ids, valid_ranks)
    assert is_valid
    
    # Duplicate ranks
    duplicate_ranks = [
        {"id": "tool-1", "rank": 1},
        {"id": "tool-2", "rank": 1},
        {"id": "tool-3", "rank": 3}
    ]
    is_valid, err = validate_ranking_output(expected_ids, duplicate_ranks)
    assert not is_valid
    assert "Duplicate ranks detected" in err

def test_editorial_engine_diversity_and_history():
    candidates = [
        {"id": "nv-1", "name": "NVIDIA Story 1", "decision": "publish", "rank": 1, "source": "nvidia_blogs", "tags": ["nvidia"]},
        {"id": "nv-2", "name": "NVIDIA Story 2", "decision": "publish", "rank": 2, "source": "nvidia_blogs", "tags": ["nvidia"]},
        {"id": "nv-3", "name": "NVIDIA Story 3", "decision": "publish", "rank": 3, "source": "nvidia_blogs", "tags": ["nvidia"]},
        {"id": "goog-1", "name": "Google AI Story 1", "decision": "publish", "rank": 4, "source": "google_blog", "tags": ["google"]},
        {"id": "ibm-1", "name": "IBM Quantum Story", "decision": "publish", "rank": 5, "source": "ibm_press", "tags": ["ibm"]},
        {"id": "old-1", "name": "Already Published Story", "decision": "publish", "rank": 6, "source": "hackernews", "tags": []}
    ]
    
    history = [{"id": "old-1"}]
    policy = {
        "queue_size": 5,
        "max_per_source": 3,
        "max_per_company": 2
    }
    
    queue = build_editorial_queue(candidates, history, policy)
    
    # Exactly nv-1 and nv-2 should be included; nv-3 dropped due to max_per_company=2
    # old-1 dropped due to history
    queue_ids = [c["id"] for c in queue]
    assert "nv-1" in queue_ids
    assert "nv-2" in queue_ids
    assert "nv-3" not in queue_ids  # company diversity cap
    assert "goog-1" in queue_ids
    assert "ibm-1" in queue_ids
    assert "old-1" not in queue_ids  # history gate
    
    # Ensure hardcoded update category
    assert all(c["category"] == "update" for c in queue)

def test_55_candidates_batch_chunking_contract():
    # Simulate 55 candidates
    synthetic_candidates = []
    for i in range(55):
        synthetic_candidates.append({
            "id": f"candidate-{i:02d}",
            "name": f"Developer Tool #{i}",
            "summary": f"Summary for developer tool announcement #{i}",
            "source": f"source_{i % 5}"
        })
        
    # Split into chunks of 10
    chunks = [synthetic_candidates[i:i + 10] for i in range(0, len(synthetic_candidates), 10)]
    assert len(chunks) == 6  # 5 chunks of 10, 1 chunk of 5
    
    # Verify every single candidate ID is accounted for across chunks
    accounted_ids = set()
    for chunk in chunks:
        expected = [c["id"] for c in chunk]
        # Simulate LLM returning publish/reject
        simulated_output = [{"id": cid, "decision": "publish" if int(cid.split("-")[1]) % 2 == 0 else "reject", "editorial_reason": "Valid reason"} for cid in expected]
        is_valid, err = validate_mission_check_output(expected, simulated_output)
        assert is_valid
        accounted_ids.update(expected)
        
    assert len(accounted_ids) == 55
