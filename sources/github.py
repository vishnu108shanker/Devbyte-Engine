import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import argparse
import datetime
import requests
import time
from bs4 import BeautifulSoup

from utils.logger import info, error, warning, success
from utils.file_utils import write_json, read_json

def scrape_github_trending(max_retries=2):
    url = "https://github.com/trending"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    for attempt in range(max_retries + 1):
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.text
        except Exception as e:
            if attempt < max_retries:
                warning(f"Failed to fetch GitHub trending, retrying... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(2)
            else:
                error(f"Failed to fetch GitHub trending after {max_retries} attempts: {str(e)}")
                return None

def parse_trending_html(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    repos = []
    
    rows = soup.find_all("article", class_="Box-row")
    
    for row in rows[:5]:
        try:
            h2 = row.find("h2", class_="h3")
            if not h2:
                continue
            a_tag = h2.find("a")
            repo_path = a_tag['href'].strip()
            title = repo_path.lstrip("/")
            url = f"https://github.com{repo_path}"
            
            p_tag = row.find("p", class_="col-9")
            summary = p_tag.text.strip() if p_tag else "No summary provided."
            
            div_mt2 = row.find("div", class_="f6")
            if div_mt2:
                language_span = div_mt2.find("span", itemprop="programmingLanguage")
                language = language_span.text.strip() if language_span else "Unknown"
                
                mutted_links = div_mt2.find_all("a", class_="Link--muted")
                stars_text = mutted_links[0].text.strip() if mutted_links else "0"
                try:
                    stars = int(stars_text.replace(",", ""))
                except ValueError:
                    stars = 0
            else:
                language = "Unknown"
                stars = 0
            
            published_at = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            
            repo_data = {
                "title": title,
                "summary": summary,
                "url": url,
                "source": "github",
                "published_at": published_at,
                "metadata": {
                    "metric_label": "Stars",
                    "metric_value": stars,
                    "language": language
                }
            }
            repos.append(repo_data)
        except Exception as e:
            warning(f"Error parsing a repository row: {str(e)}")
            continue
            
    return repos

def validate_item(item):
    title = item.get("title", "")
    if not title or len(title) > 120:
        return False
    summary = item.get("summary", "")
    if not summary or len(summary) > 500:
        return False
    url = item.get("url", "")
    if not url or not url.startswith("http"):
        return False
    if item.get("source") != "github":
        return False
    if not item.get("published_at"):
        return False
    if not isinstance(item.get("metadata"), dict):
        return False
    return True

def main():
    parser = argparse.ArgumentParser(description="Scrape GitHub Trending")
    parser.add_argument("--input", required=True, help="Path to config.json")
    parser.add_argument("--output", required=True, help="Path to output JSON")
    args = parser.parse_args()
    
    info("Starting GitHub Trending scraper...")
    
    config = read_json(args.input)
    if not config:
        error(f"Failed to load config from {args.input}")
        raise ValueError("Missing configuration")
        
    html_content = scrape_github_trending(max_retries=config.get("max_retries", 2))
    if not html_content:
        error("Could not fetch HTML content. Halting.")
        raise ValueError("Failed to fetch HTML content")
        
    raw_repos = parse_trending_html(html_content)
    
    valid_repos = []
    for item in raw_repos:
        if validate_item(item):
            valid_repos.append(item)
        else:
            warning(f"Dropped invalid item: {item.get('title', 'Unknown')}")
            
    if not valid_repos:
        error("No valid repositories found after parsing.")
        write_json(args.output, [])
        raise ValueError("No valid repositories found")
        
    success(f"Successfully scraped {len(valid_repos)} valid repositories.")
    write_json(args.output, valid_repos)

if __name__ == "__main__":
    main()
