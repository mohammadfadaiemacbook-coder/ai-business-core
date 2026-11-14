import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("generated video, subtitles, thumbnail and metadata are persisted in a separate local IndexedDB store", () => {
  assert.match(app, /const VIDEO_DRAFT_DB="aibc-video-drafts-v1"/);
  assert.match(app, /indexedDB\.open\(VIDEO_DRAFT_DB,1\)/);
  assert.match(app, /objectStore\("drafts"\)\.put\(\{/);
  assert.match(app, /video:generatedVideoBlob/);
  assert.match(app, /subtitles:generatedSubtitlesBlob\|\|null/);
  assert.match(app, /thumbnail:generatedThumbnailBlob\|\|null/);
  assert.match(app, /metadata:generatedVideoMetadata\|\|null/);
  assert.match(app, /\.get\("latest"\)/);
});

test("local draft persistence is bounded and storage failure does not discard the in-memory render", () => {
  assert.match(app, /generatedVideoBlob\.size>64\*1024\*1024/);
  assert.match(app, /catch\(storageError\)[\s\S]*?ویدئو ساخته شد، اما نسخه بازیابی‌پذیر ذخیره نشد/);
  assert.match(app, /await persistGeneratedVideoDraft\(\)/);
});

test("saved local video draft is restored after initial render and recreates a playable object URL", () => {
  assert.match(app, /async function restoreGeneratedVideoDraft\(\)/);
  assert.match(app, /generatedVideoUrl=URL\.createObjectURL\(generatedVideoBlob\)/);
  assert.match(app, /void restoreGeneratedVideoDraft\(\)/);
  assert.match(app, /videoDraftPreviewMarkup\(\)/);
});

test("restored preview provides local video, SRT and thumbnail downloads", () => {
  assert.match(app, /data-action="video-download-again"/);
  assert.match(app, /data-action="video-subtitles"/);
  assert.match(app, /data-action="video-thumbnail"/);
});

test("restored preview keeps the safe private-upload path and separately confirmed public-publish action available", () => {
  assert.match(app, /data-action="video-send">انتقال به فرم آپلود خصوصی/);
  assert.match(app, /data-action="video-publish">انتشار عمومی با تأیید جداگانه/);
  assert.match(app, /if\(a==="video-publish"\)[\s\S]*?confirm\(/);
  assert.match(app, /uploadGeneratedVideo\("public"\)/);
  assert.match(app, /if\(a==="video-send"\)[\s\S]*?#yt-video-privacy"\)\.value="private"/);
});

test("restored upload controls appear only in the result panel, not duplicated beside the inline preview", () => {
  assert.match(app, /function videoDraftPreviewMarkup\(includeUploadActions=false\)/);
  assert.match(app, /if\(preview\)preview\.innerHTML=videoDraftPreviewMarkup\(false\)/);
  assert.match(app, /if\(result\)result\.innerHTML=videoDraftPreviewMarkup\(true\)/);
  assert.match(app, /includeUploadActions\?'<button class="button secondary" data-action="video-send"/);
});
