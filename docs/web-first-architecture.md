# Web-first AI Business Core

## Product direction
The Progressive Web App (PWA) is the canonical client. It is installed from the same web origin on macOS, Android, Windows, and supported tablets. The existing Android and macOS packages remain compatibility launchers during the transition; they must not grow separate business logic or separate data stores.

## Shared application architecture
- UI: the responsive PWA in `index.html`, `app.js`, and `styles.css`.
- API: the existing Cloudflare Worker.
- Durable metadata: Cloudflare D1, scoped by workspace.
- YouTube identity and OAuth tokens: encrypted server-side storage already used by the Worker.
- Production records: `youtube_video_jobs` stores topics, scripts, metadata, production reports, workflow status, schedule metadata, and optimistic version numbers.
- Video binaries: must move to object storage (Cloudflare R2 or an equivalent) before the browser-only renderer is retired. The current repository does not yet bind an R2 bucket, so no claim is made that binary media is already durable.
- Rendering: move out of the browser into a separate renderer/worker. A local Mac renderer using FFmpeg and the existing local Ollama model is the low-cost first option; it can process jobs while the Mac is awake. Fully cloud-hosted rendering requires a separately provisioned compute service and budget.
- Publishing: keep YouTube OAuth and upload server-side. YouTube's `publishAt` scheduling is used only after explicit approval and successful upload; the app must never equate a browser timer with a reliable scheduler.

## Safety and rollout
- No production Worker/Pages deployment is performed by this branch.
- D1 migration `0007_youtube_video_jobs.sql` must be applied before enabling the new API on production.
- Public publishing remains approval-gated.
- Keep the existing web app origin and PWA update flow. Do not split product logic between Android and macOS clients.
- Validate cross-device restore, D1 conflict handling, upload size limits, media retention, and YouTube scheduled publication on staging before release.
