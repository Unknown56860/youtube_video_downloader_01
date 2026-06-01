# YouTube Bulk Video Downloader (Archived)

A simple UI for downloading YouTube videos/audio with merged or separate files.  
The backend extracts metadata using **yt‑dlp**; the frontend handles UI and progress.

---

## Description
- Downloads videos/audio from a YouTube URL.  
- Supports merging audio/video into one file or keeping them separate.  
- Shows storage estimate, progress bar, and notifications.  

> *Note: The project is archived; it may or may not work and if so, locally only.*

---

## Prerequisites
- Python 3.x (for virtual environment)  
- Node.js (for server)  

---

## Setup
```bash
# 1. Create a python venv in the project root
python -m venv .venv

# 2. Activate it
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install yt-dlp
pip install yt-dlp

# 4. Initialize Node project
cd server
npm init -y
npm install express cors child_process util
```

---

## Run
```bash
# Start the Express server
node server.js

# Open the UI (served via Live Server)
http://localhost:5500
```

---

## Notes
- All files are downloaded in `./server/downloads`.  
- No persistent storage; jobs disappear after completion.  
- Works only on localhost due to hard‑coded paths.