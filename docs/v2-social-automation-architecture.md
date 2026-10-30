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
- `GET /api/publish-jobs/:id` — inspect execution and platform result.\n- `GET /api/workspace?workspace=default` and `PUT /api/workspace?workspace=default` — read/write a validated workspace snapshot in D1; both require the Worker app bearer token. This is a single-shared-token prototype, not multi-user identity.

All write endpoints require authenticated workspace identity, CSRF/state protections as applicable, authorization checks, idempotency keys, input validation, and audit events. The current shared static app token is only a prototype gate and must not be treated as production multi-user authentication.

## Platform constraints and prerequisites

- YouTube: use Google OAuth and YouTube Data API. Uploads require an authorized channel and appropriate scopes; quota, upload processing, visibility, and API project verification/restrictions must be accounted for.
- Instagram: use Meta's official Instagram Graph API for eligible professional accounts and supported publishing flows. Account type, linked Facebook Page / Meta setup, permissions, app review, media container requirements, and publishing limits must be checked at connection time.
- Profile name/bio changes are separate high-impact actions. Generate a proposed diff and require a dedicated approval before applying, if the platform API and granted permissions support it.
- Platform APIs do not guarantee every content format or account feature can be automated. Unsupported actions must remain manual with a clear explanation.
- Do not automate browser login, scrape private endpoints, or ask users to provide platform passwords.


## Instagram onboarding and profile manager

The owner creates the Instagram account independently, then connects it to the workspace through Meta's official OAuth flow. The product must never request or collect the Instagram password. After connection, the AI prepares a reviewable profile package; it does not silently change the account.

### AI-prepared profile package

For the connected account, the profile manager may generate and maintain a versioned proposal containing:

- Username and display-name suggestions (availability is not guaranteed until checked through an allowed official mechanism or manually in Instagram).
- Suggested professional category and account-positioning notes.
- A polished bio, call-to-action, and link/contact recommendations.
- AI-generated profile-image concepts and final image asset previews.
- Highlight plan: highlight titles, ordering suggestions, cover artwork, and suggested story packs/content.
- A profile completeness report and a prioritized setup checklist.

The package is a proposal, not a claim that Instagram has accepted or applied any change. Each field should show its current value (when readable), proposed value, rationale, and capability status.

### Capability discovery and honest execution

Maintain a versioned Instagram capability registry keyed by API version, account type, granted scopes, app-review status, and endpoint availability. Re-check capabilities when an account is connected and periodically thereafter. Do not assume that a feature is writable merely because it is visible in Instagram's consumer app.

Use these statuses for each proposed operation:

- `supported`: verified official API operation is available for this account and granted permissions.
- `approval_required`: API operation is available, but owner approval for this exact change is still required.
- `manual_required`: no supported public API path is available, or prerequisites are not satisfied; show precise user-facing steps.
- `blocked`: platform policy, account eligibility, missing permission, or API error prevents the operation.
- `applied`: confirmed by a successful official API response and, where possible, a follow-up read.
- `failed`: attempted through an official API and returned an error; retain the error code and recovery guidance.

Before enabling any write, validate current Meta documentation and the app's approved permissions. Instagram Graph API support is limited and changes over time. In particular, do not promise programmatic account-type conversion, arbitrary username changes, or creation/reordering/management of Story Highlights unless current official API documentation explicitly supports the exact operation for the connected account. When unsupported or uncertain, mark it `manual_required` and provide a concise checklist that opens the relevant Instagram settings/workflow for the owner to complete.

### Approval and audit rules

- Profile edits are separate high-impact approval requests, not bundled into a content-publishing approval.
- Approval binds the account ID, exact field changes, asset references, API version, permission/capability snapshot, payload hash, and expiry.
- Any edit to the proposal or capability snapshot invalidates the approval and requires a new review.
- Apply only the approved fields that are officially supported. Never silently skip unsupported fields; return a per-field result and manual checklist.
- Record who approved, what changed, API response identifiers, timestamps, and before/after values where available.
- Profile-image upload, bio/category/contact updates, and any other supported mutation must each be reported as applied only after platform confirmation.

### Suggested profile-manager API

- `GET /api/social/instagram/capabilities` — report verified operations and prerequisites for the connected account.
- `POST /api/social/instagram/profile-package` — generate or refresh the AI profile proposal.
- `GET /api/social/instagram/profile-package/:id` — retrieve proposal, previews, per-field status, and manual checklist.
- `POST /api/social/instagram/profile-package/:id/approve` — approve the immutable profile-change payload.
- `POST /api/social/instagram/profile-package/:id/apply` — apply only approved, supported operations; return per-field outcomes.

These routes are a proposed contract; they are not implemented yet. Manual-required items must never be routed through browser automation, private endpoints, or password-based workarounds.

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

### Phase 5 — Instagram profile management and analytics
- Build the Instagram onboarding flow for owner-created accounts and official Meta OAuth connection.
- Implement capability discovery and the AI-prepared profile package (username/display-name suggestions, category, bio, profile image, links/contact, and highlight plan/covers/story packs).
- Apply only officially supported, owner-approved profile changes; expose unsupported items as manual-required checklists.
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


## D1 workspace snapshot sync (implemented foundation)

The Worker now exposes authenticated `GET` and `PUT /api/workspace` endpoints. They store the dashboard's tasks, research notes, content drafts, calendar events, approvals, and settings as a versioned JSON snapshot in `workspace_snapshots`, keyed by workspace ID. Each successful write adds an `audit_events` record. The dashboard's Settings page exposes explicit Connect, Pull, and Push actions; it does not silently overwrite local or cloud data. The app token is held in JavaScript memory only for the current page session and must be re-entered after a reload.

Apply the new D1 migration before using sync:

```sh
npx wrangler d1 migrations apply ai-business-core-db --remote
```

This snapshot sync is a transitional single-workspace/shared-token foundation. A shared `APP_ACCESS_TOKEN` does not identify individual users and is not production multi-tenant authentication. Do not expose the token publicly. Before inviting other users, implement per-user authentication, workspace membership/authorization, rate limits, and token rotation. Do not use this snapshot endpoint for OAuth tokens or binary media. OAuth, media generation, YouTube/Instagram publishing, and profile mutation remain unimplemented; no publishing is claimed by this release.
