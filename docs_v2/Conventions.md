# Code Conventions — V2 (extends V1 Conventions)

All V1 conventions remain in force.
This file adds V2-specific rules only.

CORE PRINCIPLES _ DONT REPEAT YOURSELF 

---

## Data Acquisition Rule (NEW — applies to ALL collectors)

When building any collector, always follow this decision order.
Never skip a step without trying the one above it first.
Document which method is used as a comment at the top of each
collector file.

Order:
1. Official API           → always first choice. Structured JSON.
2. RSS Feed               → /rss, /feed, atom.xml endpoints
3. Hidden JSON in HTML    → <script id="__NEXT_DATA__"> or XHR endpoints
                            found via DevTools → Network → Fetch/XHR
4. BeautifulSoup HTML     → scrape rendered HTML
5. Playwright             → last resort. NOT used in V2.

Example comment at top of every collector file:
# Data acquisition method: Official JSON API
# Endpoint: https://hacker-news.firebaseio.com/v0/topstories.json
# Auth required: No
# Rate limit: None documented

---

## Module Responsibility Rules (NEW)

collectors/    → fetch only. No normalization. No scoring. No decisions.
               → One HTTP concern per file.

ingestion/     → transform only. No HTTP calls. No scoring. No decisions.
               → Reads local JSON. Writes local JSON.

evaluation/    → score only. No HTTP calls. No editorial decisions.
               → Reads raw_candidates.json. Writes evaluated_candidates.json.

editorial/     → decide only. No HTTP calls. No scoring.
               → Reads evaluated_candidates.json + policy + history.
               → Writes content_queue.json.

services/      → one external tool per file. No collection. No editorial.

utils/         → shared helpers only. No business logic. No HTTP calls.

The rule: if a module is making an HTTP call AND writing a score,
it is doing two jobs. Split it.

---

## Schema Integrity Rules (NEW)

- Every collector output must be validated against the enriched
  normalized schema before writing to any file.
- Any object failing required field validation is dropped and logged.
- Never pass an object with null values downstream.
  Use "" for missing strings, [] for missing arrays, {} for missing
  objects, "unknown" for missing enum strings.
- score and confidence are always set to 0 and 0.0 by collectors.
  Only evaluator.py sets real values for these fields.

---

## File Safety Rules (NEW)

- history.json is APPEND ONLY. Never overwrite. Never delete.
  Only the final history-update step in the orchestrator appends to it.
- raw_candidates.json is a pipeline artifact. Cleared at run start.
- evaluated_candidates.json is a pipeline artifact. Cleared at run start.
- content_queue.json is a pipeline artifact. Cleared at run start.
- selected_tool.json is a pipeline artifact. Cleared at run start.
- Never clear data/video.mp4 automatically. Manual deletion only.

---

## Gemini Rules (UPDATED)

- Gemini is a writer. Not a researcher. Not a search engine.
- Always inject verified structured data before calling Gemini.
- Load category prompt from editorial/prompts/{category}.txt.
- Replace all {template_variables} before sending to API.
- Parse Gemini response as JSON. Strip ```json fences before parsing.
- Validate all required output fields exist after parsing.
- If JSON parsing fails, retry once. If retry fails, log and halt.
- word_count in output is SELF-REPORTED by Gemini.
  validator.py ALWAYS recounts independently. Never trust Gemini's count.

---

## Orchestrator Rules (UPDATED)

- Orchestrator reads subprocess_timeout_seconds from config.json.
  Never hardcodes timeout values.
- Cleanup of pipeline artifacts runs at the START of each new run,
  not at the end. This preserves the last video on failure.
- Flag files (data/.hn_done, data/.filtered, etc.) are used for
  steps that modify files in-place rather than producing new files.
  Flag files are deleted during cleanup at run start.
- history.json update step always runs. It has no skip condition.
  It is the only step in the orchestrator with output: null.

---

## Prompt File Rules (NEW)

- All prompt files live in editorial/prompts/ only.
- Prompt files use {variable_name} syntax for template variables.
- Available variables: {name}, {summary}, {pricing}, {website},
  {use_cases}, {target_audience}, {competitors}, {event_type}
- Every prompt file ends with an explicit JSON output format block.
- Prompt files are plain text. No Python. No JavaScript. No imports.
- Gemini.py handles variable substitution via str.format() or
  string .replace() calls before the API call.

---

## Python Conventions (Unchanged from V1)
- Version: 3.11
- All modules accept --input and --output via argparse. No exceptions.
- utils/ modules are both executable (via argparse + __main__ block)
  and importable (logic in plain functions above __main__).
- All logging via utils/logger.py only. No bare print() statements.
- All file paths via os.path.join(). No hardcoded slashes.
- All external API calls wrapped in try/except with retry logic.
- Emoji and non-ASCII characters stripped before TTS.
- Function names: snake_case. File names: snake_case.

## Node.js Conventions (Unchanged from V1)
- Version: 18
- Use async/await throughout. No raw .then() chains.
- Check file existence before any read operation.
- All subprocess calls use timeout from config.json.
- Function names: camelCase. File names: camelCase.

## JSON Conventions (Unchanged from V1)
- All data files in /data directory only.
- Dates always ISO 8601. No exceptions.
- No null values. Use "" or [] or {} instead.
- Never write a JSON file unless all required fields are present.

## Git Conventions (Unchanged from V1)
feat: [module] [what it does]
fix:  [module] [what was broken]
Examples:
feat: collectors/hackernews.py outputs normalized schema
fix:  evaluation/evaluator.py confidence calculation for tier-1 sources