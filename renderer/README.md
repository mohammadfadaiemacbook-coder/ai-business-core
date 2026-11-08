# Local Mac renderer

This agent consumes durable YouTube render jobs from the AI Business Core Worker. It downloads source WebM from R2, converts it to an MP4 suitable for YouTube with FFmpeg, asks the local Ollama model for a non-authoritative quality review, and uploads the result back to R2 for review in the PWA.

## Requirements

- macOS with Homebrew
- Node.js 20+
- FFmpeg (\`brew install ffmpeg\`)
- Ollama running on localhost, with the configured model (default: \`qwen3:4b\`)
- A Cloudflare R2 bucket bound to the Worker as \`MEDIA\`
- D1 migration \`0008_youtube_media_renderer.sql\` applied
- Worker secret \`RENDERER_SHARED_SECRET\` set to a random secret of at least 32 characters

## Setup

1. Create the R2 bucket named \`ai-business-core-media\` in the Cloudflare dashboard.
2. Deploy the Worker with the R2 binding named \`MEDIA\` and apply the D1 migrations using the repository's protected release workflow after reviewing the backup artifact.
3. In the Worker settings, add secret \`RENDERER_SHARED_SECRET\`. Generate a long random value locally (for example, \`openssl rand -hex 32\`). Never put this secret in GitHub source, a screenshot, or a chat message.
4. Copy this folder to the Mac or clone the repository, then run \`./install-mac.sh\`.
5. Edit \`.env\` and set \`AIBC_RENDERER_TOKEN\` to the same value as the Worker secret. Keep \`.env\` private and do not commit it.
6. Confirm Ollama is reachable at \`http://127.0.0.1:11434\` and the model is present with \`ollama list\`.
7. Start the agent with \`node agent.mjs\`.

## How jobs work

- The PWA stores the browser-produced WebM file in R2 and inserts a D1 render job.
- This Mac polls the queue, claims one job with a 10-minute renewable lease, and converts the video to H.264/AAC MP4.
- The local Qwen model provides an optional quality-control note; it does not perform external fact-checking and its absence does not block rendering.
- The MP4 is stored in R2 and the job becomes \`ready_for_review\`.
- Open the same PWA on any device and select **بررسی وضعیت پردازش** to fetch the rendered MP4 and preview it.
- Failed jobs are retried up to three attempts. If the Mac is offline, jobs remain queued. This is a local renderer, not a 24/7 cloud service.

## Security and limits

- The renderer token is separate from the app access token and is used only by the local agent.
- Media uploads and downloads are workspace-scoped and authenticated.
- Source and rendered files are limited to 64 MB in this first operational pass.
- The agent never uploads or publishes to YouTube. YouTube upload and public/scheduled publication remain a separate, human-approved action in the app.
