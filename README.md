# DevByte Engine V2 (YouTube Shorts Automation)

An end-to-end automated pipeline that scrapes Hacker News and tech blogs, evaluates news with an editorial engine, uses Google Gemini to write engaging scripts, generates text-to-speech using Edge TTS, and renders highly aesthetic, premium SaaS-style YouTube Short videos automatically using Remotion.

## Prerequisites

- Python 3.9+
- Node.js 18+
- [FFmpeg](https://ffmpeg.org/download.html) (Ensure it is in your system PATH)
- A Google Gemini API Key

## Setup & Installation

1. **Clone or Download the Repository**
2. **Set up Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. **Install Python Dependencies**
   ```bash
   pip install edge-tts google-generativeai requests beautifulsoup4 python-dotenv
   ```
4. **Install Node Dependencies**
   ```bash
   npm install
   cd render
   npm install
   cd ..
   ```

## Running the Full 13-Step Pipeline

To run the entire automation process from start to finish, run the orchestrator script. 

### Fresh Run (Recommended)
Use the `--fresh` flag to safely wipe previous temporary files. The engine will scrape HN and blogs, run them through the editorial/scoring engine, write the script, and render a new vertical video.
```bash
node orchestrator/run_pipeline.js --fresh
```

### Resume/Crash Recovery Run
Run without flags to pick up where a crashed pipeline left off (it will skip any step that already has a completed output file):
```bash
node orchestrator/run_pipeline.js
```

### Automated Daily Scheduling (Windows)
A `run_automation.bat` file is included in the project root. You can schedule this to run automatically using Windows Task Scheduler:
```cmd
schtasks /create /tn "DevByteAutomation" /tr "\"C:\DEV\devilcode development\Devbyte-engine (youtube automation)\run_automation.bat\"" /sc daily /st 23:30 /f
```

## Running Modules Independently

If you are debugging or testing specific modules, you can run them manually:

**1. Scrape & Normalize**
```bash
python collectors/hackernews.py --input config.json --output data/temp_hn.json
python ingestion/normalizer.py --input data/temp_hn.json --output data/raw_candidates.json
```

**2. Editorial & Script Generation**
```bash
python editorial/editorial_engine.py --input data/raw_candidates.json --output data/content_queue.json --channel channels/ai_tools.json --policy editorial/editorial_policy.json --history data/history.json
node -e "const fs=require('fs'); fs.writeFileSync('data/selected_tool.json', JSON.stringify(JSON.parse(fs.readFileSync('data/content_queue.json'))[0], null, 2))"
python services/gemini.py --input data/selected_tool.json --output data/script.json
```

**3. Generate TTS Audio**
```bash
python services/tts.py --input data/validated_script.json --output data/audio.mp3
```

**4. Render Video**
```bash
node services/render.js --input data/validated_script.json --audio data/audio.mp3 --output data/video.mp4
```

## Previewing Video Visuals
If you want to edit the React Remotion components or preview the video without waiting for a full MP4 render:
```bash
cd render
npm run dev
```

## Project Architecture
- `config.json`: Master configuration (voice selection, timeouts, retries).
- `orchestrator/run_pipeline.js`: The central task runner orchestrating the 13 Python/Node scripts.
- `render/`: The React Remotion environment responsible for the visual engine.
- `logs/pipeline.log`: Master log file tracking execution and errors.
- `data/`: Ephemeral folder where intermediate JSON files, audio, history, and the final `.mp4` are stored.
