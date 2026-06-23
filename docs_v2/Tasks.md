# V2 Build Tasks — 2 Day Plan

## Status Key
[ ] not started
[~] in progress
[x] complete
[!] blocked — add reason

## Rules For This Build
- Build and test each module independently before wiring to orchestrator
- Run each Python module standalone: python module.py --input x --output y
- Do not modify any V1 files (see Architecture.md for list)
- Do not build Playwright, Knowledge Base, Feedback Loop (V3 features)
- Only three collectors in V2: hackernews.py, blogs.py, producthunt.py

---

## DAY 1 — Ingestion + Evaluation + Editorial (8 hours)

### Hour 1 — Folder Setup and New Files

[ ] Create all new V2 folders:
    mkdir collectors ingestion evaluation editorial channels
    mkdir editorial\prompts
    mkdir render\src\templates

[ ] Install new Python dependencies:
    pip install feedparser python-slugify

[ ] Create channels/ai_tools.json
    Use exact schema from Architecture.md channel profile section.

[ ] Create editorial/editorial_policy.json
    Use exact schema from Architecture.md editorial policy section.

[ ] Create data/history.json as empty array:
    []

---

### Hours 2-3 — Collector 1: Hacker News

[ ] collectors/hackernews.py
    --input config.json --output temp_hn.json

    Steps inside this file:
    - GET https://hacker-news.firebaseio.com/v0/topstories.json
    - Take first 30 story IDs
    - For each ID: GET https://hacker-news.firebaseio.com/v0/item/{id}.json
    - Filter: keep only stories where title contains any of:
      ["AI", "GPT", "LLM", "Claude", "Gemini", "ML", "tool",
       "agent", "model", "open source", "release"]
    - Map each story to enriched normalized schema
    - Set score: 0, confidence: 0.0 (evaluator fills these)
    - Set source: "hackernews", source_tier: 3
    - Set event_type: detect from title keywords
      ("releases" / "launches" → "new_tool",
       "update" → "major_update", default → "other")
    - Output: JSON array of normalized objects
    - All errors via logger.error()

    Verify independently:
    python collectors/hackernews.py --input config.json --output data/test_hn.json
    Open test_hn.json. Confirm array of objects with all required fields.
    Delete test_hn.json after verification.

---

### Hours 3-4 — Collector 2: Blogs via RSS

[ ] collectors/blogs.py
    --input config.json --output temp_blogs.json

    RSS feeds to fetch:
    - https://openai.com/blog/rss.xml        source: "openai_blog"
    - https://www.anthropic.com/rss.xml      source: "anthropic_blog"
    - https://blog.google/technology/ai/rss/ source: "google_blog"

    Steps inside this file:
    - Use feedparser to parse each RSS URL
    - Take latest 5 entries per feed
    - Filter entries published within last 30 days
    - Map each entry to enriched normalized schema
    - Set source_tier: 2 for all blog sources
    - Set event_type: "update" for all blog entries (default)
    - Set pricing: "unknown" for blog announcements
    - Combine all three feeds into one output array
    - All errors via logger.error()

    Verify independently:
    python collectors/blogs.py --input config.json --output data/test_blogs.json
    Open test_blogs.json. Confirm entries from multiple blogs.
    Delete test_blogs.json after verification.

---

### Hour 4 — Ingestion Layer

[ ] ingestion/normalizer.py
    --input (accepts multiple --input flags or a folder path)
    --output data/raw_candidates.json

    Steps:
    - Accept multiple input JSON arrays (from collectors)
    - Merge all arrays into one
    - Generate id for each item: slugify(name) + domain suffix
    - Ensure all required fields exist (fill defaults for optional fields)
    - Output merged array to raw_candidates.json
    - Log count: "Normalized X candidates from Y sources"

[ ] ingestion/quality_filter.py
    --input data/raw_candidates.json
    --output data/raw_candidates.json (filters in place)

    Rejection rules (from Architecture.md quality filter section):
    - Log every rejection with reason via logger.warning()
    - Log final count: "Quality filter: X passed, Y rejected"

[ ] ingestion/deduplicator.py
    --input data/raw_candidates.json
    --output data/raw_candidates.json (deduplicates in place)

    Deduplication rules (from Architecture.md deduplication section):
    - Log every deduplication via logger.info()
    - Log final count: "Deduplicator: X unique candidates remaining"

    Verify full ingestion chain:
    python ingestion/normalizer.py ...
    python ingestion/quality_filter.py ...
    python ingestion/deduplicator.py ...
    Open raw_candidates.json. Confirm clean, unique, valid entries.

---

### Hours 5-6 — Evaluation Layer

[ ] evaluation/scoring.py
    (importable module, no CLI — imported by evaluator.py)

    Functions:
    - calculate_freshness_score(released_at) → integer
    - calculate_popularity_score(raw_count) → integer
    - calculate_source_trust_score(source_tier) → integer
    - calculate_quality_score(candidate) → integer
    - calculate_confidence(candidate) → float
    - calculate_total_score(candidate) → integer

    Use exact formulas from Architecture.md scoring formula section.

[ ] evaluation/evaluator.py
    --input data/raw_candidates.json
    --output data/evaluated_candidates.json

    Steps:
    - Read raw_candidates.json
    - Check for cross-source duplicates (same tool in multiple sources)
      If found, apply +15 quality_score bonus to the kept entry
    - For each candidate call scoring.py functions
    - Write score and confidence back to each candidate
    - Sort by score descending
    - Write to evaluated_candidates.json
    - Log top 3 candidates by name and score

    Verify independently:
    python evaluation/evaluator.py \
      --input data/raw_candidates.json \
      --output data/evaluated_candidates.json
    Open evaluated_candidates.json. Confirm score and confidence filled.
    Confirm sorted by score descending.

---

### Hours 6-7 — Editorial Layer

[ ] editorial/editorial_engine.py
    --input data/evaluated_candidates.json
    --output data/content_queue.json
    --channel channels/ai_tools.json
    --policy editorial/editorial_policy.json
    --history data/history.json

    Steps:
    - Load channel profile, editorial policy, history
    - Analyze last 7 days of history to find category distribution
    - Compare against policy weights to find underrepresented category
    - Check for any candidate with score above breaking_news_override_score
      If found, select it regardless of category
    - Otherwise filter evaluated_candidates by category tags
    - Apply min_score_threshold filter
    - Build queue of top queue_size candidates
    - Write content_queue.json as array of top candidates
    - Log selected category and top candidate name

    Verify independently:
    python editorial/editorial_engine.py \
      --input data/evaluated_candidates.json \
      --output data/content_queue.json \
      --channel channels/ai_tools.json \
      --policy editorial/editorial_policy.json \
      --history data/history.json
    Open content_queue.json. Confirm 3 candidates ranked by score.

---

### Hour 8 — Prompt Files

[ ] Create all 8 prompt files in editorial/prompts/

    Each file uses {name}, {summary}, {pricing}, {website},
    {use_cases}, {target_audience} as template variables.
    Gemini.py will do string replacement before the API call.

    free_alternative.txt:
    ---
    You are a YouTube Shorts scriptwriter for a tech channel.
    Today's format: FREE ALTERNATIVE
    Tool Name: {name}
    Summary: {summary}
    Pricing: {pricing}
    Website: {website}

    Write a 35-40 second script in exactly this structure:
    [HOOK]: Start with "Stop paying for..." or "This is free now".
            15 words max.
    [BODY]: Show exactly what it does and what paid tool it replaces.
            50 words max.
    [CTA]:  "Try it free — link in bio." 10 words max.

    Tone: Fast, direct, no filler words.
    Output format: JSON only. No markdown. No asterisks.
    {
      "hook": "",
      "body": "",
      "cta": "",
      "word_count": 0,
      "title": "",
      "description": "",
      "hashtags": [],
      "thumbnail_text": "",
      "pinned_comment": ""
    }
    ---

    productivity.txt:
    ---
    You are a YouTube Shorts scriptwriter for a tech channel.
    Today's format: PRODUCTIVITY HACK
    Tool Name: {name}
    Summary: {summary}
    Use Cases: {use_cases}
    Website: {website}

    Write a 35-40 second script in exactly this structure:
    [HOOK]: Start with "This AI just..." or "Stop doing X manually".
            15 words max.
    [BODY]: One specific use case. Concrete time saved. 50 words max.
    [CTA]:  "Link in bio." 10 words max.

    Tone: Fast, relatable, specific numbers when possible.
    Output format: JSON only. No markdown. No asterisks.
    {
      "hook": "", "body": "", "cta": "", "word_count": 0,
      "title": "", "description": "", "hashtags": [],
      "thumbnail_text": "", "pinned_comment": ""
    }
    ---

    hidden_gem.txt:
    ---
    You are a YouTube Shorts scriptwriter for a tech channel.
    Today's format: HIDDEN GEM
    Tool Name: {name}
    Summary: {summary}
    Pricing: {pricing}
    Website: {website}

    Write a 35-40 second script in exactly this structure:
    [HOOK]: "Nobody is talking about this AI tool." 15 words max.
    [BODY]: What it does. Why it's underrated. 50 words max.
    [CTA]:  "Link in bio — try it." 10 words max.

    Tone: Curious, exciting, like sharing a secret.
    Output format: JSON only. No markdown. No asterisks.
    {
      "hook": "", "body": "", "cta": "", "word_count": 0,
      "title": "", "description": "", "hashtags": [],
      "thumbnail_text": "", "pinned_comment": ""
    }
    ---

    comparison.txt:
    ---
    You are a YouTube Shorts scriptwriter for a tech channel.
    Today's format: COMPARISON
    Tool Name: {name}
    Competitors: {competitors}
    Summary: {summary}
    Website: {website}

    Write a 35-40 second script in exactly this structure:
    [HOOK]: Name the two tools being compared. 15 words max.
    [BODY]: Key differences. Who each is best for. 50 words max.
    [CTA]:  "Which do you use? Comment below." 10 words max.

    Tone: Balanced, informative, helps viewer decide.
    Output format: JSON only. No markdown. No asterisks.
    {
      "hook": "", "body": "", "cta": "", "word_count": 0,
      "title": "", "description": "", "hashtags": [],
      "thumbnail_text": "", "pinned_comment": ""
    }
    ---

    update.txt:
    ---
    You are a YouTube Shorts scriptwriter for a tech channel.
    Today's format: NEWS UPDATE
    Tool Name: {name}
    Summary: {summary}
    Website: {website}

    Write a 35-40 second script in exactly this structure:
    [HOOK]: "{name} just..." — announce the news. 15 words max.
    [BODY]: What changed. Why it matters. 50 words max.
    [CTA]:  "Follow for daily AI updates." 10 words max.

    Tone: Timely, newsworthy, clear impact statement.
    Output format: JSON only. No markdown. No asterisks.
    {
      "hook": "", "body": "", "cta": "", "word_count": 0,
      "title": "", "description": "", "hashtags": [],
      "thumbnail_text": "", "pinned_comment": ""
    }
    ---

    weekly_roundup.txt:
    ---
    You are a YouTube Shorts scriptwriter for a tech channel.
    Today's format: WEEKLY ROUNDUP
    Tool Name: {name}
    Summary: {summary}
    Website: {website}

    Write a 35-40 second script in exactly this structure:
    [HOOK]: "5 AI tools launched this week." 15 words max.
    [BODY]: 5 tools, one line each, punchy. 50 words max.
    [CTA]:  "Follow so you never miss a launch." 10 words max.

    Tone: Fast list format. Each tool gets one punchy sentence.
    Output format: JSON only. No markdown. No asterisks.
    {
      "hook": "", "body": "", "cta": "", "word_count": 0,
      "title": "", "description": "", "hashtags": [],
      "thumbnail_text": "", "pinned_comment": ""
    }
    ---

    best_for.txt:
    ---
    You are a YouTube Shorts scriptwriter for a tech channel.
    Today's format: BEST FOR
    Tool Name: {name}
    Target Audience: {target_audience}
    Summary: {summary}
    Website: {website}

    Write a 35-40 second script in exactly this structure:
    [HOOK]: "Best AI tool for {target_audience}." 15 words max.
    [BODY]: What it does specifically for that audience. 50 words max.
    [CTA]:  "Link in bio." 10 words max.

    Tone: Targeted, helpful, audience-specific.
    Output format: JSON only. No markdown. No asterisks.
    {
      "hook": "", "body": "", "cta": "", "word_count": 0,
      "title": "", "description": "", "hashtags": [],
      "thumbnail_text": "", "pinned_comment": ""
    }
    ---

    prompt_trick.txt:
    ---
    You are a YouTube Shorts scriptwriter for a tech channel.
    Today's format: PROMPT TRICK
    Tool Name: {name}
    Summary: {summary}
    Use Cases: {use_cases}

    Write a 35-40 second script in exactly this structure:
    [HOOK]: "One prompt that saves hours." 15 words max.
    [BODY]: The exact prompt or technique. Step by step. 50 words max.
    [CTA]:  "Save this. You'll need it." 10 words max.

    Tone: Practical, immediately actionable.
    Output format: JSON only. No markdown. No asterisks.
    {
      "hook": "", "body": "", "cta": "", "word_count": 0,
      "title": "", "description": "", "hashtags": [],
      "thumbnail_text": "", "pinned_comment": ""
    }
    ---

---

## DAY 2 — Integration + Orchestrator + Testing (8 hours)

### Hours 1-2 — Update services/gemini.py

[ ] Modify services/gemini.py to:
    - Read category from selected_tool.json
    - Load corresponding prompt file from editorial/prompts/{category}.txt
    - Replace template variables in prompt with values from selected_tool.json
    - Call Gemini API with enriched prompt
    - Parse response as JSON (output is now a full metadata package)
    - Validate all required output fields exist
    - Write full metadata package to data/script.json
    - All other behavior (retry logic, timeout, logger) unchanged from V1

    DO NOT change the --input and --output interface.
    DO NOT change retry logic.
    DO NOT change validator.py (it still reads script.json for word_count).

---

### Hours 2-3 — Update orchestrator/run_pipeline.js

[ ] Extend orchestrator to include all V2 steps before existing steps.

    New steps array order:
    {
      name: "collect_hackernews",
      output: "data/.hn_done",          ← use flag files for parallel steps
      run: () => runPython("collectors/hackernews.py", ...)
    },
    {
      name: "collect_blogs",
      output: "data/.blogs_done",
      run: () => runPython("collectors/blogs.py", ...)
    },
    {
      name: "normalize",
      output: "data/raw_candidates.json",
      run: () => runPython("ingestion/normalizer.py", ...)
    },
    {
      name: "quality_filter",
      output: "data/.filtered",
      run: () => runPython("ingestion/quality_filter.py", ...)
    },
    {
      name: "deduplicate",
      output: "data/.deduped",
      run: () => runPython("ingestion/deduplicator.py", ...)
    },
    {
      name: "evaluate",
      output: "data/evaluated_candidates.json",
      run: () => runPython("evaluation/evaluator.py", ...)
    },
    {
      name: "editorial",
      output: "data/content_queue.json",
      run: () => runPython("editorial/editorial_engine.py", ...)
    },
    {
      name: "select",
      output: "data/selected_tool.json",
      run: () => selectFromQueue()    ← reads queue[0], writes selected_tool
    },
    ... existing V1 steps from gemini onward unchanged ...

    Add history update step as final step:
    {
      name: "update_history",
      output: null,                    ← always runs, no skip
      run: () => updateHistory()       ← appends to history.json
    }

---

### Hours 3-4 — Cleanup Between Runs

[ ] Add cleanup function to orchestrator:
    At the START of each new run (before step 1):
    - Delete data/.hn_done
    - Delete data/.blogs_done
    - Delete data/.filtered
    - Delete data/.deduped
    - Delete data/raw_candidates.json
    - Delete data/evaluated_candidates.json
    - Delete data/content_queue.json
    - Delete data/selected_tool.json
    - Delete data/script.json
    - Delete data/validated_script.json
    - Delete data/audio.mp3
    DO NOT delete data/video.mp4 (keep last render)
    DO NOT delete data/history.json (permanent)
    Log: "Pipeline run started. Previous run artifacts cleared."

---

### Hours 4-6 — End-to-End Testing

[ ] Test Run 1 — Full pipeline from scratch
    node orchestrator/run_pipeline.js
    Check logs/pipeline.log for clean run.
    Check data/video.mp4 exists.
    Check data/history.json has one entry.
    Check data/script.json has all metadata fields (title, hashtags, etc.)

[ ] Test Run 2 — Step-skip recovery test
    Delete only data/audio.mp3
    Run pipeline again.
    Verify steps 1-9 are skipped.
    Verify only TTS and render re-run.
    Check logs confirm "Skipping..." messages.

[ ] Test Run 3 — History deduplication test
    Run pipeline a second full time.
    Check that the tool from Run 1 does not appear in content_queue.json.
    Verify a different tool is selected.

[ ] Test Run 4 — Collector failure test
    Temporarily break hackernews.py (rename file).
    Run pipeline.
    Verify blogs.py still runs and pipeline continues with partial data.
    Verify error is logged but pipeline does not crash.
    Restore hackernews.py.

---

### Hours 6-7 — Remotion Template Stubs

[ ] Create stub template files in render/src/templates/
    These are minimal working stubs — full visual design comes later.
    Each stub renders the same layout as the existing V1 template
    but accepts category-specific props.

    For now all templates can use identical layout to V1.
    Full visual differentiation per category is a post-launch task.

    Files to create as stubs:
    - FreeAlternative.tsx
    - Productivity.tsx
    - WeeklyRoundup.tsx
    - Comparison.tsx
    - HiddenGem.tsx
    - Update.tsx

    Update services/render.js to read category from selected_tool.json
    and pass template name to Remotion render command.

---

### Hour 8 — Documentation

[ ] Update DEVLOG.md with full V2 build notes.
[ ] Produce 3 test videos using real data.
[ ] Review quality of scripts generated from category prompts.
[ ] Adjust any prompt files that produce weak output.

---

## Post-V2 (Not Part of This Build)
These are noted here so agents do not accidentally build them:
- Knowledge Base        → V3
- Feedback Loop         → V3
- YouTube Analytics API → V3
- Playwright scraping   → V3
- producthunt.py        → add in Week 3 after V2 is stable
- Multi-channel launch  → V4
