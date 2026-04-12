# Auto-Stitch-Zoom

Auto-Stitch-Zoom is a web app for combining short vertical video clips into one final export.

It is built for a simple workflow:
upload clips, reorder them, apply one zoom/crop setting, process them, preview the result, and download the final MP4.

## Prerequisites

Install these before cloning:

| Tool | Required | Notes |
|------|----------|-------|
| [Git](https://git-scm.com/) | Yes | To clone and update the repo |
| [Node.js](https://nodejs.org/) (v18+) | Yes | LTS recommended. npm is bundled with it |
| [FFmpeg](https://ffmpeg.org/) | Yes | Needed for server-side video processing. Includes ffprobe |
| [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) | No | Only needed if you want to share the app publicly |

**Installing FFmpeg on Windows:**

```powershell
winget install Gyan.FFmpeg
```

Or use `choco install ffmpeg` / `scoop install ffmpeg`.

## Getting started

### 1. Clone the repo

```powershell
git clone https://github.com/kokoc30/Auto-Stitch-Zoom.git
cd Auto-Stitch-Zoom
```

### 2. Run first-time setup

```powershell
.\setup.ps1
```

This checks prerequisites, installs all npm dependencies, and reports anything missing.
You only need to run this once after cloning. For future updates, `git pull` is enough.

### 3. Start the app

**For local use (dev mode with hot reload):**

```powershell
.\start.ps1
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

**To share it with other people (production mode + tunnel):**

Use two terminals:

```powershell
# Terminal 1 — build and serve the app
npm run start:prod
```

```powershell
# Terminal 2 — open a public tunnel
npm run tunnel:cloudflared
```

Share the `https://...trycloudflare.com` URL from Terminal 2 with your friends.

> Do not use `.\start.ps1` for public sharing — it runs the dev server which is not
> suitable for production. Use `npm run start:prod` instead.

## Features

- Upload multiple clips
- Show clip thumbnails and metadata
- Drag and drop to reorder clips
- Set a custom video title for the downloaded MP4
- Apply one zoom setting across the full export
- Keep the output frame size intact
- Process clips with FFmpeg on the backend or locally in the browser
- Preview the final merged video
- Download the final MP4

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend:** Node.js, TypeScript, Express, Multer
- **Video processing:** FFmpeg + ffprobe (server), FFmpeg WASM (browser)
- **Drag and drop:** `@dnd-kit`
- **Deployment:** Docker + Render (hosted browser-only profile) or local public share via Cloudflare Tunnel / ngrok

## Project Structure

```text
client/              Frontend app
server/              Backend API and FFmpeg pipeline
setup.ps1            First-time setup script
start.ps1            Local dev launcher
scripts/             Build, dev, tunnel, and share helpers
Dockerfile           Production container setup
.dockerignore        Docker build cleanup
```
