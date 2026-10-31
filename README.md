# AI Business Core

AI Business Core is a responsive, installable web application for operating a creator-led business. The active product is the web app and its Cloudflare Worker/D1 backend.

## Core workspace

- Business overview for tasks, research, content planning, calendar events and approval requests.
- Task tracking with priorities, due dates and statuses.
- Research library for sources, observations, hypotheses and contradictory evidence.
- Content pipeline for YouTube, Instagram and other business channels.
- Calendar for production deadlines and milestones.
- Manual approval queue for sensitive or external actions.
- Local JSON backup export/import.
- Dark responsive UI, PWA manifest, install icons and service-worker shell caching.

## AI Studio and media pipeline

The AI Studio connects to the Cloudflare Worker and can prepare content drafts, video scripts, metadata, captions, comment replies and thumbnail briefs. Optional provider integrations include Claude review, ElevenLabs narration and image generation. These integrations require valid provider credentials and may incur third-party charges.

The video workflow includes generated narration, video composition, SRT subtitles and PNG thumbnail output. Browser/device support and media-provider availability can affect the result; validate each output before publishing.

## YouTube operations

The app includes Google OAuth connection, channel information, recent videos, YouTube Analytics/revenue reporting, comment retrieval and reply, and video upload with privacy/scheduling controls. These operations require the relevant Google APIs, OAuth consent/scopes and an authorized YouTube account. Public publishing and comment replies require explicit user confirmation. Monetization eligibility is determined by YouTube Studio, not by this app.

After OAuth scopes change, disconnect/reconnect or use the app's reconnect action to grant the updated permissions.

## Cloudflare backend and data

- Cloudflare Worker: `ai-business-core`.
- D1 database: `ai-business-core-db`.
- Worker source: `ai-gateway/worker.js`.
- D1 schema changes: `migrations/`.
- Deployment and setup guidance: [AI gateway setup](docs/ai-gateway-setup.md).

The dashboard keeps a local browser copy and provides optional workspace-based cloud sync through the Worker/D1 backend. Back up important data before changing devices, clearing browser storage or restoring cloud data. The app's workspace token is sensitive; never commit it or share it in chat.

Provider API keys are stored in Worker-managed encrypted settings where configured; never put secrets in frontend source code, Git history or public issue reports. Configure provider spending limits and rotate credentials if exposure is suspected.

## Run the web app

1. Deploy the Worker and configure its D1 binding/secrets using the setup guide.
2. Publish the web app on an HTTPS static host (the repository's Pages workflow is configured for this).
3. Open the HTTPS app URL in a supported browser.
4. Configure the workspace connection and provider credentials in the app's secure settings.
5. Add the web app to the device home screen if the browser offers installation.
6. Export periodic JSON backups.

Opening `index.html` directly as a local file is not equivalent to hosting it: service workers and PWA installation require a supported secure context.

## Security and operational limits

- The static web frontend is not a full multi-user identity/role management system. Protect the workspace access token and avoid storing unnecessary sensitive customer data.
- OAuth and provider integrations depend on third-party API availability, permissions, quotas and billing.
- AI-generated content can contain errors; verify claims, rights, sources and media before use.
- CI checks syntax, contract tests and required project files. They do not replace end-to-end browser testing or live tests against the owner's Google/provider accounts.
- Keep D1 backups and test restore procedures before schema or production changes.

## Development direction

1. Stabilize the business workspace, local data and D1 synchronization.
2. Improve evidence-based research and YouTube content operations.
3. Strengthen the AI/media production workflow and its error handling.
4. Improve analytics, scheduling and operational reporting.
5. Expand Persian e-commerce operations after the core workflows are reliable.
