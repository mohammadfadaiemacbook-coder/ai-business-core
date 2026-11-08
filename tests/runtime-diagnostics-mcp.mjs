import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../ai-gateway/worker.js", import.meta.url), "utf8");
const mcp = await readFile(new URL("../ai-gateway/mcp-readonly.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/0009_app_runtime_errors.sql", import.meta.url), "utf8");

test("browser errors remain local and are optionally synchronized only through an authenticated session", () => {
  assert.ok(app.includes("localStorage.setItem(ERROR_LOG_KEY"));
  assert.ok(app.includes("async function syncPendingRuntimeDiagnostics()"));
  assert.ok(app.includes("id:id()"));
  assert.ok(app.includes("if(!cloudToken||!navigator.onLine)return"));
  assert.ok(app.includes("/api/diagnostics/report?workspace="));
  assert.ok(app.includes("Bearer [REDACTED]"));
});

test("diagnostic ingestion is authenticated, workspace-scoped, bounded and rate-limited", () => {
  assert.ok(worker.includes('url.pathname === "/api/diagnostics/report"'));
  assert.ok(worker.includes("isAuthorized(request,env)"));
  assert.ok(worker.includes('enforceRateLimit(env.DB,workspace,"runtime-diagnostics",20,headers)'));
  assert.ok(worker.includes("Diagnostic report too large"));
  assert.ok(worker.includes("Could not store runtime diagnostic"));
  assert.ok(worker.includes("INSERT OR IGNORE INTO app_runtime_errors"));
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS app_runtime_errors"));
});

test("MCP exposes runtime errors only through a fixed-workspace SELECT query", () => {
  assert.ok(mcp.includes('name: "list_runtime_errors"'));
  assert.ok(mcp.includes("SELECT source,message,details,occurred_at,request_id FROM app_runtime_errors WHERE workspace_id=?"));
  assert.ok(!mcp.includes("INSERT INTO app_runtime_errors"));
});
