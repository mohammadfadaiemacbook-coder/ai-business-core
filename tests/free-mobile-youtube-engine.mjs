import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../ai-gateway/worker.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("all short-video text generation is pinned to Gemini free tier", () => {
  const start = worker.indexOf("if(body.freeOnly===true)");
  const end = worker.indexOf('if (!env.AI_API_KEY', start);
  const route = worker.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /gemini-2\.5-flash:generateContent/);
  assert.doesNotMatch(route, /env\.AI_API_KEY|AI_SECONDARY_API_KEY|api\.anthropic\.com/);
  assert.match(app, /body:JSON\.stringify\(\{task,inputs,freeOnly:true\}\)/);
  assert.match(app, /task:"video_script",freeOnly:true/);
  assert.match(app, /task:"yt_full_pipeline",freeOnly:true/);
});

test("English free TTS uses Gemini and has no paid fallback", () => {
  assert.match(worker, /mediaSecrets\.geminiKey/);
  assert.match(worker, /gemini-2\.5-flash-preview-tts/);
  const start = worker.indexOf('if (url.pathname === "/api/media/tts"');
  const end = worker.indexOf('if (url.pathname !== "/api/generate")', start);
  const route = worker.slice(start, end);
  const english = route.slice(route.indexOf('if(language==="en")'), route.indexOf('const ttsKey='));
  assert.match(english, /generativelanguage\.googleapis\.com/);
  assert.match(english, /no paid fallback is enabled/i);
  assert.doesNotMatch(english, /api\.elevenlabs\.com/);
});

test("short-video script and measured narration are bounded to 1–3 minutes", () => {
  assert.match(worker, /1–3 minute finished video/);
  assert.match(worker, /220–380 spoken English words/);
  assert.match(app, /totalNarrationSeconds<60\|\|totalNarrationSeconds>180/);
});

test("browser renderer composes Canvas, audio, captions and thumbnail without paid image calls", () => {
  const start = app.indexOf('if(a==="video-build"){');
  const end = app.indexOf('if(a==="video-publish"){', start);
  const renderer = app.slice(start, end);
  assert.match(renderer, /canvas\.captureStream\(24\)/);
  assert.match(renderer, /new MediaRecorder\(stream/);
  assert.match(renderer, /audioContext\.createMediaStreamDestination\(\)/);
  assert.doesNotMatch(renderer, /api\/media\/image\?workspace/);
  assert.match(renderer, /generatedSubtitlesBlob=new Blob/);
  assert.match(renderer, /const spokenScript=aiOutput\.split/);
  assert.match(renderer, /generatedThumbnailBlob=await new Promise/);
});

test("generated video can be published publicly only after an explicit user confirmation", () => {
  const start = app.indexOf("async function uploadGeneratedVideo(privacyStatus=");
  const end = app.indexOf("\\nfunction render()", start);
  const upload = app.slice(start, end);
  assert.match(upload, /body\\.append\\("privacyStatus",privacyStatus\\)/);
  assert.match(upload, /privacyStatus==="public"\\)body\\.append\\("confirmPublic","true"\\)/);
  const publishAt = app.indexOf('if(a==="video-publish"){');
  const handler = app.slice(publishAt, app.indexOf('if(a==="video-download-again"', publishAt));
  assert.match(handler, /confirm\\("تأیید انتشار عمومی/);
  assert.match(handler, /uploadGeneratedVideo\\("public"\\)/);
  assert.match(worker, /requestedPrivacy === "public" && String\\(form\\.get\\("confirmPublic"\\) \\|\\| ""\\) !== "true"/);
});
test("single PWA entry remains in place; no renderer or R2 service is introduced", () => {
  assert.match(index, /src="app\.js"/);
  assert.doesNotMatch(app, /queueGeneratedVideoForRenderer|renderer-queue|renderer-status/);
});


test("25 original Oddlings are available as a persistent selectable character cast", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/characters/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.characters.length, 25);
  assert.equal(new Set(manifest.characters.map(x => x.name)).size, 25);
  assert.match(app, /const ODDLINGS=/);
  assert.match(app, /indexedDB\.open\(CHARACTER_DB,1\)/);
  assert.match(app, /async function importOddlingZip\(file\)/);
  assert.match(app, /rows\.length!==25/);
  assert.ok(app.includes('data-action="oddling-import"'));
  assert.ok(app.includes('data-action="oddling-select"'));
  assert.match(app, /model-viewer/);
});

test("automatic episode prompt is centered on one persistent selected Oddling", () => {
  assert.match(app, /const character=selectedOddling\(\)/);
  assert.match(app, /Main recurring character:/);
  assert.match(app, /drawOddling\(ctx,selectedOddling\(\),progress\)/);
  assert.match(app, /state\.settings\.selectedCharacterId=id/);
});


test("Oddlings are procedurally animated during video rendering", () => {
  const start=app.indexOf("function drawOddling(ctx,character,progress=0");
  const end=app.indexOf("\\nfunction isDuplicateVideo",start);
  const animation=app.slice(start,end);
  assert.match(animation,/Math\\.sin\\(t\\*5\\.4\\)/);
  assert.match(animation,/ctx\\.rotate\\(/);
  assert.match(animation,/blink/);
  assert.match(animation,/Math\\.sin\\(t\\*8\\)/);
  assert.match(app,/drawOddling\\(ctx,selectedOddling\\(\\),progress,index\\)/);
});
