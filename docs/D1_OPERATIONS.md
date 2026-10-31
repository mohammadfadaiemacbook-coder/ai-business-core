# D1 operations: backup, migration, and recovery

## Safety model

- Schema changes are forward-only numbered SQL files in `migrations/`; never edit a migration after it has been applied to a shared database.
- The release workflow exports the remote D1 database before applying pending migrations and uploads that SQL export as a 30-day GitHub Actions artifact.
- The workflow applies migrations before deploying the Worker, then checks the Worker/D1 health endpoint.
- A failed migration or deployment is not proof that the database was rolled back. Keep the pre-deploy export and inspect the migration ledger before retrying.
- Workspace snapshot writes use optimistic version checks. A stale device receives HTTP 409 and must preserve its local copy before syncing again.
- Provider secret updates are encrypted before writing and now use one D1 batch so a multi-key update is committed together.

## Restore procedure (operator action)

1. Stop further releases and preserve the failed workflow logs and backup artifact.
2. Download the artifact named `ai-business-core-d1-predeploy-backup` from the failed/suspect GitHub Actions run.
3. Verify the SQL file is non-empty and retain an untouched copy outside the repository.
4. Confirm the target database name and ID in `wrangler.toml`; never restore to a guessed database.
5. Review the export and the migration ledger. Restoring an export replaces the target database contents; obtain explicit database-owner approval before doing so.
6. Use the Cloudflare Wrangler D1 execute/import workflow appropriate to the installed Wrangler version to restore the SQL export, then verify required tables and migration records.
7. Re-run read-only health checks and application smoke tests before enabling writes or deploying a Worker version that expects the restored schema.

## Manual read-only checks

```sh
npx wrangler d1 migrations list ai-business-core-db --remote
npx wrangler d1 execute ai-business-core-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
npx wrangler d1 execute ai-business-core-db --remote --command "SELECT workspace_id, version, updated_at FROM workspace_snapshots ORDER BY updated_at DESC LIMIT 20"
```

Do not paste database exports, OAuth tokens, encryption keys, or provider credentials into chat or commit them to Git.
