# Security Fix Batch #3 — Report

> Date: 2026-09-17
> Scope: **volatile session invalidation** — every password change (admin reset or self-service) now kills all previously-issued JWTs (HTTP + Socket.io) via `users.token_version`, plus targeted cache invalidation when a user's role changes.
> Constraint honored: only the enumerated items were touched; no unrelated modules refactored; no PR opened; production rate limiting untouched.
> Baseline: Batch #2 left 184/184 tests, 79 security tests (52 unit + 27 HTTP), `tsc --noEmit` clean.

---

## CHANGED FILES

| File | Change |
|------|--------|
| `schema_mssql.sql` | Fresh-DDL `users` table now declares `token_version INT NOT NULL DEFAULT 0` (safe for re-execution; the whole file is `IF NOT EXISTS`-guarded). |
| `src/backend/infrastructure/db.ts` | Inline DDL guard added: `IF NOT EXISTS (...name='token_version') ALTER TABLE users ADD token_version INT NOT NULL DEFAULT 0;` — reconciles retrofit live DBs without a migration run. |
| `migrations/033_add_users_token_version.ts` | New Knex migration: `up` adds `token_version` (idempotent via `hasColumn`), `down` drops it. Consistent with the `032`-style retrofit migrations. |
| `src/backend/api/auth.routes.ts` | `POST /register` JWT now embeds `tokenVersion: 0`; `POST /login` embeds `tokenVersion: Number(user.token_version ?? 0)`. |
| `src/backend/api/middleware.ts` | `authenticate` now rejects any JWT whose `tokenVersion` ≠ the DB `token_version` (after the exists-check, before role/tenant recheck → 401). Added exported `resolveSocketUser(token)` that mirrors the full HTTP check (blacklist + user-exists + tokenVersion + role/tenant recheck) for Socket.io. The user-exists snapshot is now stored as a defensive **copy** (`{ ...freshUser }`) so DB mutations never pollute the cache value in place. |
| `server.ts` | Socket.io handshake middleware now delegates to `resolveSocketUser`, replacing the old inline `jwt.verify`-only path — websocket sessions are now equally invalidated by password changes and role/tenant drift. |
| `src/backend/api/user.routes.ts` | `PUT /:id/password` (admin reset) and `PUT /me/password` (self-service) now increment `token_version` in the same update as the new password and clear the user's permission/session cache (`invalidateUserPermissionCache`). Self-service additionally re-issues one fresh JWT for the current session carrying `tokenVersion: nextVersion`. `PUT /:id` (profile update) now performs **targeted** `invalidateUserPermissionCache(id)` only when the `role` actually changes (name/email edits leave the cache intact). |
| `src/backend/infrastructure/cache.ts` | `invalidateUserPermissionCache(userId)` extended to also invalidate `user:{id}`, `tenantIds:{id}`, `assignment:{id}:`, `bishop_tenant:{id}:` patterns — not just the permission keys — so session/authz state never survives a security-sensitive change. |
| `src/test/security-authz.test.ts` | DB mock enhanced with real `insert` / `update` / `del` / `count` semantics (mutates the rows store, copies on `first`); `signToken` gains a `tokenVersion` parameter; harness now mounts the **real `auth.routes` + `user.routes` routers** and the **real `auditLogger`**. **+12 tests**: password-reset invalidation (4), self-service password change (5), session/cache invalidation on sensitive changes (2), passwords-never-in-audit-log (1). |
| `SECURITY_FIX_BATCH3_REPORT.md` | This file. |

---

## SECURITY BEHAVIOR BEFORE / AFTER

### Passwords / sessions
- **Before**: changing or resetting a password updated the hash only. Every JWT already handed out stayed valid for up to 24 h because the token itself carried no session version and `authenticate` never compared the token against the user's current state. The only invalidation path was client-side cookie clearing (opt-in) or the token_blacklist (logout only).
- **After**: each password change bumps `users.token_version` atomically with the new hash. `authenticate` and `resolveSocketUser` compare the JWT's `tokenVersion` claim to the DB value and hard-reject (`401` HTTP / `Session stale` socket) any mismatch. Old sessions die **server-side, immediately, with no reliance on the client** deleting its cookie. The password-holder can instantly sign back in under the new version.

### Role changes
- **Before**: `PUT /:id` profile updates never touched any cache; a stale `user:{id}` snapshot could linger up to its 15 s TTL, masking a role change, and the wrong cached permissions could serve until expiry.
- **After**: a role change through `PUT /:id` triggers **targeted** invalidation of that user's cached user-row/permissions/tenant keys only; non-sensitive updates (e.g., `name`) keep the cache warm (verified by test). `PATCH /:id/role` and the custom-role paths already invalidated; they are unchanged.

### Socket.io
- **Before**: the handshake verified signature only (`jwt.verify`). A user could keep a websocket alive with a token whose password had been reset.
- **After**: the handshake runs `resolveSocketUser` (blacklist + user-exists + tokenVersion + role/tenant recheck), same guarantees as HTTP.

---

## BACKWARD-COMPATIBILITY NOTES

1. **Older tokens still work**: JWTs issued before this deploy carry no `tokenVersion` claim ⇒ `Number(undefined ?? 0) === 0`, matching `token_version DEFAULT 0` for untouched accounts. Existing sessions only break **after** a password is changed post-deploy.
2. **Re-issue on self-service change**: the single self-service path re-mints one token at the new version so the user isn't logged out of the session they just used — every other session dies.
3. **Idempotent rollout**: `033` guards with `hasColumn`; `db.ts` guards with an `IF NOT EXISTS` check; fresh DBs get the column from `schema_mssql.sql`. Safe on retrofit and greenfield installs alike.
4. **No rate limiting weakened**: `PUT /me/password` uses its own dedicated limiter (20/15 min); the harness never calls `/auth/login`, so the production login limiter is untouched.

---

## TEST RESULTS

| Check | Result |
|-------|--------|
| `npm run lint` (`tsc --noEmit`) | ✅ no errors |
| `npx tsc --noEmit` | ✅ no errors |
| `npx vitest run` — run #1 | ✅ 14 files passed (14), **196** tests passed (196), 0 skipped |
| `npx vitest run` — run #2 | ✅ 14 files passed (14), **196** tests passed (196), 0 skipped |
| Security unit suite (`src/test/securityAuthz.test.ts`) | ✅ **52**/52 passed (unchanged) |
| Security HTTP suite (`src/test/security-authz.test.ts`) | ✅ **39**/39 passed (27 prior + 12 new) |
| SQL Server reachable | ✅ live MSSQL up — `global-setup` spawned the real server (schema applied, RBAC already seeded); both mocked-DB security suites and the live-server integration suites passed |

Counts: `184 → 196` total (‑14 files); security tests `79 → 91` (52 unit + 39 HTTP). Every prior-batch test still passes; the new suite is fully deterministic (minted JWTs, in-process server, mocked DB — no login endpoint, no rate limits).

---

## REMAINING SECURITY RISKS (unchanged, ordered by severity)

1. **Pre-existing findings from `SECURITY_FIXES.md`** (live secrets in `.env`, `dangerouslySetInnerHTML`, JWT in `localStorage`, WebSocket without auth) — the highest-severity items still open; a dedicated follow-up. Batch #3 did tighten the socket handshake, but this refers to broader hardening.
2. **Login rate limiter** — single global per-IP limiter (10/15 min); no per-account or distributed throttle. Unchanged by design.
3. **`admin_management.routes.ts` `getTenantIds`** — falls back from `user.tenantIds` to `user.tenantId`; callers guard with `tenantIds.length > 0`, so this is a consistency/audit gap, not a demonstrated leak. Out of scope.
4. **Badge creation** (`POST /badges/`) still stamps `tenant_id = req.user.tenantId`, so a null-tenant `MANAGE_REWARDS` holder could technically create a global badge (they can no longer edit/delete it). Minor data-integrity nuisance; flagged in Batch #2, untouched here.
5. **`/grant` quick-grant** (`POST /badges/grant`) still allows a non-admin to grant a badge to a null-tenant student. Same NULL-loophole class as the `/assign` case already fixed; kept out of scope.
6. **Self-service password policy** is enforced only on the new-password side of `PUT /me/password` (no `currentPassword` check in the validator); the route handler itself verifies via `bcrypt.compare`, so this is a hygiene note, not a bypass.

---

## BEHAVIOR INTENTIONALLY PRESERVED

- **Existing long-lived sessions** for untouched accounts remain valid (tokenVersion 0 matches DEFAULT 0).
- **Admin reset** keeps its response contract (`success` JSON only — no password ever echoed) and still requires `MANAGE_USERS` + `canManageTargetUser` scoping.
- **Self-service change** keeps its response contract, returns `safeUser` (password stripped), and re-issues only the acting session's cookie.
- **Socket.io** passes the same user object shape as before (`{ ..., tenantIds? }`) so downstream `io` handlers are unaffected.
- **No production rate limiting changed**; **no unrelated modules touched**.

---

## Directories / artifacts touched by this batch

```
schema_mssql.sql                            (users.token_version in fresh DDL)
src/backend/infrastructure/db.ts            (inline DDL guard for token_version)
migrations/033_add_users_token_version.ts   (idempotent migration, up + down)
src/backend/api/auth.routes.ts              (tokenVersion claim in register + login JWTs)
src/backend/api/middleware.ts               (token_version check in authenticate; resolveSocketUser; cache copy)
server.ts                                   (socket handshake → resolveSocketUser)
src/backend/api/user.routes.ts              (token_version bump on both password changes; targeted cache invalidation on role change)
src/backend/infrastructure/cache.ts         (invalidateUserPermissionCache clears user/tenant keys, not just permissions)
src/test/security-authz.test.ts             (mock insert/update/del/count; signToken tokenVersion; auth+user routers + auditLogger; +12 tests)
SECURITY_FIX_BATCH3_REPORT.md               (this file)
```