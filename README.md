<<<<<<< HEAD
# Auto Stitch & Zoom Video App

A focused web app for creators who need to upload short clips, put them in order, apply one zoom/crop setting, and export a single final MP4.

This project is built as a React + Vite frontend with an Express + FFmpeg backend. The current deployment target is a Docker-based Render Web Service.

## What it does

- Upload multiple video clips
- Show thumbnails, duration, and resolution metadata
- Reorder clips with drag and drop
- Apply one global zoom value across the whole project
- Keep the chosen output frame size intact
- Process clips on the backend with FFmpeg
- Preview the final export in the browser
- Download the merged MP4

## Core features

- Multi-file upload for `.mp4`, `.mov`, and `.webm`
- Drag-and-drop clip ordering with `@dnd-kit`
- Default zoom set to `109%`
- Output resolution based on the first uploaded clip
- Mixed resolution / aspect ratio notice in the UI
- Processing progress updates through server-sent events
- Final preview and download routes served by Express
- Automatic stale-output reset when clips or zoom change

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Zustand
- Backend: Node.js, TypeScript, Express, Multer
- Video processing: FFmpeg + ffprobe
- Drag and drop: `@dnd-kit`
- Deployment: Docker, Render Web Service

## Project structure

```text
client/              React app
server/              Express API and FFmpeg pipeline
scripts/dev.mjs      Runs client and server together in dev
Dockerfile           Production container build
.dockerignore        Docker context cleanup
start.ps1            Windows helper for local startup
```

## Local setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Make sure FFmpeg is available

Local processing needs both `ffmpeg` and `ffprobe` on your `PATH`.

If they are installed somewhere custom, you can point the app to them with:

```bash
FFMPEG_BIN=/path/to/ffmpeg
FFPROBE_BIN=/path/to/ffprobe
```

On Windows PowerShell:

```powershell
$env:FFMPEG_BIN="C:\path\to\ffmpeg.exe"
$env:FFPROBE_BIN="C:\path\to\ffprobe.exe"
```

### 3. Run the app

From the project root:

```bash
npm run dev
```

That starts:

- frontend: Vite dev server on `http://localhost:5173`
- backend: Express server on `http://localhost:3001`

There is also a Windows helper script:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

## Build commands

Create the production builds:

```bash
npm run build
```

Run the built server locally:

```bash
npm --prefix server start
```

In production mode, the Express server serves the built frontend from `client/dist`.

## App workflow

1. Upload one or more clips.
2. Reorder them in the exact final sequence.
3. Leave zoom at `109%` or adjust it.
4. Start processing.
5. Wait for the backend to normalize, zoom, and merge the clips.
6. Preview the final result.
7. Download the finished MP4.

## Docker / deployment note

This repo includes a production Dockerfile that:

- builds the frontend and backend
- installs FFmpeg in the runtime image
- starts the Express server from `server/dist/server.js`
- serves the built frontend in production

Local Docker test:

```bash
docker build -t auto-stitch-zoom-video-app .
docker run --rm -p 3001:3001 auto-stitch-zoom-video-app
```

The app is set up for a Docker-based Render Web Service, not Vercel.

For Render, `PORT` is provided automatically. No extra environment variables are required for the default Docker setup.

## Important notes

- Processing uses local temp storage under `server/tmp/uploads`.
- On Render, that storage is ephemeral, so uploaded files and finished outputs do not persist across restarts or redeploys.
- The app is best deployed as a single instance right now because job state and temp files are local to the container.
- If you change the clip list or zoom, the previous output is intentionally cleared so preview/download never go stale.
- The first clip sets the output resolution for the final export.

## Screenshots

There are no real UI screenshots checked into the repo yet.

If you want to add them, place them in `docs/screenshots/` with names like:

- `docs/screenshots/main-app.png`
- `docs/screenshots/upload-order-workflow.png`
- `docs/screenshots/zoom-settings.png`
- `docs/screenshots/processing-preview-download.png`

## Possible next improvements

- Custom export filename
- Better automated tests
- Durable storage for cloud deployments
- More clip-level controls if the MVP grows later
=======
# Auto-Stitch-Zoom
Auto-stitch web app for uploading, reordering, zoom-cropping, merging, previewing, and downloading short vertical videos.
>>>>>>> 8a917fcb6e8a5a13b9e20d3f0e9fa3e9ce6557d8
