# DevByte Dockerization Notes

## Base image
node:22-bookworm (Bumped from node:18-bookworm to resolve compatibility)

## Python
Python 3.11 (Default system Python for Debian Bookworm)

## Rendering
Remotion + Chromium + FFmpeg
(Chromium dependencies for Debian require several X11 libraries: libxext6, libxrender1, xdg-utils, etc.)

## Runtime mounts
data/
logs/
.env
client_secrets.json
token.json

## Problems encountered
- **Remotion/rspack bug**: npm optional dependency bug (#4828) caused the native rspack binding to fail on Linux.
- **Python command mapping**: Orchestrator scripts (`batch_generate_and_upload.js`) hardcoded `"python"`, which failed on the Debian container since its binary is `"python3"`.
- **TTS argument limitations**: Long strings and quoting issues caused `edge-tts` to fail when passing `--text` via command-line arguments, especially on Linux where `shell=True` list arguments get dropped.
- **Source code drift**: Code modifications made after the initial `docker compose build` (like the TTS and orchestrator fixes) are baked into the container via `COPY . .`, so the container ran stale code.

## Solutions
- **rspack fix**: Added explicit `RUN npm install @rspack/binding-linux-x64-gnu --force` directly in the `Dockerfile`.
- **Cross-platform Python commands**: Refactored Node orchestrators to use `process.platform === 'win32' ? 'python' : 'python3'` dynamically.
- **TTS Temp file**: Refactored `services/tts.py` to write the script to a temporary text file and pass it to `edge-tts` using the `--file` argument, avoiding shell string parsing limitations altogether.
- **Rebuilding**: Ran `docker compose build` to package the newly fixed Python and JS source code into the container.

## Important commands
- **Build the container**: 
  `docker compose build`
- **Run the full batch pipeline inside Docker**: 
  `docker compose up` OR `docker compose run --rm devbyte node orchestrator/batch_generate_and_upload.js`
- **Run a single test script in the container**: 
  `docker compose run --rm devbyte python3 services/tts.py --input data/worker_0/validated_script.json --output data/worker_0/audio.mp3`
