# DevByte Engine V2.00 — Development Log

## Version 2.0.0
**Date:** June 23, 2026

### 🚀 Major Architectural Overhaul
The entire pipeline was re-engineered from a simple GitHub scraper into a robust, 13-step multi-source editorial engine designed to produce premium, agency-quality vertical video Shorts.

### 📝 Pipeline & Editorial Improvements
- **Multi-Source Ingestion:** Replaced the legacy GitHub trending scraper. The system now ingests data from Hacker News API and official AI company RSS blogs (OpenAI, Anthropic, Google).
- **Normalization & Quality Filtering:** Added steps to cleanly format raw data and filter out noise before AI evaluation.
- **Deduplication:** Added a smart deduplication phase to prevent repeated topic coverage from different sources.
- **Editorial Engine:** Implemented a scoring and channel policy system. The engine now looks at past publishing history (`data/history.json`) to select the best underrepresented category, preventing stale content loops.
- **Gemini AI Scripting:** Transitioned to `gemini-2.5-flash` with dynamic category-based prompt injection for dynamic, structured scripts (Hooks, Body, CTA, Hashtags). Increased subprocess timeout to 120s to ensure API stability.

### 🎬 Render System Rewrite (Remotion)
- **Resolved Blank Frame Bug:** Previously, deeply nested `width: 100%` and `flexDirection: column` containers were collapsing in Headless Chrome, leading to blank videos. Rewrote layout primitives (`Row`, `Col`) to enforce explicit width/height constraints.
- **Premium Aesthetics:** Shifted away from the static "VS Code" theme to a dynamic, modern SaaS look inspired by Apple, Cursor, and Stripe.
- **Theme Engine:** Rebuilt `theme.ts` to use explicit numerical values for typography and spacing, enabling seamless scaling to `1080x1920` vertical resolutions.
- **Full-Timeline Sequencing:** Fixed overlapping `<Sequence>` issues that caused text collisions. Rebuilt `FreeAlternative.tsx` as a contiguous 5-scene system (Hook → Features → Comparison → Quote → CTA) that occupies 100% of the dynamic audio duration.
- **Continuous Motion:** Replaced static layouts with animated mesh gradients, floating orbs, smooth `spring()` transitions, and data-driven counting animations (`CountUp`).

### 🔧 Developer Experience
- Enhanced `orchestrator/run_pipeline.js` to run all 13 steps seamlessly.
- Updated cleanup processes for `--fresh` flags.
- Updated `run_automation.bat` paths for Windows Task Scheduler deployment.

### 🚀 Publishing Engine V1
- **Strict Separation of Concerns:** Implemented a standalone distribution pipeline completely decoupled from content generation.
- **YouTube API Integration:** Created `services/upload.py` to authenticate via OAuth 2.0 and upload `video.mp4` securely to YouTube.
- **Automated Metadata:** The script reads `script.json` to extract and apply the title, description, and hashtags automatically.
- **Private Staging:** Hardcoded `privacyStatus: private` to ensure all AI-generated content can be manually reviewed in YouTube Studio before going public.

### ⚡ Batch Processing & Parallel Execution
- **Parallel Master Node:** Created `batch_generate_and_upload.js` as an independent orchestrator. It uses `Promise.all` to run 5 independent AI pipelines concurrently.
- **Isolating Worker State:** Refactored the orchestrator to dynamically spin up `worker_0` to `worker_N` directories. This allows `gemini.py` and `tts.py` to write scripts and audio completely independently without race conditions.
- **Remotion Dynamic Assets:** Modified `services/render.js` to generate unique trailing IDs for `props.json` and `audio.mp3` (e.g. `props_17849.json`). This ensures that 5 concurrent Remotion subprocesses can compile 5 different videos simultaneously without corrupting the webpack server cache.
- **Workflow Optimization:** Ingestion (HackerNews scraping) now strictly executes *once* upfront. The Top 5 candidates are then fed into the parallel pipelines to save tremendous amounts of time and rate limits.

### 📝 Editorial Prompt Overhaul (Round 2)
- **Storytelling Framework:** Rewrote all 8 prompt templates to enforce a conversational "News Story" narrative structure (Context → Drop → Impact) instead of robotic feature lists.
- **Product Name Isolation:** Added TTS-aware isolation phrases ("a new tool called [NAME]...") so the text-to-speech engine clearly separates product names from surrounding words.
- **Name Extraction Rule:** AI now extracts the short brand name (max 3 words) from article headlines instead of using the full headline as the product name.
- **Title Length Cap:** Enforced 6-word maximum on video titles.
- **Category Rotation Fix:** Replaced hardcoded `"update"` fallback with dynamic underrepresented category selection from `editorial_policy.json`.
- **Disabled `weekly_roundup`:** Category removed from rotation — it requires multi-article input which the current pipeline doesn't support.

### 🎬 Scene Timing Sync
- **Body Scene Extended:** Shifted from 50% to 65% of total video duration (20%/65%/15% split), ensuring the CTA doesn't appear before TTS finishes reading body content.
- **Proportional Bullet Stagger:** Replaced hardcoded 18-frame delay with dynamic `bulletStagger` calculated from scene duration divided by sentence count.

## Version 2.1.0
**Date:** July 4, 2026

### 📝 Content Selection & Queue Fixes
- **Queue Truncation Fix:** Resolved a bug in `editorial_engine.py` where "Breaking News Override" was truncating the output queue to a single candidate when only one breaking news story matched the threshold, preventing the pipeline from fully utilizing all 5 workers. The engine now fills the remainder of the queue with the highest-scoring non-breaking tech stories.
- **Missing Timestamp Fix:** Resolved a category rotation bug by ensuring `batch_generate_and_upload.js` injects the `published_at` timestamp into history candidates, preventing rotation logic from failing with a 5-way mathematical tie.
- **Weight Simplification:** Simplified the channel target strategy in `editorial_policy.json` to focus entirely on the `update` category (100% weight) to align all video formats with breaking tech updates.

### 📊 Evaluator & Scoring Upgrades
- **The "Hype Bonus":** Added an evaluator scoring boost (+25 score, +0.25 confidence) in `evaluation/scoring.py` for high-click tech names (`claude, groq, gpt, gemini, openai, anthropic, chatgpt, apple, google, microsoft, meta, nvidia, aws, amazon, tesla, react, python, javascript, linux, open source, github`).
- **Confidence Balancing:** Increased the base confidence calculation for official Tier 2 developer and tech company blogs to ~0.80, ensuring first-party announcements receive correct ranking weight.

### 📝 Prompt Persona Refining
- **Tech Enthusiast Tone:** Rewrote the `update.txt` prompt template to shift the scripting persona from a rigid, objective "news anchor" to an energetic, passionate "tech enthusiast" talking to another developer.

## Version 2.2.0 — Automated Newsroom Overhaul
**Date:** July 4, 2026

### 🎯 Editorial Mission Statement
Defined a single guiding sentence for the entire pipeline:
> **"DevByte covers products, releases, tools, developer infrastructure, AI breakthroughs, and major engineering announcements—not essays, tutorials, opinion pieces, or long-form discussions."**

### 🗂️ Source Configuration Decoupled (`sources/`)
- **`sources/official_feeds.json` [NEW]:** Centralized RSS feed registry. Adding a new blog (e.g., Lovable, xAI, DeepMind) now takes 30 seconds and zero code changes. Ships with 8 feeds: OpenAI, Anthropic, Google Technology, Vercel, AWS, Cloudflare, Supabase, Bun.
- **`sources/github_repos.json` [NEW]:** Curated list of high-interest GitHub repositories to poll for releases. Ships with: `facebook/react`, `vercel/next.js`, `oven-sh/bun`, `tailwindlabs/tailwindcss`, `supabase/supabase`, `microsoft/vscode`, `denoland/deno`, `docker/cli`.
- **`sources/filters.json` [NEW]:** Rule-based keyword whitelist (for HN) and noise blacklist (for all sources). Fully editable without touching Python.
- **`collectors/blogs.py`:** Refactored to dynamically load feeds from `sources/official_feeds.json` instead of hardcoding URLs.

### 📡 New Collectors
- **`collectors/github_releases.py` [NEW]:** Polls the GitHub `/releases/latest` API for each repo in `github_repos.json`. Outputs structured candidates with release notes, version tags, and `event_type: open_source_release`.
- **`collectors/product_hunt.py` [NEW]:** Parses the Product Hunt RSS feed (`producthunt.com/feed`) for daily trending product launches.

### 🔍 Signal Filter (`ingestion/signal_filter.py` [NEW])
Introduced a new pipeline stage between Normalization and Quality Filter:
- **HN Whitelist:** HackerNews stories are only kept if the title contains a high-signal verb/noun (`released`, `launches`, `announces`, `version`, `v[0-9]`, etc.). This instantly eliminates opinion essays, tutorials, and discussion threads.
- **Noise Blacklist:** All other sources are checked against a blacklist (`tutorial`, `guide`, `walkthrough`, `roundup`, `opinion`, `essay`, etc.).
- **First test run:** Dropped 15/15 HN essay candidates and 1 blog noise candidate. Zero false positives.

### 🧠 YouTube Editor Scoring (Batch Gemini Evaluation)
- **`evaluation/evaluator.py`:** Completely rewritten. Before scoring, the evaluator sends all candidates to Gemini in a single batch API call, asking it to act as a YouTube Shorts Editor.
- **Soft Score, Not Binary Gate:** Gemini returns an `editor_score` (0-100) and a `reason` string for each candidate. Python enforces the threshold via `min_score_threshold` in `editorial_policy.json`. The LLM is a scorer, not a judge—preventing hallucination-based false rejections.
- **Score Multiplier:** The final candidate score is calculated as `base_score * (editor_score / 100)`, making video-worthiness a direct weight on the total evaluation.

### 🔧 Scoring & Keyword Fixes
- **Word-Boundary Regex:** Fixed the Hype Bonus keyword scanner to use `\b` word boundaries (`re.search(r'\b' + re.escape(kw) + r'\b', ...)`), preventing false positives like "anti-Amazon" matching "amazon".
- **`calculate_total_score`:** Now accepts an `editor_score` parameter that acts as a multiplier on the base score.

### 🔄 Orchestrator Updates
- **`batch_generate_and_upload.js`:** Updated Phase 1 to execute 4 collectors (HN, Blogs, GitHub, Product Hunt), the Signal Filter, and the new batch evaluator.
- **`run_pipeline.js`:** Updated sequential pipeline steps to include `2b. Collect GitHub`, `2c. Collect Product Hunt`, and `3b. Signal Filter`.

### 📊 First Test Run Results (July 4, 2026)
Pipeline ingested 58 raw candidates from 4 sources. After Signal Filter (dropped 16), Quality Filter (dropped 3), and Deduplication (dropped 36), 7 high-signal candidates remained. The YouTube Editor scored them:
1. AWS EKS Kubernetes Rollbacks (Editor: 82/100)
2. Vercel FUSE Filesystems (Editor: 88/100)
3. Cloudflare Monetization Gateway (Editor: 85/100)
4. Termi Protocol from Product Hunt (Editor: 92/100)
5. Deno v2.9.1 (Editor: 60/100)

**Zero essays. Zero opinion pieces. Every candidate is a real product launch or engineering announcement.**

## Version 2.2.1 — Deduplication & Source Diversity Fix
**Date:** July 4, 2026

### 🗑️ Deduplicator Rewrite (`ingestion/deduplicator.py`)
- **The Bug:** The deduplicator was grouping by domain (`openai.com`, `github.com`), resulting in one article per publisher per run. All GitHub releases were collapsed into one, discarding 84% of valid stories.
- **The Fix:** Removed domain-level deduplication entirely. Rebuilt deduplication using a strict story-level identity hierarchy:
  1. Exact ID match (e.g. RSS guid)
  2. Exact Canonical URL match
  3. Near-identical Normalized Title (lowercase, no punctuation, single whitespace)

### ⚖️ Source Diversity Limit (`editorial/editorial_engine.py`)
- **The Need:** To prevent a single publisher (e.g. AWS re:Invent) from flooding all 5 daily video slots.
- **The Implementation:** Added a `select_with_diversity` algorithm that enforces a `MAX_PER_SOURCE = 2` limit when building the queue. Applied this diversity check uniformly across both the breaking news path and the standard eligible path.

