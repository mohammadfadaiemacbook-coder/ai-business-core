# Runtime diagnostics and MCP access

The browser keeps its local error history in localStorage. When the user has connected the app with a valid `APP_ACCESS_TOKEN`, the app also sends redacted diagnostic events to the authenticated Worker endpoint:

- `POST /api/diagnostics/report?workspace=<workspace-id>` — authenticated, workspace-scoped, rate-limited to 20 reports/minute, and limited to 8 KiB per request.
- Reports redact bearer tokens and common API-key/secret assignments before persistence.
- Client-generated IDs make retries idempotent. Server-side records are retained for 30 days.
- Without an active app connection, errors remain local and are not transmitted.

The private MCP endpoint exposes `list_runtime_errors` as a read-only SELECT tool for the one configured `MCP_READONLY_WORKSPACE_ID`. It never accepts a workspace override. The MCP token is separate from the app token.

## Deployment

Apply D1 migrations (including `0009_app_runtime_errors.sql`) and deploy the Worker. Configure `MCP_READONLY_TOKEN` (32+ random characters) and `MCP_READONLY_WORKSPACE_ID` using Cloudflare's secure Worker secrets/vars UI. Enter the bearer token only in the plugin's secure connection setup. Do not place secrets in Git or chat.

## Boundaries

- Diagnostic ingestion is the only new application-data write introduced here; it stores redacted error metadata only.
- The MCP tools remain SELECT-only.
- No app records, drafts, social accounts, provider settings, tokens, or media are modified.
- R2 is not used. Media storage remains intentionally unavailable until the local media bridge is separately validated.
