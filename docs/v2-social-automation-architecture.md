# AI Business Core v2 — Social Automation Architecture

## Product decisions

- Operating mode: approval-first semi-automation. AI may research, draft, generate media, validate, and prepare schedules. No platform publish or profile mutation happens until the owner approves the exact action.
- Platforms: YouTube and Instagram.
- Media: AI-generated image/video assets, with provider adapters rather than hard-coding one vendor.
- Interface: existing GitHub Pages PWA and Android WebView remain the client.
- Backend: Cloudflare Worker remains the public API gateway. Platform OAuth callbacks, token storage, scheduled jobs, and media orchestration require server-side services/storage; secrets must never be placed in browser code or LocalStorage.

## Target architecture

```text
PWA / Android WebView
  |  session + user actions
  v
Cloudflare API Gateway
  |-- AI Orchestrator ---- Groq / additional LLM providers
  |-- Research & originality checker
  |-- Media job coordinator ---- image/video provider adapters
  |-- Approval & publishing API
  |-- OAuth callback handlers
  |
  +---- Durable storage (D1 for records, R2 for generated media)
  +---- Queue / scheduled triggers
  |
  +---- YouTube Data API (Google OAuth)
  +---- Instagram Graph API (Meta OAuth)
```

The current Worker is a stateless Groq generation proxy. It is not yet an OAuth server, database, media renderer, or publisher. Those capabilities must be added incrementally.

## Core workflow

1. Workspace owner connects a YouTube channel and an eligible Instagram professional account through official OAuth consent screens.
2. User creates a campaign brief: topic, audience, language, tone, content pillars, exclusions, and target platforms.
3. Research agent produces source candidates and separates verified facts, assumptions, and open questions. Any web research must use a configured search provider and retain source URLs and retrieval timestamps.
4. Scenario agent generates multiple distinct concepts. An originality service compares them with prior approved/published content using normalized text fingerprints and semantic similarity; high similarity is flagged, not silently rewritten as “unique”.
5. Media agent creates image/video jobs through provider adapters. Store provider, model, prompt, output metadata, usage/cost, and asset references. Keep generated binaries in object storage, not LocalStorage.
6. Quality checks verify required fields, platform constraints, claims needing citations, media dimensions/duration, and policy-sensitive items.
7. The system creates a versioned draft and a proposed action in the approval queue.
8. Owner reviews the exact caption/title, media preview, destination account, visibility, scheduled time, and profile changes. Approval is bound to that immutable version and action.
9. Scheduler executes only an approved, unexpired action. Any content, destination, visibility, or schedule change invalidates approval and requires re-approval.
10. Store platform response IDs and URLs; reconcile status and analytics asynchronously.

## Suggested data model

- `social_accounts`: id, platform, external_account_id, display_name, scopes, token_reference, status, connected_at, last_checked_at.
- `campaigns`: id, name, brief_json, language, audience, content_pillars, status.
- `content_items`: id, campaign_id, platform, content_type, title, caption, script, status, version, content_hash, similarity_report_json.
- `media_assets`: id, content_item_id, provider, model, asset_type, storage_key, mime_type, width, height, duration_seconds, status, metadata_json.
- `approval_requests`: id, action_type, target_account_id, content_item_id, content_version, payload_hash, proposed_at, expires_at, status, reviewed_at.
- `publish_jobs`: id, approval_request_id, scheduled_at, status, attempts, platform_post_id, platform_url, last_error.
- `provider_jobs`: id, provider, job_type, external_job_id, status, usage_json, error_code.

Never store raw OAuth tokens in client storage. Use encrypted server-side token storage and least-privilege scopes. Do not log access tokens, refresh tokens, API keys, or authorization headers.

## API surface to implement

- `POST /api/oauth/:platform/start` — create state + PKCE where supported and return authorization URL.
- `GET /api/oauth/:platform/callback` — validate state, exchange code server-side, persist encrypted token reference.
- `GET /api/social/accounts` — list connected accounts and granted scopes.
- `POST /api/campaigns` — create campaign brief.
- `POST /api/content/generate` — create research/script/caption draft.
- `POST /api/media/jobs` — submit image/video generation job.
- `GET /api/media/jobs/:id` — poll job state.
- `POST /api/approvals/:id/approve` and `/reject` — owner decision bound to payload hash.
- `POST /api/publish-jobs` — schedule an already-approved immutable action.
- `GET /api/publish-jobs/:id` — inspect execution and platform result.

All write endpoints require authenticated workspace identity, CSRF/state protections as applicable, authorization checks, idempotency keys, input validation, and audit events. The current shared static app token is only a prototype gate and must not be treated as production multi-user authentication.

## Platform constraints and prerequisites

- YouTube: use Google OAuth and YouTube Data API. Uploads require an authorized channel and appropriate scopes; quota, upload processing, visibility, and API project verification/restrictions must be accounted for.
- Instagram: use Meta's official Instagram Graph API for eligible professional accounts and supported publishing flows. Account type, linked Facebook Page / Meta setup, permissions, app review, media container requirements, and publishing limits must be checked at connection time.
- Profile name/bio changes are separate high-impact actions. Generate a proposed diff and require a dedicated approval before applying, if the platform API and granted permissions support it.
- Platform APIs do not guarantee every content format or account feature can be automated. Unsupported actions must remain manual with a clear explanation.
- Do not automate browser login, scrape private endpoints, or ask users to provide platform passwords.

## Delivery plan

### Phase 0 — Foundation (first implementation slice)
- Add this architecture and API contract to the repository.
- Add explicit v2 product flags and a platform-connection status area without pretending accounts are connected.
- Define approval payload/version semantics and tests before enabling publishing.

### Phase 1 — Secure account connections
- Choose durable storage and deploy D1 + encrypted token storage.
- Implement Google and Meta OAuth state validation, callbacks, disconnect/revoke, scope display, and account health checks.
- Add server-side user/workspace authentication; replace the prototype shared app token for production use.

### Phase 2 — Content intelligence
- Add campaign briefs, research provenance, multi-provider LLM adapter interface, content history, similarity checks, and draft versioning.
- Require source verification for factual claims; label generated assumptions.

### Phase 3 — AI media production
- Integrate one image provider and one video provider behind adapters.
- Add asynchronous job processing, R2 asset storage, previews, retry handling, and usage/cost tracking.

### Phase 4 — Approval and publishing
- Build the approval UI with immutable previews and explicit account/format/visibility/time.
- Add YouTube publishing first, then eligible Instagram formats.
- Scheduler must reject unapproved, expired, or hash-mismatched actions; use idempotency and reconciliation.

### Phase 5 — Profile management and analytics
- Propose profile/bio edits as separate approval requests.
- Import platform analytics within granted API access; use metrics to inform future briefs without claiming causation.

## Acceptance criteria for the first publishable release

- No platform write occurs without an authenticated owner approving the exact payload.
- Any edit after approval invalidates that approval.
- Tokens and provider secrets never reach browser JavaScript, LocalStorage, logs, or exported backups.
- OAuth state is validated and disconnect/revoke is supported.
- Every publish job is idempotent, auditable, retry-safe, and reports the platform's actual response.
- Unsupported API operations are clearly marked manual rather than simulated.
- The app shows connected-account status, draft/media status, approval state, and publish result separately.

## Current status

The existing app already has a local approval list and a Groq draft-generation gateway. The current approval buttons only change local record status; they do not authorize or perform a real platform action. No YouTube/Meta OAuth, durable social database, media generation provider, or real publishing integration is implemented yet.
