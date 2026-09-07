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


What triggers what

Docker caches each layer by hashing its instruction plus the files it copies. The moment one layer's hash changes, every layer after it is invalidated and re-run, even if those later layers themselves didn't change.

So the outcome depends entirely on what you edited:

Case A — you only edited a .py or .js file (e.g. editorial_engine.py)

Layers 1–10 are untouched → cache hit, skipped instantly (no apt, no npm ci, no Chromium download, no pip install) Layer 11 (**COPY** . .) sees changed file content → cache miss → re-copies everything Layer 12 (useradd/chown) reruns → fast, just filesystem ops Total time: a few seconds

Case B — you edited requirements.txt

Layers 1–8 cached Layer 9 (**COPY** requirements.txt) → cache miss Layer 10 (pip install) reruns → downloads/installs Python packages again Layers 11–12 rerun too Total time: moderate, network-dependent

Case C — you edited root package.json or package-lock.json

Layers 1–3 cached Layer 4 → cache miss Layer 5 (npm ci) reruns → reinstalls root Node deps Everything after also reruns Total time: moderate

Case D — you edited render/package.json

Layers 1–5 cached Layer 6 → cache miss Layer 7 (npm install inside render/) reruns → reinstalls Remotion/React/rspack deps Layer 8 (npx remotion browser ensure) reruns → re-downloads headless Chromium (this is the expensive one) Everything after reruns Total time: slow — this is the step your DOCKER_NOTES.md flagged as risky (rspack binding bug)

Case E — you edited the Dockerfile's apt-get line

Layer 2 → cache miss Everything from layer 2 onward reruns, including all npm/pip/Chromium steps Total time: slowest, full rebuild essentially What up --build does after building

Once the image build finishes (cached or not), docker compose up:

Stops/removes the old devbyte-engine container if one exists Creates a new container from the freshly built image Re-attaches your volume mounts (.env, client_secrets.json, token.json, data/, logs/) — these are untouched by the rebuild since they're not baked into the image Runs **CMD** [*npm*, *run*, *batch*], streaming output to your terminal