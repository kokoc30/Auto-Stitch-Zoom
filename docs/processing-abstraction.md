# Processing Abstraction

## Architecture

A `Processor` interface abstracts the processing lifecycle. The store delegates to a processor instance instead of managing API calls directly.

### Processor Interface

```
Processor {
  mode: ProcessingMode          // 'server' | 'browser' | 'auto'
  start(clips, options, onProgress) -> Promise<ProcessingOutput>
  abort()                       // cancel in-progress work
  dispose()                     // release resources
}
```

- `start()` returns a Promise that resolves with `{ previewUrl, downloadUrl }` on success
- Progress updates are delivered via the `onProgress` callback
- Output URLs are opaque strings — server paths for server mode, blob: URLs for browser mode

### Processing Modes

| Mode | Status | Behavior |
|------|--------|----------|
| `server` | Active | Full implementation via backend FFmpeg |
| `browser` | Active | Local processing via ffmpeg.wasm in the browser |
| `auto` | Active | Routes to browser or server based on workload and capability |

The mode defaults to `server` and is persisted in localStorage. All three modes are supported.

### Factory

`createProcessor(mode)` returns the appropriate `Processor` implementation:
- `server` → `ServerProcessor`
- `browser` → `BrowserProcessor`
- `auto` → `AutoProcessor` (delegates to browser or server at start time)

---

## Server Mode

`ServerProcessor` wraps the backend processing pipeline:
1. Calls `POST /api/process` with clip filenames and options
2. Opens SSE stream on `GET /api/job/:jobId/status`
3. Forwards parsed SSE events to the `onProgress` callback
4. Resolves with server preview/download URLs on `done`
5. Rejects on `error` or connection loss

An `aborted` flag guards against late SSE events after `abort()` is called.

---

## Browser Mode

`BrowserProcessor` processes clips locally using ffmpeg.wasm.

### Runtime Loading

The ffmpeg.wasm core (~30 MB WASM binary) is loaded lazily on the first `start()` call and cached for subsequent runs. Core files are fetched from unpkg CDN using `toBlobURL` to comply with cross-origin isolation requirements.

**Requirement:** The page must be served with Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers. Without these, `SharedArrayBuffer` is unavailable and ffmpeg.wasm cannot load.

### Processing Pipeline

Mirrors the server pipeline:
1. **Validate** — Checks all clip File refs exist, writes files to ffmpeg's virtual filesystem
2. **Resolve** — Calculates output resolution and zoom crop parameters
3. **Process clips** — Normalizes each clip: scale, center-crop, fps, and codec conversion
4. **Merge** — Concatenates normalized clips (stream-copy, fallback to re-encode)
5. **Output** — Reads output from virtual FS, creates blob URL

### Encoding Settings

| Parameter | Server | Browser |
|-----------|--------|---------|
| CRF | 18 | 23 |
| Audio bitrate | 192k | 128k |
| Acceleration | CPU / GPU | WASM (CPU only) |

Browser mode uses slightly relaxed quality settings to reduce memory pressure in WASM.

### Upload Behavior

In browser mode, clips are **not uploaded to the server**. Metadata (duration, width, height) is extracted locally from File objects using a `<video>` element. File references are stored in a module-level map (`file-store.ts`) for BrowserProcessor to read at processing time.

### Blob URL Lifecycle

All blob URLs created for browser-mode output are tracked by `blob-url-manager.ts`. They are revoked when:
- A new processing run replaces old output
- The user clears clips or resets processing
- Clip reorder, zoom, or settings changes invalidate output
- The processor is disposed

### Known Limitations

- **No crossfade transitions** — Browser mode blocks processing when transitions are enabled with multiple clips. The user is prompted to disable transitions or switch to server mode.
- **Conservative workload limits** — Auto mode routes to server for > 3 clips, > 100 MB total, or > 30 seconds total duration.
- **No file persistence** — File refs are in-memory only. After a page refresh, clips appear in the list but processing requires re-upload.
- **CDN dependency** — ffmpeg.wasm core files are loaded from unpkg. Self-hosting is deferred.
- **Single-threaded** — ffmpeg.wasm runs single-threaded in a Web Worker.

---

## Auto Mode

`AutoProcessor` resolves the target mode at processing time by calling `resolveAutoMode(clips, options)`.

### Routing Criteria

All checks must pass for browser mode:

| Check | Threshold | Rationale |
|-------|-----------|-----------|
| Cross-origin isolation | `crossOriginIsolated === true` | Required for SharedArrayBuffer |
| Clip count | ≤ 3 | Memory pressure in WASM |
| Total file size | ≤ 100 MB | Memory pressure |
| Total duration | ≤ 30 seconds | Processing time |
| Transitions | disabled (or single clip) | Not supported in browser mode |

If any check fails, auto mode routes to server with a human-readable reason.

---

## File Store

`file-store.ts` maintains a `Map<string, File>` mapping clip IDs to original File objects. Files are not serializable, so they live outside Zustand state.

- **Browser mode**: `createLocalClipItems()` stores File refs during local metadata extraction
- **Auto mode**: `UploadArea` stores File refs alongside the server upload so browser fallback works
- **Server mode**: No File refs stored (clips reference server-assigned filenames)

---

## Key Files

- `client/src/features/processing/processing-mode.ts` — Mode type, persistence, supported-mode guard
- `client/src/features/processing/processor.ts` — Interface, output type, factory, AutoProcessor
- `client/src/features/processing/server-processor.ts` — Server implementation
- `client/src/features/processing/browser-processor.ts` — Browser implementation (ffmpeg.wasm)
- `client/src/features/processing/browser-capability.ts` — Capability detection, auto-mode routing
- `client/src/features/processing/blob-url-manager.ts` — Blob URL lifecycle management
- `client/src/features/processing/file-store.ts` — File object reference store
- `client/src/features/processing/processing.api.ts` — Low-level API helpers (unchanged)
- `client/src/features/uploads/local-metadata.ts` — Browser-side video metadata extraction
- `client/src/store/useClipStore.ts` — Store delegates to processor, manages cleanup

## What Remains for Future Hardening

- Crossfade transition support in browser mode
- Self-hosted ffmpeg.wasm core files (remove CDN dependency)
- Multi-threaded ffmpeg.wasm for faster processing
- Relaxed workload limits after memory profiling
- File persistence across page refresh (IndexedDB or similar)
- Playwright end-to-end tests for browser-mode processing
