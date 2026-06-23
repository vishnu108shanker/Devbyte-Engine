# DevByte Engine — V2 Architecture

## Environment (Unchanged from V1)
- Python: 3.11
- Node.js: 18
- OS: Windows 11 (local)
Canonical reference: PROJECT.md

---

## Complete V2 Folder Structure

devbyte-engine/
  channels/
    ai_tools.json

  collectors/
    producthunt.py          ← Official GraphQL API (Week 3)
    hackernews.py           ← Official JSON API (Week 1 — build first)
    blogs.py                ← RSS feeds: OpenAI, Anthropic, Google (Week 2)
    huggingface.py          ← HTML scraping or API (future)
    github_ai.py            ← existing V1 scraper, AI category only (future)

  ingestion/
    normalizer.py           ← converts raw collector output to standard schema
    quality_filter.py       ← rejects candidates missing required fields
    deduplicator.py         ← removes duplicates by id (name slug + domain)

  evaluation/
    evaluator.py            ← scores each candidate, outputs evaluated list
    scoring.py              ← scoring formula as importable functions

  editorial/
    editorial_engine.py     ← reads policy + history, builds content queue
    editorial_policy.json   ← category weights and rotation rules
    prompts/
      free_alternative.txt
      productivity.txt
      hidden_gem.txt
      comparison.txt
      update.txt
      weekly_roundup.txt
      best_for.txt
      prompt_trick.txt

  render/
    src/
      templates/
        FreeAlternative.tsx
        Productivity.tsx
        WeeklyRoundup.tsx
        Comparison.tsx
        HiddenGem.tsx
        Update.tsx

  data/
    raw_candidates.json         ← output of ingestion layer
    evaluated_candidates.json   ← output of evaluation layer
    content_queue.json          ← output of editorial engine (queue of 3)
    selected_tool.json          ← orchestrator picks queue[0] here
    history.json                ← permanent record of all published content
    script.json                 ← Gemini script output (unchanged from V1)
    validated_script.json       ← validator output (unchanged from V1)
    audio.mp3                   ← TTS output (unchanged from V1)
    video.mp4                   ← final render (unchanged from V1)

  services/
    gemini.py                   ← MODIFIED: now outputs full metadata package
    tts.py                      ← unchanged from V1
    render.js                   ← unchanged from V1

  utils/
    logger.py                   ← unchanged from V1
    validator.py                ← unchanged from V1
    config.py                   ← unchanged from V1
    file_utils.py               ← unchanged from V1

  orchestrator/
    run_pipeline.js             ← MODIFIED: extended with new pre-Gemini steps

  config.json                   ← unchanged from V1
  PREREQUISITES.md
  PROJECT.md
  ARCHITECTURE.md
  CONVENTIONS.md
  TASKS.md
  DEVLOG.md

---

## Folder Responsibilities

collectors/    → fetch raw external data only. One file per source.
               → No processing. No decisions. Just fetch and return raw data.

ingestion/     → transform and clean raw data.
               → normalizer.py, quality_filter.py, deduplicator.py
               → Input: raw collector arrays. Output: clean standard schema array.

evaluation/    → score and rank clean candidates.
               → Never touches raw_candidates.json (read-only to evaluator)
               → Input: raw_candidates.json. Output: evaluated_candidates.json

editorial/     → make content decisions based on policy and history.
               → Input: evaluated_candidates.json + history.json + policy.
               → Output: content_queue.json

channels/      → channel profile definitions. One JSON per channel.
               → Editorial engine reads active channel profile.

data/          → all runtime files. Never committed to git (except schemas).

---

## Data Acquisition Strategy (Per Collector)

Decision order for every new source — always follow this:
1. Official API (fastest, most reliable, structured JSON)
2. RSS feed (/rss, /feed, atom.xml)
3. Hidden JSON in HTML (<script id="__NEXT_DATA__"> or XHR endpoint)
4. BeautifulSoup HTML scraping
5. Playwright browser automation (last resort only)

This rule is in CONVENTIONS.md. Every collector must document which
method it uses as a comment at the top of the file.

Per-source strategy:
- hackernews.py    → Official JSON API. No auth. GET /topstories.json
- blogs.py         → RSS feeds. feedparser library.
                     OpenAI:    https://openai.com/blog/rss.xml
                     Anthropic: https://www.anthropic.com/rss.xml
                     Google AI: https://blog.google/technology/ai/rss/
- producthunt.py   → Official GraphQL API. Free API key required.
                     Register at: https://www.producthunt.com/v2/oauth/applications

---

## Enriched Normalized Schema

Every collector outputs an array of objects.
Every object must exactly match this schema.
Quality filter rejects any object missing a REQUIRED field.

[
  {
    "id":              string   REQUIRED. Slug: lowercase, hyphens, no spaces.
                                Generated as: slugify(name) + "-" + domain
    "name":            string   REQUIRED. Non-empty. Max 120 chars.
    "category":        string   REQUIRED. One of the 8 content categories.
    "summary":         string   REQUIRED. Non-empty. Min 20 words. Max 500 chars.
    "website":         string   REQUIRED. Valid URL. Must start with https://
    "pricing":         string   REQUIRED. One of: "free", "freemium", "paid",
                                "open_source", "unknown"
    "target_audience": string   OPTIONAL. e.g. "developers", "students"
    "competitors":     array    OPTIONAL. Array of strings. Can be empty [].
    "use_cases":       array    OPTIONAL. Array of strings. Can be empty [].
    "event_type":      string   REQUIRED. One of:
                                "new_tool", "major_update", "funding",
                                "open_source_release", "pricing_change",
                                "acquisition", "research_paper", "other"
    "tags":            array    REQUIRED. Min 1 tag. Array of strings.
                                Used by editorial engine for category matching.
    "source":          string   REQUIRED. One of:
                                "hackernews", "producthunt", "openai_blog",
                                "anthropic_blog", "google_blog", "huggingface",
                                "github"
    "source_tier":     integer  REQUIRED. 1, 2, or 3.
                                Tier 1: producthunt, huggingface
                                Tier 2: github, official blogs
                                Tier 3: hackernews, reddit
    "released_at":     string   REQUIRED. ISO 8601. e.g. "2026-06-23T00:00:00Z"
    "collected_at":    string   REQUIRED. ISO 8601. Current run timestamp.
    "score":           integer  REQUIRED. Set to 0 by collector.
                                Filled in by evaluator.py.
    "confidence":      float    REQUIRED. Set to 0.0 by collector.
                                Filled in by evaluator.py. Range 0.0 to 1.0.
  }
]

---

## Quality Filter Rules

Reject (do not pass to deduplicator) if ANY of these are true:
- name is empty or missing
- summary is missing or under 20 words
- website is missing or does not start with https://
- pricing is missing or not in allowed values
- tags array is empty
- released_at is missing or not valid ISO 8601
- event_type is missing or not in allowed values

Log every rejection with logger.warning() stating which field failed.

---

## Deduplication Rules

Two candidates are duplicates if:
- Their generated id fields are identical, OR
- Their website domain (stripped of www and subdomains) is identical

When a duplicate is found, keep the one with higher source_tier (lower number).
If source_tier is equal, keep the one with more recent released_at.
Log every deduplication with logger.info().

---

## Scoring Formula (evaluator.py)

score = freshness_score + popularity_score + source_trust_score + quality_score

freshness_score (based on released_at):
  released < 7 days ago   → 40
  released < 30 days ago  → 25
  released < 90 days ago  → 10
  older than 90 days      → 0

popularity_score:
  Derived from upvotes (PH), points (HN), stars (GitHub).
  Normalize to 0-30 range using: min(30, raw_count / 100)
  Sources without popularity data get 10 as default.

source_trust_score:
  source_tier == 1  → 20
  source_tier == 2  → 15
  source_tier == 3  → 10

quality_score:
  competitors list non-empty        → +10
  use_cases list non-empty          → +10
  target_audience non-empty         → +5
  mentioned by 2+ different sources → +15 (cross-source validation bonus)

confidence formula (0.0 to 1.0):
  summary exists and > 20 words     → +0.25
  website exists and valid URL      → +0.25
  2+ sources mention it             → +0.30
  source_tier == 1                  → +0.20
  Maximum possible: 1.0

---

## Editorial Policy

File: editorial/editorial_policy.json

{
  "weights": {
    "free_alternative":  25,
    "productivity":      20,
    "hidden_gem":        15,
    "comparison":        15,
    "update":            15,
    "weekly_roundup":    10
  },
  "max_repeat_days": 3,
  "min_score_threshold": 40,
  "queue_size": 3,
  "breaking_news_override_score": 85
}

Editorial engine logic:
1. Read history.json. Find which categories appeared in last 7 days.
2. Compare against weights to find most underrepresented category today.
3. Filter evaluated_candidates.json by tags matching that category.
4. If any candidate scores above breaking_news_override_score,
   select it regardless of category rotation.
5. Build a queue of top 3 candidates by score.
6. Write to content_queue.json.
7. Orchestrator reads queue[0] → writes to selected_tool.json.

---

## Channel Profile

File: channels/ai_tools.json

{
  "channel_id": "ai_tools",
  "name": "DevByte — AI Tools",
  "allowed_categories": [
    "free_alternative", "productivity", "hidden_gem",
    "comparison", "update", "weekly_roundup", "best_for",
    "prompt_trick"
  ],
  "tone": "fast, direct, developer-friendly, no fluff",
  "cta_style": "link in bio",
  "prompt_set": "editorial/prompts/",
  "template_map": {
    "free_alternative":  "FreeAlternative",
    "productivity":      "Productivity",
    "weekly_roundup":    "WeeklyRoundup",
    "comparison":        "Comparison",
    "hidden_gem":        "HiddenGem",
    "update":            "Update",
    "best_for":          "HiddenGem",
    "prompt_trick":      "Productivity"
  },
  "upload_schedule": "23:30",
  "active": true
}

---

## History Schema

File: data/history.json (array, grows permanently, never overwritten)

[
  {
    "id":           string   Tool id (matches candidate id)
    "name":         string   Tool name
    "category":     string   Content category used
    "published_at": string   ISO 8601 timestamp
    "source":       string   Original collector source
    "event_type":   string   Event type at time of publication
    "script_hash":  string   MD5 hash of final script text
                             Allows revisit if tool has major update
    "video_path":   string   Relative path to rendered MP4
  }
]

History check rule:
- If candidate id exists in history AND script_hash would be identical
  (i.e. no meaningful new information) → skip candidate
- If candidate id exists but event_type is "major_update" → allow

---

## Modified Gemini Output (services/gemini.py)

V2 Gemini call outputs a full metadata package in one API call:

{
  "hook":            string   15-20 words
  "body":            string   45-50 words
  "cta":             string   10-15 words
  "word_count":      integer  Total words across hook+body+cta
  "title":           string   YouTube video title. Max 70 chars.
  "description":     string   YouTube description. Max 150 words.
  "hashtags":        array    10 relevant hashtags. No # symbol.
  "thumbnail_text":  string   Max 5 words. All caps. Punchy.
  "pinned_comment":  string   Affiliate CTA. Max 30 words.
  "source_title":    string   Copied from selected_tool.json name
  "source_url":      string   Copied from selected_tool.json website
  "category":        string   Copied from selected_tool.json category
  "generated_at":    string   ISO 8601 timestamp
}

The category-specific prompt file is loaded from
editorial/prompts/{category}.txt and injected into the Gemini call.
The selected_tool.json enriched data is injected as context.
Gemini is a writer — it receives verified structured data, not a
search task.

---

## Complete V2 Pipeline Flow

Orchestrator step order (run_pipeline.js):

Step 1:  collectors     → run all available collectors in parallel
                          each writes to a temp array in memory
Step 2:  normalizer     → merge all collector arrays, apply schema
                          output: data/raw_candidates.json
Step 3:  quality_filter → reject invalid candidates
                          (modifies raw_candidates.json in place,
                           or writes filtered version)
Step 4:  deduplicator   → remove duplicates
                          (output still in data/raw_candidates.json
                           after filter pass)
Step 5:  evaluator      → score all candidates
                          output: data/evaluated_candidates.json
Step 6:  editorial      → build content queue
                          output: data/content_queue.json
Step 7:  select         → read queue[0], write data/selected_tool.json
Step 8:  gemini         → read selected_tool.json + category prompt
                          output: data/script.json
Step 9:  validator      → output: data/validated_script.json
Step 10: tts            → output: data/audio.mp3
Step 11: render         → output: data/video.mp4
Step 12: history        → append entry to data/history.json

Step-skipping rule (from V1, unchanged):
If a step's output file exists and is non-empty, skip that step.
This means if render crashes, next run resumes from step 11 only.
content_queue.json persisting means steps 1-7 are also skipped.

---

## What Is Unchanged From V1
These files must NOT be modified during V2 build:
- services/tts.py
- services/render.js
- utils/logger.py
- utils/validator.py
- utils/config.py
- utils/file_utils.py
- render/src/components/ (all Remotion components)
- config.json