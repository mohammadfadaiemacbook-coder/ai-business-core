# v2 backend setup — OAuth and durable storage

This guide prepares the Cloudflare resources. It does not claim OAuth or publishing is live until credentials, provider review, and deployment are completed.

## 1. Create the D1 database

```bash
npx wrangler d1 create ai-business-core-db
```

Copy the returned database ID into the `database_id` field in `wrangler.toml`. Never commit API keys or OAuth client secrets.

Apply the schema:

```bash
npx wrangler d1 migrations apply ai-business-core-db --remote
```

## 2. Required Cloudflare bindings and secrets

- D1 binding: `DB` (configured in wrangler.toml)
- Secrets to add only with `wrangler secret put NAME`:
  - `TOKEN_ENCRYPTION_KEY` — random 32-byte key encoded as base64; use only for server-side token encryption.
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `META_APP_ID`, `META_APP_SECRET`
  - Existing `AI_API_KEY` and `APP_ACCESS_TOKEN`

Set non-secret variables for the exact deployed callback URLs and public app origin. Do not paste secrets into chat, GitHub issues, source files, or browser storage.

## 3. Google / YouTube OAuth prerequisites

Create a Google Cloud project, configure the OAuth consent screen, add the exact Worker callback URL, and request only the YouTube scopes needed for the selected workflow. Test with a channel/account authorized for the app. Google verification and YouTube API quota/restrictions may apply.

## 4. Meta / Instagram prerequisites

Create a Meta developer app, add the current Instagram API product/login configuration, configure the exact OAuth callback URL, and request only the scopes required for the selected professional-account publishing/profile capabilities. Confirm the account type, linked Page/business setup, app mode, tester roles, and App Review requirements against current Meta documentation. Do not assume highlights, username, or account-type changes are API-writable.

## 5. Release gates

- Configure real workspace authentication before exposing D1 records to multiple users. The current shared static app token is not workspace authentication.
- Encrypt access/refresh tokens at rest with authenticated encryption; never log or return them.
- Implement state validation, one-time state consumption, PKCE where supported, redirect URI allowlists, CSRF protection, disconnect/revoke, and token rotation.
- Add rate limits, audit events, idempotency, approval payload hashing, and scheduler reconciliation before any write/publish endpoint is enabled.
- Keep all platform write routes disabled until OAuth and capability tests pass.
- Test on a staging Worker and a test social account before production.

## Current implementation status

The D1 schema is a foundation only. OAuth handlers, encrypted token lifecycle, workspace authentication, media jobs, approval-bound publishing, and Instagram profile mutations are not activated by this migration. Do not configure a production UI to imply otherwise.
