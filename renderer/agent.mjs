#!/usr/bin/env node
import { readFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { openAsBlob, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

async function loadEnvFile() {
  try {
    const raw = requireText(await readFile(new URL("./.env", import.meta.url), "utf8"));
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
function requireText(value) { return String(value); }
await loadEnvFile();

const API = String(process.env.AIBC_WORKER_URL || "https://ai-business-core.mohammadfadaiemacbook.workers.dev").replace(/\/+$/, "");
const WORKSPACE = String(process.env.AIBC_WORKSPACE || "default");
const TOKEN = String(process.env.AIBC_RENDERER_TOKEN || "");
const WORKER_ID = String(process.env.AIBC_RENDERER_ID || hostname().replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 70) || "mac-renderer");
const FFMPEG = String(process.env.FFMPEG_BIN || "ffmpeg");
const OLLAMA_URL = String(process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const OLLAMA_MODEL = String(process.env.OLLAMA_MODEL || "qwen3:4b");
const POLL_MS = Math.max(2000, Number(process.env.AIBC_POLL_MS || 5000));
let stopping = false;

if (TOKEN.length < 32) {
  console.error("AIBC_RENDERER_TOKEN is missing or too short. Set the same 32+ character secret as Worker secret RENDERER_SHARED_SECRET.");
  process.exit(1);
}
if (!/^[a-zA-Z0-9_-]{3,64}$/.test(WORKSPACE)) {
  console.error("AIBC_WORKSPACE must be 3-64 letters, numbers, underscores or hyphens.");
  process.exit(1);
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      authorization: "Bearer " + TOKEN,
      ...(options.headers || {})
    },
    signal: options.signal || AbortSignal.timeout(180000)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error("HTTP " + response.status + " from " + path + ": " + body.slice(0, 500));
  }
  const type = response.headers.get("content-type") || "";
  return type.includes("application/json") ? response.json() : response;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr = (stderr + chunk.toString()).slice(-5000);
      const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines.slice(-2)) process.stdout.write("[ffmpeg] " + line + "\n");
    });
    child.on("error", error => reject(new Error("Could not start FFmpeg. Install it with Homebrew: brew install ffmpeg. " + error.message)));
    child.on("close", code => code === 0 ? resolve() : reject(new Error("FFmpeg exited with code " + code + ": " + stderr.slice(-1800))));
  });
}

async function localOllamaReview(job) {
  try {
    const response = await fetch(OLLAMA_URL + "/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        prompt: "You are a local quality-control reviewer for an English educational YouTube video. Return JSON with keys status, language, titleRisk, scriptRisks, recommendations. Do not rewrite the script and do not claim external fact checking. Review only the supplied title and script.\nTITLE: " + String(job.draft_title || "").slice(0, 300) + "\nSCRIPT: " + String(job.draft_script || "").slice(0, 7000)
      }),
      signal: AbortSignal.timeout(90000)
    });
    if (!response.ok) return { status: "skipped", reason: "Ollama HTTP " + response.status, model: OLLAMA_MODEL };
    const data = await response.json();
    const raw = String(data.response || "").trim();
    try { return { status: "completed", model: OLLAMA_MODEL, review: JSON.parse(raw) }; }
    catch { return { status: "completed", model: OLLAMA_MODEL, reviewText: raw.slice(0, 5000) }; }
  } catch (error) {
    return { status: "skipped", model: OLLAMA_MODEL, reason: String(error.message || error).slice(0, 300) };
  }
}

async function processJob(job) {
  const directory = await mkdtemp(join(tmpdir(), "aibc-render-"));
  const sourcePath = join(directory, "source.webm");
  const outputPath = join(directory, "rendered.mp4");
  const heartbeat = setInterval(() => {
    api("/api/renderer/jobs/" + encodeURIComponent(job.id) + "/heartbeat?workspace=" + encodeURIComponent(WORKSPACE), {
      method: "POST",
      headers: { "x-renderer-id": WORKER_ID, "content-type": "application/json" },
      body: JSON.stringify({ workerId: WORKER_ID })
    }).catch(error => console.error("[heartbeat]", error.message));
  }, 60000);
  try {
    console.log("[job] Downloading source asset " + job.source_asset_id);
    const source = await api("/api/media/assets/" + encodeURIComponent(job.source_asset_id) + "?workspace=" + encodeURIComponent(WORKSPACE));
    if (!source.body) throw new Error("Source video response has no readable body.");
    await pipeline(source.body, createWriteStream(sourcePath, { flags: "wx" }));
    const sourceInfo = await stat(sourcePath);
    if (!sourceInfo.size || sourceInfo.size > 64 * 1024 * 1024) throw new Error("Source video is empty or exceeds 64 MB.");
    console.log("[job] Rendering with FFmpeg");
    await runFfmpeg([
      "-y", "-i", sourcePath,
      "-map", "0:v:0", "-map", "0:a?",
      "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
      "-maxrate", "2500k", "-bufsize", "5000k", outputPath
    ]);
    const outputInfo = await stat(outputPath);
    if (!outputInfo.size || outputInfo.size > 64 * 1024 * 1024) throw new Error("Rendered MP4 is empty or exceeds the 64 MB upload limit.");
    console.log("[job] Running local Ollama quality review");
    const qaReport = await localOllamaReview(job);
    const output = await openAsBlob(outputPath, { type: "video/mp4" });
    const form = new FormData();
    form.append("file", output, "nexora-rendered.mp4");
    form.append("qaReport", JSON.stringify(qaReport));
    await api("/api/renderer/jobs/" + encodeURIComponent(job.id) + "/complete?workspace=" + encodeURIComponent(WORKSPACE), {
      method: "POST",
      headers: { "x-renderer-id": WORKER_ID },
      body: form
    });
    console.log("[job] Completed and stored MP4 in Mac-local media storage. Ollama review: " + qaReport.status);
  } finally {
    clearInterval(heartbeat);
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log("AI Business Core local renderer");
  console.log("Worker: " + API + " · workspace: " + WORKSPACE + " · renderer: " + WORKER_ID);
  console.log("FFmpeg: " + FFMPEG + " · Ollama: " + OLLAMA_URL + " (" + OLLAMA_MODEL + ")");
  while (!stopping) {
    try {
      const result = await api("/api/renderer/jobs/claim?workspace=" + encodeURIComponent(WORKSPACE), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workerId: WORKER_ID })
      });
      if (result.job) {
        console.log("[queue] Claimed " + result.job.id + " (attempt " + result.job.attempts + "/" + result.job.max_attempts + ")");
        try {
          await processJob(result.job);
        } catch (error) {
          console.error("[job] " + error.message);
          await api("/api/renderer/jobs/" + encodeURIComponent(result.job.id) + "/fail?workspace=" + encodeURIComponent(WORKSPACE), {
            method: "POST",
            headers: { "x-renderer-id": WORKER_ID, "content-type": "application/json" },
            body: JSON.stringify({ workerId: WORKER_ID, error: String(error.message || error).slice(0, 1000) })
          }).catch(failError => console.error("[queue] Could not report failure: " + failError.message));
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
    } catch (error) {
      console.error("[poll] " + error.message);
      await new Promise(resolve => setTimeout(resolve, Math.max(POLL_MS, 10000)));
    }
  }
  console.log("Renderer stopped.");
}
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
await main();
