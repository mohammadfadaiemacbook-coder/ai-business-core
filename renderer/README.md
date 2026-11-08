# Mac-local media renderer

This agent consumes durable YouTube render jobs from the AI Business Core Worker. It downloads source media from the authenticated Mac-local media service, converts it to an MP4 suitable for YouTube with FFmpeg, optionally asks a local Ollama model for a non-authoritative quality review, and stores the result on the Mac for preview in the PWA.

The media service and renderer replace Cloudflare R2 for video bytes. D1 continues to store workspace-scoped media metadata and render-job state. The agent never uploads or publishes to YouTube; publishing remains a separate, explicitly approved action in the app.

## Requirements

- macOS with Homebrew
- Node.js 20+
- FFmpeg (`brew install ffmpeg`)
- `cloudflared` (`brew install cloudflared`)
- Ollama running locally with the configured model (default: `qwen3:4b`)
- A private `renderer/.env` file with `AIBC_RENDERER_TOKEN` set to the same value as the Worker secret `RENDERER_SHARED_SECRET`

## Install

From the repository root:

```bash
cd renderer
./install-mac.sh
```

Edit `.env` locally and set `AIBC_RENDERER_TOKEN`. Never commit this file or paste its value into chat, screenshots, or logs.

## Run the media service and HTTPS tunnel

Start the local media service in Terminal tab 1:

```bash
cd ~/ai-business-core/renderer
node media-server.mjs
```

It listens only on `127.0.0.1:8788` and stores media persistently under:

`~/Library/Application Support/AI Business Core/media`

Start the Cloudflare Quick Tunnel in Terminal tab 2:

```bash
cloudflared tunnel --url http://127.0.0.1:8788
```

Copy the HTTPS `trycloudflare.com` origin (without a path) and save it as the GitHub Actions / Worker secret `RENDERER_PUBLIC_URL`. Quick Tunnel URLs can change after a restart; update the secret and redeploy if that happens.

The Worker secret `RENDERER_SHARED_SECRET` must match `AIBC_RENDERER_TOKEN` in the Mac's `.env`. These are credentials, not URLs; never expose them to the browser.

## Run the renderer

Start Ollama and confirm the configured model is installed. Then start the agent in Terminal tab 3:

```bash
cd ~/ai-business-core/renderer
node agent.mjs
```

Keep the media service, tunnel, and renderer running while processing videos. The Mac must remain awake and connected. If it is offline, jobs remain queued until service resumes; this is not a 24/7 cloud renderer.

## Job flow

- The PWA requests an authenticated upload through the Worker.
- The Worker checks the user session, workspace, asset metadata, content type, and size.
- Video bytes are sent to the Mac-local media service through the HTTPS tunnel; the service independently validates authorization and safe paths.
- The renderer claims D1 jobs, downloads source media from the local service, converts it with FFmpeg, and stores the MP4 in local persistent storage.
- The PWA can preview the rendered output for review.
- YouTube upload/publication is a separate user-approved action; the renderer never publishes automatically.

## Limits and security

- Media bytes are stored on the Mac, not in D1 or R2.
- D1 stores metadata and render-job state.
- The media service binds to loopback; Cloudflare Tunnel is the intended remote ingress.
- Media access is authenticated and workspace-scoped.
- Source and output files are limited to 64 MB in this initial operational release.
- The local model's quality note is advisory only and does not perform external fact-checking.
