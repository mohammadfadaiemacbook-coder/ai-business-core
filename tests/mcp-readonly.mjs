import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../ai-gateway/mcp-readonly.js", import.meta.url), "utf8");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const { handleReadonlyMcp } = await import(moduleUrl);
const token = "test-readonly-token-with-at-least-32-characters";

function makeDb() {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      statements.push(sql);
      return {
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes("SELECT 1")) return { ok: 1 };
          if (sql.includes("workspace_snapshots")) return { version: 7, updated_at: "2026-11-08T08:00:00Z" };
          return null;
        },
        async all() {
          if (sql.includes("sqlite_master")) return { results: [
            { name: "workspace_snapshots" }, { name: "youtube_video_jobs" }, { name: "social_accounts" }, { name: "app_runtime_errors" }
          ] };
          if (sql.includes("youtube_video_jobs")) return { results: [
            { id: "job-1", topic: "AI safety", title: "A safe title", status: "draft", stage: "draft", version: 1 }
          ] };
          if (sql.includes("app_runtime_errors")) return { results: [{ source:"window.error", message:"Test error", details:"", occurred_at:"2026-11-08T07:00:00Z", request_id:"req-1" }] };
          if (sql.includes("social_accounts")) return { results: [
            { platform: "youtube", status: "connected", display_name: "Test channel", connected_at: "2026-11-08T08:00:00Z" }
          ] };
          return { results: [] };
        }
      };
    }
  };
}

function request(message, auth = "Bearer " + token) {
  return new Request("https://worker.example/mcp", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(message)
  });
}

test("rejects missing credentials before touching the database", async () => {
  const DB = makeDb();
  const response = await handleReadonlyMcp(request({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ""), {
    DB, MCP_READONLY_TOKEN: token, MCP_READONLY_WORKSPACE_ID: "workspace-a"
  });
  assert.equal(response.status, 401);
  assert.equal(DB.statements.length, 0);
});

test("fails closed when the read-only token is not configured", async () => {
  const response = await handleReadonlyMcp(request({ jsonrpc: "2.0", id: 1, method: "tools/list" }), {
    DB: makeDb(), MCP_READONLY_TOKEN: ""
  });
  assert.equal(response.status, 503);
});

test("supports MCP initialization and advertises only read-only tools", async () => {
  const env = { DB: makeDb(), MCP_READONLY_TOKEN: token, MCP_READONLY_WORKSPACE_ID: "workspace-a" };
  const initialized = await (await handleReadonlyMcp(request({
    jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" }
  }), env)).json();
  assert.equal(initialized.result.serverInfo.name, "ai-business-core-readonly");

  const listed = await (await handleReadonlyMcp(request({
    jsonrpc: "2.0", id: 2, method: "tools/list"
  }), env)).json();
  assert.deepEqual(listed.result.tools.map(tool => tool.name), [
    "app_health", "workspace_summary", "list_youtube_jobs", "list_connections", "list_runtime_errors", "run_readonly_checks"
  ]);
});

test("executes read-only health, workspace, jobs, connections, and schema checks", async () => {
  const DB = makeDb();
  const env = { DB, MCP_READONLY_TOKEN: token, MCP_READONLY_WORKSPACE_ID: "workspace-a" };
  const invoke = async (name, args = {}) => {
    const response = await handleReadonlyMcp(request({
      jsonrpc: "2.0", id: name, method: "tools/call", params: { name, arguments: args }
    }), env);
    assert.equal(response.status, 200);
    return (await response.json()).result.structuredContent;
  };

  assert.equal((await invoke("app_health")).database, "connected");
  assert.equal((await invoke("workspace_summary")).version, 7);
  assert.equal((await invoke("list_youtube_jobs", { limit: 5 })).jobs[0].id, "job-1");
  assert.equal((await invoke("list_connections")).connections[0].status, "connected");
  assert.equal((await invoke("list_runtime_errors", { limit: 5 })).errors[0].message, "Test error");
  const checks = await invoke("run_readonly_checks");
  assert.equal(checks.passed, 5);
  assert.equal(checks.total, 5);
  assert.ok(DB.statements.every(sql => /^\s*SELECT\b/i.test(sql)), "all database statements must be SELECT-only");
});

test("rejects unknown tools and invalid list limits", async () => {
  const env = { DB: makeDb(), MCP_READONLY_TOKEN: token, MCP_READONLY_WORKSPACE_ID: "workspace-a" };
  const unknown = await (await handleReadonlyMcp(request({
    jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "delete_everything", arguments: {} }
  }), env)).json();
  assert.equal(unknown.result.isError, true);
  const invalid = await (await handleReadonlyMcp(request({
    jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_youtube_jobs", arguments: { limit: 999 } }
  }), env)).json();
  assert.equal(invalid.result.isError, true);
});

test("rejects oversized and malformed requests", async () => {
  const env = { DB: makeDb(), MCP_READONLY_TOKEN: token, MCP_READONLY_WORKSPACE_ID: "workspace-a" };
  const large = new Request("https://worker.example/mcp", {
    method: "POST", headers: { authorization: "Bearer " + token },
    body: "x".repeat(65 * 1024)
  });
  assert.equal((await handleReadonlyMcp(large, env)).status, 413);
  const malformed = new Request("https://worker.example/mcp", {
    method: "POST", headers: { authorization: "Bearer " + token }, body: "{"
  });
  assert.equal((await handleReadonlyMcp(malformed, env)).status, 400);
});

test("uses a fixed configured workspace and never accepts workspace overrides", async () => {
  const DB = makeDb();
  const env = { DB, MCP_READONLY_TOKEN: token, MCP_READONLY_WORKSPACE_ID: "workspace-a" };
  const response = await handleReadonlyMcp(request({
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "workspace_summary", arguments: { workspace: "attacker-workspace" } }
  }), env);
  const result = (await response.json()).result.structuredContent;
  assert.equal(result.workspace, "workspace-a");
  assert.ok(DB.statements.every(sql => /^\s*SELECT\b/i.test(sql)));
});
