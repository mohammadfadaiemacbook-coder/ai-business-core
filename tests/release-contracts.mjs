import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, app, wranglerTemplate, releaseWorkflow, baseMigration, compatibilityMigration] = await Promise.all([
  readFile(new URL("../ai-gateway/worker.js", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../ai-gateway/wrangler.toml.example", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/release-complete.yml", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0001_v2_social_foundation.sql", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0004_legacy_schema_compat.sql", import.meta.url), "utf8")
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

test("long-form video recorder requires synthesized Persian narration and attaches it to the video stream", () => {
  assert.match(app, /createMediaStreamDestination/);
  assert.match(app, /audioDestination\.stream\.getAudioTracks\(\)/);
  assert.match(app, /برای ساخت ویدئوی بلند با گویندگی فارسی/);
  assert.match(app, /decodeAudioData\(audioParts\[i\]\.slice\(0\)\)/);
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
  assert.ok(worker.includes('requestedPrivacy === "public"'));
  assert.ok(worker.includes('confirmPublic'));
  assert.ok(app.includes('id="yt-confirm-public"'));
  assert.ok(app.includes('body.set("confirmPublic","true")'));
});

test("bearer token comparison is constant-time and minimum token length remains enforced", () => {
  assert.ok(worker.includes("function constantTimeEqual"));
  assert.ok(worker.includes("constantTimeEqual(supplied"));
  assert.ok(worker.includes("secret.length<24"));
});

test("provider secrets use workspace/key authenticated encryption with legacy migration", () => {
  assert.ok(worker.includes("additionalData:aad"));
  assert.ok(worker.includes("workspace+"));
  assert.ok(worker.includes("legacy=true"));
  assert.ok(worker.includes("Unable to decrypt provider setting"));
});

test("workspace writes use optimistic concurrency and app sends the expected version", () => {
  assert.ok(worker.includes("expectedVersion=body?.expectedVersion"));
  assert.ok(worker.includes("WHERE workspace_snapshots.version=?"));
  assert.ok(worker.includes("conflict:true,currentVersion"));
  assert.ok(app.includes('call("PUT",{data:state,expectedVersion:cloudVersion})'));
});

test("OAuth state is atomically consumed and refresh failures require reauthorization", () => {
  assert.ok(worker.includes("UPDATE oauth_states SET consumed_at=?"));
  assert.ok(worker.includes("RETURNING *"));
  assert.ok(worker.includes("status='needs_reauth'"));
});

test("YouTube upload streams the file and quota failures are mapped to Persian 429 responses", () => {
  assert.ok(worker.includes("body: file.stream()"));
  assert.ok(!worker.includes("file.arrayBuffer()"));
  assert.ok(worker.includes("سهمیه روزانه YouTube API تمام شده است"));
  assert.ok(worker.includes("quotaExceeded"));
});

test("unapproved origins never receive a null CORS allow-origin header", () => {
  assert.ok(!worker.includes('||"null"'));
  assert.ok(!worker.includes('|| "null"'));
});

test("unknown YouTube routes are rejected before requesting or refreshing account tokens", () => {
  assert.ok(worker.includes('if(!youtubeMethods[url.pathname])return json'));
});

test("Worker exchanges the master token for a workspace-scoped 15-minute signed session", () => {
  assert.ok(worker.includes('url.pathname === "/api/auth/session"'));
  assert.ok(worker.includes("expiresIn:900"));
  assert.ok(worker.includes('payload.aud!=="ai-business-core"'));
  assert.ok(worker.includes("payload.exp-payload.iat>900"));
  assert.ok(worker.includes("crypto.subtle.verify"));
  assert.ok(app.includes("workerSessionCache"));
  assert.ok(app.includes("/api/auth/session?workspace="));
  assert.ok(app.includes('headers.set("authorization","Bearer "+session.sessionToken)'));
});

test("provider secrets use migrations rather than request-time CREATE TABLE statements", () => {
  assert.ok(!worker.includes("CREATE TABLE"));
  assert.ok(worker.includes("await ensureWorkspace(env.DB,workspace)"));
});

test("workspace sync rejects stale versions before attempting a write", () => {
  assert.ok(worker.includes("currentSnapshot?.version||0)!==expectedVersion"));
  assert.ok(worker.includes("conflict:true,currentVersion"));
});

test("Worker initializes request URL before routing the session exchange", () => {
  const fetchStart = worker.indexOf("async fetch(request, env)");
  const urlInit = worker.indexOf('const url = new URL(request.url);', fetchStart);
  const sessionRoute = worker.indexOf('if (url.pathname === "/api/auth/session")', fetchStart);
  assert.ok(fetchStart >= 0 && urlInit > fetchStart && sessionRoute > urlInit);
});

test("Cloud sync preserves local data and downloads a backup on version conflict", () => {
  assert.ok(app.includes("error.status=response.status"));
  assert.ok(app.includes('err.status===409'));
  assert.ok(app.includes("ai-business-core-conflict-backup.json"));
  assert.ok(app.includes("داده محلی دست‌نخورده ماند"));
});

test("Provider endpoints require public HTTPS and empty values delete stored secrets", () => {
  assert.ok(worker.includes("function safeProviderUrl(value)"));
  assert.ok(worker.includes('url.protocol!=="https:"'));
  assert.ok(worker.includes('host==="localhost"'));
  assert.ok(worker.includes('fetch(safeProviderUrl(secondaryUrl)'));
  assert.ok(worker.includes('fetch(safeProviderUrl(imageUrl)'));
  assert.ok(worker.includes('DELETE FROM provider_secrets WHERE workspace_id=? AND secret_key=?'));
});

test("Cloudflare deployment preserves existing vars and does not replace the configured AI model", () => {
  assert.ok(wranglerTemplate.includes("keep_vars = true"));
  assert.ok(wranglerTemplate.includes('ALLOWED_ORIGIN = "https://mohammadfadaiemacbook-coder.github.io"'));
  assert.ok(!/^AI_API_URL\\s*=/m.test(wranglerTemplate));
  assert.ok(!/^AI_MODEL\\s*=/m.test(wranglerTemplate));
});

test("production release requires explicit manual confirmation and deploys Worker before Pages", () => {
  assert.ok(releaseWorkflow.includes("workflow_dispatch:"));
  assert.ok(releaseWorkflow.includes("release_confirmation:"));
  assert.ok(releaseWorkflow.includes("- NO"));
  assert.ok(releaseWorkflow.includes("- RELEASE"));
  assert.ok(releaseWorkflow.includes("if: inputs.release_confirmation == 'RELEASE'"));
  assert.ok(!releaseWorkflow.includes("  push:"));
  assert.ok(releaseWorkflow.includes("needs: deploy-worker"));
  assert.ok(releaseWorkflow.includes("deploy-web:"));
  assert.ok(releaseWorkflow.indexOf("Export D1 backup before migration") < releaseWorkflow.indexOf("Apply pending D1 migrations"));
  assert.ok(!releaseWorkflow.includes("build-android"));
});

test("long-form YouTube video builds a preview and requires explicit publishing", () => {
  assert.match(worker, /LONG-FORM YouTube video script designed for an 8–12 minute/);
  assert.match(app, /سناریوی ویدئوی بلند ۸ تا ۱۲ دقیقه‌ای/);
  assert.match(app, /slides\.length>48/);
  assert.match(app, /decodeAudioData\(audioParts\[i\]\.slice\(0\)\)/);
  assert.match(app, /requestAnimationFrame\(animate\)/);
  assert.match(app, /async function uploadGeneratedVideo\(\)/);
  assert.match(app, /video-publish/);
  assert.match(app, /پیش‌نمایش را کامل بررسی کن/);
  assert.doesNotMatch(app, /autopilot-auto-upload/);
  assert.match(app, /autopilot-public/);
  assert.match(app, /autopilot-publish-at/);
});

test("D1 compatibility migration adds legacy columns before creating their indexes", () => {
  assert.equal(baseMigration.includes("idx_content_workspace"), false);
  assert.equal(baseMigration.includes("idx_approvals_workspace_status"), false);
  assert.equal(baseMigration.includes("idx_publish_jobs_due"), false);
  assert.ok(compatibilityMigration.indexOf("ALTER TABLE content_items ADD COLUMN workspace_id") < compatibilityMigration.indexOf("CREATE INDEX IF NOT EXISTS idx_content_workspace"));
  assert.ok(compatibilityMigration.includes("UPDATE content_items SET workspace_id = 'default'"));
  assert.ok(compatibilityMigration.includes("UPDATE media_assets SET workspace_id = 'default'"));
  assert.ok(compatibilityMigration.includes("UPDATE approval_requests SET workspace_id = 'default'"));
  assert.ok(compatibilityMigration.includes("UPDATE publish_jobs SET workspace_id = 'default'"));
  assert.ok(compatibilityMigration.includes("ALTER TABLE audit_events ADD COLUMN event_type"));
  assert.ok(compatibilityMigration.includes("ALTER TABLE campaigns ADD COLUMN brief_json"));
});
