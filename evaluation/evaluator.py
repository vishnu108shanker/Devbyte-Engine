import argparse
import json
import sys
import os
import time
import concurrent.futures
from datetime import datetime, timezone
from google import genai
from google.genai import types

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error, warning
from utils.file_utils import read_json
from evaluation.evidence_builder import build_candidate_evidence, compute_cross_source_coverage
from evaluation.scoring import compute_evidence_hash, should_rescore

CACHE_FILE_PATH = os.path.join(PROJECT_ROOT, "data", "evaluation_cache.json")
CACHE_TTL_HOURS = 30
BATCH_CHUNK_SIZE = 10
MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"]

def load_cache():
    """Load cached evaluations from file."""
    if os.path.exists(CACHE_FILE_PATH):
        try:
            with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            warning(f"Failed to read cache file: {e}")
    return {}

def save_cache(cache_data):
    """Save evaluations to cache file."""
    try:
        os.makedirs(os.path.dirname(CACHE_FILE_PATH), exist_ok=True)
        with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, indent=2)
    except Exception as e:
        warning(f"Failed to save cache file: {e}")

def is_cache_entry_valid(cached_entry, current_candidate):
    """Check if cache entry is within 30 hours and hasn't triggered re-scoring."""
    if not cached_entry:
        return False

    evaluated_at_str = cached_entry.get("evaluated_at")
    if not evaluated_at_str:
        return False

    try:
        eval_dt = datetime.fromisoformat(evaluated_at_str.replace("Z", "+00:00"))
        if eval_dt.tzinfo is None:
            eval_dt = eval_dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        age_hours = (now - eval_dt).total_seconds() / 3600.0

        if age_hours > CACHE_TTL_HOURS:
            return False

        if should_rescore(cached_entry, current_candidate):
            info(f"Re-scoring triggered for '{current_candidate.get('name')}' (signal update detected)")
            return False

        return True
    except Exception:
        return False

def validate_mission_check_output(expected_ids, output_json):
    """
    Structural verification of Gemini Pass 1 output.
    Ensures every candidate is accounted for with a valid decision and reason.
    """
    if not isinstance(output_json, list):
        return False, "Output is not a JSON array"

    found_ids = set()
    for item in output_json:
        if not isinstance(item, dict):
            return False, "Array entry is not a JSON object"
        cid = item.get("id")
        decision = item.get("decision")
        reason = item.get("editorial_reason")

        if not cid:
            return False, "Candidate missing 'id'"
        if cid not in expected_ids:
            return False, f"Unexpected candidate id '{cid}'"
        if decision not in ("publish", "reject"):
            return False, f"Invalid decision '{decision}' for id '{cid}' (must be 'publish' or 'reject')"
        if not reason or not isinstance(reason, str) or len(reason.strip()) < 5:
            return False, f"Missing or insufficient editorial_reason for id '{cid}'"

        found_ids.add(cid)

    missing = set(expected_ids) - found_ids
    if missing:
        return False, f"Missing evaluations for candidate IDs: {missing}"

    return True, None

def validate_ranking_output(expected_ids, output_json):
    """
    Structural verification of Gemini Pass 2 output.
    Ensures unique sequential ranks 1..N.
    """
    if not isinstance(output_json, list):
        return False, "Output is not a JSON array"

    found_ids = set()
    ranks = []

    for item in output_json:
        if not isinstance(item, dict):
            return False, "Array entry is not a JSON object"
        cid = item.get("id")
        rank = item.get("rank")

        if not cid:
            return False, "Candidate missing 'id'"
        if cid not in expected_ids:
            return False, f"Unexpected candidate id '{cid}' in ranking"
        if not isinstance(rank, int) or rank < 1:
            return False, f"Invalid rank '{rank}' for id '{cid}' (must be positive int)"

        found_ids.add(cid)
        ranks.append(rank)

    missing = set(expected_ids) - found_ids
    if missing:
        return False, f"Missing ranked candidates: {missing}"

    if len(ranks) != len(set(ranks)):
        return False, f"Duplicate ranks detected: {ranks}"

    return True, None

def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
        api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        return None
    return genai.Client(api_key=api_key)

def call_gemini_pass1_mission_check(client, candidates_chunk):
    """
    Pass 1: Mission eligibility evaluation.
    Decides PUBLISH or REJECT with reasoning.
    """
    expected_ids = [c["id"] for c in candidates_chunk]

    items_payload = []
    for c in candidates_chunk:
        ev = c.get("evidence", {})
        items_payload.append({
            "id": c["id"],
            "title": c.get("name"),
            "summary": c.get("summary"),
            "website": c.get("website"),
            "evidence": {
                "source": ev.get("source_label"),
                "days_ago": ev.get("days_ago"),
                "is_this_week": ev.get("is_this_week"),
                "community_hn_points": ev.get("hn_points"),
                "cross_source_mentions": ev.get("cross_source_count"),
                "event_type": ev.get("event_type")
            }
        })

    prompt = f"""You are the Lead Executive Editor for DevByte, a premier daily YouTube Shorts channel for software engineers and tech enthusiasts.

STRICT EDITORIAL MISSION:
DevByte covers major developer tools, software releases, infrastructure breakthroughs, open-source milestones, AI models, and major engineering announcements from tech giants and innovative startups.
DevByte NEVER covers:
- Opinion pieces, retrospectives, personal blog essays (e.g. "What I learned from SQL").
- General consumer marketing activations or sports events (e.g. US Open fan events).
- Broad academic surveys or non-actionable whitepapers without immediate developer utility.
- Generic tutorials or basic beginner how-to guides.

EVALUATION TASK:
Evaluate each candidate news item below and determine whether it should be PUBLISHED on DevByte or REJECTED.

CRITERIA FOR "PUBLISH":
1. Explainability: Can this story be clearly and compellingly explained in 40-50 seconds?
2. Visual Potential: Is there a concrete UI, terminal, code, tool demo, or hardware product to show?
3. Hook & FOMO: Will a developer scrolling YouTube stop immediately?
4. Broad Developer Value: Does this genuinely matter to working programmers?

CANDIDATES TO EVALUATE:
{json.dumps(items_payload, indent=2)}

OUTPUT REQUIREMENT:
Return a JSON array containing an evaluation for every single candidate.
[
  {{
    "id": "<candidate_id>",
    "decision": "publish" | "reject",
    "editorial_reason": "<Clear, concise 1-2 sentence explanation of why it fits or violates DevByte's mission>"
  }}
]
"""

    for model_name in MODELS_TO_TRY:
        for attempt in range(2):
            try:
                info(f"Pass 1 Mission Check: calling {model_name} (attempt {attempt+1}) for {len(candidates_chunk)} candidates...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0
                    )
                )
                parsed = json.loads(response.text)
                is_valid, err_msg = validate_mission_check_output(expected_ids, parsed)
                if is_valid:
                    return {item["id"]: (item["decision"], item["editorial_reason"], model_name) for item in parsed}
                else:
                    warning(f"Contract invariant violation from {model_name}: {err_msg}. Retrying...")
            except Exception as e:
                warning(f"Pass 1 error with {model_name}: {e}")
                time.sleep(1)

    warning("All models failed Pass 1 mission check. Applying safe rejection fallback.")
    return {cid: ("reject", "API evaluation failed to produce valid output", "fallback") for cid in expected_ids}

def call_gemini_pass2_rank(client, publishable_candidates):
    """
    Pass 2: Relative ranking of eligible candidates from 1 (best) to N (lowest priority).
    """
    if not publishable_candidates:
        return {}

    expected_ids = [c["id"] for c in publishable_candidates]
    if len(expected_ids) == 1:
        return {expected_ids[0]: 1}

    items_payload = []
    for c in publishable_candidates:
        ev = c.get("evidence", {})
        items_payload.append({
            "id": c["id"],
            "title": c.get("name"),
            "summary": c.get("summary"),
            "editorial_reason": c.get("editorial_reason"),
            "evidence": {
                "source": ev.get("source_label"),
                "days_ago": ev.get("days_ago"),
                "community_hn_points": ev.get("hn_points"),
                "cross_source_mentions": ev.get("cross_source_count")
            }
        })

    prompt = f"""You are the Lead Editor for DevByte. You have approved the following {len(publishable_candidates)} candidates for publication.
Now rank them in strict order of priority for today's YouTube Shorts queue, from 1 (the single most important/viral video of the day) to {len(publishable_candidates)} (lowest relative priority).

RANKING CRITERIA:
- Rank 1 must be the most impactful, high-retention, channel-defining story (e.g. major AI acquisition, breakthrough foundation model, landmark developer tool release).
- Prioritize high visual potential and immediate developer curiosity.
- Prioritize fresh, breaking news over older announcements.

APPROVED CANDIDATES:
{json.dumps(items_payload, indent=2)}

OUTPUT REQUIREMENT:
Return a JSON array assigning a unique integer rank from 1 to {len(publishable_candidates)} for each candidate.
[
  {{
    "id": "<candidate_id>",
    "rank": <unique integer from 1 to {len(publishable_candidates)}>
  }}
]
"""

    for model_name in MODELS_TO_TRY:
        for attempt in range(2):
            try:
                info(f"Pass 2 Relative Ranking: calling {model_name} (attempt {attempt+1}) for {len(publishable_candidates)} items...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0
                    )
                )
                parsed = json.loads(response.text)
                is_valid, err_msg = validate_ranking_output(expected_ids, parsed)
                if is_valid:
                    return {item["id"]: item["rank"] for item in parsed}
                else:
                    warning(f"Ranking invariant violation from {model_name}: {err_msg}. Retrying...")
            except Exception as e:
                warning(f"Pass 2 error with {model_name}: {e}")
                time.sleep(1)

    warning("All models failed Pass 2 relative ranking. Preserving original order as ranks.")
    return {cid: idx + 1 for idx, cid in enumerate(expected_ids)}

def evaluate_all_candidates(candidates):
    """
    Main evaluation pipeline:
    1. Attaches evidence signals to all candidates.
    2. Checks cache (30h TTL with re-score triggers).
    3. Pass 1: Chunked Mission Check (in batches of 10) for non-cached candidates.
    4. Pass 2: Relative Ranking of all publishable candidates.
    5. Formats output with strict schema.
    """
    # 1. Attach cross-source coverage and factual evidence
    cross_source_map = compute_cross_source_coverage(candidates)
    for c in candidates:
        count = cross_source_map.get(c["id"], 1)
        build_candidate_evidence(c, cross_source_count=count)

    # 2. Check cache
    cache = load_cache()
    to_evaluate = []
    current_time_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    for c in candidates:
        cid = c["id"]
        cached = cache.get(cid)
        if is_cache_entry_valid(cached, c):
            info(f"Using valid cached evaluation for '{c.get('name')}' (decision: {cached.get('decision')})")
            c["decision"] = cached.get("decision")
            c["editorial_reason"] = cached.get("editorial_reason")
            c["editorial_model"] = cached.get("editorial_model", "cache")
            c["evaluated_at"] = cached.get("evaluated_at")
        else:
            to_evaluate.append(c)

    client = get_gemini_client()
    if not client and to_evaluate:
        warning("GEMINI_API_KEY not found. Defaulting non-cached items to reject.")
        for c in to_evaluate:
            c["decision"] = "reject"
            c["editorial_reason"] = "No GEMINI_API_KEY available"
            c["editorial_model"] = "none"
            c["evaluated_at"] = current_time_str

    # 3. Pass 1: Chunked Mission Check for items needing evaluation (Parallelized via ThreadPoolExecutor)
    if client and to_evaluate:
        chunks = [to_evaluate[i:i + BATCH_CHUNK_SIZE] for i in range(0, len(to_evaluate), BATCH_CHUNK_SIZE)]
        max_workers = min(5, len(chunks))
        info(f"Evaluating {len(to_evaluate)} candidates across {len(chunks)} parallel chunks (batch size: {BATCH_CHUNK_SIZE}, workers: {max_workers})...")

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_chunk = {executor.submit(call_gemini_pass1_mission_check, client, chunk): chunk for chunk in chunks}
            for future in concurrent.futures.as_completed(future_to_chunk):
                chunk = future_to_chunk[future]
                try:
                    decisions = future.result()
                except Exception as e:
                    warning(f"Chunk execution failed with exception: {e}")
                    decisions = {c["id"]: ("reject", f"Evaluation failed: {e}", "fallback") for c in chunk}

                for c in chunk:
                    cid = c["id"]
                    decision, reason, model_name = decisions.get(cid, ("reject", "No decision returned", "fallback"))
                    c["decision"] = decision
                    c["editorial_reason"] = reason
                    c["editorial_model"] = model_name
                    c["evaluated_at"] = current_time_str

                    # Update cache
                    cache[cid] = {
                        "id": cid,
                        "name": c.get("name"),
                        "decision": decision,
                        "editorial_reason": reason,
                        "editorial_model": model_name,
                        "evaluated_at": current_time_str,
                        "evidence": c.get("evidence"),
                        "evidence_hash": compute_evidence_hash(c)
                    }

        save_cache(cache)

    # 4. Pass 2: Relative Ranking of all publishable candidates
    publishable = [c for c in candidates if c.get("decision") == "publish"]
    rejected = [c for c in candidates if c.get("decision") != "publish"]

    for c in rejected:
        c["rank"] = None
        c["score"] = 0

    if publishable:
        info(f"Ranking {len(publishable)} approved publishable candidates...")
        # If candidate pool is > 20, rank top contenders in segments
        if len(publishable) <= 20:
            rank_map = call_gemini_pass2_rank(client, publishable)
        else:
            # Multi-stage ranking for large 50+ candidate pools
            ranked_segments = []
            for i in range(0, len(publishable), 15):
                seg = publishable[i:i + 15]
                seg_ranks = call_gemini_pass2_rank(client, seg)
                for item in seg:
                    item["_seg_rank"] = seg_ranks.get(item["id"], 99)
                seg.sort(key=lambda x: x.get("_seg_rank", 99))
                ranked_segments.extend(seg[:5])  # Top 5 from each segment

            # Final championship ranking
            champ_ranks = call_gemini_pass2_rank(client, ranked_segments)
            rank_map = {}
            for item in ranked_segments:
                rank_map[item["id"]] = champ_ranks.get(item["id"], 50)
            # Remaining publishable items get trailing ranks
            cur_rank = len(ranked_segments) + 1
            for item in publishable:
                if item["id"] not in rank_map:
                    rank_map[item["id"]] = cur_rank
                    cur_rank += 1

        for c in publishable:
            c["rank"] = rank_map.get(c["id"], 999)

        # Sort publishable strictly by rank ascending
        publishable.sort(key=lambda x: x.get("rank", 999))

        # Re-normalize ranks to strictly 1..N
        for idx, c in enumerate(publishable):
            c["rank"] = idx + 1
            # Backwards-compatible score: Rank 1 gets 99, descending
            c["score"] = max(10, 100 - idx * 5)

    # Combine: published first (by rank), then rejected
    all_evaluated = publishable + rejected

    return all_evaluated

def main():
    parser = argparse.ArgumentParser(description="DevByte Editorial Evaluator V2")
    parser.add_argument("--input", required=True, help="Path to input candidates JSON")
    parser.add_argument("--output", required=True, help="Path to evaluated candidates JSON")
    args = parser.parse_args()

    data = read_json(args.input)
    if not data or not isinstance(data, list):
        warning("No candidates to evaluate.")
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        return

    info(f"Starting Editorial Evaluation V2 for {len(data)} candidates...")
    evaluated = evaluate_all_candidates(data)

    # Log summary of results
    publishable_count = sum(1 for c in evaluated if c.get("decision") == "publish")
    info(f"Evaluation complete: {publishable_count} approved for publication, {len(evaluated) - publishable_count} rejected.")

    info("--- Top Evaluated Publishable Items ---")
    for c in [c for c in evaluated if c.get("decision") == "publish"][:5]:
        info(f"  Rank #{c.get('rank')}: '{c.get('name')}' (Model: {c.get('editorial_model')})")
        info(f"    Reason: {c.get('editorial_reason')}")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(evaluated, f, indent=2)

    info(f"Evaluated candidates written to {args.output}")

if __name__ == "__main__":
    main()
