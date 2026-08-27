# Data acquisition method: Official JSON API
# Endpoint: https://hacker-news.firebaseio.com/v0/topstories.json
# Auth required: No
# Rate limit: None documented

import argparse
import json
import urllib.request
import datetime
import sys
import os
from slugify import slugify

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error, warning

def fetch_json(url):
    try:
        import requests
        response = requests.get(url, headers={'User-Agent': 'DevByte/2.0'}, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        error(f"Failed to fetch {url}: {e}")
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to config.json")
    parser.add_argument("--output", required=True, help="Path to output json")
    args = parser.parse_args()

    info("Fetching Hacker News top stories...")
    top_story_ids = fetch_json("https://hacker-news.firebaseio.com/v0/topstories.json")
    
    if not top_story_ids:
        error("Could not fetch top stories from Hacker News.")
        sys.exit(1)

    # Take first 15 story IDs (since we are not filtering, 15 is plenty for the daily queue)
    top_story_ids = top_story_ids[:15]
    
    candidates = []
    
    current_time = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    for story_id in top_story_ids:
        story = fetch_json(f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json")
        if not story or "title" not in story or "url" not in story:
            continue
            
        title_lower = story["title"].lower()
        
        # Parse event type
        event_type = "other"
        if "release" in title_lower or "launch" in title_lower:
            event_type = "new_tool"
        elif "update" in title_lower:
            event_type = "major_update"
                
        domain = urllib.parse.urlparse(story["url"]).netloc.replace("www.", "")
        slug = slugify(story["title"])
        item_id = f"{slug}-{domain}"
            
        # Map to enriched normalized schema
        candidate = {
            "id": item_id,
            "name": story["title"][:120],
            "category": "unknown",
            "summary": story.get("title", ""),
            "website": story["url"],
            "pricing": "unknown",
            "target_audience": "",
            "competitors": [],
            "use_cases": [],
            "event_type": event_type,
            "tags": ["tech", "hackernews"],
            "source": "hackernews",
            "source_tier": 3,
            "released_at": datetime.datetime.fromtimestamp(story.get("time", 0), datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
            "collected_at": current_time,
            "score": 0,
            "confidence": 0.0,
            "_hn_points": story.get("score", 0)
        }
        
        candidates.append(candidate)

    info(f"Hacker News collector finished. Found {len(candidates)} stories.")
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(candidates, f, indent=2)

if __name__ == "__main__":
    main()
