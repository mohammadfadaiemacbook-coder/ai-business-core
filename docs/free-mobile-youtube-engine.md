# Free mobile YouTube short-video engine

## Scope
This branch adds a zero-paid-provider short-video path to the existing PWA. Target output is an English 60–180 second YouTube video rendered in the browser on Android Chrome or another browser that supports Canvas captureStream, MediaRecorder, and Web Audio.

## Free-tier provider policy
- English narration uses the Google Gemini Developer API TTS model `gemini-2.5-flash-preview-tts` through the authenticated Worker route.
- The Gemini key is read from the encrypted Worker provider store (`geminiKey`), or from the existing Gemini secondary-provider key only when its configured URL is the official `generativelanguage.googleapis.com` host. It is never sent to the browser.
- English narration never falls back to ElevenLabs or another paid provider. A Gemini quota/rate-limit error stops production.
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
7. The generated-video upload helper is private-only. Public publishing and scheduled public publishing are disabled in this branch.

## Mobile limitations
- The browser tab must remain open and awake during generation; mobile OS/browser background suspension can pause or terminate rendering.
- Browser support and memory vary by device. If MediaRecorder, Canvas capture, or Web Audio is unavailable, stop with a clear error.
- WebM upload support depends on the connected YouTube upload implementation and Google API/account restrictions. This branch does not claim MP4 output.
- This PR does not deploy the Worker or Pages site and does not publish any video.

## Validation
CI runs JavaScript syntax checks, all `tests/*.mjs` suites, and a Wrangler dry-run. Live Gemini quota, Android device rendering, Google OAuth, and YouTube private upload require a later manual test and are not claimed as verified by static CI.
