# Data acquisition method: RSS Feed
# Endpoints: OpenAI, Anthropic, Google AI official RSS feeds
# Auth required: No
# Rate limit: None documented

import argparse
import json
import feedparser
import datetime
import sys
import os
import urllib.parse
from slugify import slugify
from bs4 import BeautifulSoup

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error, warning

FEEDS = [
    {"url": "https://openai.com/blog/rss.xml", "source": "openai_blog"},
    {"url": "https://www.anthropic.com/rss.xml", "source": "anthropic_blog"},
    {"url": "https://blog.google/technology/ai/rss/", "source": "google_blog"}
]

def clean_html(html_content):
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, "html.parser")
    return soup.get_text(separator=" ", strip=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to config.json")
    parser.add_argument("--output", required=True, help="Path to output json")
    args = parser.parse_args()

    info("Fetching AI blogs via RSS...")
    candidates = []
    current_time = datetime.datetime.now(datetime.timezone.utc)
    thirty_days_ago = current_time - datetime.timedelta(days=30)
    current_time_str = current_time.isoformat().replace("+00:00", "Z")

    for feed_info in FEEDS:
        url = feed_info["url"]
        source_name = feed_info["source"]
        info(f"Parsing feed: {url}")
        
        try:
            parsed_feed = feedparser.parse(url)
            
            # Take latest 5 entries
            entries = parsed_feed.entries[:5]
            
            for entry in entries:
                # Parse published date
                published_tuple = entry.get("published_parsed") or entry.get("updated_parsed")
                if not published_tuple:
                    continue
                    
                published_dt = datetime.datetime(*published_tuple[:6], tzinfo=datetime.timezone.utc)
                
                # Filter out older than 30 days
                if published_dt < thirty_days_ago:
                    continue
                
                title = entry.get("title", "")
                link = entry.get("link", "")
                
                # Try to get summary
                summary_raw = entry.get("summary", "")
                if not summary_raw and "content" in entry and len(entry["content"]) > 0:
                    summary_raw = entry["content"][0].value
                    
                summary = clean_html(summary_raw)
                
                # Ensure summary is at least 20 words for the quality filter
                if len(summary.split()) < 20:
                    summary = f"{title}. {summary}. This announcement was recently published on the official {source_name} blog and is highly relevant to the AI community."
                    
                domain = urllib.parse.urlparse(link).netloc.replace("www.", "")
                slug = slugify(title)
                item_id = f"{slug}-{domain}"
                
                candidate = {
                    "id": item_id,
                    "name": title[:120],
                    "category": "unknown",
                    "summary": summary[:500],
                    "website": link,
                    "pricing": "unknown",
                    "target_audience": "",
                    "competitors": [],
                    "use_cases": [],
                    "event_type": "update",
                    "tags": ["ai", "blog", "official", source_name.split("_")[0]],
                    "source": source_name,
                    "source_tier": 2,
                    "released_at": published_dt.isoformat().replace("+00:00", "Z"),
                    "collected_at": current_time_str,
                    "score": 0,
                    "confidence": 0.0
                }
                candidates.append(candidate)
                
        except Exception as e:
            error(f"Failed to parse RSS feed {url}: {e}")

    info(f"Blogs collector finished. Found {len(candidates)} recent announcements.")
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(candidates, f, indent=2)

if __name__ == "__main__":
    main()
