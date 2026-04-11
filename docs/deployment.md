# Deployment Guide

This guide covers deploying Auto Stitch & Zoom to a real hosted environment.
Both server-mode processing (backend FFmpeg) and browser-mode processing
(ffmpeg.wasm) must work in the hosted build — browser mode in particular has
hard requirements that a generic Node host will not satisfy by default.

## Production requirements

1. **Node.js 20+** (Dockerfile uses `node:20-bookworm-slim`).
2. **FFmpeg** available on `PATH` for server-mode processing. The Dockerfile
   installs the Debian `ffmpeg` package in the runtime stage.
3. **Cross-origin isolation headers** (`Cross-Origin-Opener-Policy: same-origin`
   and `Cross-Origin-Embedder-Policy: require-corp`) on every response.
   Browser mode cannot run without these — `globalThis.crossOriginIsolated`
   must be `true`, which requires both headers.
4. **Same-origin static hosting** for the SPA, `/uploads`, `/api`, and the
   self-hosted `/ffmpeg/` runtime assets. No third-party CDN fetches are
   allowed in the hot path because `require-corp` will block them.

Everything above is handled out of the box by this repo's production path:
`npm run start:prod` runs the client prebuild (copies ffmpeg.wasm core from
`node_modules` into `client/public/ffmpeg/`), builds both halves, and starts
the Express server with `NODE_ENV=production`, which:

- Sets COOP/COEP middleware before all routes ([`server/src/app.ts`](../server/src/app.ts)).
- Serves the built SPA from `client/dist` with an SPA fallback.
- Serves `client/dist/ffmpeg/*` same-origin, so the ffmpeg.wasm core binary
  loads cleanly under `require-corp`.

## Docker build

```bash
docker build -t auto-stitch-zoom .
docker run --rm -p 3001:3001 auto-stitch-zoom
```

Then open `http://localhost:3001`.

The image installs ffmpeg, runs the full build (including the ffmpeg.wasm
asset copy step), and starts the compiled server. Uploaded clips live under
`/app/server/tmp/uploads` inside the container; mount a volume if you want
persistence across restarts.

## Render deployment

The repo ships a `render.yaml` that deploys the Docker image directly:

```yaml
services:
  - type: web
    name: auto-stitch-zoom
    runtime: docker
    dockerfilePath: ./Dockerfile
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3001"
```

Create a new **Blueprint** in Render pointed at this repo. Render will use
the Dockerfile and `/health` for health checks. The `/health` endpoint is
implemented at [`server/src/app.ts`](../server/src/app.ts) and returns a
JSON `{ status: "ok" }` payload.

## How ffmpeg.wasm is self-hosted

Browser mode uses `@ffmpeg/ffmpeg` + `@ffmpeg/core`. Loading the core from a
public CDN does not work under `Cross-Origin-Embedder-Policy: require-corp`
unless the CDN reliably sends `Cross-Origin-Resource-Policy: cross-origin` —
which `unpkg` does not.

To avoid this, the core assets are bundled with the app:

1. `@ffmpeg/core@0.12.6` is pinned as a client devDependency.
2. `client/package.json` runs [`scripts/copy-ffmpeg-core.mjs`](../scripts/copy-ffmpeg-core.mjs)
   as a `prebuild` step. It copies every file from
   `node_modules/@ffmpeg/core/dist/{esm,umd}/` into
   `client/public/ffmpeg/{esm,umd}/`.
3. Vite then publishes those files to `client/dist/ffmpeg/` during build.
4. Express serves them as static same-origin assets.
5. [`browser-processor.ts`](../client/src/features/processing/browser-processor.ts)
   loads them via `/ffmpeg/esm/ffmpeg-core.js` and `/ffmpeg/esm/ffmpeg-core.wasm`.

The ESM build is required: `@ffmpeg/ffmpeg@0.12.x` spawns its internal worker
with `type: "module"`, so `importScripts` is not available and the worker
falls back to dynamic `import()` of the core script. Dynamic ESM import
only works with the ESM distribution — pointing at the UMD build surfaces
as `failed to import ffmpeg-core.js`. The copy script brings both `esm/`
and `umd/` for completeness. `@ffmpeg/core@0.12.6` is the single-threaded
build, so no worker file is required.

`client/public/ffmpeg/` is `.gitignore`d — the ~32MB WASM binary is
generated at build time, not tracked in git.

## Auto-mode decision logic in production

`Auto` picks between browser and server based on:

- `crossOriginIsolated` must be `true`.
- Reachability of `/ffmpeg/ffmpeg-core.wasm` (HEAD probe, cached on success).
- Workload caps: up to 3 clips, 100 MB total, 30 seconds total duration.
- No crossfade transitions (browser mode does not implement them yet).

If any check fails, auto falls back to server with a human-readable reason.
See [`browser-capability.ts`](../client/src/features/processing/browser-capability.ts)
for the full policy.

## Browser-mode limitations

- No crossfade transitions — enable transitions and auto falls back to
  server. Manually selecting browser mode while transitions are on is blocked
  by `getStartValidationMessage`.
- Workload caps above keep browser mode fast and prevent OOM in low-memory
  tabs. Exceeding them routes to server instead.
- Large single files still require buffering into WASM memory — keep test
  clips small for browser-mode smoke tests.

## Smoke test checklist (hosted URL)

1. Open the hosted URL.
2. DevTools → Network → reload. Confirm the HTML response carries
   `Cross-Origin-Opener-Policy: same-origin` and
   `Cross-Origin-Embedder-Policy: require-corp`.
3. DevTools → Console: `crossOriginIsolated` prints `true`.
4. Settings panel → **Browser** mode button is enabled (not greyed out).
5. Upload a tiny clip in **Server** mode, process, confirm preview + download.
6. Switch to **Browser** mode, upload a small clip, process, confirm output
   URL starts with `blob:`.
7. Switch to **Auto**, upload a small clip, confirm browser routing. Upload a
   clip exceeding the caps and confirm it routes to server.
8. Reorder/zoom/transition toggle after a finished run — the preview and
   download sections should disappear and require a fresh run.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Browser-mode button greyed out in production | COOP/COEP headers missing — check Express middleware or a reverse proxy stripping headers. |
| `crossOriginIsolated === false` in console | Same as above, or a third-party iframe/script on the page is leaking a non-isolated embed. |
| Browser mode fails at "Loading browser video engine..." | `/ffmpeg/ffmpeg-core.wasm` is 404 — the prebuild copy step did not run. Rebuild. |
| `cross-origin resource blocked` errors in console | Something is being fetched from a different origin without CORP. All assets must be same-origin. |
| Server mode fails with `ffmpeg: command not found` | Runtime image is missing ffmpeg. Confirm the runtime stage of the Dockerfile installs it. |

## Docker smoke test

Run this sequence against a freshly built image to confirm the container
actually serves what the app needs. All commands run from the repo root.

```bash
# 1. Build and run
docker build -t auto-stitch-zoom .
docker run -d --rm --name asz -p 3001:3001 auto-stitch-zoom
docker logs asz              # look for "Server started" and preflight lines

# 2. Health + isolation headers + ffmpeg assets
curl -fsS  http://localhost:3001/health
curl -sI   http://localhost:3001/                             | grep -i cross-origin
curl -sI   http://localhost:3001/ffmpeg/esm/ffmpeg-core.js    | grep -i '200\|cross-origin'
curl -sI   http://localhost:3001/ffmpeg/esm/ffmpeg-core.wasm  | grep -i '200\|content-length'

# 3. Reuse the existing Playwright suite against the running container.
#    playwright.config.ts has reuseExistingServer:!CI, so the config's
#    webServer block is skipped when :3001 is already bound.
npx playwright test e2e/isolation-headers.spec.ts
npx playwright test e2e/server-mode.spec.ts
npx playwright test e2e/browser-mode.spec.ts
npx playwright test e2e/auto-mode.spec.ts

# 4. Cleanup
docker stop asz
```

Expected: `/health` returns `{"status":"ok",...}`; every response carries
`cross-origin-opener-policy: same-origin` and
`cross-origin-embedder-policy: require-corp`; `ffmpeg-core.wasm` returns 200
with a ~30 MB `content-length`; all four Playwright specs pass.

Note: `server/tmp/uploads` is ephemeral inside the container. Attach a
persistent disk on Render (or a Docker volume locally) if you need uploads
and job artifacts to survive restarts.
