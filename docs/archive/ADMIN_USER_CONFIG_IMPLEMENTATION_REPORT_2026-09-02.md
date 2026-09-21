# Admin User and System Config Implementation Report

Date: 2026-09-02
Repository: `fptu-lost-found-system-main`
Branch: `fix/admin-user-config-review`

## Scope

This change set completes the hardening review for:

- `feature/admin-user-role-access-management` / UC-063
- `feature/system-config-public-config` / LNFS-50

No mobile, claims, chat, appointment, warehouse expansion, or unrelated product feature was added.

## Implemented

### Admin user management

- Admin-only API routes for list, read, create, atomic update, role change, status change, and soft delete.
- One PATCH request can update profile, access role, and status together.
- Active-admin mutations lock the complete active-admin set in deterministic order inside the transaction.
- The final active-admin count is read after the lock, preventing two concurrent requests from removing the last active Admin.
- Self-demotion, self-disable, and self-delete are rejected.
- Duplicate normalized email is returned as HTTP 409.
- Disabled or role-revoked users have refresh tokens revoked and session version incremented.
- Audit entries include actor, action, target, before/after state, reason, and timestamp.
- Password hashes, passwords, refresh tokens, and other credentials are excluded from response and audit state.

### System configuration

- Admin-only CRUD and per-config history endpoint.
- Typed values: `STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, and `JSON`.
- Safe integer, finite float, boolean, and JSON validation.
- Public response is restricted to an allowlist and `client.*` keys.
- Credential-like keys are rejected and are never written through the config API.
- Config writes use a transaction and row lock; history is written in the same transaction.
- History stores old/new key, type, value, state, actor, reason, and timestamp.
- Sensitive values are redacted in admin responses, history responses, and audit state.

## Database migration

Added `apps/api-node/src/migrations/039_admin_user_and_config_audit.sql`:

- creates `admin_audit_logs`;
- extends `config_history` with config identity, action, old/new key and type, state snapshots, reason, and an index.
- migration checksum verification accepts CRLF/LF line-ending differences while still rejecting SQL content changes.

Migration `039_admin_user_and_config_audit.sql` was applied successfully to the shared Aiven database on 2026-09-02 through `npm run migrate`. Read-only verification confirmed the migration row, the `admin_audit_logs` table, and all new `config_history` audit columns. Do not run the database integration suite against Aiven.

## API contract changes

- `PATCH /api/admin/users/:id` accepts `email`, `fullName`, `studentCode`, `phoneNumber`, `accessRole`, `status`, and optional `reason` in one request.
- `POST /api/admin/users` accepts optional `reason`.
- `PATCH /api/admin/users/:id/role` and `/status` accept optional `reason`.
- `DELETE /api/admin/users/:id` accepts an optional JSON body with `reason`.
- `GET /api/admin/configs/:id/history?limit=20` returns config history.
- Config create/update accepts optional `reason`; config delete accepts optional JSON `reason`.
- Duplicate email/key and relational conflicts return HTTP 409 through the shared error handler.

## Tests and commands

| Command | Result |
| --- | --- |
| `npm run test` | PASS: 85 API tests, 1 safe DB integration skip, Web TypeScript check pass |
| `npm run build` | PASS: API TypeScript build and Web production build |
| `npm run migrate:diagnose-checksums` | PASS: current migration files match applied database checksums, including CRLF/LF-equivalent files |
| `npm run migrate` | PASS: applied `039_admin_user_and_config_audit.sql` to the shared Aiven database |
| `npm --workspace @lnfs/api-node run test:db-integration` | PASS as a safe skip because no dedicated local `*_test` database was configured |
| `git diff --check` | PASS; only Git line-ending normalization warnings |

CI coverage is defined in `.github/workflows/ci.yml`. It provisions an ephemeral MySQL 8 service and runs the same integration suite with a dedicated `lnfs_test` database.

Added or expanded coverage includes:

- HTTP authentication and role checks for admin user/config routes;
- HTTP user/config CRUD contract, history route, and duplicate-email HTTP 409;
- atomic user profile/role/status service update;
- deterministic `SELECT ... FOR UPDATE` active-admin locking query;
- MySQL integration test for concurrent last-admin removal, guarded to local `*_test` only;
- typed config validation, public allowlist, sensitive-key rejection, and history audit behavior.

## Remaining verification

- The MySQL concurrency test becomes an executed pass only when run with a dedicated local `LNFS_TEST_DB_NAME` ending in `_test` and `LNFS_DB_INTEGRATION=1`.
- Future migrations on Aiven still require the team deployment owner and a reviewed backup/rollback window.
- Jira, PR, and branch status were not changed by this implementation.

## Rollback

Revert the implementation commit and, if migration `039` has already been applied, restore the database from the approved backup or execute a reviewed down-migration. Do not edit or delete earlier migration checksums.
