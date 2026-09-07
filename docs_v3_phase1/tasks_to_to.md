# DevByte Engine V2.1 — Editorial Quality Refactor

## Agent Instructions
- Execute these tasks sequentially.
- DO NOT introduce new libraries, databases, or agentic frameworks.
- DO NOT rewrite the Remotion rendering logic.
- Our goal is to remove rigid editorial constraints and simplify the architecture. Delete code aggressively where instructed.

---

## PHASE 1: Constraint Removal (Critical Quality Fixes)

### [ ] Task 1: Remove Hacker News Whitelist
**File:** `ingestion/signal_filter.py`
**Action:** 
- Delete the logic that treats `hackernews` differently (lines ~51-57).
- Apply the `noise_blacklist` check to ALL sources equally.
- If a candidate matches the `noise_blacklist`, drop it. Otherwise, keep it.
- **File:** `sources/filters.json` -> Delete the `hn_whitelist` array entirely.

### [ ] Task 2: Remove 20-Word Summary Limit
**File:** `ingestion/quality_filter.py`
**Action:**
- Locate `validate_candidate()`.
- Change the summary check from `if not summary or len(summary.split()) < 20:` to simply `if not summary or not summary.strip():`.
- Update the rejection reason string to match.

### [ ] Task 3: Remove Fake Summary Padding
**Files:** `collectors/blogs.py` & `collectors/product_hunt.py`
**Action:**
- Locate the block: `if len(summary.split()) < 20: summary = f"{title}. {summary}..."`
- Delete this block entirely from both files. Pass the raw summary directly downstream.

### [ ] Task 4: Remove Hype Bonus & Brand Favoritism
**File:** `evaluation/scoring.py`
**Action:**
- In `calculate_quality_score()`, delete the `hype_keywords` array and the regex check that adds `+25` to the score.
- In `calculate_confidence()`, delete the `hype_keywords` array and the regex check that adds `+0.45` to the confidence.
- In `calculate_confidence()`, remove the hardcoded `+0.20` and `+0.25` bumps for Tier 1 and Tier 2 sources. Let the cross-source validation and summary quality drive confidence.

### [ ] Task 5: Remove Destructive ASCII Stripping
**File:** `utils/validator.py`
**Action:**
- Delete the `strip_non_ascii()` function.
- In `validate_script()`, remove the calls to `strip_non_ascii()`. Allow UTF-8 characters (emojis, smart quotes, foreign names) to pass through to the TTS engine.

### [ ] Task 6: Gut the Category Rotation Math
**File:** `editorial/editorial_engine.py`
**Action:**
- Delete `get_category_distribution()`, `find_underrepresented_category()`, and `candidate_matches_category()`.
- Rewrite `main()` to simply:
  1. Load evaluated candidates and history.
  2. Filter out candidates whose `id` is already in `published_ids` (unless `event_type` == "major_update").
  3. Apply the `min_score_threshold`.
  4. Pass the remaining list to `select_with_diversity()` to get the top `queue_size` candidates.
  5. Save to `content_queue.json`.
- **Note:** Do not assign a fallback category. Leave `candidate["category"]` as whatever the collector set it to.

---

## PHASE 2: Prompt Consolidation

### [ ] Task 7: Create Universal Tech Story Prompt
**File:** `editorial/prompts/tech_story.txt`
**Action:**
- Create this new file. 
- Write a universal prompt that tells the LLM: "You are a tech news scriptwriter. Review the provided JSON data. Decide the best angle (e.g., Breaking News, Free Alternative, Productivity Hack, or Hidden Gem) based on the context. Write a 40-50 word script..."
- Ensure it requires the exact same JSON output schema as the previous prompts (`hook`, `body`, `cta`, `title`, etc.).

### [ ] Task 8: Update Gemini Scriptwriter
**File:** `services/gemini.py`
**Action:**
- Update `load_prompt_template()` to ALWAYS load `tech_story.txt`, regardless of the tool's category.
- Delete the 8 old category prompts from `editorial/prompts/` (`best_for.txt`, `comparison.txt`, etc.).

---

## PHASE 3: Structural Upgrades

### [ ] Task 9: Fix Hacker News Popularity Signal
**File:** `collectors/hackernews.py`
**Action:**
- When parsing the story JSON from the HN API, extract `story.get("score", 0)`.
- Map this value to a new key `"_hn_points": story.get("score", 0)` in the candidate dictionary. (The evaluator already looks for `_hn_points` to calculate popularity).

### [ ] Task 10: Parallelize Discovery
**File:** `orchestrator/batch_generate_and_upload.js`
**Action:**
- Locate "Phase 1: Ingestion & Evaluation".
- The first 4 steps (the collectors) currently run sequentially using `runCommandSync`.
- Refactor these 4 steps to run concurrently using `runCommandAsync` wrapped in `Promise.all()`.
- Wait for all 4 to resolve before moving on to `ingestion/normalizer.py` (which must remain synchronous/sequential).

### [ ] Task 11: DRY the Orchestrators (Low Priority / Optional for this PR)
**Files:** Create `orchestrator/pipeline_steps.js`, Update `run_pipeline.js` & `batch_generate_and_upload.js`
**Action:**
- Extract the step definitions (command, args, input/output paths) into a shared configuration file `pipeline_steps.js`.
- Refactor both orchestrators to import and iterate over these shared steps, ensuring that if a pipeline step is added/removed in the future, it only needs to be updated in one place.