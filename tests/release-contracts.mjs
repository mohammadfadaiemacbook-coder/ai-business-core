import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, app, wranglerTemplate, releaseWorkflow, baseMigration, compatibilityMigration, rateLimitMigration] = await Promise.all([
  readFile(new URL("../ai-gateway/worker.js", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../ai-gateway/wrangler.toml.example", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/release-complete.yml", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0001_v2_social_foundation.sql", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0004_legacy_schema_compat.sql", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0006_api_rate_limits.sql", import.meta.url), "utf8")
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

test("YouTube replies use the actual top-level comment ID required by comments.insert", () => {
  assert.match(worker, /threadId:item\.id,commentId:comment\.id,topLevelCommentId:comment\.id/);
  assert.match(worker, /parentId=String\(body\?\.parentCommentId\|\|body\?\.commentId/);
  assert.match(worker, /parentId,textOriginal:replyText/);
  assert.match(app, /JSON\.stringify\(\{parentCommentId:item\.topLevelCommentId\|\|item\.commentId,text:reply\}\)/);
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
  assert.ok(worker.includes('fetchWithTimeout(safeProviderUrl(secondaryUrl)'));
  assert.ok(worker.includes('fetchWithTimeout(safeProviderUrl(imageUrl)'));
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


test("AI generation loads provider secrets only from the authenticated URL workspace", () => {
  assert.ok(worker.includes('const aiProviderSecrets=await loadProviderSecrets(env,env.DB,url.searchParams.get("workspace")||"default")'));
  assert.ok(!worker.includes('loadProviderSecrets(env,env.DB,body.inputs.workspace'));
});


test("English voice preview explicitly requests the English voice", () => {
  assert.match(app, /video-voice-preview[\s\S]*?JSON\.stringify\(\{text:aiOutput\.slice\(0,3500\),language:"en"\}\)/);
});


test("English and Persian TTS capabilities are reported independently", () => {
  assert.match(worker, /ttsPersian:!!\(secrets\.elevenlabsKey&&secrets\.elevenlabsVoiceId\)/);
  assert.match(worker, /ttsEnglish:!!\(secrets\.elevenlabsKey&&secrets\.elevenlabsEnglishVoiceId\)/);
  assert.match(app, /\["ttsEnglish","گویندگی انگلیسی"\]/);
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


test("cloud sync, provider settings, media capabilities, and YouTube trends use the active workspace", () => {
  assert.ok(app.includes("function cloudWorkspaceId()"));
  assert.ok(app.includes('api/workspace?workspace="+encodeURIComponent(cloudWorkspaceId())'));
  assert.ok(app.includes('api/providers?workspace="+encodeURIComponent(cloudWorkspaceId())'));
  assert.ok(app.includes('/api/media/capabilities'));
  assert.ok(app.includes('url.searchParams.set("workspace",cloudWorkspaceId())'));
  assert.ok(app.includes('api/youtube/trends?workspace="+encodeURIComponent(cloudWorkspaceId())+"&q='));
  assert.doesNotMatch(app, /workspace=default/);
});


test("YouTube core analytics remains available when monetization metrics are unavailable", () => {
  assert.ok(worker.includes('const baseMetrics = "views,estimatedMinutesWatched,averageViewDuration,subscribersGained"'));
  assert.ok(worker.includes('reportUrl("estimatedRevenue,estimatedAdRevenue,adImpressions,monetizedPlaybacks")'));
  assert.ok(worker.includes("monetizationAvailable"));
  assert.ok(worker.includes("if (revenueResponse.ok"));
});

test("provider secret updates are prepared fully and committed as one D1 batch", () => {
  const start=worker.indexOf("async function saveProviderSecrets");
  const end=worker.indexOf("\nasync function ensureWorkspace",start);
  const source=worker.slice(start,end);
  assert.ok(source.includes("const key=await providerCryptoKey(env),statements=[]"));
  assert.ok(source.includes("statements.push(db.prepare"));
  assert.ok(source.includes("if(statements.length)await db.batch(statements)"));
  assert.ok(!source.includes(".run()"));
  assert.ok(source.includes("Array.isArray(values)"));
});

test("D1 migration sequence is numbered, additive, and includes workspace-scoped indexes", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const dir = new URL("../migrations/", import.meta.url);
  const files = (await readdir(dir)).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.deepEqual(files, ["0001_v2_social_foundation.sql","0002_workspace_snapshots.sql","0003_provider_secrets.sql","0004_legacy_schema_compat.sql","0005_workspace_query_indexes.sql","0006_api_rate_limits.sql"]);
  const migration = await readFile(new URL("../migrations/0005_workspace_query_indexes.sql", import.meta.url), "utf8");
  for (const index of ["idx_campaigns_workspace_updated","idx_audit_workspace_event_time","idx_publish_workspace_due","idx_approvals_workspace_status_created","idx_media_workspace_created","idx_social_workspace_status"]) assert.ok(migration.includes(index));
  assert.doesNotMatch(migration, /\b(DROP TABLE|DROP COLUMN|DELETE FROM)\b/i);
});

test("release workflow validates a non-empty pre-migration D1 backup and exposes it as an artifact", () => {
  assert.match(releaseWorkflow, /test -s cloudflare-d1-predeploy-backup\.sql/);
  assert.ok(releaseWorkflow.indexOf("Export D1 backup before migration") < releaseWorkflow.indexOf("Apply pending D1 migrations"));
  assert.match(releaseWorkflow, /ai-business-core-d1-predeploy-backup/);
  assert.match(releaseWorkflow, /retention-days: 30/);
});

test("YouTube OAuth rejects token exchanges without a refresh token", () => {
  assert.ok(worker.includes('if (!tokens.refresh_token) return fail("Google did not issue a refresh token.'));
});

test("YouTube OAuth tokens are authenticated to their workspace and account with AES-GCM AAD", () => {
  assert.ok(worker.includes('saved.workspace_id+"\\\\0youtube\\\\0"+("youtube_"+channel.id)'));
  assert.ok(worker.includes('workspace+"\\\\0youtube\\\\0"+row.id'));
  assert.ok(worker.includes('additionalData:tokenAad'));
  assert.ok(worker.includes('additionalData:aad'));
  assert.ok(worker.includes('catch{try{decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:ivBytes},key,cipherBytes);legacy=true'));
  assert.ok(worker.includes('refreshed.refresh_token || token.refresh_token'));
});

test("YouTube OAuth callback responses are non-cacheable and do not disclose provider token payloads", () => {
  assert.ok(worker.includes('"cache-control":"no-store"'));
  assert.doesNotMatch(worker, /return json\(\{[^}]*access_token/);
});

test("YouTube token refresh and reauthorization writes are scoped to both account ID and workspace", () => {
  const start=worker.indexOf("async function youtubeAccessToken");
  const end=worker.indexOf("\nexport default",start);
  const source=worker.slice(start,end);
  assert.ok(source.includes("WHERE id=? AND workspace_id=?"));
  assert.ok(source.includes(".bind(row.id,workspace)"));
  assert.doesNotMatch(source, /WHERE id=\?["']/);
});

test("OAuth account connection and token lifecycle events are recorded without secrets", () => {
  assert.ok(worker.includes("async function writeAuditEvent(db,workspace,eventType,targetType,targetId,details={})"));
  assert.ok(worker.includes('"youtube.account.connected"'));
  assert.ok(worker.includes('"youtube.token.refreshed"'));
  assert.ok(worker.includes('"youtube.token.refresh_failed"'));
  const helper=worker.slice(worker.indexOf("async function writeAuditEvent"),worker.indexOf("\nfunction buildPrompt"));
  assert.ok(helper.includes("workspace,eventType,targetType,targetId"));
  assert.ok(helper.includes("catch { return false; }"));
  assert.doesNotMatch(helper,/access_token|refresh_token|client_secret|encrypted_token_json/);
});


test("all Worker upstream HTTP requests have bounded timeouts", () => {
  assert.ok(worker.includes("async function fetchWithTimeout(input, init = {}, timeoutMs = 25000)"));
  assert.ok(worker.includes("signal: init.signal || AbortSignal.timeout(timeoutMs)"));
  assert.doesNotMatch(worker, /await fetch\(/);
  assert.ok(worker.includes("await fetchWithTimeout(uploadUrl"));
  assert.ok(worker.includes("signal:AbortSignal.timeout(90000)"));
});


test("Worker rate limits expensive operations with atomic D1 buckets and fails closed", () => {
  assert.ok(worker.includes("async function enforceRateLimit(db, workspace, route, limit, headers)"));
  assert.ok(worker.includes("ON CONFLICT(bucket_key, window_start) DO UPDATE SET request_count=request_count+1 RETURNING request_count"));
  assert.ok(worker.includes('"retry-after": "60"'));
  assert.ok(worker.includes('enforceRateLimit(env.DB, workspace, "youtube-upload", 3, headers)'));
  assert.ok(worker.includes('enforceRateLimit(env.DB, url.searchParams.get("workspace") || "default", "media-image", 5, headers)'));
  assert.ok(worker.includes('enforceRateLimit(env.DB, url.searchParams.get("workspace") || "default", "media-tts", 20, headers)'));
  assert.ok(worker.includes('enforceRateLimit(env.DB, url.searchParams.get("workspace") || "default", "ai-generate", 20, headers)'));
});
test("Worker errors are correlated by request ID and never return raw exception details", () => {
  assert.ok(worker.includes('const requestId = crypto.randomUUID()'));
  assert.ok(worker.includes('"x-request-id": requestId'));
  assert.ok(worker.includes('خطای داخلی سرور رخ داد. شناسه پیگیری: '));
  assert.doesNotMatch(worker, /detail:String\(error\?\.message/);
});
test("YouTube upload rejects non-video content and oversized declared bodies before parsing multipart data", () => {
  assert.ok(worker.includes('declaredLength > 66 * 1024 * 1024'));
  assert.ok(worker.includes('!file.type.startsWith("video/")'));
});
test("rate limit migration creates an atomic per-route bucket table", () => {
  const migration = rateLimitMigration;
  assert.match(migration, /PRIMARY KEY \(bucket_key, window_start\)/);
  assert.match(migration, /idx_api_rate_limits_window/);
});
