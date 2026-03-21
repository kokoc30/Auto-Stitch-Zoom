# Auto Stitch & Zoom Video Web App — Implementation Plan

## 1. Purpose
This document translates the product requirements into an implementation strategy for development inside VS Code with an AI coding agent such as Claude Code.

It is written to support:
- iterative implementation,
- clean architecture,
- clear technical choices,
- low-risk MVP delivery,
- future extensibility.

This plan assumes the product goal is:

- upload multiple short video clips,
- drag-and-drop reorder them,
- apply a global zoom value (default 109%),
- concatenate them into one final video,
- preserve chosen output frame resolution,
- preview and download the final result.

---

## 2. Recommended MVP Architecture

## Recommended Architecture Choice
For the MVP, the best practical architecture is:

**Frontend UI + Backend processing service**

### Why this is the best choice
A pure browser/client-only approach using `ffmpeg.wasm` can work, but it has important weaknesses:
- heavy CPU and memory usage in the browser
- slower performance for larger files
- potential browser crashes
- inconsistent performance across devices
- worse developer ergonomics for reliable export handling

A backend processing service using native FFmpeg is more professional for this workflow because:
- more stable
- faster
- easier to debug
- easier to control codecs/resolution/export settings
- easier to support larger clip sets later
- easier to extend for future features

### Final recommendation
Use:
- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + TypeScript + Express (or Fastify)
- **Processing engine:** native FFmpeg installed on the machine/server
- **Drag-and-drop:** `@dnd-kit`
- **Uploads:** multipart upload via frontend to backend
- **Preview:** browser video elements using object URLs / served files
- **Storage:** temporary local storage for uploaded and processed files

---

## 3. Suggested Tech Stack

## Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- `@dnd-kit/core` and `@dnd-kit/sortable`
- `react-hook-form` (optional, for settings)
- `zustand` or React context/state for lightweight app state

## Backend
- Node.js
- TypeScript
- Express or Fastify
- `multer` for file uploads
- `fluent-ffmpeg` or direct FFmpeg CLI execution
- `ffprobe` for metadata extraction
- `uuid` for job/folder naming
- `fs/promises` for file management

## Processing
- Native FFmpeg binary
- ffprobe for:
  - duration
  - resolution
  - codec info
  - frame rate if needed

## Development Utilities
- ESLint
- Prettier
- tsx / nodemon
- concurrently (if running frontend and backend together)
- dotenv for environment variables

---

## 4. Why Not Use Browser-Only FFmpeg for MVP
A browser-only build with `ffmpeg.wasm` may sound attractive because it avoids a backend, but for this project the professional recommendation is to avoid it for the first version.

### Main reasons
- video stitching and scaling are CPU-heavy
- large browser memory usage
- poor performance on lower-end machines
- harder to provide stable export/download behavior
- more friction when debugging resolution and codec problems

### Future option
A browser-only version can be explored later as a second deployment mode, but not as the main first implementation.

---

## 5. Core MVP Technical Decisions

## Decision 1 — Output Resolution Rule
### Recommendation
For MVP:
- if all uploaded clips share the same frame size, use that automatically
- if clips differ, default to the **first clip’s resolution** and warn the user
- allow future enhancement later for custom resolution selection

### Why
This keeps the MVP simple and deterministic.

---

## Decision 2 — Zoom Behavior
### Recommendation
Implement zoom as:
- scale the frame uniformly from center
- crop overflow to fill output frame
- no black bars introduced by zoom
- apply the same zoom to all clips

### Example
109% means:
- scale video to 1.09
- center-crop to output width/height

---

## Decision 3 — Export Format
### Recommendation
- output container: `.mp4`
- H.264 video codec
- AAC audio codec when audio exists
- yuv420p pixel format for compatibility

### Why
This is broadly compatible for social upload and easy playback.

---

## Decision 4 — Audio Handling
### MVP Recommendation
- concatenate source audio as-is if audio exists
- keep audio simple in MVP
- do not add audio editing UI initially

### Note
If clips have no audio, final output can be silent.

---

## Decision 5 — Mixed Aspect Ratios / Resolutions
### MVP Recommendation
- detect mismatch
- show warning
- normalize all clips to chosen output frame
- center-fit / crop consistently according to app rules

---

## Decision 6 — Job Storage
### Recommendation
Use a temporary per-job folder structure:

- `/tmp/uploads/<job-id>/originals`
- `/tmp/uploads/<job-id>/processed`
- `/tmp/uploads/<job-id>/output`

Later add cleanup logic after job completion or expiry.

---

## 6. Suggested Project Structure

```text
project-root/
  client/
    src/
      app/
      components/
      features/
        uploads/
        clip-list/
        settings/
        processing/
        preview/
      hooks/
      lib/
      styles/
      types/
      utils/
    index.html
    package.json
    tsconfig.json
    vite.config.ts

  server/
    src/
      app.ts
      server.ts
      routes/
        upload.routes.ts
        process.routes.ts
        download.routes.ts
        preview.routes.ts
      controllers/
      services/
        upload.service.ts
        metadata.service.ts
        processing.service.ts
        ffmpeg.service.ts
        concat.service.ts
        zoom.service.ts
        cleanup.service.ts
      utils/
      types/
      config/
    package.json
    tsconfig.json

  docs/
    auto-stitch-zoom-video-app-requirements.md
    implementation-plan.md

  package.json
  README.md
```

---

## 7. Module Responsibilities

## Frontend Modules

### Upload Module
Responsible for:
- selecting files
- validating file type at UI level
- uploading files to backend
- displaying initial clip cards

### Clip List Module
Responsible for:
- showing uploaded clips
- drag-and-drop reordering
- remove clip action
- clip numbering

### Settings Module
Responsible for:
- zoom input
- reset-to-default (109%)
- future export settings

### Processing Module
Responsible for:
- start button
- loading state
- progress state
- error handling
- triggering processing request

### Preview Module
Responsible for:
- clip preview
- final output preview
- final video player

### Download Module
Responsible for:
- download button
- download URL
- output filename handling

---

## Backend Modules

### Upload Service
Responsible for:
- receiving uploaded files
- saving them safely
- creating job folders
- returning file metadata

### Metadata Service
Responsible for:
- ffprobe inspection
- duration
- resolution
- codec detection
- validation support

### Processing Service
Responsible for:
- orchestration of full job
- ordering clips
- resolution normalization
- zoom scaling/cropping
- concatenation
- export path return

### FFmpeg Service
Responsible for:
- raw FFmpeg command building
- ffprobe integration
- stderr/stdout handling
- processing errors

### Cleanup Service
Responsible for:
- temporary file cleanup
- removing stale jobs
- future scheduled cleanup

---

## 8. Recommended FFmpeg Processing Strategy

## Step-by-Step Processing Flow
When the user presses **Start**:

1. Validate job state
2. Read clip order from frontend
3. Resolve output frame size
4. For each clip:
   - inspect metadata
   - normalize dimensions if needed
   - apply zoom scale
   - crop to output frame
   - encode into intermediate normalized clip
5. Concatenate normalized clips into final output
6. Return final file URL / download route

## Recommended Intermediate Strategy
Do **not** concatenate raw mismatched clips directly.

Instead:
- preprocess each clip into a normalized intermediate format
- then concatenate those intermediates

### Why
This reduces concat failures and makes the pipeline more reliable.

---

## 9. FFmpeg Logic Recommendation

## Zoom Filter Concept
For each clip, use a filter chain conceptually like:

1. scale up by zoom factor
2. crop center to target width/height
3. set output pixel format / codec-compatible output

### Example logic
If output frame is `1080x1920` and zoom is `1.09`, conceptually:
- scale input to `iw*1.09 : ih*1.09`
- crop center to `1080:1920`

Final exact FFmpeg command should be implemented carefully by the agent.

---

## 10. API Design Recommendation

## Basic Endpoints

### `POST /api/upload`
Uploads one or more video files.

**Returns**
- job ID
- uploaded clip list
- metadata per clip

### `POST /api/process`
Starts processing using:
- job ID
- ordered clip IDs
- zoom setting
- output settings

**Returns**
- processing status
- final output path or output token when complete

### `GET /api/job/:jobId`
Returns:
- job status
- uploaded clips
- metadata
- processing state
- output availability

### `GET /api/download/:jobId`
Downloads final file.

### `GET /api/preview/:jobId`
Optional endpoint for preview streaming.

---

## 11. Frontend State Model

## Suggested State Shape
```ts
type ClipItem = {
  id: string;
  filename: string;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  thumbnailUrl?: string;
};

type AppState = {
  jobId: string | null;
  clips: ClipItem[];
  zoomPercent: number; // default 109
  processingStatus: "idle" | "uploading" | "ready" | "processing" | "done" | "error";
  outputUrl: string | null;
  errorMessage: string | null;
};
```

---

## 12. Suggested Implementation Order for Claude Code

## Phase 1 — Foundation
1. Initialize project structure
2. Set up frontend React + TypeScript + Tailwind
3. Set up backend Node + TypeScript + Express
4. Add shared lint/format tooling

## Phase 2 — Upload and UI
5. Build UI shell
6. Implement multi-file upload
7. Save uploads to backend temp folders
8. Return clip metadata
9. Build clip list UI

## Phase 3 — Ordering and Settings
10. Implement drag-and-drop ordering
11. Implement zoom settings panel
12. Add remove/reset controls
13. Add validation states

## Phase 4 — Processing
14. Build metadata inspection service
15. Build FFmpeg service
16. Implement resolution selection rule
17. Implement per-clip zoom normalization
18. Implement clip concatenation
19. Return final output file

## Phase 5 — Preview and Download
20. Build final output preview
21. Build download route/button
22. Add completion and error UI

## Phase 6 — Hardening
23. Improve logging
24. Add mixed-resolution warning
25. Add cleanup service
26. Improve architecture / refactor

---

## 13. Requirement-to-Implementation Mapping

### Requirement 1
Maps to:
- initial frontend shell
- page layout
- backend health route

### Requirement 2
Maps to:
- upload form
- upload endpoint
- multer configuration

### Requirement 3
Maps to:
- clip card component
- metadata display

### Requirement 4
Maps to:
- sortable list UI
- ordered state sync

### Requirement 5
Maps to:
- settings store
- zoom validation
- reset control

### Requirement 6
Maps to:
- metadata inspection
- output frame resolver

### Requirement 7
Maps to:
- processing pipeline orchestration
- FFmpeg normalization
- concat job

### Requirement 8
Maps to:
- processing state UI
- backend job status handling

### Requirement 9
Maps to:
- output route
- download button
- downloadable response headers

---

## 14. Key Risks and Mitigations

## Risk 1 — Browser crashes if processing is client-side
### Mitigation
Use backend native FFmpeg for MVP.

## Risk 2 — Mixed resolution clips break concat
### Mitigation
Normalize every clip before concat.

## Risk 3 — Output accidentally loses quality
### Mitigation
Make output frame size explicit and avoid silent downscale below chosen target.

## Risk 4 — Large file uploads fail
### Mitigation
Add upload limits, validation, and clear error messaging.

## Risk 5 — Temporary files pile up
### Mitigation
Add cleanup service and delete stale jobs.

## Risk 6 — Drag order UI does not match backend order
### Mitigation
Send explicit ordered clip ID list in process request.

---

## 15. UX Recommendations

### Keep the interface focused
Do not overload the first version with editing features.

### Highlight the 3 most important actions
- Upload
- Reorder
- Start

### Make 109% visible
The user cares about watermark hiding.
So 109% should be very visible and easy to reset.

### Show trust-building feedback
- clip count
- detected resolution
- processing state
- final success state

---

## 16. Validation Recommendations

## Frontend Validation
- file type
- file presence
- zoom range
- minimum one clip
- disabled start if invalid

## Backend Validation
- MIME / extension
- codec support where practical
- file existence
- job existence
- clip order validity
- zoom numeric validity

---

## 17. Suggested Definition of Done for MVP
The MVP is done when all of the following are true:

- user can upload multiple clips
- uploaded clips appear clearly in UI
- user can drag to reorder
- default zoom is 109%
- user can change zoom
- pressing Start processes successfully
- all clips are merged in chosen order
- output uses chosen frame size
- zoom is applied to all clips
- final video can be previewed and downloaded
- common errors are handled clearly
- app is stable for normal short-form creator workloads

---

## 18. Suggested First Prompt to Claude Code
Use something like this:

“Read `auto-stitch-zoom-video-app-requirements.md` and `implementation-plan.md`. Start by implementing Requirement 1 using the architecture defined in the implementation plan. Use React + TypeScript + Vite for the client and Node + TypeScript + Express for the server. Create a clean modular project structure and stop after Requirement 1 is complete, explaining what was built and what files were created.”

---

## 19. Suggested Follow-Up Prompt Pattern
After each step, use:

“Now implement Requirement X from `auto-stitch-zoom-video-app-requirements.md` using the existing architecture. Keep the code modular, update any necessary shared types, and explain what changed when finished.”

---

## 20. Final Recommendation
For this project, do **not** try to make it a full editor.
Keep it narrow and strong:

- upload
- reorder
- zoom
- stitch
- preview
- download

That focused scope is what makes the product useful, buildable, and reliable.
