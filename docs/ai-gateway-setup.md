# Secure AI gateway (Cloudflare Worker)

This gateway connects the AI Business Core dashboard to an OpenAI-compatible text-generation API. The dashboard's **AI Studio** calls this endpoint after you enter the deployed URL and app access token. The provider API key stays in Worker secrets, not in the browser or GitHub.

## Temporary low-cost/free-tier option: Groq

Groq provides an OpenAI-compatible API. Whether a request is free depends on the account plan and the exact model. **Do not assume every Groq model is free**: the model catalogue can list paid prices even when a developer/free tier exists. Before selecting a model, check the current account's limits and pricing:
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq supported models and prices](https://console.groq.com/docs/models)
- [Groq OpenAI-compatible API](https://console.groq.com/docs/openai)

Use the following endpoint, then select a model ID that the Groq console explicitly makes available within your free allowance (if offered to your account):
- `AI_API_URL`: `https://api.groq.com/openai/v1/chat/completions`
- `AI_MODEL`: exact free-eligible model ID shown in your Groq console
- `AI_API_KEY`: a Groq API key from your developer console

If the console shows a price for the selected model or asks you to add billing, do not use it for the free-only setup. Model availability, pricing, and quotas can change.

## 1. Create and deploy the Worker

1. Create/sign in to a [Cloudflare account](https://dash.cloudflare.com/).
2. Open **Workers & Pages** and create a Worker named `ai-business-core-gateway`.
3. Paste the contents of `ai-gateway/worker.js` into the Worker editor and deploy.
4. Open Worker **Settings → Variables and Secrets** and configure:
   - **Secret** `AI_API_KEY`: your Groq API key (or another compatible provider's key).
   - **Secret** `APP_ACCESS_TOKEN`: a random secret at least 24 characters long. Keep it private.
   - **Variable** `AI_API_URL`: `https://api.groq.com/openai/v1/chat/completions`
   - **Variable** `AI_MODEL`: the exact free-eligible model ID you confirmed in your console.
   - **Variable** `ALLOWED_ORIGIN`: `https://mohammadfadaiemacbook-coder.github.io` (origin only; no repository path).
5. Save changes and redeploy if the Cloudflare dashboard asks you to.
6. Open the published AI Business Core dashboard, go to **AI Studio**, enter the Worker URL ending in `/api/generate` and the same `APP_ACCESS_TOKEN`, then generate a small test draft.

The Worker URL looks like `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/generate`. Do not share the app token or provider key in chat, screenshots, or GitHub.

## 2. Other provider settings

The gateway expects an OpenAI-compatible **chat completions** endpoint and response. To change provider, update the Worker variables/secrets:
- `AI_API_URL`: provider's chat-completions endpoint.
- `AI_MODEL`: exact model ID supported by the provider.
- `AI_API_KEY`: provider API key stored as a Worker secret.

Do not assume that a provider's consumer subscription includes API usage. In particular, **Claude Pro is a subscription for Claude's chat product and does not include Anthropic API credits**. If you later want to use Claude through this gateway, you will need Anthropic Console API access and separately funded API usage, plus an adapter if the chosen Anthropic endpoint does not accept the OpenAI chat-completions schema. Official explanation: https://support.anthropic.com/en/articles/9876003-i-subscribe-to-a-paid-claude-ai-plan-why-do-i-have-to-pay-separately-for-api-usage-on-console.

## Request and response

Endpoint: `POST https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/generate`

Headers:
- `Authorization: Bearer YOUR_APP_ACCESS_TOKEN`
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

Supported task names: `youtube_research`, `video_outline`, `video_script`, `title_ideas`, `instagram_repurpose`.

A successful response returns `output`, `task`, and `model`. The gateway does not browse the web, independently verify facts, publish content, or execute business actions. Treat output as a draft and verify factual claims and sources before approval.

## Security and limitations

- CORS restricts browser origins but is not authentication by itself; the bearer token is also required.
- Never put API keys or the app access token in frontend code, GitHub files, or the manifest.
- Anyone who obtains the app access token can use your gateway. Rotate it if exposed.
- The Worker has a request-size cap and basic error handling, but no durable per-user identity, billing controls, or advanced rate limiting.
- A free Cloudflare Workers plan does not make a third-party provider's paid API free.
- AI-generated claims and suggested sources are not verified automatically.
