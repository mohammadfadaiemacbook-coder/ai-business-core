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
  assert.match(worker, /body\.freeOnly===true\|\|\["trend_strategy","youtube_research","video_outline","video_script","title_ideas","youtube_metadata","thumbnail_brief","yt_full_pipeline","social_caption"\]\.includes\(body\.task\)/);
  const start = worker.indexOf("if(body.freeOnly===true");
  const end = worker.indexOf('if (!env.AI_API_KEY', start);
  const route = worker.slice(start, end);
  assert.match(route, /gemini-3\.5-flash-lite:generateContent/);
  assert.doesNotMatch(route, /env\.AI_API_KEY|AI_SECONDARY_API_KEY|api\.anthropic\.com/);
});

test("English narration is pinned to the current free-tier Gemini 3.1 Flash TTS Preview model", () => {
  assert.match(worker, /const model="gemini-3.1-flash-tts-preview"/);
  assert.doesNotMatch(worker, /gemini-2\.5-flash-preview-tts/);
  assert.doesNotMatch(worker, /mediaSecrets\.geminiTtsModel/);
  const start = worker.indexOf('if (url.pathname === "/api/media/tts"');
  const end = worker.indexOf('if (url.pathname !== "/api/generate")', start);
  const english = worker.slice(start, end);
  assert.match(english, /no paid fallback is enabled/i);
  assert.doesNotMatch(english.slice(english.indexOf('if(language==="en")'), english.indexOf("const ttsKey=")), /api\.elevenlabs\.com/);
});

test("YouTube preview copy does not claim private-only while exposing a separately confirmed public action", () => {
  assert.doesNotMatch(app, /در این مرحله فقط بارگذاری خصوصی فعال است/);
  assert.match(app, /confirm\("تأیید انتشار عمومی/);
});

test("manual YouTube script generation sends freeOnly and refuses external provider endpoints", () => {
  assert.match(app, /freeOnly:\["trend_strategy","youtube_research","video_outline","video_script","title_ideas","youtube_metadata","thumbnail_brief","yt_full_pipeline","social_caption"\]\.includes\(task\)/);
  assert.match(app, /u\.origin!==\"https:\/\/ai-business-core\.mohammadfadaiemacbook\.workers\.dev\"/);
  assert.match(app, /برای موتور ویدئوی رایگان فقط درگاه رسمی Gemini همین پروژه مجاز است/);
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
