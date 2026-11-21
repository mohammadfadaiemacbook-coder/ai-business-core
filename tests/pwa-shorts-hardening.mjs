import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile, stat } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../ai-gateway/worker.js", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));

test("PWA manifest has Chromium install sizes and matching raster assets", async () => {
  assert.ok(manifest.id);
  assert.ok(manifest.icons.some(icon => icon.sizes === "192x192" && icon.type === "image/png"));
  assert.ok(manifest.icons.some(icon => icon.sizes === "512x512" && icon.type === "image/png"));
  assert.ok((await stat(new URL("../icons/icon-192.png", import.meta.url))).size > 500);
  assert.ok((await stat(new URL("../icons/icon-512.png", import.meta.url))).size > 1000);
});

test("PWA offers an install button and Apple touch icon", () => {
  assert.match(index, /apple-touch-icon/);
  assert.match(index, /id="pwa-install-button"/);
  assert.match(index, /beforeinstallprompt/);
  assert.match(index, /appinstalled/);
  assert.match(index, /Add to Dock/);
  assert.match(index, /Add to Home Screen/);
});

test("service worker serves fresh network content even when Cache Storage writes fail", async () => {
  const context = {
    self: { location: { origin: "https://app.test" }, addEventListener: () => {}, clients: { claim: async () => {} }, skipWaiting: () => {} },
    caches: { open: async () => ({ put: async () => { throw new Error("quota exceeded"); } }), match: async () => null, keys: async () => [], delete: async () => true },
    Response,
    URL,
    fetch: async () => new Response("network")
  };
  vm.runInNewContext(sw, context);
  const cacheNetworkResponse = vm.runInNewContext("cacheNetworkResponse", context);
  const response = await cacheNetworkResponse("./index.html", new Response("fresh-network"));
  assert.equal(await response.text(), "fresh-network");
});

test("all YouTube production tasks are forced onto the Gemini free-only path server-side", () => {
  const expected = ["youtube_research","video_outline","video_script","title_ideas","youtube_metadata","trend_strategy","comment_reply","thumbnail_brief","yt_plan","yt_viral","yt_edit","yt_retention","yt_shorts","yt_seo","yt_chapters","yt_audit","yt_full_pipeline","social_caption"];
  const workerSet = worker.match(/const YOUTUBE_FREE_ONLY_TASKS = new Set\(\[([\s\S]*?)\]\);/);
  const appSet = app.match(/const YOUTUBE_FREE_ONLY_TASKS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(workerSet && appSet, "both Worker and app must define the free-only task set");
  const values = match => [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
  assert.deepEqual(values(workerSet).sort(), [...expected].sort());
  assert.deepEqual(values(appSet).sort(), [...expected].sort());
  const start = worker.indexOf("if(body.freeOnly===true||YOUTUBE_FREE_ONLY_TASKS.has(body.task)){");
  const end = worker.indexOf("if (!env.AI_API_KEY", start);
  const route = worker.slice(start, end);
  assert.ok(start >= 0 && end > start, "YouTube tasks must enter the Gemini-only branch before paid provider setup");
  assert.match(route, /gemini-3\.5-flash-lite:generateContent/);
  assert.doesNotMatch(route, /env\.AI_API_KEY|AI_SECONDARY_API_KEY|api\.anthropic\.com/);
  assert.match(app, /if\(YOUTUBE_FREE_ONLY_TASKS\.has\(task\)&&u\.origin!==/);
  assert.match(app, /freeOnly:YOUTUBE_FREE_ONLY_TASKS\.has\(task\)/);
});
test("English narration uses the Gemini 3.8 Interactions API with WAV output", () => {
  assert.match(worker, /const model="gemini-3\.8-flash-tts"/);
  assert.doesNotMatch(worker, /gemini-2\.5-flash-preview-tts/);
  assert.doesNotMatch(worker, /mediaSecrets\.geminiTtsModel/);
  const start = worker.indexOf('if (url.pathname === "/api/media/tts"');
  const end = worker.indexOf('if (url.pathname !== "/api/generate")', start);
  const route = worker.slice(start, end);
  assert.match(route, /v1beta\/interactions/);
  assert.match(route, /annotations:\[\{type:"speech_metadata"/);
  assert.match(route, /response_format:\{type:"audio",mime_type:"audio\/wav"\}/);
  assert.match(route, /result\.steps/);
  assert.match(route, /item\.type==="audio"/);
  assert.doesNotMatch(route, /:generateContent|candidates|inlineData/);
  assert.doesNotMatch(route, /api\.elevenlabs\.com/);
});

test("YouTube preview copy distinguishes private upload from separately confirmed public publishing", () => {
  assert.doesNotMatch(app, /در این مرحله فقط بارگذاری خصوصی فعال است/);
  assert.match(app, /confirm\("تأیید انتشار عمومی/);
});

test("manual YouTube script generation restricts every YouTube task to the official free gateway", () => {
  assert.match(app, /if\(YOUTUBE_FREE_ONLY_TASKS\.has\(task\)&&u\.origin!==/);
  assert.match(app, /freeOnly:YOUTUBE_FREE_ONLY_TASKS\.has\(task\)/);
  assert.match(app, /برای موتور ویدئوی رایگان فقط درگاه رسمی Gemini همین پروژه مجاز است/);
  assert.match(worker, /if\(body\.freeOnly===true\|\|YOUTUBE_FREE_ONLY_TASKS\.has\(body\.task\)\)/);
});
test("video repair keeps free-only requests on the official Gemini gateway", () => {
  const start = app.indexOf('if(a==="video-fix"){');
  const end = app.indexOf('if(a==="video-build")', start);
  const handler = app.slice(start, end);
  const guard = handler.indexOf('const freeEndpoint=new URL(endpoint)');
  const request = handler.indexOf('workerFetch(endpoint');
  assert.ok(start >= 0 && end > start, "video-fix handler must be present");
  assert.ok(guard >= 0 && request > guard, "endpoint guard must run before any token-bearing fetch");
  assert.ok(handler.includes('freeEndpoint.origin!=="https://ai-business-core.mohammadfadaiemacbook.workers.dev"'));
  assert.ok(handler.includes('freeEndpoint.pathname!=="/api/generate"'));
});

test("Shorts renderer produces vertical 9:16 video, readable captions and a portrait thumbnail", () => {
  assert.match(app, /canvas\.width=720;canvas\.height=1280/);
  assert.match(app, /ctx\.canvas\.width\|\|720/);
  assert.match(app, /height-320/);
  assert.match(app, /slides\.length>18/);
  assert.match(app, /aspect-ratio:9\/16/);
  assert.match(app, /AI BUSINESS CORE/);
  assert.match(app, /generatedThumbnailBlob=await new Promise/);
});
