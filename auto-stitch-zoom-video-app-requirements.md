# Auto Stitch & Zoom Video Web App — Product Requirements Document

## 1. Document Purpose
This document defines the full requirements, scope, acceptance criteria, and implementation order for a web application that automatically combines multiple uploaded video clips into one final downloadable video.

The app is intended to replace a manual workflow where the user:
1. generates multiple short video clips,
2. imports them into an editor,
3. orders them,
4. applies a zoom-in crop (default 109%) to hide a watermark,
5. exports the final stitched video,
6. downloads the result for social media posting.

This PRD is written so an AI coding agent can implement the system requirement-by-requirement inside a VS Code project.

---

## 2. Product Summary
The app is a lightweight browser-based video editing tool focused on one workflow:

- upload multiple video clips,
- visually reorder them with drag-and-drop,
- set a zoom percentage (default 109%),
- combine all clips in that order,
- apply the same zoom/crop to every clip,
- generate one final output video,
- download the final video without reducing output resolution.

This is an **MVP video utility**, not a full nonlinear editor.

---

## 3. Core User Goal
The user wants to save time by avoiding manual editing in CapCut or similar software for a repetitive workflow.

The user should be able to:
- upload clips,
- arrange them,
- set zoom,
- press **Start**,
- wait for processing,
- preview/download the final merged result.

---

## 4. Primary Use Case
### Main Workflow
1. User opens the web app.
2. User uploads 2 or more video files.
3. App displays uploaded clips as reorderable items.
4. User drags clips into desired order.
5. User sets zoom value (default 109%).
6. User presses **Start**.
7. App processes videos:
   - preserves chosen output resolution,
   - applies uniform zoom/crop,
   - concatenates in selected order.
8. App shows completion state.
9. User clicks **Download**.
10. Final file downloads as one merged video ready for social media upload.

---

## 5. Product Goals
### Must Have
- Multi-video upload
- Drag-and-drop reordering
- Zoom percentage control
- Default zoom = 109%
- One-click processing
- One final stitched downloadable video
- Output resolution must match selected source/output resolution and must not be downscaled unnecessarily
- Simple clean interface
- Reliable processing for normal short-form clips

### Nice to Have Later
- Preview before export
- Per-clip trim
- Per-clip mute
- Custom export filename
- Remember last-used zoom setting
- Mobile support
- Progress bar with per-stage updates

---

## 6. Non-Goals (for MVP)
The first version does **not** need to include:
- timeline-based advanced editing
- transitions between clips
- audio mixing controls
- subtitles/captions
- filters/color grading
- multi-track editing
- cloud accounts
- user login
- team collaboration
- background music tools
- watermark removal by AI inpainting
- server-side publishing to social platforms

---

## 7. Key Product Rule
The app must preserve the **output frame resolution**.

### Important Clarification
When zooming in to 109%, the app may reduce the visible field of view and may slightly reduce effective sharpness because the image is cropped and scaled, but the exported video file must still preserve the chosen output frame size (for example 1080x1920 if that is the working resolution). It must not export at a lower resolution than the selected output resolution.

---

## 8. Target Users
### Primary User
A content creator producing short-form AI-generated videos who repeatedly needs to merge several short clips and crop/zoom them uniformly.

### Secondary User
Any creator who needs a fast browser-based stitching tool for short-form vertical videos.

---

## 9. High-Level Functional Requirements

## Requirement 1 — Project Setup and Basic UI Shell
### Description
Create the initial web app shell with:
- page layout,
- upload area,
- clip list area,
- settings panel,
- processing section,
- download section.

### Acceptance Criteria
- App loads without errors.
- Main screen shows clear areas for upload, ordering, settings, process button, and download result.
- Layout is usable on desktop browser.
- App has a clean modern UI.
- No backend dependency is required for the first UI shell if architecture is still being prepared.

---

## Requirement 2 — Multi-Video Upload
### Description
Allow the user to upload multiple video files at once or one-by-one.

### Functional Details
- Accept common formats at minimum:
  - `.mp4`
  - `.mov`
  - `.webm` (optional but recommended)
- Each uploaded file should appear as one item in the clip list.
- Each item should show:
  - filename,
  - duration if available,
  - resolution if available,
  - thumbnail or poster frame if practical.

### Acceptance Criteria
- User can upload multiple video files successfully.
- Uploaded files appear in a list immediately.
- Invalid file types are rejected with a clear message.
- Duplicate uploads are either prevented or clearly handled.
- The app remains stable after uploading several clips.

---

## Requirement 3 — Clip List Display
### Description
Display uploaded clips in a visually clear ordered list.

### Functional Details
Each clip item should show:
- sequence number,
- filename,
- short metadata,
- remove button,
- drag handle.

### Acceptance Criteria
- Every uploaded clip appears in the list.
- Remove button works correctly.
- Sequence numbers update automatically.
- Empty state is shown when no clips exist.

---

## Requirement 4 — Drag-and-Drop Reordering
### Description
Allow the user to reorder clips using drag-and-drop.

### Functional Details
- Dragging should reorder the clip list.
- Order shown in UI must match final export order.
- Touch support is optional for MVP, desktop mouse support is required.

### Acceptance Criteria
- User can reorder any clip.
- New order is visibly updated in the UI.
- Processing uses the reordered sequence exactly.
- No hidden mismatch exists between displayed order and export order.

---

## Requirement 5 — Zoom Settings Panel
### Description
Allow the user to set a global zoom value that applies uniformly to all clips.

### Functional Details
- Default zoom must be **109%**.
- User can change zoom value manually.
- Recommended input modes:
  - number input
  - slider (optional)
- Valid zoom range for MVP:
  - minimum 100%
  - maximum 150% (or another reasonable safe limit)
- App should explain that zoom is used to crop out watermark edges.

### Acceptance Criteria
- Default zoom loads as 109%.
- User can change the value before processing.
- App validates invalid values.
- Final export uses the selected zoom consistently across all clips.

---

## Requirement 6 — Output Resolution Handling
### Description
The app must preserve output frame size and not unintentionally reduce resolution.

### Functional Details
- For MVP, choose one of these strategies:
  1. **Use the first clip's resolution as output resolution**, or
  2. allow the user to choose output resolution from detected clips / preset options.
- Recommended MVP rule:
  - if all videos share the same resolution, use that resolution automatically.
  - if videos differ, warn the user and normalize to the chosen output resolution.
- App should prioritize vertical short-form output, especially 1080x1920 if the inputs are vertical.

### Acceptance Criteria
- Exported file frame size matches the chosen output resolution.
- App does not silently downscale below chosen output resolution.
- If input resolutions differ, the app shows a clear rule or warning.
- Output remains playable and visually consistent.

---

## Requirement 7 — Processing Engine: Concatenate + Zoom
### Description
When the user presses **Start**, the app must process the clips in order and produce one final merged video.

### Processing Steps
1. Read ordered clips.
2. Normalize to output frame/canvas if needed.
3. Apply zoom crop to each clip.
4. Concatenate clips in selected order.
5. Export final video file.

### Technical Note
Implementation may use:
- FFmpeg / ffmpeg.wasm
- server-side FFmpeg
- hybrid architecture

The final app must be reliable for the target workload.

### Acceptance Criteria
- Clicking **Start** begins processing.
- Clips are merged in exact UI order.
- Same zoom is applied to every clip.
- Output file is generated successfully for supported videos.
- No hidden reordering or skipped clips occurs.

---

## Requirement 8 — Processing Status / Progress UI
### Description
The user should see that processing is happening.

### Functional Details
Show:
- processing started,
- current step if possible,
- success state,
- error state.

### Acceptance Criteria
- User sees visible feedback during processing.
- Start button becomes disabled while processing.
- User cannot accidentally launch multiple overlapping jobs.
- Completion state is clear.
- Errors are displayed in a readable way.

---

## Requirement 9 — Download Final Video
### Description
Once processing is complete, the app should provide a download button for the merged file.

### Functional Details
- Download button appears only after successful processing.
- Final filename should be sensible, e.g.:
  - `final-output.mp4`
  - or user-customizable later
- The final video must remain in the chosen output frame resolution.

### Acceptance Criteria
- User can click **Download** and receive the final file.
- Downloaded file opens and plays correctly.
- Video includes all clips in selected order.
- Resolution matches chosen output frame size.
- No obvious export corruption exists.

---

## Requirement 10 — Preview of Uploaded Clips
### Description
Allow the user to preview each uploaded clip before export.

### Functional Details
- A small preview or thumbnail is enough for MVP.
- Optional: click a clip to preview playback in a player.

### Acceptance Criteria
- User can visually identify clips before export.
- Preview helps confirm order/content.
- Preview does not break upload or ordering functionality.

---

## Requirement 11 — Preview of Final Output (Recommended MVP+)
### Description
After processing, optionally allow the user to preview the merged result before downloading.

### Acceptance Criteria
- Final processed video can be previewed in-browser.
- Preview matches downloadable output.
- Download still works after preview.

---

## Requirement 12 — Remove / Reset / Rebuild Controls
### Description
User should be able to manage the working set without refreshing the whole app.

### Functional Details
Include:
- remove individual clip,
- clear all clips,
- reset zoom to default 109%,
- rebuild/export again after reordering or changing zoom.

### Acceptance Criteria
- User can remove clips without app failure.
- User can clear all and start over.
- Reset returns zoom to 109%.
- User can rerun processing after making changes.

---

## Requirement 13 — Validation Rules
### Description
Protect the app against bad input and broken workflows.

### Validation Cases
- no clips uploaded
- only one clip uploaded (decide whether allowed; recommended yes, still process zoom/export)
- invalid file type
- zero-byte/corrupt file
- unsupported codec
- extreme zoom value
- processing failure

### Acceptance Criteria
- App shows clear error/warning messages.
- App does not silently fail.
- User always knows what needs to be fixed.

---

## Requirement 14 — UX for Short-Form Vertical Creators
### Description
The app should feel optimized for social-media creators.

### Functional Details
- Prioritize vertical video workflows
- Keep controls simple
- Minimize steps
- Make 109% zoom easy and visible
- Make drag-and-drop obvious
- Make Start and Download primary actions

### Acceptance Criteria
- Main workflow is understandable without training.
- User can complete the task quickly.
- The app feels focused, not bloated.

---

## Requirement 15 — Performance Expectations
### Description
The app should be usable for normal creator workloads.

### Initial MVP Performance Assumption
- 3–6 short clips
- each clip around 5–10 seconds
- vertical content
- normal desktop browser

### Acceptance Criteria
- App remains responsive during upload and setup.
- Processing completes successfully for standard short-form workloads.
- App does not crash on typical expected usage.

---

## Requirement 16 — Export Format
### Description
Define the initial export format.

### Recommended MVP
- output container: `.mp4`
- common codec support preferred for easy social upload

### Acceptance Criteria
- Exported file is broadly compatible.
- User can upload it to social platforms easily.
- File is not produced in an unusual or unusable format.

---

## Requirement 17 — Error Logging / Debug Visibility
### Description
The app should be debuggable during development.

### Functional Details
- Log key processing events
- Log validation errors
- Log export failures
- Show meaningful user-facing messages while keeping developer logs available

### Acceptance Criteria
- Developer can diagnose common failures.
- User sees simple readable error messages.
- Debug logging does not overwhelm the UI.

---

## Requirement 18 — Architecture Requirement
### Description
The project should be structured cleanly so requirements can be implemented one-by-one.

### Recommended Module Areas
- UI shell
- upload manager
- clip metadata service
- ordering/drag-drop module
- settings state
- video processing service
- export/download service
- preview player
- validation/error service

### Acceptance Criteria
- Code structure supports iterative development.
- Features are not tightly tangled.
- Future enhancements can be added without rewriting the entire app.

---

## Requirement 19 — Zoom Behavior Definition
### Description
Define exactly what “zoom 109%” means.

### Rule
- Zoom is applied uniformly from the center by default.
- The app scales the video up to 109% and crops overflow to fit the chosen output frame.
- No black bars should appear due to zoom.
- The watermark area at the edge should be hidden if the zoom is sufficient.

### Acceptance Criteria
- 109% zoom behaves consistently across all clips.
- Center crop remains visually stable.
- Output fills the frame completely.
- No unintended border artifacts appear.

---

## Requirement 20 — Processing Start Safety
### Description
The **Start** action should only run when the project is in a valid state.

### Conditions Before Start
- at least one valid clip is present
- zoom setting is valid
- output resolution rule is resolved

### Acceptance Criteria
- Start button is disabled or guarded until valid.
- Invalid start attempts produce clear feedback.
- No broken job launches.

---

## Requirement 21 — Ordering Persistence During Session
### Description
Within a single session, the selected clip order should remain stable unless the user changes it.

### Acceptance Criteria
- Clip order remains stable after previews, zoom changes, or temporary UI interactions.
- Processing always uses current visible order.

---

## Requirement 22 — Resolution Consistency Warning
### Description
When uploaded clips do not share the same resolution/aspect ratio, the app should inform the user.

### Acceptance Criteria
- App detects mismatched resolutions where feasible.
- User sees a warning or notice.
- The chosen normalization/output rule is explained.

---

## Requirement 23 — Visual Quality Protection
### Description
The app should avoid accidental quality loss beyond the unavoidable crop effect caused by zooming.

### Acceptance Criteria
- No unnecessary downscale is applied.
- Output uses chosen frame size.
- Export settings prioritize stable quality over extreme compression.
- Visual output is appropriate for short-form social upload.

---

## Requirement 24 — Download Reliability
### Description
Downloaded exports should be reliable and easy to use.

### Acceptance Criteria
- Download button works after successful export.
- Repeated download clicks do not break the app.
- File can be saved locally without corruption.

---

## Requirement 25 — Future Extensibility Hooks
### Description
Leave the architecture ready for future additions.

### Future Additions
- trim clip start/end
- per-clip zoom
- per-clip mute
- transition effects
- caption overlays
- direct social export
- project save/load
- automatic silence removal
- batch processing

### Acceptance Criteria
- Current codebase does not block future feature growth.
- Modules can be extended without major redesign.

---

## 10. Suggested Implementation Order for AI Agent
Use this order when telling the coding agent what to do next:

1. Requirement 1 — Project setup and UI shell  
2. Requirement 2 — Multi-video upload  
3. Requirement 3 — Clip list display  
4. Requirement 4 — Drag-and-drop reordering  
5. Requirement 5 — Zoom settings panel  
6. Requirement 6 — Output resolution handling  
7. Requirement 7 — Processing engine concatenate + zoom  
8. Requirement 8 — Processing status UI  
9. Requirement 9 — Download final video  
10. Requirement 10 — Clip preview  
11. Requirement 12 — Remove/reset/rebuild controls  
12. Requirement 13 — Validation rules  
13. Requirement 11 — Final preview  
14. Requirement 17 — Error logging  
15. Requirement 18 — Architecture cleanup and modularization  
16. Requirement 22 / 23 — resolution and quality protections  
17. Requirement 25 — future extensibility cleanup

---

## 11. Recommended MVP Acceptance Test
The app is MVP-complete when this test passes:

### Test Scenario
- User uploads 4 vertical video clips.
- User drags them into a custom order.
- User leaves zoom at 109%.
- User clicks Start.
- App processes successfully.
- App outputs one downloadable merged `.mp4`.
- Final video is in the correct selected output resolution.
- Final video plays correctly.
- Watermark edge is hidden by zoom.
- Clip order matches UI order.
- User downloads successfully.

If all of the above pass reliably, MVP is complete.

---

## 12. Open Technical Decisions
The implementing agent should explicitly decide and document:
- client-side vs server-side processing
- FFmpeg WASM vs backend FFmpeg
- output resolution selection rule
- handling of mixed frame rates
- handling of mixed aspect ratios
- export codec settings
- temporary file cleanup strategy

These decisions should be documented during implementation.

---

## 13. Final Product Definition
This app is a focused creator utility for:
- uploading short video clips,
- ordering them visually,
- applying a default or custom zoom crop,
- merging them into one final export,
- preserving the chosen output resolution,
- and removing repetitive manual editing work from the creator’s daily workflow.
