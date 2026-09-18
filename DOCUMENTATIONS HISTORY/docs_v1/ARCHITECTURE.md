# Architecture

## Environment
- Python: 3.11
- Node.js: 18
(Canonical reference: PROJECT.md)

## Folder Structure

devbyte-engine/
  orchestrator/
    run_pipeline.js         ← coordinates steps only, no business logic
  sources/                  ← data collectors, one file per source
    github.py
    hacker_news.py
  services/                 ← processors, one file per concern
    gemini.py
    tts.py
    render.js
  utils/
    logger.py
    validator.py
    config.py
    file_utils.py
  data/
    trending.json
    script.json
    validated_script.json
    audio.mp3
    video.mp4
  logs/
    pipeline.log
  render/
    src/                    ← Remotion React components
  config.json
  PREREQUISITES.md
  PROJECT.md
  ARCHITECTURE.md
  CONVENTIONS.md
  TASKS.md
  DEVLOG.md

## Folder Rules
- sources/   → data collectors only. Input: config.json. Output: trending.json
- services/  → processors only. Each owns one external tool or API.
- utils/     → shared helpers only. No business logic. No API calls.
- data/      → all runtime JSON and media files. Gitignored except schemas.
- logs/      → pipeline.log only. Gitignored.

## Pipeline Flow

sources/github.py
  --input config.json
  --output data/trending.json

services/gemini.py
  --input data/trending.json
  --output data/script.json

utils/validator.py
  --input data/script.json
  --output data/validated_script.json

services/tts.py
  --input data/validated_script.json
  --output data/audio.mp3

services/render.js
  --input data/validated_script.json
  --audio data/audio.mp3
  --output data/video.mp4

## Orchestrator Behaviour
- Before running each step, check if output file already exists
- If output exists and is non-empty, skip that step (failure recovery)
- On skip, write INFO log: "Skipping [step] — output exists"
- Max 2 retries on any external API call (Gemini only in V1)
- subprocess_timeout_seconds is read from config.json at startup.
  Orchestrator fails fast with a clear error if config.json is
  missing or malformed before any pipeline step runs.
- On retry exhaustion, write ERROR log and halt pipeline
- Pipeline never continues past a step that produced empty output

## Ingestion Schema (Array Envelope)
Every source outputs a JSON array of objects.
Each object must conform exactly to this shape:

[
  {
    "title": string,          REQUIRED. Non-empty. Max 120 chars.
    "summary": string,        REQUIRED. Non-empty. Max 500 chars.
    "url": string,            REQUIRED. Valid URL format.
    "source": string,         REQUIRED. One of: "github", "hackernews", "rss"
    "published_at": string,   REQUIRED. ISO 8601 format. e.g. "2024-01-15T00:00:00Z"
    "metadata": object        REQUIRED. Can be empty object {}. Never null.
  }
]

Minimum 1 item. Maximum 10 items per run.
Any item failing validation is dropped and logged, not passed forward.

## Script Schema (Single Object)
services/gemini.py outputs a single JSON object:

{
  "hook": string,         REQUIRED. 15-20 words. Non-empty.
  "body": string,         REQUIRED. 45-50 words. Non-empty.
  "cta": string,          REQUIRED. 10-15 words. Non-empty.
  "word_count": integer,  REQUIRED. Total words across hook+body+cta.
  "source_title": string, REQUIRED. Copied from ingestion schema title field.
  "source_url": string,   REQUIRED. Copied from ingestion schema url field.
  "generated_at": string  REQUIRED. ISO 8601 timestamp of generation time.
}

## Validated Script Schema
utils/validator.py outputs same shape as Script Schema, plus:

{
  ...all script schema fields...,
  "validated": true,            REQUIRED. Always true if file exists.
  "validated_at": string        REQUIRED. ISO 8601 timestamp.
}

If validation fails, file is not written. Pipeline halts. Error is logged.