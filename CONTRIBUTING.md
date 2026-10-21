# Contributing to DevByte Engine

Thanks for your interest in DevByte Engine, an autonomous AI engine that discovers, evaluates, scripts, renders, and publishes short-form developer news videos. Contributions of all sizes are welcome: bug reports, docs fixes, new news sources, new video templates, and pipeline improvements.

Please read this guide before opening an issue or pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Project Layout](#project-layout)
- [Running and Testing Changes](#running-and-testing-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Security and Secrets](#security-and-secrets)
- [License](#license)

## Code of Conduct

Be respectful and constructive. Harassment, personal attacks, and discriminatory language are not tolerated. Maintainers may edit, close, or remove contributions that violate this.

## Ways to Contribute

Most of the newsroom is configured through JSON, so many contributions need no pipeline changes:

| Contribution | Where |
|---|---|
| Add an RSS feed | `sources/official_feeds.json` |
| Track a GitHub repo for releases | `sources/github_repos.json` |
| Tune noise keywords or HN whitelist | `sources/filters.json` |
| Adjust queue size, diversity caps, staleness, cache TTL | `editorial/editorial_policy.json` |
| Improve a category prompt | `editorial/prompts/*.txt` |
| Add or improve a video component or template | `render/src/` |
| Add a new collector or publishing target | `collectors/`, `services/` |
| Improve documentation | `README.md`, `docs_v2_Dockerization/` |

## Reporting Bugs

Search existing issues first. If none match, open a new issue and include:

1. **What happened** and what you expected instead.
2. **Steps to reproduce**, including the exact command (for example `npm run batch` or `python services/tts.py ...`).
3. **Environment:** OS, Python version, Node.js version, FFmpeg version, and whether you ran inside Docker.
4. **Relevant logs** from `logs/pipeline.log`. Full traces are written there, not to the terminal.
5. **The failing pipeline stage:** collection, ingestion, evaluation, script, TTS, render, or a specific upload target.

**Before pasting logs or config, remove API keys, tokens, presigned URLs, account IDs, and the contents of `.env`, `token.json`, and `client_secrets.json`.**

## Suggesting Features

Open an issue describing the problem you want solved, not only the solution. Explain how it fits the editorial mission: DevByte covers products, releases, tools, developer infrastructure, AI breakthroughs, and major engineering announcements, not essays, tutorials, or opinion pieces. Features that change editorial behavior should say how they affect category rotation, source diversity, or ranking.

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg 6+
- PostgreSQL (for the `publications` table; `data/history.json` is the migration fallback)

### Steps

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/Youtube-video-automation.git
cd Youtube-video-automation
mkdir -p data logs

# 2. Python dependencies
pip install python-dotenv google-genai requests beautifulsoup4 edge-tts feedparser \
  python-slugify google-auth google-auth-oauthlib google-api-python-client boto3

# 3. Node orchestrator dependencies
npm install

# 4. Remotion renderer dependencies
cd render && npm install && cd ..

# 5. Initialize the history ledger
echo "[]" > data/history.json
```

### Environment variables

Create a `.env` file in the project root (it is gitignored). You only need the keys for the stage you are working on:

```env
GEMINI_API_KEY=...            # evaluation, scripting
DATABASE_URL=postgresql://user:password@localhost:5432/devbyte
META_LONG_LIVED_TOKEN=...     # Instagram
INSTAGRAM_ACCOUNT_ID=...
FB_PAGE_ID=...                # Facebook
FB_LONG_LIVED_TOKEN=...
S3_TEMP_BUCKET=...            # S3 temporary bridge
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
REMOTION_CONCURRENCY=4        # optional; defaults to all CPU cores
```

**You do not need publishing credentials to contribute.** Collection, ingestion, evaluation, scripting, TTS, and rendering can all be developed and verified without uploading anywhere. Please do not test uploads against someone else's accounts, and use a throwaway channel or Page for your own upload testing.

### Docker

A Docker setup is documented in `docs_v2_Dockerization/DOCKER_NOTES.md`. Note that `services/render.js` is a Node script and must be run with `node`, not `python`.

## Project Layout

```text
sources/       Editable newsroom configuration (feeds, repos, filters)
collectors/    Source-specific fetchers (HN, blogs, GitHub releases, Product Hunt)
ingestion/     Normalizer, signal filter, quality filter, deduplicator, staleness gate
evaluation/    Gemini editorial evaluation and evidence building
editorial/     Queue builder, policy JSON, category prompts
services/      Script, TTS, render, and upload services
orchestrator/  Single-video and batch pipeline controllers
utils/         Logger, validator, config and file helpers
render/        Remotion video engine (React, TypeScript, Tailwind)
```

Every Python module is designed to run on its own with `--input` and `--output` flags, which is the easiest way to test a change in isolation.

## Running and Testing Changes

The project does not currently ship an automated test suite, so changes are verified by running the affected stage and inspecting its output. Run the narrowest check that covers your change, then a broader one before opening a PR.

### Run a single stage

```bash
# Collect from one source
python collectors/hackernews.py --input config.json --output data/temp_hn.json

# Ingestion chain
python ingestion/normalizer.py --input data/temp_hn.json --output data/raw_candidates.json
python ingestion/signal_filter.py --input data/raw_candidates.json --output data/raw_candidates.json
python ingestion/quality_filter.py --input data/raw_candidates.json --output data/raw_candidates.json
python ingestion/deduplicator.py --input data/raw_candidates.json --output data/raw_candidates.json
python ingestion/staleness_gate.py --input data/raw_candidates.json --output data/raw_candidates.json --max-days 14

# Evaluation and editorial queue
python evaluation/evaluator.py --input data/raw_candidates.json --output data/evaluated_candidates.json
python editorial/editorial_engine.py \
  --input data/evaluated_candidates.json \
  --output data/content_queue.json \
  --channel channels/ai_tools.json \
  --policy editorial/editorial_policy.json \
  --history data/history.json

# Production
python services/gemini.py --input data/selected_tool.json --output data/script.json
python utils/validator.py --input data/script.json --output data/validated_script.json
python services/tts.py --input data/validated_script.json --output data/audio.mp3
node services/render.js --input data/validated_script.json --audio data/audio.mp3 --output data/video.mp4
```

### Run the full pipeline

```bash
# One video, ignoring cached progress
node orchestrator/run_pipeline.js --fresh

# Full batch (up to 5 videos)
npm run batch
```

Batch runs publish for real if publishing credentials are present. Remove or leave unset the YouTube, Meta, and S3 credentials when you only want to test the pipeline up to rendering.

### What to check

- **Ingestion and filter changes:** run the chain on real collector output and compare candidate counts before and after. Confirm you did not start dropping legitimate announcements or letting tutorials and opinion pieces through.
- **Evaluation and editorial changes:** the evaluator must return every input ID, with valid `publish`/`reject` decisions, unique integer ranks from 1 to N for publishable items, and `rank: null` for rejects. Confirm the queue still respects the source and company diversity caps in `editorial_policy.json`.
- **Prompt changes:** generate scripts for at least two different candidates and read the validated output, not just the raw script.
- **Render changes:** render a real video and watch it. Check scene boundaries, bullet timing against the audio, subtitles, and that nothing overflows the 1080×1920 frame. You can preview components in Remotion Studio from `render/`.
- **Publishing changes:** test against a private or throwaway account and confirm the S3 temporary object is deleted afterward.
- **Always:** check `logs/pipeline.log` for new errors or warnings.

If you add a test framework or tests for the area you touched, that is very welcome. Please describe how to run them in your PR.

## Pull Request Process

1. **Open an issue first** for anything larger than a small fix, so the approach can be agreed before you invest time.
2. **Branch from `main`** with a descriptive name, for example `fix/staleness-gate-timezone` or `feat/devto-collector`.
3. **Keep PRs focused.** One logical change per PR. Separate refactors from behavior changes.
4. **Write clear commit messages** in the imperative mood, for example `Fix duplicate rank handling in evaluator`.
5. **Update documentation** when behavior, config keys, CLI flags, or environment variables change. This includes the README and its version history where relevant.
6. **Fill in the PR description:** what changed, why, how you verified it (commands you ran and what you observed), and screenshots or a short clip for any visual change.
7. **Confirm no secrets** are in the diff, the commit history, or attached logs.
8. A maintainer will review your PR. Expect feedback; address it by pushing additional commits to the same branch.

### PR checklist

- [ ] The change is focused and linked to an issue where applicable
- [ ] I ran the affected stage(s) and verified the output
- [ ] I checked `logs/pipeline.log` for new errors
- [ ] I updated docs and config examples if behavior changed
- [ ] No API keys, tokens, presigned URLs, or personal data are included
- [ ] New files follow the existing structure and naming

## Coding Guidelines

**General**

- Match the style of the surrounding code. Do not reformat unrelated lines.
- Keep modules runnable standalone with `--input` and `--output` where the existing ones are.
- Prefer configuration in `sources/` and `editorial/editorial_policy.json` over hardcoding values.
- Use the shared helpers in `utils/` (`logger.py`, `config.py`, `file_utils.py`) instead of reimplementing them.
- Log through the project logger so output reaches `logs/pipeline.log`. Keep terminal output to short milestone lines.

**Python**

- Target Python 3.11+. Add type hints to new functions where practical.
- Handle network failures and malformed API responses explicitly. Collectors and uploaders should fail one item without crashing the whole batch.
- Never write secrets to logs or to files under `data/`.

**LLM-facing code**

- Treat model output as untrusted and probabilistic. Validate structure (IDs, decisions, ranks) and retry or fall back rather than assuming correctness.
- Keep the principle: code decides what is allowed, Gemini decides what is worth publishing. Hard rules belong in deterministic gates, not in prompts.

**Remotion and TypeScript**

- Derive timing from `render/src/utils/timing.ts` and the sentence metadata rather than hardcoding frame counts.
- Reuse tokens from `render/src/design/theme.ts` for colors, typography, and spacing.
- Avoid platform-dependent glyphs such as system emoji. Use SVG for icons and badges.

## Security and Secrets

- Never commit `.env`, `client_secrets.json`, `token.json`, or anything under `data/`.
- If you accidentally commit a credential, treat it as compromised: revoke and rotate it immediately, then tell a maintainer. Deleting the commit is not enough.
- Report security vulnerabilities privately to the maintainers (via GitHub's private vulnerability reporting if enabled, or by contacting the maintainer directly) rather than opening a public issue.

## License

This project is proprietary; see the License section of the README. By submitting a contribution, you confirm that you wrote it or have the right to submit it, and you agree that the maintainers may use, modify, and distribute it as part of the project.
