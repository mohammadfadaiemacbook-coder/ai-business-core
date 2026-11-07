# Web-first AI Business Core

## Product direction
The Progressive Web App (PWA) is the canonical client. It is installed from the same web origin on macOS, Android, Windows, and supported tablets. The existing Android and macOS packages remain compatibility launchers during the transition; they must not grow separate business logic or separate data stores.

## Shared application architecture
- UI: the responsive PWA in `index.html`, `app.js`, and `styles.css`.
- API: the existing Cloudflare Worker.
- Durable metadata: Cloudflare D1, scoped by workspace.
- YouTube identity and OAuth tokens: encrypted server-side storage already used by the Worker.
- Production records: `youtube_video_jobs` stores topics, scripts, metadata, production reports, workflow status, schedule metadata, and optimistic version numbers.
- Video binaries: the Worker now has a workspace-scoped R2 media API and the PWA can upload source WebM files to the `MEDIA` bucket. The bucket `ai-business-core-media` must be created in Cloudflare and bound before these endpoints become operational.
- Rendering: a durable D1 queue with leases, heartbeats, three attempts, and failure reporting feeds `renderer/agent.mjs`. The local Mac agent uses FFmpeg to produce H.264/AAC MP4 and the installed Ollama model for optional local script QA. The Mac must be awake; fully cloud-hosted 24/7 rendering requires separately provisioned compute and budget.
- Publishing: keep YouTube OAuth and upload server-side. YouTube's `publishAt` scheduling is used only after explicit approval and successful upload; the app must never equate a browser timer with a reliable scheduler.

## Safety and rollout
- No production Worker/Pages deployment is performed by this branch.
- D1 migration `0007_youtube_video_jobs.sql` must be applied before enabling the new API on production.
- Public publishing remains approval-gated.
- Keep the existing web app origin and PWA update flow. Do not split product logic between Android and macOS clients.
- Validate cross-device restore, D1 conflict handling, upload size limits, media retention, and YouTube scheduled publication on staging before release.
