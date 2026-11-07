# Secure AI gateway (Cloudflare Worker)

This is a deployable, provider-compatible gateway for the AI Business Core app. It keeps the provider API key on the server side rather than putting it in GitHub or browser JavaScript. The AI Studio UI already supports a **manual connection**: enter the Worker HTTPS endpoint and APP_ACCESS_TOKEN in the form. The master token is exchanged for a workspace-scoped HMAC session that expires after 15 minutes; normal API calls use that session. Both tokens remain in memory and are not persisted in local storage. Deploy and configure the Worker before using it.

## 1. Deploy the Worker

1. The repository's guarded release workflow targets the existing Worker named `ai-business-core` and existing D1 database `ai-business-core-db`. The D1 ID is read from the checked-in root `wrangler.toml`; do not create a new database.
2. The deployment config uses `keep_vars = true` and intentionally leaves the existing primary AI endpoint/model variables untouched.
3. In Cloudflare Worker Settings → Variables and Secrets, verify the existing values are still present. Set any missing values below before deployment:

   - Secret `AI_API_KEY`: your provider API key.
   - Secret `APP_ACCESS_TOKEN`: a random secret of at least 24 characters. Keep it private.
   - Variable `AI_API_URL`: the provider's OpenAI-compatible chat-completions URL.
   - Variable `AI_MODEL`: a model name supported by that provider.
   - Variable `ALLOWED_ORIGIN`: the exact published app origin, with no path, e.g. `https://mohammadfadaiemacbook-coder.github.io`.
4. Use a long, unique token. Never commit either secret to GitHub or share it in a screenshot/chat.
5. If you use a different AI provider, verify its endpoint and request/response compatibility first. Provider usage may cost money; the gateway does not make API calls free.

Required Worker bindings/secrets:
- D1 binding `DB` pointing to `ai-business-core-db`.
- `APP_ACCESS_TOKEN`: existing master token, at least 24 characters. It also signs the 15-minute sessions; keep it unchanged unless intentionally rotating it.
- `TOKEN_ENCRYPTION_KEY`: base64-encoded 32-byte key. **Do not replace an existing key** while encrypted YouTube/provider records are stored in D1, or those records become unreadable.
- `AI_API_KEY`, `AI_API_URL`, `AI_MODEL`: primary OpenAI-compatible provider.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: OAuth callback must be `https://ai-business-core.mohammadfadaiemacbook.workers.dev/oauth/google/callback`.

Optional Worker variables/secrets:
- `AI_SECONDARY_API_URL`, `AI_SECONDARY_API_KEY`, `AI_SECONDARY_MODEL` for a second OpenAI-compatible model.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` for narration.
- `IMAGE_API_URL`, `IMAGE_API_KEY`, `IMAGE_MODEL` for artwork.
- `APP_PUBLIC_URL` for the published frontend origin/redirect behavior.

## 2. Complete release: Worker and web app

1. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**.
2. Add `CLOUDFLARE_API_TOKEN` with Cloudflare permissions **Workers Scripts: Edit**, **D1: Edit**, **R2 Storage: Edit**, and the account read permission Wrangler requires.
3. Add `CLOUDFLARE_ACCOUNT_ID`.
4. Generate a random secret locally with `openssl rand -hex 32` and add it as repository Actions secret `RENDERER_SHARED_SECRET`. Keep the same value for the Mac renderer; do not share it in chat or commit it.
5. Keep all existing Cloudflare Worker secrets/variables intact: `APP_ACCESS_TOKEN`, `TOKEN_ENCRYPTION_KEY`, Google OAuth credentials, primary AI provider credentials and optional media-provider credentials. Never replace `TOKEN_ENCRYPTION_KEY` for an existing database.
6. In GitHub Actions, select **Complete release - Worker and web app**, choose the `main` branch (after merging the reviewed changes), and set confirmation to `RELEASE`. Do not select retired experimental branches.
7. The guarded workflow creates the R2 bucket if needed, configures the renderer secret, exports a D1 backup, applies pending migrations, deploys the Worker, verifies Worker/D1/R2 readiness, and publishes only public app files to GitHub Pages.
8. Download and retain the artifact named `ai-business-core-d1-predeploy-backup`.

The default confirmation is `NO`; no production changes happen unless you explicitly choose `RELEASE`. The release health check requires D1, R2 and the renderer secret to be available. The standalone **Backup, migrate and deploy Cloudflare Worker** and **Deploy web app to GitHub Pages** workflows remain available for separate, gated operations.

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

## 4. Durable video storage and local Mac renderer

After the reviewed code is merged and the guarded release workflow succeeds, the R2-backed renderer queue is ready for Mac setup:

1. From the repository root on the Mac, run `./renderer/install-mac.sh`. It checks Node.js 20+, installs FFmpeg with Homebrew if needed, and creates `renderer/.env` from the example.
2. Edit `renderer/.env` and set `AIBC_RENDERER_TOKEN` to the exact same value you saved as the GitHub Actions secret `RENDERER_SHARED_SECRET`. The `.env` file is ignored by Git and must remain only on the Mac.
3. Make sure Ollama is running locally and `qwen3:4b` is installed.
4. Start the renderer from the repository root with `node renderer/agent.mjs`. Keep the Mac awake while jobs are being processed.
5. Generate and preview a YouTube video in the PWA, then select **ارسال فایل به موتور مک‌بوک (FFmpeg)**. The source file is saved in R2 and a durable job is added to D1. On the phone or Mac, select **بررسی وضعیت موتور مک‌بوک** to retrieve the rendered MP4 from R2 when ready.

The local renderer converts the browser-produced WebM into H.264/AAC MP4 and optionally asks Ollama for a local script-quality note. It does not yet replace the browser's scene-generation step, does not run while the Mac is asleep, and never uploads or publishes to YouTube. The separate YouTube upload action still requires your review and explicit confirmation.

## Security and limits

- CORS restricts browser origins but is not authentication by itself; the bearer token is also required.
- Do not place the provider API key in frontend code, GitHub files, or the manifest.
The master APP_ACCESS_TOKEN is accepted only by the session-exchange endpoint; normal API routes require a signed, workspace-scoped 15-minute session. Anyone who obtains the master token can still mint sessions and may incur provider charges. Rotate it if exposed.
- This version has request-size limits and basic error handling, but no durable per-user identity, billing controls, or advanced rate limiting. Set provider spending limits and platform limits before using it publicly.
- AI Studio calls this endpoint when the user submits the form. The app access token is entered per session and is not stored in local storage. The provider API key remains server-side in Worker secrets.
