# Build Tasks

## Status Key
[ ] not started
[~] in progress
[x] complete
[!] blocked — add reason

---

## DAY 1 — Python Pipeline

[x] Scaffold full folder structure as defined in ARCHITECTURE.md

    Run in PowerShell from project root:
    mkdir orchestrator, sources, services, utils, data, logs, render

    V1 Python dependencies (install once):
    pip install edge-tts google-generativeai requests beautifulsoup4 python-dotenv

    V1 Node dependencies (install once):
    npm install axios dotenv music-metadata

    Do NOT install mongoose, node-cron, or cloudinary.
    These belong to V2 and later. See version roadmap in PROJECT

[x] utils/logger.py
    - Functions: info(), error(), warning(), success()
    - Writes to logs/pipeline.log using Python logging module
    - Prints emoji prefix to console: ✅ ❌ ⚠️ 🎉
    - No arguments. Import and call directly.

[x] config.json (starting template)
    {
      "source": "github",
      "tts_voice": "en-US-ChristopherNeural",
      "max_word_count": 95,
      "max_retries": 2,
      "subprocess_timeout_seconds": 30,
      "output_dir": "./data"
    }

[x] utils/config.py
    - Loads config.json
    - Validates all required keys exist
    - Raises clear ValueError if any key missing
    - Returns config as a plain Python dict

[x] utils/file_utils.py
    - file_exists(path) → bool
    - read_json(path) → dict or list
    - write_json(path, data) → void
    - All paths via os.path.join()
    - All errors via logger.error()

[x] sources/github.py
    - --input config.json --output data/trending.json
    - Scrapes GitHub Trending top 5 repos
    - Each item must match ingestion schema exactly
    - Output is a JSON array (not a single object)
    - Drops and logs any item that fails schema validation

[ ] services/gemini.py
    - --input data/trending.json --output data/script.json
    - Reads first valid item from trending.json array
    - Calls Gemini 1.5 Flash with structured prompt
    - Output matches script schema exactly
    - Retries up to max_retries from config on API failure

[ ] utils/validator.py
    - --input data/script.json --output data/validated_script.json
    - Validates word_count <= max_word_count from config
    - Strips emoji and non-ASCII from hook, body, cta fields
    - Adds validated: true and validated_at timestamp
    - Does not write output if validation fails

[ ] services/tts.py
    - --input data/validated_script.json --output data/audio.mp3
    - Concatenates hook + body + cta into single string
    - Uses edge-tts with voice from config
    - Saves to output path from --output argument
    - Handles rate limiting and empty input gracefully

---

## DAY 2 — Remotion Video Engine

[ ] Install FFmpeg globally (winget install ffmpeg), verify with ffmpeg -version

[ ] Initialize Remotion project in /render (npm create video@latest)

[ ] Set composition to 1080x1920, 30fps, duration driven by audio length

[ ] components/RepoTitle.jsx
    - Displays source_title from props
    - Animated fade-in on frame 0

[ ] components/CodePanel.jsx
    - Uses react-syntax-highlighter with VS Code dark theme
    - Displays code snippet or summary text from props
    - Scrolls slowly upward over video duration

[ ] components/SubtitleBar.jsx
    - Displays current subtitle text at bottom
    - Synced to audio duration via frame calculation

[ ] services/render.js
    - Accepts --input data/validated_script.json
               --audio data/audio.mp3
               --output data/video.mp4
    - Internally reads audio duration using music-metadata
    - Internally generates render/props.json from script + duration
    - Spawns npx remotion render as a child process
    - Deletes render/props.json after successful render (cleanup)
    - Exits with code 1 if render subprocess fails
    - All errors via console.error and appended to logs/pipeline.log

[ ] Test render with real data
    - npx remotion render src/index.tsx MyVideo data/video.mp4 --props=render/props.json
    - Verify audio sync
    - Verify video duration matches audio duration

---

## DAY 3 — Orchestrator + Reliability

[ ] orchestrator/run_pipeline.js
    - Define steps array with name, output path, run function
    - Check output file exists before each step
    - Skip step if output exists and is non-empty
    - 30 second timeout on all Python subprocess calls
    - All errors to logger (Node console.error + append to logs/pipeline.log)
    - Exit with code 1 on any unrecoverable failure

[ ] Add retry logic to services/gemini.py
    - Retry up to max_retries from config
    - Wait 10 seconds between retries
    - Log each retry attempt as warning

[ ] End-to-end test run 1
    - Run full pipeline manually
    - Verify video.mp4 produced
    - Check logs/pipeline.log for clean run

[ ] Deliberate failure test
    - Rename data/trending.json temporarily
    - Run pipeline
    - Verify orchestrator logs error and halts cleanly
    - Restore file

[ ] End-to-end test run 2 and 3 with different GitHub trending data

[ ] Windows Task Scheduler setup
    - Create .bat file that runs: node orchestrator/run_pipeline.js
    - Schedule for 11:30 PM daily
    - Test trigger manually

[ ] README.md
    - Setup instructions
    - How to run each module independently
    - How to run full pipeline
    - Environment