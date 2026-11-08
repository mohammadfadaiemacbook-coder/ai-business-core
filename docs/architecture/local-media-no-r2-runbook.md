# Mac-local media service runbook

This setup replaces the paid Cloudflare R2 bucket. D1 continues to hold media metadata and render-job state; the actual video files are stored on the Mac.

## Requirements

- macOS with Node.js 20+ and FFmpeg installed
- Ollama running locally with `qwen3:4b`
- Existing `renderer/.env` containing `AIBC_RENDERER_TOKEN` (the same secret as the Worker `RENDERER_SHARED_SECRET`)
- `cloudflared` installed

## Update the Mac checkout

```bash
cd ~/ai-business-core
git fetch origin
git checkout feature/local-media-no-r2
git pull --ff-only
cd renderer
```

Do not paste or share the renderer token in chat, screenshots, or terminal output.

## Start the local media service

In Terminal tab 1:

```bash
cd ~/ai-business-core/renderer
node media-server.mjs
```

The service listens only on `127.0.0.1:8788` and stores files persistently under:

`~/Library/Application Support/AI Business Core/media`

Keep this process running while uploading or rendering videos.

## Expose it through a temporary HTTPS tunnel

In Terminal tab 2:

```bash
cloudflared tunnel --url http://127.0.0.1:8788
```

Copy the HTTPS `trycloudflare.com` origin printed by cloudflared. Do not include a path. Quick Tunnel URLs are temporary and may change after a restart.

## Configure the GitHub Actions secret

In the repository, open **Settings → Secrets and variables → Actions → New repository secret**.

- Name: `RENDERER_PUBLIC_URL`
- Value: the HTTPS Quick Tunnel origin from the previous step

The existing `RENDERER_SHARED_SECRET` must continue to match `AIBC_RENDERER_TOKEN` in the Mac's `renderer/.env`. Never replace it with the tunnel URL.

## Start the renderer

In Terminal tab 3:

```bash
cd ~/ai-business-core/renderer
node agent.mjs
```

Keep the media service, tunnel, and renderer running during video production. Ollama and FFmpeg run locally.

## Release gate

The validation workflow must pass before merging. After the tunnel is running and the Actions secret is set, the release workflow can back up D1, apply migrations, deploy the Worker, and publish the PWA. Do not start the production release before those prerequisites are met.

If the Quick Tunnel URL changes, update the `RENDERER_PUBLIC_URL` repository secret and run the release workflow again so the Worker receives the new endpoint.
