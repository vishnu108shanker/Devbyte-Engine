import argparse
import json
import sys
import os
import urllib.parse
import time
from google import genai
from google.genai import types

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error, warning
from utils.file_utils import read_json
from evaluation.scoring import (
    calculate_freshness_score,
    calculate_popularity_score,
    calculate_source_trust_score,
    calculate_quality_score,
    calculate_confidence,
    calculate_total_score
)

def extract_root_domain(url):
    try:
        netloc = urllib.parse.urlparse(url).netloc.replace("www.", "")
        parts = netloc.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return netloc
    except Exception:
        return ""

def find_cross_source_counts(candidates):
    """Group candidates by root domain to detect cross-source mentions."""
    domain_sources = {}
    for c in candidates:
        domain = extract_root_domain(c.get("website", ""))
        if not domain:
            continue
        source = c.get("source", "")
        if domain not in domain_sources:
            domain_sources[domain] = set()
        domain_sources[domain].add(source)

    # Map domain -> number of distinct sources
    return {domain: len(sources) for domain, sources in domain_sources.items()}

def get_editor_scores_from_gemini(candidates):
    """Batch evaluate candidates using Gemini as a YouTube Editor."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
        api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        warning("GEMINI_API_KEY not found. Defaulting all editor scores to 50.")
        return {c["id"]: {"editor_score": 50, "reason": "No API Key"} for c in candidates}

    client = genai.Client(api_key=api_key)

    prompt = """You are an expert YouTube Shorts Editor for a developer-focused tech channel called DevByte.
Our channel follows this strict Editorial Mission Statement:
"DevByte covers products, releases, tools, developer infrastructure, AI breakthroughs, and major engineering announcements—not essays, tutorials, opinion pieces, or long-form discussions."

Evaluate the following candidate news items. For each item, give an "editor_score" from 0 to 100 representing how compelling, high-retention, and "video-worthy" it is for a 40-second YouTube Short.

Scoring Criteria:
1. Explainability: Can this be clearly explained in under 60 seconds?
2. Visual Potential: Is there a concrete UI, code, demo, or tool to show on screen?
3. Hook Potential: Does this create instant curiosity or FOMO for developers?
4. Broad Developer Appeal: Is this relevant to a wide group of programmers rather than a tiny niche?

Score Reference:
- 90+: Tech Updates from major tech giants (e.g. Gemini , Anthropic , Meta , Open ai , Gpt , Google , Nvidia, Claude Code release).
- 40-50: Solid, relevant tech announcements or minor tool releases.
- Below 40: Dry opinion essays, retrospectives, tutorials, or academic research without immediate developer utility (e.g. "Costco is the anti-Amazon" or "What I learned from SQL").And also the contents related to vercel or cloudfare  .  Set these strictly below 40.

Candidates:
"""

    for c in candidates:
        prompt += f"ID: {c['id']}\nTitle: {c['name']}\nSummary: {c['summary']}\n\n"

    prompt += """Return a JSON object mapping each Candidate ID to its evaluation:
{
  "candidate_id": {
    "editor_score": <int 0-100>,
    "reason": "<brief explanation of the score>"
  }
}
"""

    models_to_try = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite']
    
    for model_name in models_to_try:
        try:
            info(f"Calling Gemini API ({model_name}) for batch editorial scoring...")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                )
            )
            return json.loads(response.text)
        except Exception as e:
            warning(f"Batch editorial evaluation failed with {model_name}: {e}. Trying fallback...")
            continue

    warning("All models failed for batch evaluation. Defaulting editor scores to 50.")
    return {c["id"]: {"editor_score": 50, "reason": "API Failure"} for c in candidates}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to raw_candidates.json")
    parser.add_argument("--output", required=True, help="Path to evaluated_candidates.json")
    args = parser.parse_args()

    data = read_json(args.input)
    if not data or not isinstance(data, list):
        error("No candidates to evaluate.")
        sys.exit(1)

    # Batch evaluate candidates via Gemini
    info("Starting batch YouTube Editor evaluation phase...")
    editor_evals = get_editor_scores_from_gemini(data)

    # Detect cross-source mentions
    cross_source_map = find_cross_source_counts(data)

    for candidate in data:
        cid = candidate["id"]
        eval_result = editor_evals.get(cid, {"editor_score": 50, "reason": "No evaluation found"})
        editor_score = int(eval_result.get("editor_score", 50))
        editor_reason = eval_result.get("reason", "")

        candidate["editor_score"] = editor_score
        candidate["editor_reason"] = editor_reason

        domain = extract_root_domain(candidate.get("website", ""))
        cross_count = cross_source_map.get(domain, 1)

        raw_count = candidate.get("_hn_points", 0)

        candidate["score"] = calculate_total_score(
            candidate, 
            raw_count=raw_count, 
            cross_source_count=cross_count, 
            editor_score=editor_score
        )
        candidate["confidence"] = calculate_confidence(candidate, cross_source_count=cross_count)

    # Sort by score descending
    data.sort(key=lambda c: c["score"], reverse=True)

    # Log top 5
    info("--- Top 5 Evaluated Candidates ---")
    for i, c in enumerate(data[:5]):
        info(f"  #{i+1}: {c.get('name')} (Score: {c['score']}, Conf: {c['confidence']:.2f}, Editor: {c.get('editor_score')}/100, Reason: {c.get('editor_reason')})")

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    info(f"Evaluated {len(data)} candidates. Written to {args.output}")

if __name__ == "__main__":
    main()
