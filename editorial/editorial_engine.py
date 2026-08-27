import argparse
import json
import sys
import os


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, warning, error
from utils.file_utils import read_json




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
        non_breaking = [c for c in eligible if c.get("score", 0) < breaking_threshold and c.get("score", 0) >= min_score]
        combined = breaking + non_breaking
        queue = select_with_diversity(combined, queue_size)
    else:
        # Simple score-based selection
        scored = [c for c in eligible if c.get("score", 0) >= min_score]

        if not scored:
            warning(f"No candidates above score threshold {min_score}. Taking top eligible regardless.")
            scored = eligible

        # Sort by score descending
        scored.sort(key=lambda c: c.get("score", 0), reverse=True)

        queue = select_with_diversity(scored, queue_size)

    # Hardcode category to "update" for all selected candidates
    for c in queue:
        c["category"] = "update"

    info(f"Top pick: {queue[0].get('name') if queue else 'none'} (score: {queue[0].get('score') if queue else 0})")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(queue, f, indent=2)

    info(f"Content queue built with {len(queue)} candidates.")


if __name__ == "__main__":
    main()
