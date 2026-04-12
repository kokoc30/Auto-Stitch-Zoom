# Local Public Share (via Tunnel)

This mode runs the **full** Auto Stitch & Zoom app on your own machine and
exposes it to a few trusted friends through a public HTTPS tunnel (ngrok,
Cloudflare Tunnel, or any reverse-tunnel provider). Server-mode processing
uses **your** CPU / RAM / disk; browser-mode processing still runs in the
visitor's browser. It is the opposite of the Render browser-only profile
described in [deployment.md](./deployment.md).

> **Share with trusted users only.** This mode adds no authentication. Anyone
> with the tunnel URL can upload clips and start server-side jobs on your
> machine. Treat it like sharing your desktop.

## What it does

- Runs `npm run start:prod` locally (builds client + server, starts Express
  on `PORT=3001` by default with `NODE_ENV=production`).
- You separately run a tunnel provider (ngrok / cloudflared) that forwards
  its public HTTPS URL to `http://localhost:3001`.
- Visitors open the public URL, the SPA loads, and every API / SSE / preview
  / download / ffmpeg asset URL resolves **relative to the tunnel origin**,
  so nothing has to be reconfigured in the client build.
- Processing-mode choice is unchanged:
  - **Browser** mode → user's device runs ffmpeg.wasm
  - **Server** mode → **your machine** runs native ffmpeg
  - **Auto** → picks per job using the caps in
    [client/src/features/processing/browser-capability.ts](../client/src/features/processing/browser-capability.ts)

`HOSTED_BROWSER_ONLY` must **not** be set in this mode. `share:local` refuses
to start if it is.

## One-time setup

1. Install a tunnel CLI on your PATH. Either works:
   - **ngrok** — <https://ngrok.com/download>, then run
     `ngrok config add-authtoken <your-token>` once. Your token lives in
     ngrok's own config file, never in this repo.
   - **cloudflared** — <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>.
     The `tunnel --url` quick-mode used below does not need a Cloudflare
     account.
2. From the repo root: `npm run install:all` (first time only).

## Run it

Two terminals from the repo root:

```bash
# Terminal 1 — build + start the full-profile server locally
npm run share:local
```

Wait for the banner:

```
================================================================
 Auto Stitch & Zoom — local share mode (full profile)
================================================================
 Local URL:          http://localhost:3001
 Health check:       http://localhost:3001/health
 Bind:               0.0.0.0:3001
 Processing modes:   Browser + Server + Auto (all enabled)
                     Server jobs run on THIS machine.
 ...
```

Then:

```bash
# Terminal 2 — expose it publicly
npm run tunnel:ngrok
# or
npm run tunnel:cloudflared
```

The tunnel CLI prints the public HTTPS URL (e.g.
`https://abcd-1234.ngrok-free.app` or
`https://something.trycloudflare.com`). Share that URL with your friends.

### Changing the port

```bash
PORT=4000 npm run share:local
# in the other terminal, PORT must match:
PORT=4000 npm run tunnel:ngrok
```

The tunnel wrapper rejects invalid / out-of-range `PORT` values up front.

### Echoing the public URL in the banner (optional)

If you want the `share:local` banner to echo the tunnel URL back at you (so
you can paste-test it), set `PUBLIC_BASE_URL` (or `APP_ORIGIN`) before
starting:

```bash
PUBLIC_BASE_URL=https://abcd-1234.ngrok-free.app npm run share:local
```

This is **purely operator-facing messaging**. It is never baked into the
client bundle and never used to construct URLs — the app stays
tunnel-portable regardless of what you set here.

## Verify

From any machine (or your own phone on cellular, to prove it's really public):

```bash
curl https://<your-tunnel-url>/health
```

Expected:

```json
{
  "status": "ok",
  "message": "Auto Stitch & Zoom API running",
  "mode": "full",
  "serverProcessing": true,
  "version": 1
}
```

If `mode` is not `"full"` or `serverProcessing` is `false`, you accidentally
have `HOSTED_BROWSER_ONLY=true` set — unset it and restart.

## Manual smoke checklist (through the tunnel)

1. Open the public URL. The SPA loads with no console errors.
2. DevTools → Console: `crossOriginIsolated` prints `true` (COOP/COEP headers
   propagate through ngrok and cloudflared out of the box).
3. Upload one small clip, choose **Server** mode, Start. Status events
   stream (SSE), preview URL plays, download URL saves the MP4.
4. Reset, upload a small clip, choose **Browser** mode, Start. ffmpeg.wasm
   loads from `/ffmpeg/esm/ffmpeg-core.wasm` (served same-origin through the
   tunnel), the blob-URL preview plays.
5. Reset, choose **Auto**, upload a clip within the caps — it should route
   to browser. Upload one over the caps — it should route to server.

## Other tunnel providers

Any reverse-tunnel that forwards HTTPS to `http://localhost:3001` will work,
because the app uses relative URLs and same-origin static hosting end to
end. The two scripts in `package.json` (`tunnel:ngrok`, `tunnel:cloudflared`)
are thin wrappers around [scripts/tunnel.mjs](../scripts/tunnel.mjs) — add a
new entry to the `PROVIDERS` map there if you want to wire another CLI.

## Security caveats

- **No authentication is added by this mode.** The tunnel URL is effectively
  a public upload + processing endpoint. Share only with people you trust
  not to burn your CPU or upload something you wouldn't want on your disk.
- **Your computer must stay on and connected.** If your machine sleeps, the
  app dies; if the tunnel agent dies, the URL 502s.
- **Uploads and job artifacts land in `server/tmp/uploads/`** on your local
  filesystem. Clean up periodically.
- **Server mode uses your CPU / RAM / disk.** A large or malicious job can
  saturate your machine. Keep the cap constants in
  [server/src/config/video-processing.config.ts](../server/src/config/video-processing.config.ts)
  and [browser-capability.ts](../client/src/features/processing/browser-capability.ts)
  in mind.
- **Free ngrok tunnels rotate.** The public hostname changes each time you
  restart `ngrok http`. Reserved domains or Cloudflare Tunnel named tunnels
  are the fix if you need a stable URL.
- **CORS is wide-open** (`cors()` in [server/src/app.ts](../server/src/app.ts)).
  That is correct for local-share mode — the tunnel host is unpredictable —
  but it means any origin can call `/api/*` through your tunnel. Another
  reason to treat the URL as trusted-only.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Public URL loads HTML but `/api/*` 404s | You ran `npm run dev` instead of `npm run share:local`. Dev mode needs Vite's proxy and is not the share path — rebuild with `share:local`. |
| `share:local` exits with "Refusing to start: HOSTED_BROWSER_ONLY=true" | Exactly what it says. Unset `HOSTED_BROWSER_ONLY` and `VITE_HOSTED_BROWSER_ONLY` in your shell. |
| `/health` returns `mode: "hosted-browser-only"` | Same as above — your env still has the flag set. |
| `ERR_NGROK_*` / "account not found" / "authtoken required" | ngrok CLI account issue, not an app issue. Run `ngrok config add-authtoken <token>` and retry. |
| SSE job status freezes through the tunnel | Some tunnel providers buffer `text/event-stream`. We already send `X-Accel-Buffering: no` ([process.routes.ts](../server/src/routes/process.routes.ts)). ngrok and cloudflared both stream SSE cleanly by default. |
| Browser mode button greyed out through the tunnel | `crossOriginIsolated` is `false` — a COOP/COEP header is being stripped somewhere. Check `curl -sI https://<tunnel>/` for the two headers. |
| Public URL works but `/ffmpeg/esm/ffmpeg-core.wasm` is 404 | The client prebuild didn't run. Re-run `npm run share:local` (it rebuilds every start). |
| "Port in use" from `share:local` | Something else is on `3001`. Set `PORT=<free>` on **both** the `share:local` and the `tunnel:*` command. |

## Dev-mode tunneling (advanced, not recommended)

If you specifically want to share the Vite dev server (hot reload) rather
than a production build, Vite blocks unknown Host headers by default. Allow
your tunnel host:

```bash
VITE_DEV_ALLOWED_HOSTS=abcd-1234.ngrok-free.app npm run dev
```

Then tunnel `5173` (client) and `3001` (server) separately, or write a
custom proxy. This is brittle because the tunnel host changes; the
production build path above is almost always the right choice.
