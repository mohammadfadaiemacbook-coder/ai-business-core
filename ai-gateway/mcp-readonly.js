const WORKSPACE_RE = /^[a-zA-Z0-9_-]{3,64}$/;
const MAX_REQUEST_BYTES = 64 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "mcp-protocol-version": "2025-03-26"
    }
  });
}

function equalSecret(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
}

function rpc(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

const TOOLS = [
  {
    name: "app_health",
    description: "Read the application Worker and database health without changing data.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "workspace_summary",
    description: "Read whether the configured workspace has a saved snapshot and its version metadata. Does not create or update a workspace.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "list_youtube_jobs",
    description: "List recent YouTube production drafts and their status for the configured workspace.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 20, default: 10 } },
      additionalProperties: false
    }
  },
  {
    name: "list_connections",
    description: "Read connected social account names and statuses. Never reads or refreshes access tokens.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "list_runtime_errors",
    description: "Read recent redacted browser and Worker runtime error reports for the configured workspace. This tool performs SELECT-only queries.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20, default: 10 } }, additionalProperties: false }
  },
  {
    name: "run_readonly_checks",
    description: "Run non-mutating database connectivity and schema-presence checks for the configured workspace.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  }
];

async function callTool(name, args, env) {
  const db = env.DB;
  const workspace = String(env.MCP_READONLY_WORKSPACE_ID || "default");
  if (!db) throw new Error("Database is not configured");
  if (!WORKSPACE_RE.test(workspace)) throw new Error("Read-only workspace configuration is invalid");

  if (name === "app_health") {
    await db.prepare("SELECT 1 AS ok").first();
    return { ok: true, database: "connected", workspace };
  }

  if (name === "workspace_summary") {
    const row = await db.prepare(
      "SELECT version, updated_at FROM workspace_snapshots WHERE workspace_id = ?"
    ).bind(workspace).first();
    return {
      workspace,
      snapshotExists: !!row,
      version: row?.version ?? 0,
      updatedAt: row?.updated_at ?? null
    };
  }

  if (name === "list_youtube_jobs") {
    const requested = Number.isInteger(args?.limit) ? args.limit : 10;
    if (requested < 1 || requested > 20) throw new Error("limit must be between 1 and 20");
    const rows = await db.prepare(
      "SELECT id, topic, title, status, stage, version, created_at, updated_at FROM youtube_video_jobs WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT ?"
    ).bind(workspace, requested).all();
    return { workspace, jobs: rows.results || [] };
  }

  if (name === "list_connections") {
    const rows = await db.prepare(
      "SELECT platform, status, display_name, connected_at FROM social_accounts WHERE workspace_id = ? ORDER BY connected_at DESC"
    ).bind(workspace).all();
    return {
      workspace,
      connections: (rows.results || []).map(row => ({
        platform: row.platform,
        status: row.status,
        displayName: row.display_name || "",
        connectedAt: row.connected_at || null
      }))
    };
  }

  if (name === "list_runtime_errors") {
    const requested = Number.isInteger(args?.limit) ? args.limit : 10;
    if (requested < 1 || requested > 20) throw new Error("limit must be between 1 and 20");
    const rows = await db.prepare("SELECT source,message,details,occurred_at,request_id FROM app_runtime_errors WHERE workspace_id=? ORDER BY occurred_at DESC LIMIT ?").bind(workspace,requested).all();
    return { workspace, errors: rows.results || [] };
  }

  if (name === "run_readonly_checks") {
    const dbCheck = await db.prepare("SELECT 1 AS ok").first();
    const schema = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('workspace_snapshots','youtube_video_jobs','social_accounts') ORDER BY name"
    ).all();
    const present = new Set((schema.results || []).map(row => row.name));
    const checks = [
      { name: "database_query", ok: dbCheck?.ok === 1 },
      { name: "workspace_snapshots_table", ok: present.has("workspace_snapshots") },
      { name: "youtube_video_jobs_table", ok: present.has("youtube_video_jobs") },
      { name: "social_accounts_table", ok: present.has("social_accounts") }
    ];
    return {
      workspace,
      passed: checks.filter(item => item.ok).length,
      total: checks.length,
      checks
    };
  }

  throw new Error("Unknown or unavailable read-only tool");
}

export async function handleReadonlyMcp(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const configuredToken = String(env.MCP_READONLY_TOKEN || "");
  const authorization = request.headers.get("Authorization") || "";
  if (configuredToken.length < 32 || !equalSecret(authorization, "Bearer " + configuredToken)) {
    return json({ error: "Unauthorized" }, configuredToken.length < 32 ? 503 : 401);
  }

  const workspace = String(env.MCP_READONLY_WORKSPACE_ID || "default");
  if (!WORKSPACE_RE.test(workspace)) return json({ error: "Read-only workspace configuration is invalid" }, 503);

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) return json({ error: "Request too large" }, 413);
  let message;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return json({ error: "Request too large" }, 413);
    message = JSON.parse(raw);
  } catch {
    return json({ error: "Expected JSON-RPC request" }, 400);
  }

  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return json(rpcError(message?.id ?? null, -32600, "Invalid JSON-RPC request"), 400);
  }
  if (message.method.startsWith("notifications/")) return new Response(null, { status: 202 });
  if (message.method === "initialize") {
    return json(rpc(message.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "ai-business-core-readonly", version: "1.0.0" }
    }));
  }
  if (message.method === "ping") return json(rpc(message.id, {}));
  if (message.method === "tools/list") return json(rpc(message.id, { tools: TOOLS }));
  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (!TOOLS.some(tool => tool.name === name)) {
      return json(rpc(message.id, {
        content: [{ type: "text", text: "Unknown or unavailable read-only tool" }],
        isError: true
      }));
    }
    try {
      const result = await callTool(name, message.params?.arguments || {}, env);
      return json(rpc(message.id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
        isError: false
      }));
    } catch (error) {
      return json(rpc(message.id, {
        content: [{ type: "text", text: String(error?.message || "Read-only diagnostic failed").slice(0, 240) }],
        isError: true
      }));
    }
  }
  return json(rpcError(message.id ?? null, -32601, "Method not found"));
}
