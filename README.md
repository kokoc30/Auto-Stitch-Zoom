# Auto-Stitch-Zoom

Auto-Stitch-Zoom is a web app for combining short vertical video clips into one final export.

It is built for a simple workflow:
upload clips, reorder them, apply one zoom/crop setting, process them, preview the result, and download the final MP4.

## Features

- Upload multiple clips
- Show clip thumbnails and metadata
- Drag and drop to reorder clips
- Apply one zoom setting across the full export
- Keep the output frame size intact
- Process clips with FFmpeg on the backend
- Preview the final merged video
- Download the final MP4

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend:** Node.js, TypeScript, Express, Multer
- **Video processing:** FFmpeg + ffprobe
- **Drag and drop:** `@dnd-kit`
- **Deployment:** Docker + Render (hosted browser-only profile) or local public share via ngrok / Cloudflare Tunnel

## Share locally

To run the full app on your own machine and expose it to a few trusted
friends through a public tunnel (ngrok, Cloudflare Tunnel, etc.), see
[docs/local-share.md](docs/local-share.md). Short version:
`npm run share:local` in one terminal, `npm run tunnel:ngrok` in another.

## Project Structure

```text
client/              Frontend app
server/              Backend API and FFmpeg pipeline
Dockerfile           Production container setup
.dockerignore        Docker build cleanup
start.ps1            Windows helper script
