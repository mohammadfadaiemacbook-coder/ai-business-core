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

test("media rendering accepts the cloud workspace token when the AI form token is absent", () => {
  assert.match(app, /const mediaToken=aiToken\|\|cloudToken/);
  assert.match(app, /authorization":"Bearer "\+mediaToken/);
});

test("subtitle export and human approval before posting remain present", () => {
  assert.match(app, /generatedSubtitlesBlob=new Blob/);
  assert.match(app, /confirm\("این پاسخ با نام کانال یوتیوب منتشر شود؟"\)/);
});

test("public YouTube upload requires explicit server-side confirmation", () => {
  assert.match(worker, /requestedPrivacy === "public"[\\s\\S]{0,180}confirmPublic/);
  assert.match(app, /publicRequested&&!\\$\\("#yt-confirm-public"\\)\\?\\.checked/);
  assert.match(app, /body\\.set\\("confirmPublic","true"\\)/);
});

test("bearer token comparison is constant-time and minimum token length remains enforced", () => {
  assert.match(worker, /function constantTimeEqual/);
  assert.match(worker, /constantTimeEqual\\(supplied/);
  assert.match(worker, /expected\\.length>=24/);
});

test("provider secrets use workspace/key authenticated encryption with legacy migration", () => {
  assert.match(worker, /additionalData:aad/);
  assert.match(worker, /workspace\\+"\\\\\\\\0"\\+row\\.secret_key/);
  assert.match(worker, /if\\(legacy\\)/);
  assert.match(worker, /Unable to decrypt provider setting/);
});

test("workspace writes use optimistic concurrency and app sends the expected version", () => {
  assert.match(worker, /expectedVersion=body\\?\\.expectedVersion/);
  assert.match(worker, /WHERE workspace_snapshots\\.version=\\?/);
  assert.match(worker, /conflict:true,currentVersion/);
  assert.match(app, /call\\("PUT",\\{data:state,expectedVersion:cloudVersion\\}\\)/);
});

test("OAuth state is atomically consumed and refresh failures require reauthorization", () => {
  assert.match(worker, /UPDATE oauth_states SET consumed_at=\\?[^\\n]+RETURNING \\*/);
  assert.match(worker, /status='needs_reauth'/);
});

test("YouTube upload streams the file and quota failures are mapped to Persian 429 responses", () => {
  assert.match(worker, /body: file\\.stream\\(\\)/);
  assert.doesNotMatch(worker, /file\\.arrayBuffer\\(\\)/);
  assert.match(worker, /سهمیه روزانه YouTube API تمام شده است/);
  assert.match(worker, /quotaExceeded/);
});

test("unapproved origins never receive a null CORS allow-origin header", () => {
  assert.doesNotMatch(worker, /access-control-allow-origin["']?\\s*:\\s*headers\\[[^\\]]+\\]\\s*\\|\\|\\s*["']null["']/);
});

test("unknown YouTube routes are rejected before requesting or refreshing account tokens", () => {
  assert.match(worker, /if\\(!youtubeMethods\\[url\\.pathname\\]\\)return json/);
});
