# DevByte Engine

## What This Is
A fully automated YouTube Shorts generation pipeline that turns
GitHub Trending repositories and tech news into short-form videos
without human intervention.

## Who Runs It
A single developer on a Windows 11 laptop. No team. No budget.

## Environment — SINGLE SOURCE OF TRUTH
- Python: 3.11
- Node.js: 18
- OS: Windows 11 (local), Ubuntu 22.04 (cloud, later)
- Package manager: pip for Python, npm for Node.js

## Hard Constraints
- Zero paid APIs. Only free tiers and open source tools.
- Must run overnight unattended on a local Windows machine.
- Each video must be under 60 seconds (target 35-40 seconds).
- Pipeline must not silently fail. Every error must be logged.
- No Docker. No complex infrastructure in V1.

## Core Output
One MP4 file (1080x1920, vertical) generated from real trending
data, with voiceover and synced subtitles, saved to /data/video.mp4

## Tech Stack
- Python 3.11 (scraping, LLM calls, TTS)
- Node.js 18 (orchestration, Remotion rendering)
- Gemini 1.5 Flash API (free tier, 15 RPM)
- edge-tts (Microsoft neural voices, no API key needed)
- Remotion 4.x (React-based video rendering)
- File-based storage in V1 (no database)
- FFmpeg (must be installed globally, required by Remotion)