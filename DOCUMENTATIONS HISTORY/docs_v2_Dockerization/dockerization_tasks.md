# Task: Dockerize DevByte Engine V2

## Objective

Get the existing DevByte pipeline running **identically** inside a single Docker
container, with no behavior changes. Success = `docker compose up` runs the
same pipeline that currently runs via `npm run batch` / `node
orchestrator/run_pipeline.js --fresh` on the host machine.

## Explicit non-goals (do not do these in this task)

- Do NOT deploy to Oracle Cloud or any remote host.
- Do NOT set up cron / scheduling.
- Do NOT migrate `data/history.json` to Postgres or any other database.
- Do NOT split into multiple containers / services / job queues.
- Do NOT attempt multi-stage image size optimization yet — single-stage,
  readable Dockerfile first.
- Do NOT attempt the YouTube OAuth *interactive* flow inside the container —
  see Phase 0.

---


## After the completion of each phase of the project , give me a brief of 
What you did ? How you did ? AND Why is it needed in my project ?


## Phase 0 — Pre-flight (do this before touching Docker)

- [ ] Confirm `token.json` already exists on the host from a prior successful
      YouTube OAuth run. If it doesn't exist yet, run the pipeline locally
      once to generate it — the OAuth browser flow **cannot** run inside a
      container. The container will only ever reuse/refresh an existing
      token, never create one from scratch.
- [ ] Confirm `.env` exists locally with a valid `GEMINI_API_KEY`.
- [ ] Confirm `client_secrets.json` exists locally.
- [ ] Note current host versions for parity checks later:
      `python --version`, `node --version`, `ffmpeg -version`.

---

## Phase 1 — `.dockerignore`

Create `.dockerignore` at repo root. Must exclude, at minimum:

```
node_modules/
render/node_modules/
data/
logs/
.env
client_secrets.json
token.json
.git
*.log
```

Rationale: keeps secrets out of the build context entirely (never even sent
to the Docker daemon), keeps the image reproducible, keeps build context
upload fast.

---

## Phase 2 — Dockerfile

Target: single-stage image based on `node:18-bookworm` (Debian-based, has a
reliable apt setup) with Python 3.11 installed on top.

Required apt packages, grouped by purpose:

- **Python runtime:** `python3.11`, `python3-pip`, `python3-venv`
- **FFmpeg:** `ffmpeg`
- **Chromium/Remotion runtime deps:** consult Remotion's official Docker
  guide for the current package list for the target Debian version — this
  list has changed across Remotion/Debian releases, don't hardcode from
  memory. At minimum expect to need: `libnss3`, `libatk1.0-0`, `libatk-bridge2.0-0`,
  `libdrm2`, `libgbm1`, `libasound2`, `fonts-liberation`, `libx11-xcb1`.
- **Fonts:** ensure at least one legible sans-serif font family is present
  (`fonts-liberation` covers this) or subtitle/title text will render with
  fallback glyphs.

Build steps, in this order (order matters for layer caching):

1. Install system packages (apt) — changes rarely, cache this layer.
2. Copy `package.json` + `package-lock.json` (root) → `npm install`.
3. Copy `render/package.json` + lockfile → `npm install` inside `render/`.
4. Copy `requirements.txt` (create one via `pip freeze` from the working
   local environment if it doesn't exist yet) → `pip install --break-system-packages
   -r requirements.txt`.
5. Copy the rest of the source code.
6. Create a non-root user and switch to it (`USER` directive) — do not run
   Chromium as root. If Chromium still fails to launch under the non-root
   user, the fallback is passing `--no-sandbox` to Remotion's Chromium
   launch args, but prefer the non-root user first.
7. Set `WORKDIR` appropriately, set default `CMD` to the batch pipeline
   entrypoint.

Do NOT `COPY` any of: `.env`, `client_secrets.json`, `token.json`, `data/`.
These are runtime mounts (Phase 3).

---

## Phase 3 — `docker-compose.yml`

Single service. Responsibilities:

- Build from the Dockerfile above.
- Mount as volumes (not baked in):
  - `./.env` → read-only
  - `./client_secrets.json` → read-only
  - `./token.json` → read-write (YouTube SDK may refresh it)
  - `./data` → read-write (runtime artifacts must persist outside the
    container so a rebuild doesn't wipe history/queues)
- Pass through any env vars needed beyond what's in `.env`.
- No exposed ports needed at this stage (no web server yet — that's later).

---

## Phase 4 — Build & smoke test

- [ ] `docker compose build` completes without error.
- [ ] Start a shell inside the built image (`docker compose run --rm devbyte
      bash` or equivalent) and manually verify:
  - `python3.11 --version`
  - `node --version`
  - `ffmpeg -version`
  - `python3.11 -c "import google.generativeai"` (or whichever import
    confirms pip deps installed)
  - Chromium can actually launch — the cheapest test is running Remotion's
    own render on a trivial composition, or checking Puppeteer can open a
    headless page without the "Failed to launch the browser process" error.

Do not proceed to Phase 5 until Chromium launches cleanly. This is the
highest-risk step — budget real time for it.

---

## Phase 5 — Full pipeline smoke test inside the container

- [ ] Run a single independent module first (lowest blast radius), e.g.:
      `python collectors/hackernews.py --input config.json --output
      data/temp_hn.json` — confirm outbound network access works from
      inside the container and the output file lands correctly in the
      mounted `data/` volume.
- [ ] Run the full ingestion chain (`normalizer.py` → `signal_filter.py` →
      `quality_filter.py` → `deduplicator.py`).
- [ ] Run evaluation + editorial selection.
- [ ] Run a single video generation end-to-end (script → validate → TTS →
      render). This exercises Chromium under real load, not just a launch
      check.
- [ ] Confirm the rendered `video.mp4` is playable and matches quality of a
      host-rendered video (check for font/rendering regressions).
- [ ] Only after a single video works end-to-end, attempt the full batch
      (5 parallel workers) and watch memory usage — this is where you'll
      discover if the container needs a memory limit adjustment.

---

## Known risk log (update as you go)

Keep a running note in this file (or a linked `DOCKER_NOTES.md`) of any deviation from the plan above:

*   **Node Version:** Bumped base image from `node:18-bookworm` to `node:22-bookworm` to resolve package compatibility.
*   **Chromium Dependencies:** Additional X11 libs (like `libxext6`, `libxrender1`, `xdg-utils`) were required beyond Remotion's base list to get Chromium to launch headlessly without issue.
*   **Remotion/rspack Bug:** Encountered an npm optional dependency bug (npm/#4828) causing the `rspack` native binding to fail. The workaround is explicitly adding `npm install @rspack/binding-linux-x64-gnu --force` inside the container after the remotion browser step.
*   **Orchestrator Python Command:** The Node orchestrator scripts (`batch_generate_and_upload.js` and `run_pipeline.js`) hardcoded `python` to execute modules. This works natively on Windows but fails on Linux (`bookworm`) where the executable is `python3`. Updated orchestrators to dynamically resolve the command using `process.platform`.
*   **TTS Subprocess Bug:** The `edge-tts` subprocess in `services/tts.py` used `shell=True` with a list argument. On POSIX (Linux) systems, this causes the shell to silently drop all arguments, leading to an argument missing error. Updated to dynamically set `shell = os.name == 'nt'`.

---

## Definition of done

- `docker compose up` runs the full batch pipeline (`npm run batch`
  equivalent) inside the container with no manual intervention beyond having
  `.env`, `client_secrets.json`, and `token.json` present on the host.
- Output video quality, YouTube upload, and history.json entries match what
  the host-run pipeline produces — no behavior change, only environment
  change.
- Everything in "Explicit non-goals" above is still untouched.