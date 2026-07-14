# Data acquisition method: Official JSON API
# Endpoint: https://api.github.com/repos/{owner}/{repo}/releases/latest
# Auth required: No
# Rate limit: 60 requests per hour (unauthenticated)

import argparse
import json
import urllib.request
import urllib.parse
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
        req = urllib.request.Request(url, headers={'User-Agent': 'DevByte/2.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        # 404 means no releases yet, which is expected for some repos
        warning(f"Could not fetch releases from {url}: {e}")
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to config.json")
    parser.add_argument("--output", required=True, help="Path to output json")
    args = parser.parse_args()

    repos_config_path = os.path.join(PROJECT_ROOT, "sources", "github_repos.json")
    if not os.path.exists(repos_config_path):
        error(f"GitHub repos config missing at: {repos_config_path}")
        sys.exit(1)

    with open(repos_config_path, "r", encoding="utf-8") as f:
        repos = json.load(f)

    info(f"Fetching GitHub releases for {len(repos)} repositories...")
    candidates = []
    current_time = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    for repo in repos:
        url = f"https://api.github.com/repos/{repo}/releases/latest"
        release = fetch_json(url)
        if not release:
            continue

        tag = release.get("tag_name", "")
        name = release.get("name", "") or tag
        html_url = release.get("html_url", "")
        body = release.get("body", "") or ""

        # Create a clean summary from the release notes
        # Strip some markdown and limit words
        clean_body = body[:400].replace("\r", "").replace("\n", " ")
        summary = f"{repo} released version {tag}: {name}. {clean_body}"
        if len(summary) > 500:
            summary = summary[:497] + "..."

        repo_name = repo.split("/")[-1]
        item_id = slugify(f"{repo}-{tag}")

        candidate = {
            "id": item_id,
            "name": f"{repo_name} {tag}: {name}"[:120],
            "category": "unknown",
            "summary": summary,
            "website": html_url,
            "pricing": "open_source",
            "target_audience": "",
            "competitors": [],
            "use_cases": [],
            "event_type": "open_source_release",
            "tags": ["tech", "github", repo_name.lower()],
            "source": "github",
            "source_tier": 2,
            "released_at": release.get("published_at", current_time),
            "collected_at": current_time,
            "score": 0,
            "confidence": 0.0
        }
        candidates.append(candidate)

    info(f"GitHub releases collector finished. Found {len(candidates)} releases.")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(candidates, f, indent=2)

if __name__ == "__main__":
    main()
