# DevByte Engine V2 (Newsroom Automation)

An end-to-end automated YouTube Shorts pipeline that acts as a tech newsroom. It scrapes Hacker News, official company blogs, GitHub releases, and Product Hunt to find the highest signal product launches and engineering announcements. It evaluates them using Gemini as an AI Editor, writes engaging scripts, generates text-to-speech using Edge TTS, and renders premium aesthetic videos using Remotion.

## 🏗️ Architecture

The DevByte Engine follows a strict separation of concerns:

```mermaid
flowchart TD
    %% Generation Pipeline
    subgraph Newsroom Ingestion
        direction TB
        A1[GitHub Releases] --> N[Normalizer]
        A2[Product Hunt] --> N
        A3[Official Blogs] --> N
        A4[Hacker News] --> N
        
        N -->|Normalized Data| S[Signal Filter]
        S -->|High-Signal Candidates| Q[Quality Filter]
        Q -->|Valid Word Count| D[Deduplicator]
        D -->|Unique Stories| E[Gemini AI Evaluator]
    end

    subgraph Editorial Engine
        direction TB
        E -->|Scored Candidates| Ed[Editorial Engine]
        Ed -->|Source Diversity & Override| Queue[Content Queue]
    end
    
    subgraph Video Production
        direction TB
        Queue --> G[Gemini AI Scriptwriter]
        G --> T[Edge TTS]
        T --> R[Remotion Renderer]
        R -->|video.mp4| Out[(data/)]
    end

    %% Flow
    Newsroom Ingestion --> Editorial Engine
    Editorial Engine --> Video Production
```

## 📋 Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **[FFmpeg](https://ffmpeg.org/download.html)** (Ensure it is in your system PATH)
- **Google Gemini API Key** (For script generation and evaluation)
- **Google Cloud Console OAuth Credentials** (For YouTube publishing)

## 🛠️ Setup & Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/vishnu108shanker/Youtube-video-automation.git
   cd Youtube-video-automation
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Install Dependencies**
   ```bash
   # Python Dependencies
   pip install edge-tts google-generativeai requests beautifulsoup4 python-dotenv feedparser python-slugify
   pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
   
   # Node Dependencies (Root & Render)
   npm install
   cd render
   npm install
   cd ..
   ```

4. **YouTube API Credentials**
   - Go to the Google Cloud Console, enable the **YouTube Data API v3**, and set up an OAuth Consent Screen.
   - Create an **OAuth Client ID** (Desktop App type).
   - Download the JSON file, rename it to `client_secrets.json`, and place it in the project root.

---

## 🚀 Running the Engine

### The Generation Pipeline
To run the entire automation process from scraping to rendering a batch of videos:

```bash
npm run batch
```
*(This triggers Phase 1: Ingestion & Evaluation, followed by Phase 2: Batch Generation of up to 5 videos).*

### The Publishing Engine
Once videos are generated in the `data/` folder, run the publisher:
```bash
python services/upload.py
```
*(The first time you run this, a browser window will open to authenticate your Google Account. A `token.json` file will be saved for future runs. Videos are uploaded as **Private** by default).*

---

## 🎛️ Configuration & Editorial Sources

You can configure what the engine tracks without changing any code by editing the JSON files in the `sources/` directory:

- **`sources/official_feeds.json`**: Add any company RSS feed (e.g. OpenAI, Vercel, Supabase).
- **`sources/github_repos.json`**: Add any GitHub repository in `owner/repo` format to track its latest releases.
- **`sources/filters.json`**: Configure the whitelist for Hacker News and the global noise blacklist.
- **`editorial/editorial_policy.json`**: Tweak scoring weights (Freshness, Popularity, Quality) and thresholds.
- **`config.json`**: Master configuration (voice selection, timeouts, retries).

## 📂 Project Structure

- `collectors/`: Python scripts that fetch data from various sources (HN, Blogs, GitHub, PH).
- `ingestion/`: Normalization, Signal Filtering, and Deduplication logic.
- `evaluation/`: The Gemini AI evaluator and algorithmic scoring logic.
- `editorial/`: Selects the final candidates based on diversity and historical category distribution.
- `orchestrator/`: Node.js scripts (`run_pipeline.js`, `batch_generate_and_upload.js`) that control execution flow.
- `render/`: The React Remotion environment responsible for the visual engine.
- `logs/`: Master log files tracking execution and errors.
- `data/`: Ephemeral folder for intermediate JSON files, audio, and the final `.mp4` outputs.


### Running Modules Independently
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

**3. Render Pipeline**
```bash
python services/tts.py --input data/script.json --output data/audio.mp3
node services/render.js --input data/script.json --audio data/audio.mp3 --output data/video.mp4
```


To upload the already generatedd videos inddependently 
cd "c:/DEV/devilcode development/Devbyte-engine (youtube automation)"; python services/upload.py --video data/worker_0/video.mp4 --script data/worker_0/script.json
