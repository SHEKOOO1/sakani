# Security Fix Batch #1 — Report

> Date: 2026-09-15
> Scope: HIGH cross-tenant authorization findings from Security Audit #2 — H-1, H-2, H-3 plus null-tenant widening in `canManageEmployee` and `canManageTargetUser`.
> Constraint honored: NO broad refactors; intentional global behavior preserved; all new code fails closed.

---

## CHANGED FILES

| File | Change |
|------|--------|
| `src/backend/api/students/crud.routes.ts` | H-1. `POST /:id/files`, `GET /:id/files`, `DELETE /:id/files/:fileId`, `/:id/priest-upload` now scope by `computeUserTenantIds`; exported `canManageStudent(user, studentTenantId)` for unit tests. |
| `src/backend/api/uploads.routes.ts` | H-2. Already correct; exported `canAccessDocument`, `resolveOrphanedDocument`, `canAccessOrphanedDocument` for unit tests. |
| `src/backend/api/broadcast.service.ts` | H-3. All `getScoped*` helpers now fail closed; `resolveTargetScope` covers admin/bishop/staff/unknown; exported `applySenderTenantScope`, `passesScopeIsolation`, `getSenderTenantIds`. |
| `src/backend/api/broadcast.routes.ts` | H-3 send-time: `POST /` and `PUT /:id` validate targeting via `applySenderTenantScope`. |
| `src/backend/api/students/extras.routes.ts` | **H-4** (employee-permission scope). `canManageEmployee` now fails closed: computes employee scope as `tenant_id` + `user_tenant_assignments`; an employee with `NULL` tenant and no assignment is **not manageable** by any non-admin. Exported for unit tests. |
| `src/backend/api/user.routes.ts` | **H-5** (target-user scope). Split `canManageTargetUser` into a **FAIL-CLOSED** management variant (exported) for update/password/role/delete/permissions; null-tenant targets are no longer globally manageable. `canImportTargetUser` (exported) preserves the intentional global-user import behavior only for `POST /add-to-tenant`. |
| `src/test/securityAuthz.test.ts` | Unit suite — now 43 tests covering H-1, H-2, H-3, H-4 (10 tests), H-5 (7 tests). All deterministic, mocked DB + mocked knex. |
| `src/test/security-authz.test.ts` | **RESTORED** — 12 in-process HTTP tests using real middleware + minted JWTs against mocked DB; no login calls, no rate limiter interference. |

---

## SECURITY FIXES

### H-1 — Student document upload/download across residences (`crud.routes.ts`)
- Before: `POST /students/:id/files` fetched the student using the client-supplied tenant id, so an attacker could upload a file under another residence's student (cross-tenant write) as long as they had upload permission for any student.
- After: the student is fetched **by student id only**; access requires `canManageStudent` — admin passes, otherwise the requesting user's canonical tenant set (`computeUserTenantIds`, which is derived from `user_tenant_assignments`, not from a spoofable header) must contain the student's real `tenant_id`. A student with no `tenant_id` is **never** manageable by non-admins.
- Same guard applied to `GET /:id/files` and `DELETE /:id/files/:fileId`; `/:id/priest-upload` no longer trusts the route's tenant id and uses the fetched student's tenant for notifications.

### H-2 — Orphaned document download authorization (`uploads.routes.ts`)
- Verified already implemented; no logic change required, only exports for tests.
- Rule set (fail closed): documents linked to a `StudentDocuments` row → admin, the owner student, a linked parent/guardian, or staff whose `computeUserTenantIds` contains the student's tenant. Orphaned files → admin; event receipt → uploader, linked parent, tenants in scope (null-tenant public events → bishop only); maintenance photo → requester or same-tenant staff. Anything unresolved (no DB row, no owner) → 404/403. Any non-`documents/radio/broadcasts` uploads folder → non-admin denied.

### H-3 — Broadcast target scope isolation (`broadcast.service.ts` + `broadcast.routes.ts`)
- `resolveTargetScope`: admin → `global`; bishop → tenants managed via `tenants.bishop_id`; supervisor / priest / assistant_supervisor / employee → their `tenantIds`/`tenantId`; unknown role or no assignments → `[]`.
- `getScoped*` helpers all fail closed: global branch only for admin; every staff branch clamps selections to the caller's authorized tenants; the fall-through `else` returns `[]` (never "all tenants").
- `applySenderTenantScope` (POST/PUT sender/target check): non-admin with empty allowed scope → `ok:false`; caller-supplied tenant lists are intersected with the allowed scope (empty intersection → `ok:false`); omitted target lists auto-scope to the allowed set instead of defaulting to everything.
- `passesScopeIsolation`: `assistant_supervisor` and `employee` senders are now subject to their own-tenant scope (they were previously treated as global); unknown roles can no longer broadcast to everyone.

### H-4 — Employee-permission grant across / outside residences (`extras.routes.ts`)
- Before: `canManageEmployee` returned `true` for any target whose `tenant_id` was `NULL` (`if (!employee.tenant_id) return true;`), so a wholly tenant-less employee (or one whose real scope lived only in `user_tenant_assignments`) could be permission-granted by any non-admin who held `MANAGE_EMPLOYEES` — effectively no residence boundary.
- After: the employee's **scope** is rebuilt from the DB — `tenant_id` plus every `user_tenant_assignments.tenant_id` link. Access requires an overlap with the requester's canonical `computeUserTenantIds`. Empty requester scope → denied; empty employee scope (NULL tenant, no links) → denied. Admin still passes; admin/bishop targets still blocked. Given that `computeUserTenantIds` is DB-derived, a spoofed `X-Tenant-Id` cannot widen access.

### H-5 — Target-user management vs. import isolation (`user.routes.ts`)
- Before: `canManageTargetUser` shared one rule for management (`PUT /:id`, password reset, role change, delete, permissions) and for the `POST /add-to-tenant` import. The null-tenant shortcut (`if (!target.tenant_id) return true`) made any tenant-less global account **writable/removable/** deletable by any `MANAGE_USERS` holder — not just importable.
- After: split into
  - `canManageTargetUser` (**FAIL-CLOSED**, used by update/password/role/delete/permissions): admin → pass; admin/bishop target → denied; requester scope empty → denied; target scope (`tenant_id` + assignments) empty → denied; requires a real scope overlap. **Null-tenant global accounts are no longer globally writable.**
  - `canImportTargetUser` (used only by `POST /add-to-tenant`): preserves the *intended* behavior that any approved manager can import a global (null-tenant, un-linked) account into their residence; scoped targets keep requiring overlap.
- Both exported for the unit suite.

---

## TEST RESULTS

| Check | Result |
|-------|--------|
| `npm run lint` (`tsc --noEmit`) | ✅ no errors |
| `npm test` (`vitest run`) | ✅ 14 test files passed (14), 160 tests passed (160), 0 skipped |
| Security unit suite (`src/test/securityAuthz.test.ts`) | ✅ 43/43 passed (H-1..H-5, mocked DB + knex) |
| Security HTTP suite (`src/test/security-authz.test.ts`) | ✅ 12/12 passed (in-process server, real middleware, minted JWTs) |

The restored `security-authz.test.ts` no longer calls `POST /api/auth/login` (the only route hit by the old test that the login rate limiter governs). It spins up an in-process Express app mounting the real `uploads` + `students/extras` routers with the **real** `authenticate`/`authorizePermission` middleware, mints JWTs with the same `JWT_SECRET`, and stubs only the DB layer — so no 429 flakes and no live database needed.

---

## REMAINING SECURITY RISKS (out of scope for Batch #1)

1. **Login rate limiter** (`auth.routes.ts` max 10 per 15 min per IP) is the only login throttling; it is global per IP, so it can be used to nuisance-lockout shared IPs, and it constrains test logins. Consider a distributed / per-account limiter.
2. **`admin_management.routes.ts`** `getTenantIds` falls back from `user.tenantIds` to `user.tenantId`; the `/roles` route already returns empty data for non-admin without tenant ids (fail closed), but other routes there still read the mixed fallback — worth a Batch #2 review that `user.tenantId` values are never trusted as a security boundary.
3. **Broadcast** — `assistant_supervisor`/`employee` now enforce scope, but their effective scope depends entirely on `user_tenant_assignments` being populated correctly at creation time; no defense-in-depth check on assignment hygiene at user-provision routes.
4. **`finance.routes.ts:225`** (record fetch in `PUT /:id`) — `if (tenantId) recordQuery.where('tenant_id', tenantId)` has no explicit null-tenant `else`. Read-side exposure is limited to the record-identifier of a finance row; the **write** path (`:255-256`) still throws for managers with no tenant, so an update can never land on a foreign `tenant_id`. Classified **LOW / fail-closed-on-write** — no change in this batch.
5. **`badges.routes.ts:13`** (`canAccessBadge`) — `if (!badge?.tenant_id) return true;` lets any authorized badge-manager (edit/delete) reach a **global (null-tenant) badge**. Classified **BORDERLINE**: global badges are shared system content modeled like public events; still, a cross-tenant write on a global row exists for badge maintainers. Recommended follow-up (Batch #2): restrict non-admin badge writes to non-global badges.
6. Pre-existing findings in `SECURITY_FIXES.md` (live secrets in `.env`, `dangerouslySetInnerHTML`, JWT in localStorage, WebSocket without auth, etc.) are unchanged — Batch #1 touched none of them.

---

## REMAINING `if (tenantId)` OCCURRENCES

These are the audit's "naive pattern" candidates. All of the below are **already fail closed or are data-model logic, not auth boundaries** — but they should be confirmed in a full pass:

| Location | Context | Status |
|----------|---------|--------|
| `src/backend/api/audit.routes.ts:41` | `else if (tenantId)` branch in list filter | ✅ verified fail-closed else present |
| `src/backend/api/competitions.routes.ts:20` | `else if (tenantId)` branch | ✅ fail-closed else present |
| `src/backend/api/finance.routes.ts:118` | `/summary` — admin → admin-only; non-admin with tenantId → own tenant; bishop w/o tenantId → explicit `tenantIds` else `[]` | ✅ fail closed |
| `src/backend/api/finance.routes.ts:225` | `if (tenantId) recordQuery = ...where('tenant_id', tenantId)` | ⚠️ **LOW** — no-null-else, but write path (`:255-256`) throws for null tenant; classified residual, no change (see Risks #4) |
| `src/backend/api/event.routes.ts:139` | `if (tenantId)` block | ✅ read-scope gate; null-tenant branch resolves to owned tenancies only |
| `src/backend/api/decisions.routes.ts:35` | `else if (tenantId)` branch | ✅ fail-closed else present |
| `src/backend/api/user.routes.ts:193` | `if (tenantId) insert user_tenant_assignment` | ✅ data-model (assignment creation), not filter boundary |
| `src/backend/api/badges.routes.ts:13` | `if (!badge?.tenant_id) return true` in `canAccessBadge` | ⚠️ **BORDERLINE** — global-badge writes open to any badge manager; recommended Batch #2 follow-up (see Risks #5) |

Also reviewed and confirmed safe/intended in this pass: `event.routes.ts:28` (global events readable by all, by design), `middleware.ts:233` (bishop-only global item management), `uploads.routes.ts:48` (already fail-closed), `profile.routes.ts:637` (already 403 for null-tenant data).

In `broadcast.service.ts` and `broadcast.routes.ts` there are **no** remaining `if (tenantId)` fallback-to-global patterns — the naive pattern is eliminated there.

---

## REMAINING GLOBAL FILES AND WHY THEY ARE GLOBAL (intentional)

- **`/uploads/radio/**`** — radio-station art/streaming assets are system-wide public content; any authenticated user may load them (`uploads.routes.ts:123`).
- **`/uploads/broadcasts/**`** — broadcast (public text/bulletin) attachments are system-wide by design; same `publicArea` carve-out.
- **Admin-only stores** (`/uploads/docs-admin/*` etc.): every path outside `documents|radio|broadcasts` is denied for non-admins (`uploads.routes.ts:127-129`), so "global" access is confined to the two declared-public directories.

No other global fallbacks for documents remain in `uploads.routes.ts`; event receipts for **null-tenant (public) events** are viewable only by the uploader, a linked parent, or bishops (`uploads.routes.ts:89-91`).

---

## Directories / artifacts touched by this batch

```
src/backend/api/students/crud.routes.ts   (H-1)
src/backend/api/uploads.routes.ts         (H-2, exports only)
src/backend/api/broadcast.service.ts      (H-3)
src/backend/api/broadcast.routes.ts       (H-3 send-time)
src/backend/api/students/extras.routes.ts (H-4 — canManageEmployee fail-closed)
src/backend/api/user.routes.ts            (H-5 — canManageTargetUser / canImportTargetUser split)
src/test/securityAuthz.test.ts            (unit suite — 43 tests)
src/test/security-authz.test.ts           (restored HTTP suite — 12 tests)
SECURITY_FIX_BATCH1_REPORT.md             (this file)
```