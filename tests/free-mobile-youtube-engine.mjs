import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../ai-gateway/worker.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("every allowed text-generation task is server-enforced onto Gemini free tier", () => {
  assert.match(worker, /const FREE_ONLY_TEXT_TASKS = new Set\\(ALLOWED_TASKS\\)/);
  const start = worker.indexOf("if(body.freeOnly===true||FREE_ONLY_TEXT_TASKS.has(body.task)){");
  const end = worker.indexOf("if (!env.AI_API_KEY", start);
  const route = worker.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /gemini-2\\.5-flash:generateContent/);
  assert.doesNotMatch(route, /env\\.AI_API_KEY|AI_SECONDARY_API_KEY|api\\.anthropic\\.com/);
});

test("English TTS is Gemini-only and Persian TTS fails closed before paid providers", () => {
  const start = worker.indexOf('if (url.pathname === "/api/media/tts" && request.method === "POST")');
  const end = worker.indexOf('if (url.pathname !== "/api/generate")', start);
  const route = worker.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /if\\(language!==\\"en\\"\\)return json/);
  assert.match(route, /generativelanguage\\.googleapis\\.com/);
  assert.doesNotMatch(route, /api\\.elevenlabs\\.com|ELEVENLABS_API_KEY|ttsKey/);
});

test("external image generation is disabled in the zero-cost build", () => {
  const start = worker.indexOf('if (url.pathname === "/api/media/image" && request.method === "POST")');
  const end = worker.indexOf('if (url.pathname === "/api/media/tts" && request.method === "POST")', start);
  const route = worker.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /External image generation is disabled in the zero-cost build/);
  assert.doesNotMatch(route, /loadProviderSecrets|safeProviderUrl|fetchWithTimeout|IMAGE_API_URL|imageApiKey/);
  assert.match(worker, /imageGeneration:false/);
  assert.doesNotMatch(app, /data-action="video-image"/);
  assert.match(app, /تصویرسازی خارجی در نسخه بدون هزینه غیرفعال است/);
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


