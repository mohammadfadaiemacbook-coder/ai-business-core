import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, app] = await Promise.all([
  readFile(new URL("../ai-gateway/worker.js", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8")
]);

test("all creator studio tasks are allow-listed and have task-specific prompts", () => {
  for (const task of ["social_caption", "comment_reply", "thumbnail_brief"]) {
    assert.match(worker, new RegExp('"'+task+'"'));
    assert.match(worker, new RegExp(task + ': "'));
  }
});

test("Claude review uses Anthropic Messages API and server-side secret storage", () => {
  assert.match(worker, /api\.anthropic\.com\/v1\/messages/);
  assert.match(worker, /"x-api-key":claudeKey/);
  assert.match(worker, /"claudeKey","claudeModel"/);
  assert.match(worker, /claude:!!\(secrets\.claudeKey&&secrets\.claudeModel\)/);
});

test("YouTube reply uses the comment-thread ID required by comments.insert", () => {
  assert.match(worker, /threadId:item\.id,commentId:item\.id/);
  assert.match(worker, /parentId,textOriginal:replyText/);
  assert.match(app, /JSON\.stringify\(\{threadId:item\.threadId,text:reply\}\)/);
});

test("comments that cannot be replied to are not offered a reply composer", () => {
  assert.match(app, /item\.canReply===false/);
});

test("YouTube comment write permission is requested during OAuth", () => {
  assert.match(worker, /youtube\.force-ssl/);
});

test("video recorder includes synthesized audio when available and has a silent fallback", () => {
  assert.match(app, /createMediaStreamDestination/);
  assert.match(app, /audioDestination\.stream\.getAudioTracks\(\)/);
  assert.match(app, /ویدئو بدون گویندگی ساخته می‌شود/);
});

test("subtitle export and human approval before posting remain present", () => {
  assert.match(app, /generatedSubtitlesBlob=new Blob/);
  assert.match(app, /confirm\("این پاسخ با نام کانال یوتیوب منتشر شود؟"\)/);
});
