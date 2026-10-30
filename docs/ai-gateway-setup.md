# Secure AI gateway (Cloudflare Worker)

This is a deployable, provider-compatible gateway for the AI Business Core app. It keeps the provider API key on the server side rather than putting it in GitHub or browser JavaScript. The AI Studio UI already supports a **manual connection**: enter the Worker HTTPS endpoint and APP_ACCESS_TOKEN in the form. The master token is exchanged for a workspace-scoped HMAC session that expires after 15 minutes; normal API calls use that session. Both tokens remain in memory and are not persisted in local storage. Deploy and configure the Worker before using it.

## 1. Deploy the Worker

1. Create/sign in to a Cloudflare account and open Workers & Pages.
2. Use the existing Worker named `ai-business-core` (or confirm the configured service name in wrangler.toml).
3. Paste the contents of `worker.js` into the Worker editor and deploy.
4. In Worker Settings → Variables and Secrets, set:
   - Secret `AI_API_KEY`: your provider API key.
   - Secret `APP_ACCESS_TOKEN`: a random secret of at least 24 characters. Keep it private.
   - Variable `AI_API_URL`: the provider's OpenAI-compatible chat-completions URL.
   - Variable `AI_MODEL`: a model name supported by that provider.
   - Variable `ALLOWED_ORIGIN`: the exact published app origin, with no path, e.g. `https://mohammadfadaiemacbook-coder.github.io`.
5. Use a long, unique token. Never commit either secret to GitHub or share it in a screenshot/chat.
6. If you use a different AI provider, verify its endpoint and request/response compatibility first. Provider usage may cost money; the gateway does not make API calls free.

## 2. Apply D1 migrations

Before deploying Worker code that reads provider settings, apply the repository migrations (including 0003_provider_secrets):

```bash
npx wrangler d1 migrations apply ai-business-core-db --remote
```

Do not run this against production until the release owner has reviewed the migration plan and backup.

## 3. Configure and test

First exchange the master token for a 15-minute session:

```bash
SESSION=$(curl -fsS -X POST 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/auth/session?workspace=default' -H 'Authorization: Bearer YOUR_APP_ACCESS_TOKEN' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).sessionToken))')
```

Then call `POST https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/generate` with:
- `Authorization: Bearer $SESSION`
- `Content-Type: application/json`

Body example:
```json
{
  "task": "youtube_research",
  "inputs": {
    "topic": "Free AI tools for small businesses",
    "audience": "English-speaking beginners",
    "sources": []
  }
}
```

Supported tasks include `youtube_research`, `trend_strategy`, `video_outline`, `video_script`, `title_ideas`, `youtube_metadata`, `social_caption`, `comment_reply`, and `thumbnail_brief`.

A successful response returns `output`, `task`, and `model`. The gateway does not browse the web, verify claims, publish content, or execute business actions. Treat output as a draft; verify factual claims and sources before approval.

## Security and limits

- CORS restricts browser origins but is not authentication by itself; the bearer token is also required.
- Do not place the provider API key in frontend code, GitHub files, or the manifest.
The master APP_ACCESS_TOKEN is accepted only by the session-exchange endpoint; normal API routes require a signed, workspace-scoped 15-minute session. Anyone who obtains the master token can still mint sessions and may incur provider charges. Rotate it if exposed.
- This version has request-size limits and basic error handling, but no durable per-user identity, billing controls, or advanced rate limiting. Set provider spending limits and platform limits before using it publicly.
- AI Studio calls this endpoint when the user submits the form. The app access token is entered per session and is not stored in local storage. The provider API key remains server-side in Worker secrets.
