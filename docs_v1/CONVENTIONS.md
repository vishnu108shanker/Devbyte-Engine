# Code Conventions

## Environment
- Python: 3.11
- Node.js: 18
(Canonical reference: PROJECT.md)

## Python Rules
- All modules accept --input and --output via argparse. No exceptions.
- All logging via utils/logger.py only. No bare print() statements.
- All file paths built with os.path.join(). No hardcoded slashes.
- All external API calls wrapped in try/except with retry logic.
- Emoji and non-ASCII characters stripped before any TTS call.
- Empty string or null fields must raise ValueError before processing.
- utils/ modules are both executable (via argparse + __main__ block)
  and importable (logic in plain functions above __main__).
  This is the standard pattern for all utils/ files.
- Function names: snake_case
- File names: snake_case
- Constants: UPPER_SNAKE_CASE

## Node.js Rules
- Use async/await throughout. No raw .then() chains.
- Check file existence before any read operation.
- All subprocess calls use timeout value from config.json
  (subprocess_timeout_seconds). Never hardcode this value.
  Default in config.json is 30. Raise during Remotion render
  testing if needed.
- Function names: camelCase
- File names: camelCase
- Constants: UPPER_SNAKE_CASE

## JSON Rules
- All data files live in /data directory only.
- Sources output arrays. Services output single objects. (See ARCHITECTURE.md)
- Dates always in ISO 8601 format. No exceptions.
- No null values. Use empty string "" or empty object {} instead.
- Never write a JSON file unless all required fields are present and valid.

## Error Handling Rules
- Never swallow errors silently.
- Every catch block calls logger.error() before any other action.
- Pipeline halts if a step produces empty or missing output file.
- On API retry exhaustion: log error, halt pipeline, exit with code 1.
- Timeouts are errors. Log them as logger.error(), not logger.warning().

## Naming Conventions for Data Files
- trending.json        → raw ingestion output
- script.json          → LLM generated script
- validated_script.json → validator approved script
- audio.mp3            → TTS output
- video.mp4            → final render output
Never rename these. Orchestrator depends on exact filenames.

## Git Commit Format
feat: [module name] [what it does]
fix: [module name] [what was broken]
refactor: [module name] [what changed]

Examples:
feat: sources/github.py outputs standard ingestion schema
fix: services/tts.py handles emoji in script body