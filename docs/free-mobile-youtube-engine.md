# Free mobile YouTube short-video engine

## Scope
This branch adds a zero-paid-provider short-video path to the existing PWA. Target output is an English 60–180 second YouTube video rendered in the browser on Android Chrome or another browser that supports Canvas captureStream, MediaRecorder, and Web Audio.

## Free-tier provider policy
- Video topic analysis, script, metadata and the 11-stage review use a dedicated `freeOnly` Worker path pinned to Google Gemini 2.5 Flash; it never calls the configured primary provider, paid secondary provider, or paid review model.\n- English narration uses the Google Gemini Developer API TTS model `gemini-2.5-flash-preview-tts` through the authenticated Worker route.
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
7. The generated-video upload helper is private-only. Public publishing and scheduled public publishing are disabled in this branch.

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
- Use **Import character ZIP** once in the YouTube studio and select the supplied `AI_Business_Core_25_3D_Characters.zip`. The app validates that all 25 GLB models are present and stores them in IndexedDB on that browser/device. The selected GLB can then be previewed in the built-in 3D viewer.
- Imported models are local to that browser profile/device. They are not automatically synced to another phone or browser. Import the ZIP on each device where the 3D previews are needed.
- The GLB models are static and unrigged. The current video renderer uses a stylized Canvas character illustration rather than GLB animation. Rigging, facial animation, and direct 3D video rendering remain a separate future production task.


## Procedural character animation and publishing
- The rendered video now animates the selected character with a looping idle bounce, body sway, alternating arm gestures, leg movement, eye blinks, talking mouth motion, and floating sparkles. The picker cards also have lightweight CSS idle motion with reduced-motion support.
- The GLB source meshes remain static/unrigged. Their interactive preview can rotate, while the video uses a procedural animated Canvas character rather than skeletal GLB animation. This is a mobile-friendly renderer; it does not claim full 3D skeletal animation.
- The generated-video publish button requests explicit confirmation, then sends `privacyStatus=public` and `confirmPublic=true`. The Worker enforces this explicit server-side confirmation before public upload. No upload occurs until the user presses the button and confirms.
- YouTube API projects that have not completed YouTube's required audit may be restricted to private uploads even when the API request asks for public. This cannot be bypassed by the app; the channel/API project must meet YouTube's requirements.
- Uploads are subject to YouTube Data API quota. Free video production does not mean unlimited API uploads.
