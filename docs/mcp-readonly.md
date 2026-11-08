# Read-only ChatGPT MCP connection

The Worker exposes a stateless Streamable HTTP MCP endpoint at `/mcp`. It is intentionally read-only and serves one fixed workspace per configured deployment.

## Exposed tools

- `app_health`: execute a database connectivity query.
- `workspace_summary`: read snapshot existence and version metadata.
- `list_youtube_jobs`: list up to 20 recent YouTube draft summaries.
- `list_connections`: list social connection names and statuses; never reads or refreshes tokens.
- `run_readonly_checks`: run SELECT-only database and schema-presence checks.

The MCP handler does not expose workspace writes, draft creation/updates, AI generation, uploads, publication, scheduling, token refresh, deletion, or audit writes. It does not accept a workspace override from tool arguments.

## Configure the endpoint

1. Generate a unique random bearer secret of at least 32 characters and store it securely.
2. In the Cloudflare account for this Worker, configure the Worker secrets:
   - `MCP_READONLY_TOKEN`: the bearer secret.
   - `MCP_READONLY_WORKSPACE_ID`: the one workspace ID this plugin is permitted to read (for example, `default`).
3. Deploy the Worker using the repository's normal release process.
4. Obtain the actual deployed Worker origin from the Cloudflare dashboard or deployment output. The MCP URL is that origin followed by `/mcp`.
5. Configure the ChatGPT plugin with Streamable HTTP and bearer/API-key authentication. Enter the secret only in the host's secure connection flow; never commit it or paste it into source files.

Example local secret configuration (run only in an authenticated Cloudflare environment):

```sh
npx wrangler secret put MCP_READONLY_TOKEN
npx wrangler secret put MCP_READONLY_WORKSPACE_ID
```

Do not use a guessed `workers.dev` hostname. The deployed origin must be copied from the actual Cloudflare deployment.

## Verification

The test suite in `tests/mcp-readonly.mjs` covers authentication, tool discovery, read-only SQL behavior, workspace isolation, request limits, and tool argument validation. CI also performs the Worker bundle dry run. These checks do not replace a live authenticated MCP call after deployment.
