import argparse
import json
import sys
import os
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, warning, error
from utils.file_utils import read_json

def is_stale(candidate, max_days=14):
    """Returns (is_stale, days_ago, reason) tuple."""
    released_at = candidate.get("released_at", "")
    if not released_at:
        return True, None, "missing released_at timestamp"

    try:
        # Standardize ISO-8601
        dt_str = released_at.replace("Z", "+00:00")
        released_dt = datetime.fromisoformat(dt_str)
        if released_dt.tzinfo is None:
            released_dt = released_dt.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        days_ago = (now - released_dt).total_seconds() / 86400.0

        if days_ago < 0:
            # Future release date / timezone anomaly, allow but treat as 0 days ago
            return False, 0, None

        if days_ago > max_days:
            return True, int(days_ago), f"released {int(days_ago)} days ago (max allowed is {max_days})"

        return False, int(days_ago), None
    except Exception as e:
        return True, None, f"invalid date format '{released_at}': {e}"

def main():
    parser = argparse.ArgumentParser(description="Filter out stale candidates based on released_at date.")
    parser.add_argument("--input", required=True, help="Path to input candidates JSON")
    parser.add_argument("--output", required=True, help="Path to output filtered candidates JSON")
    parser.add_argument("--max-days", type=int, default=14, help="Maximum candidate age in days (default: 14)")
    args = parser.parse_args()

    data = read_json(args.input)
    if not data or not isinstance(data, list):
        warning("No candidates to evaluate for staleness.")
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        return

    passed = []
    dropped_stale = 0

    for candidate in data:
        stale, days_ago, reason = is_stale(candidate, max_days=args.max_days)
        if stale:
            dropped_stale += 1
            info(f"Staleness Gate: Dropped '{candidate.get('name')}' -> {reason}")
        else:
            candidate["_days_ago"] = days_ago
            passed.append(candidate)

    info(f"Staleness Gate finished: {len(passed)} passed. (Dropped: {dropped_stale} stale items > {args.max_days} days)")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(passed, f, indent=2)

if __name__ == "__main__":
    main()
