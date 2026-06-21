# Developer Log: DevByte Engine Build

Use this file to document your progress, challenges, and architectural changes made during each coding session.

---

## 2026-06-21 - Session 1
- **Focus:** Python Ingestion Engine (Day 1) & Remotion Video Engine (Day 2)
- **Accomplishments:**
  - Scaffolded complete folder structure and installed all dependencies.
  - Implemented centralized logging (`utils/logger.py`) and config loader (`utils/config.py`).
  - Created GitHub trending scraper (`sources/github.py`) enforcing exact ingestion schema.
  - Developed `services/gemini.py` for structured LLM script generation.
  - Built `utils/validator.py` to enforce word counts and strip non-ASCII text.
  - Developed `services/tts.py` to interface with edge-tts and gracefully handle API constraints.
  - Verified FFmpeg installation and cleanly scaffolded the `render` Remotion project.
  - Built three core visual components (`RepoTitle.tsx`, `CodePanel.tsx`, `SubtitleBar.tsx`) styled precisely to mimic a premium VS Code dark theme environment (including an SVG noise texture, blinking cursors, and custom Google Fonts: Fira Code & Inter).
  - Built Node wrapper `services/render.js` to compute audio duration via `music-metadata`, safely copy assets to the `public/` directory, inject dynamic JSON props, and trigger Remotion headless rendering.
  - Successfully executed a full end-to-end pipeline test, automatically generating a 35-second `.mp4` video locally.
- **Bugs/Issues Encountered:**
  - Python's standard `print()` failed on Windows with a `UnicodeEncodeError` when outputting emojis (✅, ❌) to the console.
  - `google.generativeai` package returned a 404 for `gemini-1.5-flash` because the endpoint was deprecated.
  - Remotion's CLI renderer failed when passed an absolute `file:///` URI for the audio track (`audio.mp3`).
- **Solutions & Workarounds:**
  - Added a dynamic patch in `logger.py` to call `sys.stdout.reconfigure(encoding='utf-8')` if the console encoding isn't UTF-8.
  - Updated `services/gemini.py` to target `gemini-2.5-flash` instead.
  - Refactored `services/render.js` to intelligently copy the absolute audio file into Remotion's local `public/` directory and use Remotion's `staticFile()` loader for reliable rendering.
- **Next Steps:**
  - Move to Day 3: Orchestrator Script & Reliability features (bringing everything together into one master script).