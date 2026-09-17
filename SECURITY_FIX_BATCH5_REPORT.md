# Security Fix Batch #5 — Report

> Date: 2026-09-17
> Scope: **A-2 (seed-admin) + secret/environment hardening** — `scripts/seed-admin.ts` no longer hardcodes `admin123`, is env-driven and fail-closed, has a production-safety guard, and bumps `token_version` on reset; the hardcoded JWT secret in `scripts/test-endpoints.ts` is gone; `.env`/`.env.example`/git-history/frontend/build-output were verified; and **an actual server-secret exposure in the built bundle was discovered and fixed**.
> Constraint honored: no unrelated authorization logic, no Socket.IO/radio/tenant-isolation changes, no dependency bumps, no rate-limit/proxy/HTTPS/payment/file-authz/UI changes. The one apparent scope exception (Vite `define`) is the section-7 “prevent an actual secret exposure discovered during this task” exception (see **EXPOSURE FOUND** below).
> Baseline: Batch #4 left **231/231 tests across 15 files**, `tsc --noEmit` clean, `npm run lint` clean.

---

## Executive Summary

- **A-2 fixed.** `scripts/seed-admin.ts` previously reset the super-admin to a hardcoded `admin123` and never bumped `token_version`. It now reads `SEED_ADMIN_PASSWORD`/`SEED_ADMIN_EMAIL` from the environment, **fails closed** (no default, min 12 chars, known-weak blocklist, rejects reuse of the documented `DEFAULT_USER_PASSWORD`), refuses production without explicit `SEED_ADMIN_ALLOW_PRODUCTION=true`, and **bumps `token_version` in the same update** so every previously issued JWT for that account is invalidated (existing Batch #3 mechanism — no second mechanism added).
- **Hardcoded JWT secret removed.** `scripts/test-endpoints.ts` signed admin/bishop tokens with a literal `sakani-secret-key-…`. It now loads `process.env.JWT_SECRET` via dotenv and exits fail-closed if unset.
- **`scripts/set-passwords.ts` hardened** (same hardcoded-credential class; it reset **every** user to `123456`): env-driven DB config + password, weak/default rejection, production guard, and `token_version` bumped with the password.
- **E-1 fixed.** The startup guard now rejects the documented `.env.example` value `super-secret-key-change-me-in-production`.
- **EXPOSURE FOUND (new):** at batch start, the on-disk built bundle `dist/assets/index-*.js` contained the **literal values of 4 server secrets** (`JWT_SECRET`, `ENCRYPTION_KEY`, `VAPID_PRIVATE_KEY`, `YOUTUBE_API_KEY`) plus the identifiers for 5 env keys (including `DB_PASSWORD`). Root cause: `vite.config.ts` serialized the **entire** loaded env into `define` (`JSON.stringify(env)`) and `process`. Fixed by inlining **only** `NODE_ENV`/`MODE`/`VITE_*`; rebuilt bundle re-scanned → **0 secret-value hits, 0 secret-name hits**.
- **Verification:** `tsc --noEmit` clean; `npx vitest run` **247/247 across 16 files, twice**; +16 new tests (14 in the new batch-5 suite, 2 token-invalidation tests in the existing authz harness).

> **Not claimed:** the application is **not** fully secure. Documented remaining risks below (E-2 `DEFAULT_USER_PASSWORD`, local diagnostic credentials, CI/docker-compose defaults, cache TTL window, Vite build-artifact hygiene) are real.

---

## CHANGED FILES

| File | Change |
|------|--------|
| `scripts/seed-admin-lib.ts` | **New, pure (no DB imports).** `resolveSeedAdminEmail`, `validateSeedAdminPassword` (fail-closed: missing/empty, `< 12`, known-weak set incl. `admin123`/`123456`, equals `DEFAULT_USER_PASSWORD`), `assertSeedAdminProductionSafety` (production requires `SEED_ADMIN_ALLOW_PRODUCTION=true`), `buildAdminPasswordReset` (`{ password, token_version: current + 1 }`). Importable by tests without touching `knex`. |
| `scripts/seed-admin.ts` | Reads `SEED_ADMIN_PASSWORD`/`SEED_ADMIN_EMAIL`; validates with the lib and **exits before any DB connection** on failure; selects the production knex config when `NODE_ENV=production`; keeps bcrypt cost **10**; on reset writes the new hash **and** the bumped `token_version` in one update; **never prints a password**; connection in `try/finally`. |
| `scripts/test-endpoints.ts` | Removed the literal JWT secret. Added dotenv + `getJwtSecret()` reading `process.env.JWT_SECRET`, fail-closed with an error and `exit(1)`; token minting moved inside `main()`. |
| `scripts/set-passwords.ts` | Removed hardcoded `sa/123` DB credentials and the all-users `123456` reset. Requires `SET_ALL_USERS_PASSWORD` (≥12, weak-list rejection), production guard `SET_ALL_USERS_PASSWORD_ALLOW_PRODUCTION=true`, DB config from env, and `token_version` bumped via `kdb.raw('token_version + 1')` in the same update. |
| `server.ts` | **E-1:** added `'super-secret-key-change-me-in-production'` to `insecureJwtValues` (line 114) so the documented `.env.example` placeholder is rejected at boot. |
| `vite.config.ts` | **Secret-exposure fix:** builds `clientSafeEnv` (only `NODE_ENV`, `MODE`, `VITE_*`) and uses it in `define` for both `'process.env'` and `'process'`; the full env map is no longer serialized into client bundles. |
| `.env.example` | Added commented `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_ALLOW_PRODUCTION` documentation explaining the fail-closed, no-default behavior (lines 16-22). Existing values left unchanged (documented as local-only). |
| `src/test/security-secrets-batch5.test.ts` | **New +14 tests:** 6 unit tests for `seed-admin-lib`, 5 source-scan regression tests (seed-admin, test-endpoints, set-passwords, server.ts E-1, vite define), 1 `.env.example` test, 1 client-source secret-reference test, 1 conditional built-bundle secret-value test. |
| `src/test/security-authz.test.ts` | **+2 tests:** a script-style direct-DB reset (password + `token_version` in one update) kills every pre-existing JWT and the bumped version works; a bare `token_version` bump alone is sufficient. Reuses the existing real-middleware + mocked-DB harness. |
| `SECURITY_FIX_BATCH5_REPORT.md` | This file. |

---

## EXPOSURE FOUND — built bundle contained real server secrets (HIGH)

**Evidence (no values printed).** Scanning the on-disk `dist/` at the start of this batch:

| Artifact | Secret-name hits | Secret-value hits |
|----------|------------------|-------------------|
| Before fix — `dist/assets/index-BngBAvVr.js` (124 files scanned) | **5** (`JWT_SECRET`, `DB_PASSWORD`, `ENCRYPTION_KEY`, `VAPID_PRIVATE_KEY`, `YOUTUBE_API_KEY`) | **4** of 6 tested env values matched (`JWT_SECRET`, `ENCRYPTION_KEY`, `VAPID_PRIVATE_KEY`, `YOUTUBE_API_KEY`; `DB_PASSWORD` has a 3-char local value and `SETUP_REGISTRATION_TOKEN` is unset) |
| After fix (rebuilt, `dist/assets/index-CM0zNx1V.js`) | **0** | **0** |
| `dev-dist/` (3 tracked generated files) | 0 | 0 |

- **Root cause:** `loadEnv(mode, '.', '')` returns the entire environment (empty prefix), and `define: { 'process.env': JSON.stringify(env), 'process': { env } }` serialized all of it into the bundle whenever any dependency referenced `process.env`.
- **Why it differed from the Audit #4 note:** Audit #4 grepped the `dist` present at *its* time and found no matches; the artifact present at batch-5 start did contain them. This is exactly the hazard Audit #4 described (V-1), now materialized on disk.
- **Fix:** allowlist-only inline. Rebuilt and re-verified (table above).
- **Action required:** **rotate** `JWT_SECRET`, `ENCRYPTION_KEY`, `VAPID_PRIVATE_KEY`, and `YOUTUBE_API_KEY` if that bundle was ever served or deployed — treat the values that were in `dist/` as compromised. `dist/` is git-ignored and was not committed.

---

## SECURITY BEHAVIOR BEFORE / AFTER

### A-2 — `scripts/seed-admin.ts`
- **Before:** created/reset `admin@sakani.com` with `bcrypt.hash('admin123', 10)`; printed the password; no production guard; no `token_version` bump (a stolen admin JWT survived the reset). Reachable only manually (`npx tsx scripts/seed-admin.ts`; not wired into `package.json`), but the hardcoded credential was public in the repo since the initial commit.
- **After:** no literal password exists anywhere; the password is required from env and validated fail-closed (missing/empty/`<12`/known-weak/`=DEFAULT_USER_PASSWORD` ⇒ exit 1 **before** connecting). Production requires explicit opt-in. Reset updates `{ password, token_version: old+1 }` atomically ⇒ every prior JWT for the admin is rejected by `authenticate` (`middleware.ts:77-80`).

### `scripts/test-endpoints.ts`
- **Before:** `const SECRET = 'sakani-secret-key-change-in-production-2024'` — a committed signing key (matching a previously shipped secret string), usable to forge admin tokens if it ever matched a live server.
- **After:** secret read from `process.env.JWT_SECRET` only, fail-closed when missing.

### `scripts/set-passwords.ts`
- **Before:** hardcoded `sa`/`123` DB login and reset **all** users to the password `123456`, with no session invalidation.
- **After:** env-only credentials/password, weak/default + production guards, and `token_version` increment on every row (all old sessions die).

### E-1 — startup `JWT_SECRET` guard
- **Before:** rejected `your-secret-key-here`, `super-secret-key`, `''` but accepted the value the project itself tells operators to copy (`super-secret-key-change-me-in-production`).
- **After:** that documented value is rejected too (`server.ts:114`).

### Vite client bundle
- **Before:** full env (including server secrets) serialized into `define`; any `process.env` reference in a dependency leaked all of them.
- **After:** only `NODE_ENV`/`MODE`/`VITE_*` are inlined. No client source references `process.env` (regression-tested), and the rebuilt bundle contains no secret names or values.

---

## VERIFICATION — `.env`, git history, frontend, build output

| Question | Result |
|----------|--------|
| Is `.env` tracked / in history? | **No.** `.gitignore:7` (`.env*` + `!.env.example`); `git ls-files .env` empty; no `.env` commits in history. |
| Is `.env.example` tracked? | **Yes**, since the initial commit `92e1f7c`. Contains clearly-labelled placeholders: `DB_PASSWORD=123` (local-only warning), `JWT_SECRET=super-secret-key-change-me-in-production`, `ENCRYPTION_KEY=your-32-character-encryption-key-here`, `YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY_HERE`, `DEFAULT_USER_PASSWORD=Sakani@2026#ChangeMe`. |
| Does the frontend reference server secrets? | **No** — no `process.env` in `components/`, `contexts/`, `hooks/`, `providers/`, `services/`, `types/`, `App.tsx`, `main.tsx` (enforced by a new test). |
| Does the build output contain secrets? | **Not after the fix.** It did before (see EXPOSURE FOUND). |
| Are admin scripts auto-invoked? | **No** — `seed-admin.ts`, `set-passwords.ts`, `test-endpoints.ts` are not referenced in `package.json`; manual only. |
| Was the old secret in git history? | Yes — `scripts/seed-admin.ts` (`admin123`) and `scripts/test-endpoints.ts` (JWT secret) since `92e1f7c`. Removing them from HEAD does not purge history; rotate if those values were ever used live. |

---

## TEST RESULTS

| Check | Result |
|-------|--------|
| `npm run lint` (`tsc --noEmit`) | ✅ no errors |
| `npx vitest run` — run #1 | ✅ 16 files passed (16), **247** tests passed (247) |
| `npx vitest run` — run #2 | ✅ 16 files passed (16), **247** tests passed (247) |
| New batch-5 suite (`src/test/security-secrets-batch5.test.ts`) | ✅ **14**/14 passed (lib unit tests + source-scan regressions + conditional build-output scan) |
| Token-invalidation additions (`src/test/security-authz.test.ts`) | ✅ **2**/2 passed (real middleware + mocked DB) |
| Rebuilt bundle scan | ✅ 0 secret-name hits, 0 secret-value hits across 124 `dist` files |
| SQL Server reachable | ✅ live MSSQL up — `global-setup` spawned the real server for the live integration suites |

Counts: `231 → 247` tests (+16); files `15 → 16`. The batch-5 suite proves the fixes themselves and guards against regressions (e.g. re-adding a literal `bcrypt.hash('…')`, re-introducing `JSON.stringify(env)`, or a client importing `process.env`).

---

## BACKWARD-COMPATIBILITY NOTES

1. **Legitimate seed/reset flows still work** with a strong `SEED_ADMIN_PASSWORD`; the new admin row is identical except `token_version` is explicit (`0`) and no password is logged.
2. **`set-passwords.ts` now needs `SET_ALL_USERS_PASSWORD`** — operators who relied on the hardcoded `123456` must set the env var (intended: the old behavior was the vulnerability).
3. **No schema/migration changes**; `token_version` already exists (Batch #3).
4. **Admin authentication/authorization is untouched** beyond rejecting the documented placeholder secret at boot.
5. **Client runtime:** restricting `define` is standard Vite behavior; `NODE_ENV`/`MODE` remain inlined, so React and other dependencies keep working (build succeeded and app code references no other env var).

---

## REMAINING SECURITY RISKS (out of scope — documented, not fixed)

1. **E-2 — `DEFAULT_USER_PASSWORD` (`Sakani@2026#ChangeMe`)** is a documented constant applied to auto-created accounts; anyone who knows it can log into every account that never changed its password. Fixing requires touching account-creation flows (multiple routes) — deferred.
2. **Local diagnostic credentials remain** in `scripts/check-db.ts:9` and `scripts/test-db-conn.ts:8` (`password: '123'`) and `scripts/test-api.ts:29,39` (`123456`). Intended for local dev only, but they are in git; a security-conscious operator should parameterize them.
3. **CI/Docker defaults:** `.github/workflows/ci.yml` uses `JWT_SECRET: ${{ secrets.JWT_SECRET || 'ci-secret-key' }}` (lines 72, 84) and `JWT_SECRET: build-secret` (line 111); `docker-compose.yml:32` defaults `SA_PASSWORD` to `YourStrong@Password123`. Test/build-only, but replace-with-required would be safer.
4. **`src/test/students.test.ts:25,51,72`** logs in with `admin@sakani.com`/`admin123` against the live test server — depends on local DB state; migrate to env-based test credentials.
5. **Auth cache TTL window:** `userCache` TTL is 15s (`cache.ts:54`). In a *running* server, a script-based DB reset is reflected only after cache convergence (≤15s) unless the cache is invalidated; the `token_version` bump is the authoritative server-side control. Documented residual.
6. **Tracked generated PWA artifacts:** `dev-dist/{sw.js,registerSW.js,workbox-*.js}` are committed and regenerated by builds/tests (noisy diffs; 1-line change to `dev-dist/sw.js` in this batch, no secrets). Consider untracking them.
7. **Stale `dist/` on developer machines** can still be built with real secrets if the app is built before this fix; rotate secrets and rebuild. The new test fails if a present `dist/` contains current `.env` secret values, forcing a rebuild.
8. **Audit #4 items still open** (Socket.IO auth hardening, `dangerouslySetInnerHTML`, JWT in localStorage, payment/file-authz items) — unchanged.

---

## RECOMMENDATIONS

1. **Rotate** `JWT_SECRET`, `ENCRYPTION_KEY`, `VAPID_PRIVATE_KEY`, `YOUTUBE_API_KEY` (they appeared in a servable bundle; they were never committed, but treat on-disk build artifacts as public).
2. Set `SEED_ADMIN_PASSWORD` (and optionally `SEED_ADMIN_EMAIL`) in the deployment secret store; never commit it.
3. Remove the CI `ci-secret-key`/`build-secret` fallbacks and the `docker-compose.yml` SA-password default (require the env var).
4. Address E-2 by forcing a per-user password / first-login rotation instead of a fixed `DEFAULT_USER_PASSWORD`.
5. Add the build-artifact secret scan to CI (the new test already performs it when a `dist/` is present).

---

## Directories / artifacts touched by this batch

```
scripts/seed-admin-lib.ts                 (new: pure fail-closed helpers)
scripts/seed-admin.ts                     (env-driven, prod guard, token_version bump, no password logging)
scripts/test-endpoints.ts                 (JWT secret from env, fail-closed)
scripts/set-passwords.ts                  (env-only DB/password, prod guard, token_version bump)
server.ts                                 (E-1: reject documented .env.example JWT placeholder)
vite.config.ts                            (client-safe env allowlist — fixes bundle secret exposure)
.env.example                              (documented SEED_ADMIN_* placeholders)
src/test/security-secrets-batch5.test.ts  (+14 tests)
src/test/security-authz.test.ts           (+2 token-invalidation tests)
SECURITY_FIX_BATCH5_REPORT.md             (this file)
```

---

## FINAL SECURITY VALIDATION (summary answers)

1. **Was the hardcoded `admin123` removed from seed-admin?** Yes — no literal password remains; the password comes from `SEED_ADMIN_PASSWORD` and is validated fail-closed (`scripts/seed-admin-lib.ts`, `scripts/seed-admin.ts`).
2. **Does a reset invalidate existing sessions?** Yes — `token_version` is bumped in the same update (`buildAdminPasswordReset`), verified end-to-end (old JWT → 401, bumped JWT → 200).
3. **Is there a production-safety guard?** Yes — production refuses to run without `SEED_ADMIN_ALLOW_PRODUCTION=true` (and `set-passwords.ts` has the analogous guard).
4. **Was the hardcoded JWT secret in `test-endpoints.ts` removed?** Yes — read from `process.env.JWT_SECRET`, fail-closed; no `sakani-secret-key` string remains.
5. **Are there hardcoded credentials left in admin scripts?** Only the local diagnostic/dev utilities (`check-db.ts`, `test-db-conn.ts`, `test-api.ts`) — documented, not used by production flows.
6. **Is `.env` tracked or in git history?** No — git-ignored and never committed; `.env.example` is tracked and contains placeholders only.
7. **Does the frontend or built bundle expose server secrets?** Not now — no client `process.env`, and the rebuilt bundle has zero secret-name/value hits; an actual pre-fix exposure was found and fixed.
8. **Is `.env.example` cleaned/documented?** It documents `SEED_ADMIN_*` and carries explicit local-only warnings; remaining placeholder defaults are documented as residual (E-2 / DB_PASSWORD).
9. **Do the full gates pass?** Yes — `tsc --noEmit` clean; `vitest run` 247/247 twice; +16 new tests.
10. **Is the app fully secure?** No — see REMAINING SECURITY RISKS; this batch closes the targeted secret/default-credential findings but does not claim overall security.
