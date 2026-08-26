# Data acquisition method: Official JSON API
# Endpoints: GitHub releases, with a tag fallback for repositories without Releases
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

def fetch_json(url, warn=True):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'DevByte/2.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        if warn:
            warning(f"Could not fetch data from {url}: {e}")
        return None

def fetch_latest_release(repo):
    releases_url = f"https://api.github.com/repos/{repo}/releases?per_page=1"
    releases = fetch_json(releases_url)
    if isinstance(releases, list) and releases:
        return releases[0]

    tags_url = f"https://api.github.com/repos/{repo}/tags?per_page=1"
    tags = fetch_json(tags_url)
    if not isinstance(tags, list) or not tags:
        return None

    tag = tags[0].get("name", "")
    return {
        "tag_name": tag,
        "name": tag,
        "html_url": f"https://github.com/{repo}/releases/tag/{urllib.parse.quote(tag, safe='')}",
        "body": "Published as a Git tag; no GitHub Release notes are available.",
        "published_at": None,
    }

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
        release = fetch_latest_release(repo)
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
            "released_at": release.get("published_at") or current_time,
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
