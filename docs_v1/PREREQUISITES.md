# Prerequisites — One Canonical Setup Path

Complete every step in order before writing any code.
Each step has a verification command. Do not proceed until it passes.

---

## Step 1 — Python 3.11

Install: https://www.python.org/downloads/release/python-3110/
Check "Add to PATH" during installation.

Verify:
python --version
Expected: Python 3.11.x

---

## Step 2 — Node.js 18

Install: https://nodejs.org/en/blog/release/v18.0.0
Use the LTS installer for Windows.

Verify:
node --version
Expected: v18.x.x

npm --version
Expected: 8.x.x or higher

---

## Step 3 — FFmpeg (Required by Remotion)

Install via winget:
winget install ffmpeg

Or download manually: https://ffmpeg.org/download.html
Add to PATH manually if using manual install.

Verify:
ffmpeg -version
Expected: ffmpeg version 6.x or higher

---

## Step 4 — edge-tts

pip install edge-tts

Verify:
edge-tts --version
Expected: edge-tts x.x.x

Quick audio test:
edge-tts --text "Pipeline test successful" --voice en-US-ChristopherNeural --write-media test.mp3
Open test.mp3 and listen. Delete after test.

---

## Step 5 — Gemini API Key

1. Go to https://aistudio.google.com
2. Sign in with Google account
3. Click "Get API Key" → "Create API key"
4. Copy the key

Create .env file in project root:
GEMINI_API_KEY=your_key_here

Install python-dotenv:
pip install python-dotenv google-generativeai requests beautifulsoup4

Verify:
python -c "import google.generativeai; print('Gemini OK')"
Expected: Gemini OK

---

## Step 6 — Node Dependencies

From project root:
npm init -y
npm install axios dotenv music-metadata

Verify:
node -e "require('axios'); console.log('Node deps OK')"
Expected: Node deps OK

Note: mongoose and node-cron are NOT installed in V1.
mongoose → added in V2 when MongoDB is introduced.
node-cron → added in V5 when Railway scheduling is introduced.
For V1, scheduling is handled by Windows Task Scheduler only.

---

## Step 7 — Remotion

From /render directory:
npm create video@latest
Choose: blank template
Choose: TypeScript

Verify:
npx remotion studio
Expected: Browser opens with Remotion studio at localhost:3000

---

## Step 8 — Folder Structure

Run this from project root to create all required folders:

mkdir orchestrator sources services utils data logs render

Verify full structure matches ARCHITECTURE.md exactly.

---

## Step 9 — Preflight Check

Before starting Day 1 coding, verify all of these pass in PowerShell:

python --version
Expected: Python 3.11.x

node --version
Expected: v18.x.x

ffmpeg -version
Expected: ffmpeg version 6.x

edge-tts --version
Expected: edge-tts x.x.x

$env:GEMINI_API_KEY
Expected: your key printed (not empty, not blank line)

Test-Path data
Expected: True

Test-Path logs
Expected: True

All seven must pass. If any fails, fix it before opening your coding agent.

---

## config.json Starting Template

Create this file in project root before Day 1 Hour 1:

{
  "source": "github",
  "tts_voice": "en-US-ChristopherNeural",
  "max_word_count": 95,
  "max_retries": 2,
  "subprocess_timeout_seconds": 30,
  "output_dir": "./data"
}