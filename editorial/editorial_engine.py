import argparse
import json
import sys
import os
import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, warning, error
from utils.file_utils import read_json


def get_category_distribution(history, days=7):
    """Analyze which categories appeared in the last N days of history."""
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    distribution = {}

    for entry in history:
        published = entry.get("published_at", "")
        try:
            pub_dt = datetime.datetime.fromisoformat(published.replace("Z", "+00:00"))
            if pub_dt >= cutoff:
                cat = entry.get("category", "unknown")
                distribution[cat] = distribution.get(cat, 0) + 1
        except (ValueError, AttributeError):
            continue

    return distribution


def find_underrepresented_category(weights, recent_distribution):
    """Find the category that is most underrepresented vs its target weight."""
    total_weight = sum(weights.values())
    total_published = sum(recent_distribution.values()) or 1

    max_deficit = -float('inf')
    best_category = None

    for category, weight in weights.items():
        expected_share = weight / total_weight
        actual_count = recent_distribution.get(category, 0)
        actual_share = actual_count / total_published

        deficit = expected_share - actual_share
        if deficit > max_deficit:
            max_deficit = deficit
            best_category = category

    return best_category


def candidate_matches_category(candidate, category):
    """Check if a candidate's tags match the target category."""
    tags = candidate.get("tags", [])
    # Direct category match
    if candidate.get("category") == category:
        return True
    # Tag-based matching using category keywords
    category_keywords = category.replace("_", " ").split()
    for tag in tags:
        tag_lower = tag.lower()
        for keyword in category_keywords:
            if keyword in tag_lower:
                return True
    return False


MAX_PER_SOURCE = 3  # Maximum stories from the same source in a single queue

def select_with_diversity(scored_candidates, queue_size):
    """Select top N candidates while enforcing source diversity.
    No single source (e.g. 'openai_blog', 'hackernews') can contribute
    more than MAX_PER_SOURCE stories to a single daily queue."""
    queue = []
    source_counts = {}

    for c in scored_candidates:
        if len(queue) >= queue_size:
            break
        source = c.get("source", "unknown")
        count = source_counts.get(source, 0)
        if count < MAX_PER_SOURCE:
            queue.append(c)
            source_counts[source] = count + 1
        else:
            info(f"Diversity cap: skipping '{c.get('name')}' (already {MAX_PER_SOURCE} from '{source}')")

    return queue


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to evaluated_candidates.json")
    parser.add_argument("--output", required=True, help="Path to content_queue.json")
    parser.add_argument("--channel", required=True, help="Path to channel profile JSON")
    parser.add_argument("--policy", required=True, help="Path to editorial_policy.json")
    parser.add_argument("--history", required=True, help="Path to history.json")
    args = parser.parse_args()

    # Load all inputs
    candidates = read_json(args.input)
    channel = read_json(args.channel)
    policy = read_json(args.policy)
    history = read_json(args.history) or []

    if not candidates or not isinstance(candidates, list):
        error("No evaluated candidates to process.")
        sys.exit(1)

    weights = policy.get("weights", {})
    min_score = policy.get("min_score_threshold", 50)
    queue_size = policy.get("queue_size", 3)
    breaking_threshold = policy.get("breaking_news_override_score", 85)

    # Get history IDs to skip already-published tools
    published_ids = {entry.get("id") for entry in history}

    # Filter out already-published candidates (unless major_update)
    eligible = []
    for c in candidates:
        if c.get("id") in published_ids and c.get("event_type") != "major_update":
            info(f"Skipping already-published: {c.get('name')}")
            continue
        eligible.append(c)

    if not eligible:
        warning("No eligible candidates after filtering published history.")
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        return

    # Check for breaking news override
    breaking = [c for c in eligible if c.get("score", 0) >= breaking_threshold]
    if breaking:
        info(f"Breaking news override! '{breaking[0].get('name')}' scored {breaking[0].get('score')}")
        # Combine breaking news + remaining eligible, then select with diversity
        non_breaking = [c for c in eligible if c.get("score", 0) < breaking_threshold and c.get("score", 0) >= min_score]
        combined = breaking + non_breaking
        queue = select_with_diversity(combined, queue_size)
    else:
        # Find underrepresented category
        recent_dist = get_category_distribution(history)
        target_category = find_underrepresented_category(weights, recent_dist)
        info(f"Target category (most underrepresented): {target_category}")

        # Try to find candidates matching the target category
        category_matches = [c for c in eligible if candidate_matches_category(c, target_category)]

        # Apply min score threshold
        scored = [c for c in category_matches if c.get("score", 0) >= min_score]

        # If no category matches pass threshold, fall back to all eligible above threshold
        if not scored:
            info(f"No candidates matched '{target_category}' above score {min_score}. Falling back to top-scored eligible.")
            scored = [c for c in eligible if c.get("score", 0) >= min_score]

        # If still nothing, lower threshold and take whatever we have
        if not scored:
            warning(f"No candidates above score threshold {min_score}. Taking top eligible regardless.")
            scored = eligible

        # Already sorted by score from evaluator, pick top N with source diversity
        queue = select_with_diversity(scored, queue_size)

    # Assign dynamic target category to selected candidates if missing or "unknown"
    target_cat = find_underrepresented_category(weights, get_category_distribution(history))
    for c in queue:
        if not c.get("category") or c.get("category") == "unknown":
            c["category"] = target_cat

    info(f"Editorial selected category: {queue[0].get('category') if queue else 'none'}")
    info(f"Top pick: {queue[0].get('name') if queue else 'none'} (score: {queue[0].get('score') if queue else 0})")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(queue, f, indent=2)

    info(f"Content queue built with {len(queue)} candidates.")


if __name__ == "__main__":
    main()
