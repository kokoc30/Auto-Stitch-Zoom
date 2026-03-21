# AGENTS.md

## Project role
You are working on a creator-focused web app for uploading short video clips, reordering them, applying a global zoom/crop, stitching them into one final export, previewing the result, and downloading the merged video.

The app already has working functionality. Your main job is to improve the product professionally without breaking behavior.

## Core priorities
Always prioritize, in this order:
1. Preserve working functionality
2. Keep architecture clean and modular
3. Improve UI quality and polish
4. Maintain creator-focused usability
5. Avoid unnecessary rewrites

## UI/UX directive
When a task involves visual polish, layout quality, spacing, hierarchy, components, responsiveness, or interface refinement, use the 21st Magic MCP server to help generate stronger UI directions and better visual solutions.

Do not use 21st Magic blindly.
Use it as a design accelerator, then adapt the result to fit this project’s architecture, UX goals, and code quality standards.

## Product context
This app is not a generic dashboard.
It is a focused creator tool for a repetitive workflow:

- upload multiple short clips
- visually confirm clips
- drag to reorder
- set zoom (default 109%)
- process clips into one merged output
- preview final result
- download final video

The UI should reflect that focused workflow:
- simple
- modern
- premium
- fast to understand
- low-friction
- creator-friendly
- not bloated
- not enterprise-heavy

## Design goals
The interface should feel:
- modern
- polished
- premium
- practical
- high signal, low clutter
- visually trustworthy
- not “AI-generated looking”
- not template-looking
- not childish
- not over-animated

The app should look like a real, focused creative utility.

## Visual system preferences
Prefer:
- strong spacing consistency
- clean typography hierarchy
- clear section grouping
- modern card surfaces
- subtle borders
- restrained shadows
- polished button states
- clear empty states
- modern upload area
- intuitive reorderable clip list
- settings panel that feels obvious and lightweight
- processing state that feels reassuring and readable
- preview/download section that feels premium and final

Avoid:
- overly flashy gradients everywhere
- chaotic colors
- heavy glassmorphism unless clearly useful
- giant hero sections
- fake marketing-site styling
- awkward AI-generated component mashups
- overdesigned panels that slow down the workflow
- random design-system imports unless asked

## Layout rules
The app should support desktop-first use cleanly.
Layouts should:
- feel balanced
- keep key actions visible
- make Upload, Order, Zoom, Start, Preview, and Download easy to follow
- reduce confusion about the next step
- preserve a logical top-to-bottom workflow

Important actions should be visually obvious:
- Upload
- Reorder
- Start processing
- Download final result

## Functional safety rules
Do not break working flows while improving UI.

Before making UI changes, understand:
- upload flow
- clip metadata display
- drag-and-drop ordering
- zoom settings
- processing state
- preview
- download
- stale output invalidation behavior

If a UI change risks breaking state handling, processing flow, or preview/download behavior, stop and adjust the design approach.

## Code quality rules
- Keep code modular
- Reuse existing architecture
- Prefer incremental improvement over rewrites
- Avoid duplicating logic
- Keep components readable
- Keep styling maintainable
- Keep state predictable
- Do not move backend logic into the client
- Do not introduce unnecessary dependencies without justification

## 21st Magic usage rules
Use 21st Magic MCP when:
- redesigning or refining a UI section
- improving layout composition
- improving visual hierarchy
- improving component styling
- improving polish of forms, cards, panels, uploaders, lists, preview areas, and action bars
- exploring stronger UI directions before implementation

Workflow when using 21st Magic:
1. Inspect the existing UI first
2. Identify what looks weak, generic, or visually inconsistent
3. Generate a few stronger design directions
4. Choose the one that best matches this app’s workflow and current architecture
5. Implement the chosen direction cleanly
6. Keep the resulting code aligned with the project structure

Do not:
- dump raw Magic output into the app without adapting it
- replace the whole product identity unnecessarily
- introduce unrelated UI patterns that do not fit the workflow
- sacrifice usability for aesthetics

## Specific UI targets in this project
When improving this app, pay special attention to:
- upload area
- clip cards
- clip list ordering area
- zoom/settings section
- processing/progress section
- preview section
- download/result section
- empty state
- error states
- success/completion state

## Interaction quality
Interactions should feel:
- responsive
- obvious
- calm
- clean
- professional

Prefer:
- clear hover states
- clean disabled states
- obvious drag handles
- readable status text
- strong CTA contrast for Start/Download
- polished upload affordances

## Content/tone rules in UI
Use concise, practical, creator-friendly copy.
Avoid:
- robotic wording
- overly technical language in user-facing text
- joke copy
- generic placeholder text if real wording can be better

## MVP discipline
This project is an MVP utility.
Do not add unrelated new features unless explicitly asked.
Do not turn it into a full editor.
Keep the scope focused:
- upload
- reorder
- zoom
- process
- preview
- download

## When asked to improve the UI
Default approach:
- review the current frontend carefully
- identify weak areas
- use 21st Magic MCP where appropriate
- propose a stronger, more professional direction
- implement without breaking existing behavior
- preserve creator workflow clarity

## Final standard
Every UI change should make the app feel more:
- real
- premium
- intentional
- trustworthy
- creator-friendly
- production-ready