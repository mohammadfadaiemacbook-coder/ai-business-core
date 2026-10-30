# Release candidate checklist

## Current branch
`feature/security-expo-hardening` (web/PWA and Cloudflare Worker)

## Implemented in this candidate
- Persian creator tasks: trend research/strategy, scripts, metadata, captions, comment replies and thumbnail briefs.
- Claude second-opinion review through the Anthropic Messages API; provider credentials are encrypted in D1 and never returned to the UI.
- YouTube channel/analytics, comment inbox and reply posting with explicit user action.
- YouTube replies use the comment-thread resource ID required by `comments.insert`.
- YouTube uploads default to private; public uploads require `confirmPublic=true` in the Worker, not only a client-side checkbox.
- TTS scene generation, audio muxing into WebM, SRT subtitles and PNG thumbnail export.
- Cloud sync uses version compare-and-swap; a 409 conflict preserves local state and downloads a local backup.
- Worker master-token exchange produces workspace-scoped HMAC sessions that expire after 15 minutes.
- Provider secrets use AES-GCM with workspace/key AAD; legacy values are re-encrypted and invalid ciphertext fails visibly.
- Provider URLs require public HTTPS hostnames; empty provider fields delete stored secrets.
- OAuth state is atomically consumed; failed YouTube refresh marks the account `needs_reauth`.
- YouTube quota failures return a Persian 429 response; uploads stream the File body.
- Guarded Pages publishing and a gated Worker → Pages release workflow added.

## Automated checks
- JavaScript syntax checks for `app.js`, `sw.js` and Worker module.
- Release contract suite: **22 tests passed** on the latest completed dashboard validation run.

## Required production setup
- Set GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; the API token needs Workers Scripts and D1 edit permissions.
- The complete release workflow reads the existing D1 database ID from root `wrangler.toml`, exports a backup, applies pending migrations, deploys the Worker and checks `/api/health` before publishing Pages and building the APK.
- Keep `APP_ACCESS_TOKEN`, `TOKEN_ENCRYPTION_KEY`, AI provider keys, Google OAuth credentials, and optional ElevenLabs/image provider keys configured as Cloudflare Worker secrets/variables.
- Verify the D1 backup artifact before treating the production migration as complete.
- Reconnect Google OAuth after deployment so the `youtube.force-ssl` scope is granted.
- Configure Anthropic API key/model, ElevenLabs key/voice ID and an image provider if those paid services are required. These are not included free by the app.

## Release gate
1. Add GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
2. Run **Complete release - Worker and web app** from this branch with explicit `RELEASE` confirmation.
3. Verify the D1 pre-deploy backup artifact, Worker/D1 health and Pages deployment.
4. Live tests pass for primary AI, Claude, YouTube OAuth/comments, TTS and image generation.
5. A real WebM file is confirmed to contain an audio track when TTS is configured.
6. A real YouTube upload is tested as private first.
7. Verify the web app backup/export and import path in the target browser.

No public YouTube upload or comment reply is automatic.
