# YouTube Shorts Automation Engine

An end-to-end automated pipeline that scrapes GitHub trending repositories, uses Google Gemini to write engaging scripts, generates text-to-speech using Edge TTS, and renders a highly aesthetic, VS Code themed YouTube Short video automatically using Remotion.

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
   npm install axios dotenv music-metadata
   cd render
   npm install
   cd ..
   ```

## Running the Full Pipeline

To run the entire automation process from start to finish, run the orchestrator script. 

### Fresh Run (Recommended)
Use the `--fresh` flag to safely wipe previous temporary files and generate a brand new video from today's trending data. The script will randomly pick one of the top 5 trending repositories to keep videos unique.
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
schtasks /create /tn "YouTubeShortsAutomation" /tr "\"C:\absolute\path\to\run_automation.bat\"" /sc daily /st 23:30 /f
```
Check `logs/automation.log` and `logs/pipeline.log` to monitor automated background runs.

## Running Modules Independently

You can execute each step manually if you are debugging or testing. Run these from the root of the project:

**1. Scrape GitHub Trending**
```bash
python sources/github.py --input config.json --output data/trending.json
```

**2. Generate AI Script**
```bash
python services/gemini.py --input data/trending.json --output data/script.json
```

**3. Validate Script**
```bash
python utils/validator.py --input data/script.json --output data/validated_script.json
```

**4. Generate TTS Audio**
```bash
python services/tts.py --input data/validated_script.json --output data/audio.mp3
```

**5. Render Video**
```bash
node services/render.js --input data/validated_script.json --audio data/audio.mp3 --output data/video.mp4
```

## Previewing Video Visuals
If you want to edit the React components or preview the video without waiting for a full MP4 render, use Remotion Studio:
```bash
cd render
npm run dev
```

## Project Architecture
- `config.json`: Master configuration (voice selection, word counts, retries).
- `logs/pipeline.log`: Master log file tracking execution and errors.
- `data/`: Ephemeral folder where intermediate JSON files, audio, and the final `.mp4` are stored.
