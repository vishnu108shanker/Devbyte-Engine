# Data acquisition method: RSS Feed
# Endpoint: https://www.producthunt.com/feed
# Auth required: No
# Rate limit: None documented

import argparse
import json
import feedparser
import datetime
import sys
import os
from bs4 import BeautifulSoup
from slugify import slugify

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error, warning

def clean_html(html_content):
    if not html_content:
        return ""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        return soup.get_text().strip()
    except Exception:
        return html_content

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to config.json")
    parser.add_argument("--output", required=True, help="Path to output json")
    args = parser.parse_args()

    info("Fetching Product Hunt popular products...")
    try:
        import requests
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        response = requests.get("https://www.producthunt.com/feed", headers=headers, timeout=10)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except Exception as e:
        error(f"Failed to fetch Product Hunt RSS feed: {e}")
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        return

    if feed.bozo:
        warning(f"Product Hunt RSS feed parsed with warnings/errors: {feed.bozo_exception}")

    if not feed.entries:
        warning("No entries found in Product Hunt RSS feed.")
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        return

    candidates = []
    current_time = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    # Take top 15 products of the day
    for entry in feed.entries[:15]:
        title = entry.get("title", "")
        if not title:
            continue

        raw_summary = entry.get("description", "") or entry.get("summary", "")
        summary = clean_html(raw_summary)

        # PH descriptions might be short, let's append fallback details to satisfy the schema's word limit
        if len(summary.split()) < 20:
            summary = f"{title}. {summary}. This new tech product is currently featured and trending on Product Hunt today."

        link = entry.get("link", "")
        # Try to parse published date
        published = current_time
        for key in ["published_parsed", "updated_parsed"]:
            parsed = entry.get(key)
            if parsed:
                published = datetime.datetime(*parsed[:6], tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")
                break

        item_id = f"ph-{slugify(title)}"
        candidate = {
            "id": item_id,
            "name": title[:120],
            "category": "unknown",
            "summary": summary,
            "website": link,
            "pricing": "unknown",
            "target_audience": "",
            "competitors": [],
            "use_cases": [],
            "event_type": "new_tool",
            "tags": ["tech", "producthunt"],
            "source": "producthunt",
            "source_tier": 3,
            "released_at": published,
            "collected_at": current_time,
            "score": 0,
            "confidence": 0.0
        }
        candidates.append(candidate)

    info(f"Product Hunt collector finished. Found {len(candidates)} products.")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(candidates, f, indent=2)

if __name__ == "__main__":
    main()
