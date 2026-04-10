# Auto Stitch & Zoom Video App

## Overview

Auto Stitch & Zoom is a creator-focused web application for combining multiple short video clips into one finished export. The app is intentionally narrow in scope: it is built for a repeatable workflow where a user uploads clips, arranges them in order, applies one global zoom or crop setting, processes them into a single MP4, previews the merged output, and downloads the result.

The product is not a general-purpose video editor. It is a focused utility for a specific short-form creation workflow, optimized for clarity, speed, and predictable output.

## What the App Does

The app supports the full lifecycle of a stitched export:

- upload multiple clips at once or incrementally
- validate video format and file integrity
- extract metadata such as duration, resolution, and thumbnails
- display clips as reorderable cards
- let the user drag clips into the exact final sequence
- apply a single zoom percentage across the entire project
- preserve the chosen output frame resolution
- process the clips on the backend with FFmpeg
- provide live progress updates during export
- preview the completed video in the browser
- download the merged MP4 once processing finishes

## Primary User Workflow

The app is organized around a simple creator flow:

1. Upload source clips.
2. Review the uploaded items and their metadata.
3. Reorder clips into the final export sequence.
4. Adjust the global zoom if needed.
5. Start processing.
6. Wait for the backend export pipeline to finish.
7. Preview the final video.
8. Download the finished MP4.

The UI and state flow are designed so the current step is always obvious and the next action is easy to identify.

## Key Product Characteristics

This app is built as an MVP utility with a deliberate scope:

- creator-friendly
- low-friction
- desktop-first
- premium but practical
- reliable for short-form clips
- focused on upload, order, zoom, process, preview, and download

It avoids the complexity of a full nonlinear editor. There is no timeline, no transitions, no multi-track editing, and no account system.

## Frontend Architecture

The frontend is a React + TypeScript application built with Vite. State is centralized in a Zustand store so the upload, ordering, zoom, and processing workflow stays predictable.

### Main UI Areas

- Upload area
- Clip list and drag-and-drop ordering
- Zoom settings panel
- Resolution information panel
- Processing/progress section
- Preview section
- Download section
- App settings modal
- Toast notification stack

The page layout is not generic dashboard UI. It is arranged as a linear workflow that mirrors how a creator actually uses the tool.

## Main Screen Behavior

The root page presents the app as a guided export workspace. It shows:

- the current project status
- the number of clips in the project
- the current saved default zoom
- the workflow stages from upload through download
- the upload surface
- the clip ordering area
- the control rail for zoom, resolution, and processing
- preview and download sections once export is complete

The screen is designed to keep key actions visible and the export sequence easy to follow.

## Upload Experience

Users can add clips by clicking the upload area or dragging files into it.

### Supported Formats

- `.mp4`
- `.mov`
- `.webm`

### Upload Behavior

- multiple files can be added in one action
- empty files are rejected
- invalid extensions are rejected
- duplicate source names are skipped with a warning
- upload state locks the workspace while files are being sent and metadata is extracted

### What the User Sees

The upload area gives immediate feedback about what is happening. It changes state while files are uploading and explains when the clip set is locked.

## Clip List and Reordering

Each uploaded clip appears as a card in the ordering list. The card includes useful metadata so the user can verify the source content before export.

### Clip Card Data

- sequence number
- source filename
- thumbnail preview when available
- duration
- resolution
- file size
- file type tag
- remove button
- drag handle

### Ordering Behavior

The list is reorderable with drag-and-drop using desktop pointer and keyboard interactions.

The export order is exactly the same as the list order in the UI. There is no hidden reordering in the backend.

If the user removes a clip or changes the order, any previously generated output is invalidated so preview and download never go stale.

## Zoom Settings

The app uses one global zoom setting for the entire project.

### Zoom Defaults and Limits

- default zoom: 109%
- minimum: 100%
- maximum: 150%

The zoom is presented as a range slider in the main workflow and as a browser-level default in the app settings modal.

### Two Zoom Concepts

The app keeps two related but separate values:

- current project zoom: applied to the active clip set
- saved default zoom: stored locally in the browser for future projects

This separation lets the user keep a preferred starting value without forcing every active project to use the same setting.

### Zoom Behavior

- the project zoom applies uniformly to every clip
- zoom is centered on the resolved output frame
- changing zoom invalidates the current output
- the current project can be reset to the saved default zoom

## Resolution Handling

The app preserves a single output frame size for the final export.

### Output Rule

The first clip determines the export resolution. All other clips are normalized to that frame size.

### Resolution UI

The resolution panel explains:

- what output frame size is being used
- whether the frame is vertical or landscape
- whether all clips already match
- whether the project includes mixed resolutions or mixed aspect ratios

### Mixed Media Behavior

If the uploaded clips do not share the same resolution or aspect ratio, the app warns the user and explains the normalization strategy.

The workflow stays stable because the backend always exports to one resolved frame rather than letting output dimensions drift.

## Processing Flow

The processing section starts the export and keeps the user informed while the backend works.

### Export Pipeline Stages

- validate
- resolve output
- process clips
- merge
- complete

### Processing Experience

- the start button is disabled when the project is not ready
- the app blocks duplicate overlapping jobs
- progress is shown in real time
- clip-by-clip progress is shown during the main processing phase
- success and error states are displayed clearly

### Workload Guidance

The UI also indicates whether the current project is within the app’s intended lightweight workload or whether the export is heavier than the recommended MVP target.

## Preview Experience

After a successful export, the app exposes an inline preview player for the processed video.

### Preview Purpose

The preview is meant to confirm:

- clip order
- crop and zoom behavior
- pacing
- output readiness before download

The preview uses the same final output generated by the backend.

## Download Experience

When processing completes successfully, the app shows a download section for the final MP4.

### Download Behavior

- the final file is exposed only after a completed export
- the download filename is sensible and stable
- the output is presented as an MP4
- the user can re-download safely while the project remains unchanged

If the user changes the clip order or zoom later, the previous output is cleared so the download always matches the active project state.

## Toast and Error Handling

The app uses toast notifications to surface quick feedback.

### Toast Types

- error
- warning
- info

### Typical Notifications

- invalid upload format
- duplicate clip skipped
- upload failed
- processing started or completed
- processing connection lost
- export failed

Errors are also shown in the processing panel when the export itself fails.

## Project State Management

The clip store manages the main workflow state in one place.

### Stored State

- uploaded clips
- uploading flag
- current zoom
- saved default zoom
- toast queue
- processing status
- output URL
- preview URL
- error message
- pipeline step
- progress percentage
- current clip index
- total clip count

### Important State Rules

- adding clips invalidates old output
- removing clips invalidates old output
- reordering clips invalidates old output
- changing zoom invalidates old output
- starting processing is blocked when the project is not ready
- upload and processing both temporarily lock parts of the interface

These rules are critical to keeping preview and download aligned with the current clip set.

## Backend Architecture

The backend is a Node.js + Express service built around FFmpeg.

### Backend Responsibilities

- accept multipart uploads
- validate file type, file size, and media metadata
- generate thumbnails when possible
- expose processing endpoints
- run the FFmpeg export pipeline
- stream live job progress to the client
- serve preview streams
- serve download streams

### Backend Processing Model

Processing is asynchronous. The frontend starts the job, then subscribes to job status updates through server-sent events.

### FFmpeg Behavior

The server handles the actual video work, including:

- normalization
- zoom and crop application
- resolution matching
- clip concatenation
- final MP4 export

The backend may use GPU acceleration when available and can fall back to CPU processing if needed.

## Upload and Media Validation

The app validates video uploads at both the client and server layers.

### Client Validation

- checks allowed file extensions
- rejects empty files

### Server Validation

- verifies file type and MIME information
- checks file size limits
- extracts metadata with ffprobe
- confirms media is readable and suitable for processing

This layered approach makes the upload flow more robust and reduces bad job starts.

## Resolution and Export Integrity

The app is designed to keep the export stable and predictable.

### Output Stability Rules

- output frame size is resolved before processing starts
- preview and download come from the same processed output
- output is invalidated when the project changes
- the app avoids silent mismatches between the visible list and the exported order

These protections are especially important in a creator workflow where the final export must match what was configured in the UI.

## Temporary Storage

The app stores uploads and processing artifacts locally in temporary folders on the machine running the backend.

### What This Means

- files are not durable across restarts
- the app is best treated as a single-machine service
- processing performance depends on the host hardware
- upload and export speed depend on local CPU, disk, and network conditions

## Deployment and Runtime Notes

The repository supports local development and production-style local hosting.

### Typical Modes

- frontend dev server plus backend API server
- production-style local build served from the backend
- optional Cloudflare Tunnel for remote access to the local machine
- optional Docker-based deployment

The app is well suited to a local machine workflow where the host machine does the uploads and FFmpeg processing.

## What Makes the App Useful

The app removes the need for repetitive manual editing in a separate video editor when the task is simply:

- collect clips
- order them
- crop them consistently
- stitch them together
- download the result

That makes it a practical creator tool rather than a full editing environment.

## Summary

Auto Stitch & Zoom is a focused export utility for short-form video workflows. It lets a creator upload clips, inspect them, reorder them, apply one shared zoom setting, process them into a single MP4, preview the result, and download the finished file.

The app’s core strengths are clarity, consistency, and workflow discipline. It is built to make one repeatable task fast and reliable without introducing unnecessary editing complexity.