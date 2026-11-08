# Local media architecture (R2-free)

This document defines the implementation contract for issue #49. It is not a claim that the pipeline is already implemented.

## Non-negotiable constraints

- Do not require Cloudflare R2, an R2 bucket, or a payment card.
- Keep D1 as the durable source of truth for workspace, draft, render-job, and audit metadata.
- Keep the existing YouTube connection and approval-before-publish behavior.
- Do not change production `main` until the replacement passes tests and review.
- Never expose renderer or media endpoints without authentication and workspace authorization.

## Target data flow

1. PWA authenticates with the existing app session and requests a source-media upload.
2. Worker validates the session, workspace, content type, and declared size, then creates a D1 asset/job record in a state that clearly indicates the Mac media service must receive the file.
3. PWA transfers bytes to the Mac-local media service through the existing Cloudflare Tunnel. The local service independently validates the signed/short-lived authorization, workspace, asset ID, size, MIME type, and filename.
4. The Mac service writes to a dedicated application data directory using a temporary file followed by an atomic rename. It must reject path traversal and symlinks escaping the media root.
5. Renderer claims D1 jobs, reads source media from the local service, runs FFmpeg, and writes the MP4 back to persistent local storage.
6. Worker stores only metadata and local-media identifiers in D1. PWA obtains a short-lived authenticated preview URL and streams the MP4 from the Mac service.
7. YouTube upload remains a separate action and must require an explicit user approval/confirmation immediately before upload.

## Required service behavior

- Bind the local media service to loopback only; Cloudflare Tunnel is the only intended remote ingress.
- Use per-request authorization with expiry and workspace/asset scoping; do not reuse the renderer shared secret as a browser-visible token.
- Apply configurable upload limits, strict MIME allowlists, safe generated filenames, disk-space checks, and rate limits.
- Support health/readiness reporting, graceful shutdown, restart recovery, and cleanup of abandoned temporary files.
- Return clear offline errors when the Mac or tunnel is unavailable. Do not silently fall back to R2.
- Do not place media bytes in D1 or Worker memory as a storage workaround.

## Deployment changes

- Remove R2 bucket creation and R2 binding requirements from the release workflow and Wrangler configuration.
- Preserve D1 backup, migrations, Worker deployment, health checks, Pages deployment, and test gates.
- Health output must distinguish database readiness from Mac media-service connectivity; a healthy Worker alone does not mean media processing is ready.

## Verification checklist

- [ ] Worker has no mandatory R2 binding on any YouTube media/render route.
- [ ] Upload and preview work from both Mac and phone through the tunnel.
- [ ] Workspace isolation and expired-token rejection are tested.
- [ ] Path traversal, oversized files, invalid MIME, low disk space, and Mac-offline cases are tested.
- [ ] Source and output files survive renderer restart and Mac reboot.
- [ ] Render jobs recover safely after interrupted processing.
- [ ] Preview is available before approval; upload is impossible without explicit approval.
- [ ] Release workflow completes without R2 permissions, bucket creation, or payment setup.
- [ ] Existing D1 records and YouTube connection remain intact.
