# Security Fix Batch #2 — Report

> Date: 2026-09-15
> Scope: residual authorization/security items carried over from Batch #1 — **M-7/BORDERLINE global badge management**, the **LOW finance NULL-tenant probe**, and **test-infrastructure determinism** (no login/rate-limiter coupling).
> Constraint honored: only the enumerated items were touched; no unrelated modules refactored; no PR opened; production rate limiting untouched.
> Baseline: Batch #1 left 160/160 tests, 55/55 security tests, `tsc --noEmit` clean.

---

## CHANGED FILES

| File | Change |
|------|--------|
| `src/backend/api/badges.routes.ts` | **M-7.** Added exported `canManageBadge(req, badge)`: global badges (`tenant_id IS NULL`) are org-level items editable/deletable only by **admin** or **bishop** (mirrors `middleware.ts` `requireItemAccess` global-item model). `PUT /:id` and `DELETE /:id` now use `canManageBadge`. `POST /assign` keeps `canAccessBadge` (global badges remain assignable) but now **fail-closes** for null-tenant students (`student.tenant_id` must be in the caller's canonical tenant set). |
| `src/backend/api/finance.routes.ts` | **LOW.** `PUT /:id` probe and `DELETE /:id` probe now **fail closed**: a non-admin with no valid tenant scope returns `404` before building any unscoped `finances` query. Admin branch behavior is byte-for-byte unchanged; the in-tenant non-admin branch is unchanged. |
| `src/test/securityAuthz.test.ts` | **+9 tests** (52 total). New `M-7: canManageBadge` describe: admin/global ✅, bishop/global ✅, supervisor/priest/employee/assistant_supervisor + global ❌, supervisor + same-tenant ✅, cross-tenant ❌, empty-scope fail-closed ❌. |
| `src/test/security-authz.test.ts` | **+15 tests** (27 total). Mounts real `badges.routes` + `finance.routes` routers. Badges: global-badge PUT/DELETE denied to supervisor and to priest/employee/assistant_supervisor, bishop ✅ 200, admin ✅ 200, same-tenant ✅ 200, cross-tenant ❌ 403, global-badge assign to in-scope student ✅ 200, assign to null-tenant student ❌ 400, assign to cross-tenant student ❌ 400. Finance: null-tenant non-admin PUT/DELETE → 404 (no probe), in-tenant PUT/DELETE → 200, cross-tenant PUT → 404, admin PUT/DELETE → 200. DB mock gained a `.transaction(fn)` shim so `POST /badges/assign`'s transaction body is actually exercised (deterministic, mocked DB). |
| `SECURITY_FIX_BATCH2_REPORT.md` | This file. |

---

## SECURITY BEHAVIOR BEFORE / AFTER

### M-7 — Global badge management (`badges.routes.ts`)
- **Before**: `canAccessBadge` returned `true` for any badge with `tenant_id IS NULL` for **any** `MANAGE_REWARDS` holder. A supervisor/priest/employee/assistant_supervisor with the reward permission could `PUT`/`DELETE` **global** (shared-system) badges.
- **After**:
  - Edit/delete guard: admin → allow; **global badge → bishop only** (consistent with `middleware.ts:274-277`, where org-level items are edited by admin/bishop only); tenant badge → must be inside the caller's `computeUserTenantIds` set; empty resolvable scope → deny. Lower-tier staff can no longer write to or delete a global badge.
  - `POST /assign` unchanged for badge use (global badges remain assignable, matching product behavior) — but the **student** must be a real tenant-scoped student inside the caller's scope; a null-tenant student (the Batch #1 NULL-loophole class) is now rejected (throws → 400). Cross-tenant students remain rejected.

### LOW — Finance NULL-tenant probe (`finance.routes.ts`)
- **Before**: for a non-admin with `tenantId = NULL`, `PUT /:id` skipped the tenant filter (`if (tenantId) ...`) and probed `finances` unscoped, creating a **record-existence oracle** (404 vs 400/403) even though the write later threw for the same user. `DELETE /:id` had the same shape (`...(tenantId ? {tenant_id} : {})`).
- **After**: both probes short-circuit to `404` for non-admins without a tenant scope **before issuing any query**. Legitimate in-tenant updates/deletes behave exactly as before; admin PUT/DELETE behavior is unchanged; cross-tenant access stays 404.

### Test infrastructure — login / rate limiter
- Verified: the two security suites (`securityAuthz.test.ts`, `security-authz.test.ts`) contain **zero** calls to `/auth/login` or the API server; grep of `src/test` shows `/auth/login` only in the integration suites (`auth`, `students`, `rooms`, `employees`, `isolation`, `pagination`) that target the live/dev server.
- Pattern (unchanged, now with badges + finance mounted): in-process Express app using the **real** routers and the **real** `authenticate`/`authorizePermission` middleware, JWTs minted with the same `JWT_SECRET`, only `infrastructure/db` and `infrastructure/knex` stubbed. No production code changed; **no rate limiter disabled or weakened anywhere** — the mechanism is isolated entirely in the test harness.
- Minor harness fix for determinism: `createKdbMock().kdb.transaction(fn)` now executes the callback with a fresh query builder per table, so `POST /badges/assign` is actually validated (previously the transaction body never ran). `beforeAll` receives an explicit timeout because `finance.routes` pulls in `exceljs`/`pdfkit`.

---

## TEST RESULTS

| Check | Result |
|-------|--------|
| `npm run lint` (`tsc --noEmit`) | ✅ no errors |
| `npm test` (`vitest run`) — run #1 | ✅ 14 files passed (14), **184** tests passed (184), 0 skipped |
| `npm test` (`vitest run`) — run #2 | ✅ 14 files passed (14), **184** tests passed (184), 0 skipped |
| Security unit suite (`src/test/securityAuthz.test.ts`) | ✅ **52**/52 passed (43 prior + 9 M-7) |
| Security HTTP suite (`src/test/security-authz.test.ts`) | ✅ **27**/27 passed (12 prior + 9 badge + 6 finance) |
| SQL Server reachable | not required — all security tests run against mocked DB |

Counts: `160 → 184` total (‑14 files); security tests `55 → 79` (52 unit + 27 HTTP). Every prior Batches test still passes (the two 10s `beforeAll` hook timeouts hit during full-suite contention are fixed by explicit hook timeouts, no test semantics changed).

---

## REMAINING SECURITY RISKS (unchanged, ordered by severity)

1. **Pre-existing findings from `SECURITY_FIXES.md`** (live secrets in `.env`, `dangerouslySetInnerHTML`, JWT in `localStorage`, WebSocket without auth) — none touched in Batch #1 or #2. These are the highest-severity items still open and should be a dedicated follow-up.
2. **Login rate limiter** — single global per-IP limiter (10/15 min); can nuisance-lock shared IPs; no per-account or distributed throttle. Unchanged by design (Batch #2 must not weaken it).
3. **`admin_management.routes.ts` `getTenantIds`** — falls back from `user.tenantIds` to `user.tenantId`; all callers guard with `tenantIds.length > 0` and empty→`[]`, so this is a consistency/audit gap, not a demonstrated leak. Not part of Batch #2 scope.
4. **Badge creation** (`POST /badges/`) still stamps `tenant_id = req.user.tenantId`, so a null-tenant `MANAGE_REWARDS` holder could technically *create* a global badge (they can no longer edit/delete it). Minor data-integrity nuisance, no cross-tenant reach; flagged for a possible Batch #3 (`canManageBadge`-style gate or a null-tenant `403` on create).
5. **`/grant` quick-grant** (`POST /badges/grant`) still allows a non-admin to grant a badge to a null-tenant student (its student check is `if (... && student.tenant_id)`). Same NULL-loophole class as the `/assign` case fixed above; kept out of scope to avoid unrequested behavior change, flagged for Batch #3.
6. **Lower-tier staff who hold `MANAGE_REWARDS`** can still *assign* global badges to in-scope students (product-permitted, intentional per requirement) — only the ability to modify/delete global badges was restricted.

---

## BEHAVIOR INTENTIONALLY PRESERVED

- **Global badges remain assignable** by authorized `MANAGE_REWARDS` staff to tenant-scoped students (product rule preserved; requirement #5/#9).
- **Bishop retains org-level global management** for badges, matching `canManageItem`/`requireItemAccess` (the application's intended global/org model).
- **Admin is fully global** for badges and finance.
- **Finance semantics unchanged**: permission checks order, per-type permission (`ADD_EXPENSE`/`ADD_REVENUE`), `is_admin_only` partitioning, tenant scoping, and admin behavior are exactly as before — only the null-tenant probe path now fails closed.
- **No production code for rate limiting changed**; the no-login test approach is harness-only.
- **No unrelated modules touched**; only `badges.routes.ts`, `finance.routes.ts`, and the two security test files changed.

---

## Directories / artifacts touched by this batch

```
src/backend/api/badges.routes.ts  (M-7: canManageBadge + /assign null-tenant student fail-closed)
src/backend/api/finance.routes.ts (LOW: fail-closed PUT/DELETE probes)
src/test/securityAuthz.test.ts    (unit suite — 52 tests, +M-7)
src/test/security-authz.test.ts   (HTTP suite — 27 tests, +badges +finance routers, transaction shim)
SECURITY_FIX_BATCH2_REPORT.md     (this file)
```