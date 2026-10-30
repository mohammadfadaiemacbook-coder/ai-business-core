# Release candidate checklist

## Current branch
`feature/voiceover-video-pipeline`

## Implemented in this candidate
- Persian creator tasks: trends, scripts, metadata, captions, comment replies and thumbnail briefs.
- Claude second-opinion review through the Anthropic Messages API; API credentials are stored encrypted in D1.
- YouTube comment inbox and AI reply drafts. Posting a reply requires a separate explicit confirmation.
- YouTube replies use the comment-thread resource ID expected by `comments.insert`.
- TTS scene generation, audio muxing into WebM, subtitle export and thumbnail export.
- Media calls accept the cloud workspace token as a fallback when the AI form token is not set.
- Service keys are not returned by provider settings endpoints.

## Automated checks
- `node --check app.js`
- `node --check sw.js`
- `node --input-type=module --check < ai-gateway/worker.js`
- `node --test tests/release-contracts.mjs`

## External prerequisites for live acceptance
- Cloudflare Worker secrets and D1 binding must exist in the deployment environment.
- YouTube Data API v3 and YouTube Analytics API must be enabled in Google Cloud.
- Reconnect Google OAuth after adding the `youtube.force-ssl` scope.
- Configure a valid Anthropic API key and model ID to enable Claude review. Claude subscription and API billing are separate.
- Configure ElevenLabs API key and Voice ID to enable spoken narration.
- Configure an OpenAI-compatible image endpoint and key for generated artwork.
- Verify Android WebView recording, playback and file downloads on the actual target device.

## Release gate
Do not merge or deploy until:
1. All CI checks pass on the latest PR head.
2. Claude has reviewed the diff and any findings are resolved.
3. Live smoke tests pass for primary AI, Claude, YouTube OAuth/comments, TTS and image generation.
4. A real WebM file is confirmed to contain an audio track when TTS is configured.
5. A real YouTube upload is tested as private first.
6. The owner explicitly approves merge and production deployment.

No automatic public uploads or comment replies are permitted.
