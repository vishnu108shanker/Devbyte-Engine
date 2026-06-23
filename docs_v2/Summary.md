# DevByte Engine — V2 Summary

## What V1 Proved
V1 is complete and working. The pipeline takes GitHub Trending data,
generates a script via Gemini, produces a voiceover via edge-tts, and
renders a 1080x1920 MP4 via Remotion. The orchestrator chains all steps
with failure recovery, step-skipping, retry logic, and full logging.
V1 architecture is stable and must not be changed during V2 build.

## Why V2 Exists
V1 had one hardcoded data source (GitHub Trending) and no content
intelligence. It produced videos randomly based on whatever was trending.

V2 replaces the single source with a full content discovery engine that:
- Collects from multiple sources simultaneously
- Normalizes all data to one standard schema
- Filters out low-quality candidates
- Scores and ranks candidates by freshness, popularity, and source trust
- Makes editorial decisions based on channel strategy, not random selection
- Maintains a content queue so pipeline failures don't lose progress
- Remembers what has been published to avoid repetition

## Niche Change
V1 used GitHub Trending as a test data source.
V2 targets the "AI Tools and Websites" niche.

Reason: Higher CPM (broader audience), strong affiliate income potential
(most AI tools have affiliate programs), and visually simple content
that suits the existing Remotion pipeline.

Content categories for this niche:
- free_alternative  (highest CTR — "stop paying for X")
- productivity      (relatable — "saves 2 hours")
- hidden_gem        (curiosity — "nobody is talking about this")
- comparison        (decision-intent — "ChatGPT vs Claude")
- update            (timely — "OpenAI just released...")
- weekly_roundup    (broad reach — "5 AI tools this week")
- best_for          (search traffic — "best AI for students")
- prompt_trick      (engagement — "one prompt that saves hours")

## What V2 Adds to V1
V1 pipeline (Gemini → Validator → TTS → Remotion) is UNCHANGED.
V2 adds everything BEFORE Gemini:

NEW: collectors/         — source-specific data fetchers
NEW: ingestion/          — normalizer, quality filter, deduplicator
NEW: evaluation/         — scoring and ranking engine
NEW: editorial/          — policy-driven content selection and queue
NEW: data files          — raw_candidates, evaluated_candidates,
                           content_queue, history
NEW: channels/           — channel profile abstraction
MODIFIED: services/gemini.py  — now receives enriched schema + 
                                category-specific prompt
                              — now outputs script + title + 
                                description + hashtags + 
                                thumbnail text in one call

## What Is Intentionally Left for V3
These were designed and reviewed but are NOT part of V2:
- Knowledge Base (per-tool accumulated history)
- Feedback Loop (performance data → editorial weight adjustment)
- YouTube Analytics API integration
- Multi-channel expansion beyond ai_tools.json
- Playwright browser automation for complex sources

## Start With Three Collectors Only
Do not build all collectors at once.
Week 1: hackernews.py (simplest API, no auth)
Week 2: blogs.py (RSS feeds for OpenAI, Anthropic, Google AI)
Week 3: producthunt.py (GraphQL API, requires free API key)

## The Golden Rule for V2
V2 proves you can automate content discovery.
V1 proved you can automate video creation.
Do not change the video creation pipeline.
Do not build V3 features.
Ship 50 videos after V2 is stable. Then revisit.