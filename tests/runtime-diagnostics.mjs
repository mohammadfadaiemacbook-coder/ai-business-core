import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../ai-gateway/worker.js", import.meta.url), "utf8");

test("render tolerates optional shell elements without crashing", () => {
  assert.match(app, /function render\(\)\{let root=\$\("#view-root"\);if\(!root\)\{/);
  assert.match(app, /const breadcrumb=\$\("#breadcrumb-current"\);if\(breadcrumb\)breadcrumb\.textContent/);
  assert.match(app, /const taskCount=\$\("#nav-task-count"\);if\(taskCount\)taskCount\.textContent/);
  assert.match(app, /const approvalCount=\$\("#nav-approval-count"\);if\(approvalCount\)approvalCount\.textContent/);
  assert.match(app, /const el=\$\("#toast"\);if\(!el\)\{/);
});

test("YouTube draft restore failures are retained in the local diagnostic log", () => {
  assert.match(app, /recordAppError\(error\?\.message\|\|"YouTube draft restore failed","youtube:draft-restore",error\?\.stack\|\|""\)/);
  assert.match(app, /detail = typeof data\.detail === "string"/);
});

test("YouTube Worker failures expose a diagnostic id and safe detail without returning stack traces", () => {
  assert.match(worker, /const diagnosticId = crypto\.randomUUID\(\)/);
  assert.match(worker, /console\.error\("YouTube operation failed", \{ diagnosticId, workspace, path: url\.pathname, detail: safeDetail \}\)/);
  assert.match(worker, /detail: safeDetail, diagnosticId/);
});
