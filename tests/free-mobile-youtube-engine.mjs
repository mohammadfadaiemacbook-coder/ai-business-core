import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../ai-gateway/worker.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const docs = await readFile(new URL("../docs/free-mobile-youtube-engine.md", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../public/characters/manifest.json", import.meta.url), "utf8"));

test("all short-video text generation is pinned to Gemini free tier", () => {
  const start = worker.indexOf('if(body.freeOnly===true||["trend_strategy"');
  const end = worker.indexOf('if (!env.AI_API_KEY', start);
  const route = worker.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /gemini-3\.5-flash-lite:generateContent/);
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
  const end = app.indexOf("function render()", start);
  const upload = app.slice(start, end);
  assert.ok(upload.includes('body.append("privacyStatus",privacyStatus)'));
  assert.ok(upload.includes('if(privacyStatus==="public")body.append("confirmPublic","true")'));
  const publishAt = app.indexOf('if(a==="video-publish"){');
  const handler = app.slice(publishAt, app.indexOf('if(a==="video-download-again"', publishAt));
  assert.ok(handler.includes('confirm("تأیید انتشار عمومی'));
  assert.ok(handler.includes('uploadGeneratedVideo("public")'));
  assert.ok(worker.includes('requestedPrivacy === "public" && String(form.get("confirmPublic") || "") !== "true"'));
});

test("Oddlings use animated procedural portraits during video rendering", () => {
  const start=app.indexOf("function drawOddling(ctx,character,progress=0");
  const end=app.indexOf("function isDuplicateVideo",start);
  const animation=app.slice(start,end);
  assert.ok(animation.includes("Math.sin(t*2.5+id)"));
  assert.ok(animation.includes("ctx.rotate("));
  assert.ok(animation.includes("drawOddlingPortrait(portrait,character,true)"));
  assert.ok(animation.includes("window.__oddlingPortraitCache"));
  assert.ok(app.includes("drawOddling(ctx,selectedOddling(),progress,index)"));
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
  assert.ok(app.includes('oddling-pack-download'));
  assert.ok(app.includes('data-action="oddling-select"'));
  assert.match(app, /model-viewer/);
});

test("automatic episode prompt is centered on one persistent selected Oddling", () => {
  assert.match(app, /const character=selectedOddling\(\)/);
  assert.match(app, /Main recurring character:/);
  assert.ok(app.includes("drawOddling(ctx,selectedOddling(),progress,index)"));
  assert.match(app, /state\.settings\.selectedCharacterId=id/);
});



test("short-video documentation matches Gemini model and explicit publishing safeguards", () => {
  assert.ok(worker.includes("gemini-3.5-flash-lite:generateContent"));
  assert.ok(docs.includes("Gemini 3.5 Flash-Lite"));
  assert.ok(docs.includes("Upload defaults to `private`"));
  assert.ok(docs.includes("confirmPublic=true"));
  assert.ok(docs.includes("Scheduled publishing is not exposed"));
  assert.equal(docs.includes("private-only. Public publishing and scheduled public publishing are disabled"), false);
  assert.ok(app.includes('confirm("تأیید انتشار عمومی'));
  assert.ok(worker.includes('requestedPrivacy === "public" && String(form.get("confirmPublic") || "") !== "true"'));
});

test("character pack documentation and manifest clearly distinguish 2D PNG portraits from missing GLB assets", () => {
  assert.equal(manifest.characters.length, 25);
  assert.ok(manifest.modelNote.includes("No actual GLB model assets are currently included"));
  assert.ok(manifest.assetStatus.includes("metadata-only"));
  assert.ok(manifest.portraitRendering.includes("2D Canvas PNGs"));
  assert.ok(docs.includes("2D Canvas PNG artwork"));
  assert.ok(docs.includes("not a GLB pack"));
  assert.ok(docs.includes("does **not** contain the referenced GLB files"));
});
