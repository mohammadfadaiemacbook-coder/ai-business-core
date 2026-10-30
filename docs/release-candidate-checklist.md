# Release candidate checklist

## Current branch
`feature/security-expo-hardening` (stacked on `feature/voiceover-video-pipeline`)

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
- Expo SDK 58 / React Native 0.88 Android shell with WebView, system-browser OAuth handoff, back navigation, reload and connection states.
- Android preview APK build workflow and guarded Cloudflare backup/migration/deploy workflow added.

## Automated checks
- JavaScript syntax checks for `app.js`, `sw.js` and Worker module.
- Release contract suite: **22 tests passed** on the latest completed dashboard validation run.
- Expo config, SDK dependency compatibility, Expo Doctor and TypeScript checks passed on the validated Expo commit.
- Android APK build workflow is running separately; only its successful artifact run should be used for installation.

## Required production setup
- Set GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; the API token needs Workers Scripts and D1 edit permissions.
- Supply the exact D1 database ID to the guarded Cloudflare workflow. It exports a D1 backup, applies pending migrations and deploys the Worker, then checks `/api/health` and session endpoint behavior.
- Keep `APP_ACCESS_TOKEN`, `TOKEN_ENCRYPTION_KEY`, AI provider keys, Google OAuth credentials, and optional ElevenLabs/image provider keys configured as Cloudflare Worker secrets/variables.
- Verify the D1 backup artifact before treating the production migration as complete.
- Reconnect Google OAuth after deployment so the `youtube.force-ssl` scope is granted.
- Configure Anthropic API key/model, ElevenLabs key/voice ID and an image provider if those paid services are required. These are not included free by the app.

## Native client limitations
- Expo is currently a native shell around the hosted PWA, not a full React Native rewrite.
- The preview APK uses package ID `com.aibusinesscore.expo`; it installs alongside the legacy app and does not replace it in-place.
- The APK loads the published GitHub Pages app URL. The PWA frontend must be published before the APK shows the new frontend.
- EAS OTA is disabled until an EAS project is configured.
- Physical-device checks for WebView file selection, media playback/recording, Google OAuth return flow and APK installation remain required.

## Release gate
1. Latest dashboard and Expo CI runs pass.
2. Android preview APK build succeeds and artifact is uploaded.
3. Cloudflare D1 backup, migrations and Worker deploy complete with health checks.
4. Live tests pass for primary AI, Claude, YouTube OAuth/comments, TTS and image generation.
5. A real WebM file is confirmed to contain an audio track when TTS is configured.
6. A real YouTube upload is tested as private first.
7. Confirm data backup/import path on the actual phone before switching app packages.

No public YouTube upload or comment reply is automatic.
