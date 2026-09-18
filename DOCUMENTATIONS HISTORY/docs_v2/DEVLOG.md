# V2 Build Notes & Developer Log

## Mission Accomplished: Content Intelligence Engine
We successfully upgraded the DevByte Engine from a single-source scraper into a robust, multi-layer **Content Intelligence Engine**.

### Architecture Upgrades
- **Collectors Layer:** Implemented `hackernews.py` (JSON API) and `blogs.py` (RSS via feedparser). Both run independently and dump temporary raw outputs.
- **Ingestion Layer:** Created `normalizer.py` to merge outputs into the strict Enriched Normalized Schema. Added `quality_filter.py` to strip out junk, and `deduplicator.py` to collapse cross-source mentions (e.g., merging multiple RSS posts covering the same OpenAI launch).
- **Evaluation Layer:** Implemented `scoring.py` to rank candidates based on Freshness, Popularity, Source Trust, and Quality.
- **Editorial Engine:** Implemented category rotation. The engine reads `history.json` to find underrepresented niches, applies the `editorial_policy.json` weights, and selects the absolute best tool for the day's video.

### Integration Success
- Rewrote `gemini.py` to stop using random data and start reading `selected_tool.json`. It dynamically injects the verified tool data into category-specific prompt templates (`free_alternative.txt`, `hidden_gem.txt`, etc.).
- Overhauled `run_pipeline.js` to execute all 13 steps seamlessly.
- Tested the pipeline end-to-end. The system gracefully handled the multi-source merge, correctly detected an OpenAI blog post, injected it into the prompt, generated the short script, and fully rendered the final MP4.
- Implemented `history.json` tracking to ensure we never repeat a tool across videos.

### Challenges & Fixes
- **Powershell Directory Creation:** Faced a minor hiccup using multiple arguments with PowerShell's `mkdir`. Fixed by using `cmd /c mkdir`.
- **Pipeline Cleanups:** Ensured that `run_pipeline.js` only wipes intermediate `.json` files when the `--fresh` flag is used, preserving the ability to perform "step-skip recovery" if a script crashes midway.

### Next Steps (Post-Launch)
- Build out visually distinct Remotion templates for all 6 categories (Free Alternative, Productivity, etc.) in `render/src/templates/`.
- Add more collector sources (e.g., ProductHunt, Reddit).

**V2 STATUS: 100% COMPLETE. STABLE. DEPLOYED.**
