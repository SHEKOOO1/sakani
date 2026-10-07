# Security Fix Batch #4 — Report

> Date: 2026-09-17
> Scope: **permission write paths** — every way a user/role's permissions can be written (`PUT /:id/permissions`, `POST/PUT custom-roles`, `POST/PUT /admin/roles`, and the `ALL` escalation vector through `custom_permissions`) is now hardened fail-closed with a single shared strict parser and a **grantor-subset** rule: nobody can grant, create, edit, or bind a permission they do not already hold (or a role that grants one they don't), and `ALL` is never honored from stored data except through an authenticated application admin.
> Constraint honored: only the enumerated write paths + their test harness were touched; the real read-side `checkUserPermission` is hardened for the same stored-value fail-closed rule but its behavior is otherwise unchanged; no unrelated modules, no migration needed, no production rate limits touched.
> Baseline: Batch #3 left 196/196 tests across 14 files (91 security), `tsc --noEmit` clean.

---

## CHANGED FILES

| File | Change |
|------|--------|
| `src/backend/infrastructure/permission-parser.ts` | **Single shared strict parser (pure, no DB imports)**. `parseStoredPermissionsArray(value)`: any stored value that is **not** an array — e.g. the old attack string `"ALL"`, JSON text `"[\"ALL\"]"`, objects, numbers, `null` — yields `[]` (fail-closed: grants nothing). Unknown / non-string / `ALL` elements inside arrays are dropped, `wasArray` recorded for audit. `validatePermissionsInput(permissions, role)`: rejects non-arrays (400), `ALL` for non-admin (403), unknown permissions (400); `ALL` is never persisted. `safeParseStoredPermissionValue(value)`: decodes JSON-text arrays to real arrays and returns `null` for anything else (JSON-text of `"ALL"`, objects, numbers) so every reader and every writer share the exact same decoding rule. |
| `src/backend/infrastructure/permission-grants.ts` | **Grantor-subset decision layer (DB-backed, read-only)**. `getEffectivePermissionCodes(userId)` computes the actor's true effective set from `custom_permissions` + custom role (`tenant_custom_roles`, tenant-scoped) + `role_permissions`, all through the strict parser (JSON-text decoded first — a bug found by the new tests: the merged custom sources were silently ignored). `canGrantSubset(requested, grantorCodes, grantorHasAll, grantorIsAdmin)`: non-array ⇐ 400; `ALL` for non-admin ⇐ 403; unknown permission ⇐ 400; any requested permission the grantor does **not** hold ⇐ 403 (subset). Application admin (`role=admin`) may grant anything including `ALL`. |
| `src/backend/infrastructure/db.ts` | `checkUserPermission` writer-side read now routes through `parseStoredPermissionsArray(safeParseStoredPermissionValue(...))` — the same two-stage fail-closed rule as the grants layer (values stored as string `"ALL"` or malformed JSON grant nothing; stored `ALL` array elements no longer short-circuit to "has everything"). Removed the old per-file JSON-parse + `includes('ALL')` shortcut. |
| `src/backend/api/user.routes.ts` | `PUT /:id/permissions`: body gating (`permissions` must be an array → 400; empty payload → 400), **self-block** (a user can never edit their own permissions → 403), then formal check + `canGrantSubset` on the actor's **actual** effective permissions for the direct array, and the same subset check for binding `customRoleId` (a role that grants anything outside the actor's set is rejected → 403). `POST /custom-roles`: replaced local validation with the shared `validatePermissionsInput` + `canGrantSubset`; stored array deduped via `new Set`; cache invalidation preserved. Read paths (`/refresh-permissions`) now decode through the strict parser. |
| `src/backend/api/admin_management.routes.ts` | `POST /roles` + `PUT /roles/:id` aligned with the shared parser and grantor-subset: same formal check (`validatePermissionsInput`), same `canGrantSubset` gate before insert/update, deduped stored arrays. A priest/supervisor can no longer create or widen a role holding permissions they don't possess (e.g. `MANAGE_BISHOPS`). |
| `src/backend/api/auth.routes.ts` | `/login` and `/me` effective-permission resolution now merges `custom_permissions` + custom role through the strict parser (JSON-text decoded, `ALL`/unknown dropped) so the emitted permission list can never leak a forged stored `"ALL"` or bogus code. |
| `src/test/security-permissions-batch4.test.ts` | **New +35-test suite: unit (parser, input validation, `canGrantSubset`, `getEffectivePermissionCodes`) + real-routers HTTP attack paths** (in-process express server, real `authenticate`/`authorizePermission`, mocked DB, minted JWTs). Covers the full attack matrix: string `"ALL"` → 400 and nothing persisted; `["ALL"]` from supervisor → 403; granting/creating/editing/binding a permission outside the actor's set → 403; genuine unknown permissions → 400; admin unrestricted; self-block; cache invalidation after write; correct clean-array persistence. |
| `SECURITY_FIX_BATCH4_REPORT.md` | This file. |

---

## SECURITY BEHAVIOR BEFORE / AFTER

### Read-side (`checkUserPermission`) — stored-value assume-array attack
- **Before**: `JSON.parse(user.custom_permissions)` was trusted, then `perms.includes(permission) || perms.includes('ALL')`. A stored string `"ALL"` (or a knock-off JSON text `"[\"ALL\"]"`) with a valid JSON parse returned truthy — the classic privilege-escalation in a row, and a stored `ALL` array element was an unconditional grant for every non-admin holder of that row.
- **After**: the stored value must be a genuine array of known permission codes, decoded by the same `safeParseStoredPermissionValue` + `parseStoredPermissionsArray` used by the writers. Stored `"ALL"` as a string ⇒ `[]`. Stored array *element* `"ALL"` ⇒ ignored (never honored from storage). Fail-closed by input shape, not by guess.

### Write paths — each escalation vector closed
- **`ALL` via `custom_permissions` (the old `"ALL"` write)**: non-array payload ⇒ 400 before any DB write; `["ALL"]` array from a supervisor ⇒ 403 (`validatePermissionsInput`); `ALL` for a genuine app admin is still allowed, but `ALL` is **never stored** and never honored from the stored array.
- **Unknown/fake permissions (`MANAGE_BISHOPS` style for lower roles)**: unknown codes ⇒ 400 at the parser; **known but unowned** codes ⇒ 403 at `canGrantSubset`. `MANAGE_BISHOPS` is a real value in `VALID_PERMISSIONS`, so its protection is *purely* the grantor-subset gate, not the parser.
- **Custom-role creation / edit (`/api/users/custom-roles`, `/api/admin/roles`)**: both routes now call the shared parser + subset check — a `priest` with `MANAGE_SETTINGS` can no longer mint a role containing `MANAGE_BISHOPS`, and editing can't widen a role beyond the actor's own set (owner/admin still enforced first).
- **Role *binding* (`PUT /:id/permissions` with `customRoleId`)**: the target role's stored permissions are decoded strictly and subset-checked against the actor — binding a role that grants what the actor doesn't hold ⇒ 403.
- **Self-services**: a supervisor can no longer edit their **own** permissions via this route (403) — self-grant is untouchable except through higher authority.
- **DB text `"ALL"` extraction**: `getEffectivePermissionCodes` now decodes JSON-text arrays first (bug found by test #15: previously `custom_permissions`/'`custom_role` text values were silently ignored, breaking legitimate grants); the decode is fail-closed so a text `"ALL"` still grants nothing.

---

## BACKWARD-COMPATIBILITY NOTES

1. **Valid-legit grants still work**: a supervisor holding `VIEW_STUDENT`/`MANAGE_USERS` can still set those on a report; an admin can set anything. Tested end-to-end (200 + clean persisted array).
2. **Read path semantics are unchanged for well-formed arrays**: storage that was already `["VIEW_STUDENT", ...]` behaves identically; only the malformed/`ALL`-ish values stop being honored. No migration, no schema change, no new env vars.
3. **Authentication/authorization to the routes is untouched**: `authenticate` + `authorizePermission` still gate entry (`MANAGE_USERS` / `MANAGE_SETTINGS`); this batch hardens what happens *after* those gates.
4. **Admin preserves full control**: app admin bypasses the subset restriction (hasAll) and may grant any valid code, including the previously-forged `MANAGE_BISHOPS`.
5. **No rate limiting / middleware changes**; the core `permission-parser` is pure and importable anywhere without touching `db`/`knex`, so writes can never drift to a different validation logic again.

---

## TEST RESULTS

| Check | Result |
|-------|--------|
| `npm run lint` (`tsc --noEmit`) | ✅ no errors |
| `npx tsc --noEmit` | ✅ no errors |
| `npx vitest run` — run #1 | ✅ 15 files passed (15), **231** tests passed (231), 0 skipped |
| `npx vitest run` — run #2 | ✅ 15 files passed (15), **231** tests passed (231), 0 skipped |
| New batch-4 suite (`src/test/security-permissions-batch4.test.ts`) | ✅ **35**/35 passed, deterministic (real routers + minted JWTs + mocked DB; no live login, no rate limits) |
| SQL Server reachable | ✅ live MSSQL up — `global-setup` spawned the real server (schema applied, RBAC already seeded); live-server integration suites passed alongside the mocked-DB security suites |

Counts: `196 → 231` tests (‑15 files); security tests `91 → 126` (52 unit + 39 HTTP in `securityAuthz`/`security-authz` + 35 in the new batch-4 suite). The batch-4 suite itself includes the "attack path" HTTP tests (Part 10): string `"ALL"` persistence, `["ALL"]`, out-of-subset grants, malicious custom-role creation, malicious role binding, role hijack on edit, admin override, self-block, empty-payload 400, and cache-invalidation-on-write.

---

## REMAINING SECURITY RISKS (unchanged items, ordered by severity)

1. **Pre-existing findings from `SECURITY_FIXES.md`** (live secrets in `.env`, `dangerouslySetInnerHTML`, JWT in `localStorage`, WebSocket auth hardening) — the highest-severity follow-ups still open; out of scope here.
2. **Login rate limiter** — single global per-IP limit; no per-account or distributed throttle. Unchanged by design.
3. **`admin_management.routes.ts` `getTenantIds`** — falls back `user.tenantIds` → `user.tenantId`; callers guard with `tenantIds.length > 0`. Consistency gap, not a demonstrated leak; out of scope.
4. **`/grant` quick-grant** (`POST /badges/grant`) and **badge creation** null-tenant nuances flagged in earlier batches — unchanged.
5. **Role deletion** (`DELETE`) routes still rely on the owner/admin checks only; they were not a permission-escalation path (deleting doesn't grant), left untouched per scope.

---

## BEHAVIOR INTENTIONALLY PRESERVED

- **App admin (`role=admin`)** can still grant any permission including `MANAGE_BISHOPS`/`ALL` — the top of the grantor-subset hierarchy is intentionally trusted.
- **Genesis precedence**: `getEffectivePermissionCodes` treats `custom_permissions` → custom role → `role_permissions` as an ordered merge (custom wins), mirroring `checkUserPermission`'s semantics.
- **Response contracts**: successful writes keep their JSON shape (`success` + message); existing reads (`/refresh-permissions`, `/auth/me`) still return the merged permission list minus the now-strictly-invalid values.
- **`role_permissions` table format** is preserved exactly (one permission code per row; exported rows parsed with the strict rule).

---

## Directories / artifacts touched by this batch

```
src/backend/infrastructure/permission-parser.ts    (shared strict parser + safe JSON-text decode — new layer)
src/backend/infrastructure/permission-grants.ts    (getEffectivePermissionCodes + canGrantSubset — new layer)
src/backend/infrastructure/db.ts                   (checkUserPermission uses shared parser; removes old JSON/ALL shortcut)
src/backend/api/user.routes.ts                     (PUT /:id/permissions: array-gate, self-block, subset-check direct+role; custom-roles; refresh-permissions)
src/backend/api/admin_management.routes.ts         (admin/roles POST+PUT aligned to shared parser + grantor-subset)
src/backend/api/auth.routes.ts                     (login / me effective-permission merge via strict parser)
src/test/security-permissions-batch4.test.ts       (+35 tests: PR-1..PR-4 unit + attack-path HTTP suite)
SECURITY_FIX_BATCH4_REPORT.md                      (this file)
```