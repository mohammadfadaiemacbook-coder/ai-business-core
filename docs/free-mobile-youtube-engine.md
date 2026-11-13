# Free mobile YouTube short-video engine

## Scope
This branch adds a no-paid-provider-fallback short-video path to the existing PWA. Target output is an English 60–180 second YouTube video rendered in the browser on Android Chrome or another browser that supports Canvas captureStream, MediaRecorder, and Web Audio. Gemini free-tier quota is limited and account-specific; the app cannot inspect whether a supplied Google project has billing enabled. Keep billing disabled and stop if Google requests billing or reports quota exhaustion.

## Free-tier provider policy
- Video topic analysis, script and metadata use a dedicated `freeOnly` Worker path pinned to Google Gemini 3.5 Flash-Lite; it never calls the configured primary provider, paid secondary provider, or paid review model.\n- English narration uses the Google Gemini Developer API TTS model `gemini-2.5-flash-preview-tts` through the authenticated Worker route.
- The Gemini key is read from the encrypted Worker provider store (`geminiKey`), or from the existing Gemini secondary-provider key only when its configured URL is the official `generativelanguage.googleapis.com` host. It is never sent to the browser.
- English narration never falls back to ElevenLabs or another paid provider. A Gemini text-generation quota/rate-limit error also stops production without a paid fallback. A Gemini quota/rate-limit error stops production.
- Use a Google AI Studio project on its free tier with no billing account attached. The app cannot override a provider account that has billing enabled; do not attach billing or configure paid fallbacks.
- The video render path does not call the image-generation endpoint. It uses browser Canvas graphics, motion, narration, captions, and a thumbnail.
- No R2, external renderer, FFmpeg, Mac process, or paid storage is required.

## Production flow
1. Fetch a recent YouTube trend sample and deduplicate against saved topics.
2. Generate a 220–380-word English script and metadata.
3. Split narration into scene chunks and request Gemini TTS audio.
4. Decode WAV narration in Web Audio, combine it with animated Canvas frames through MediaRecorder, and produce a WebM file.
5. Generate SRT captions and a PNG thumbnail locally in the browser.
6. Enforce a measured narration duration of 60–180 seconds.
7. Upload defaults to `private`. The public-publish button is a separate action: the browser asks for explicit confirmation, sends `privacyStatus=public` plus `confirmPublic=true`, and the Worker rejects public uploads without that server-side flag. Scheduled publishing is not exposed in the current Shorts UI. No upload is performed during generation.

## Mobile limitations
- The browser tab must remain open and awake during generation; mobile OS/browser background suspension can pause or terminate rendering.
- Browser support and memory vary by device. If MediaRecorder, Canvas capture, or Web Audio is unavailable, stop with a clear error.
- WebM upload support depends on the connected YouTube upload implementation and Google API/account restrictions. This branch does not claim MP4 output.
- This PR does not deploy the Worker or Pages site and does not publish any video.

## Validation
CI runs JavaScript syntax checks, all `tests/*.mjs` suites, and a Wrangler dry-run. Live Gemini quota, Android device rendering, Google OAuth, and YouTube private upload require a later manual test and are not claimed as verified by static CI.


## The 25 Oddlings recurring character system
- The YouTube studio includes a library of 25 original fantasy troll-like characters with unique names, personality seeds, signature features and color palettes. The canonical metadata lives in `public/characters/manifest.json`.
- The selected character is stored in the existing workspace settings and reused for subsequent episodes until changed.
- The automatic script prompt explicitly centers the episode on the selected character (goal, comic obstacle, reveal and ending), and the 11-stage review is instructed to preserve that identity.
- Each rendered scene includes a matching character illustration, so the cast remains visually present throughout the generated short. The current browser renderer is still a Canvas/WebM renderer; it does not render the GLB mesh directly into the final video.
- `public/characters/manifest.json` currently lists 25 character identities and intended GLB filenames only. The repository does **not** contain the referenced GLB files or a supplied 25-model 3D ZIP.
- The 25 in-app portraits are procedurally drawn 2D Canvas PNG artwork. The downloadable character ZIP from PR #66 contains those PNG portraits and a JSON manifest; it is not a GLB pack.
- The current video renderer uses the procedural Canvas character illustrations. No rigged/animated GLB assets, facial rig, or direct 3D video rendering are included yet. Do not describe the character pack as 3D until real model files have been produced, validated and tested.


## Procedural character animation and publishing
- The rendered video now animates the selected character with a looping idle bounce, body sway, alternating arm gestures, leg movement, eye blinks, talking mouth motion, and floating sparkles. The picker cards also have lightweight CSS idle motion with reduced-motion support.
- No GLB source meshes are currently included in the repository. The character motion in the generated video is procedural Canvas animation, not skeletal GLB animation. This is a mobile-friendly 2D renderer; it does not claim full 3D skeletal animation.
- The generated-video publish button requests explicit confirmation, then sends `privacyStatus=public` and `confirmPublic=true`. The Worker enforces this explicit server-side confirmation before public upload. No upload occurs until the user presses the button and confirms.
- Current YouTube Data API documentation states that uploads from unverified API projects are not restricted to private viewing mode. The Worker still requires an explicit `confirmPublic=true` guard for public visibility. See the official videos resource and insert reference.
- Uploads are subject to YouTube Data API quota: the current API docs describe a dedicated `videos.insert` bucket of 100 calls/day and a separate `search.list` bucket of 100 calls/day; other methods share the 10,000-unit daily bucket. Limits can change.
