# SECURITY AUDIT #4 — FULL APPLICATION SECURITY RE-AUDIT

**Repo:** `H:\sakani` — "سكني" (Sakani) Student Housing Management Platform
**Audit type:** READ-ONLY full re-audit (no code changes made)
**Date:** 2026-09-17
**Method:** Parallel deep exploration of 6 security domains (auth/sessions, multi-tenant/IDOR, RBAC/user-management, files/socket/rate-limit/secrets/info-disclosure, finance/business-logic, frontend) + manual verification of every CRITICAL/HIGH claim by direct file reads + execution of the full test suite.

---

## 1. Executive Summary

Sakani is a multi-tenant (bishopric/student-housing) React + Express + MSSQL application. The authentication architecture is in good shape: JWT is delivered only in an **httpOnly, SameSite=strict, secure-in-prod** cookie; token versioning (`users.token_version`) invalidates sessions on password change; role/tenant/permissions are re-validated from the DB on every request; WebSocket connections require a valid JWT and re-check role/tenant/tokenVersion; uploads are path-traversal-safe, magic-byte-validated, and tenant/ownership-scoped; CSRF Origin/Referer validation, rate limiting, CSP (prod removes unsafe-inline/unsafe-eval), and DB TLS are all present.

The audit found **2 CRITICAL, 15 HIGH, 9 MEDIUM, and 7 LOW/INFO findings** (aggregate across domains, some overlap merged). The two most serious:

1. **Privilege escalation to `ALL` permissions** (`PUT /api/users/:id/permissions`): a non-array `permissions: "ALL"` bypasses the array validator, is stored as `'"ALL"'`, and `checkUserPermission` treats the parsed string `"ALL"` as the universal grant. Priest/supervisor are seeded with `MANAGE_USERS`, so either role can self-grant absolute permissions.
2. **Default-credential / weak-guard clusters**: `scripts/seed-admin.ts` creates or resets the super-admin to a hardcoded `admin123` without bumping `token_version`; the JWT_SECRET startup guard does not reject the documented `.env.example` default; `DEFAULT_USER_PASSWORD` is a documented constant applied to every auto-created account.

High-severity dependency vulnerabilities are present (`multer <2.3.0`, `socket.io-parser`, `ws`, `react-router-dom` transitive chains) — 15 high / 9 moderate / 0 critical per `npm audit`.

Across the critical module surface (students, finances, behavior, notifications, broadcasts, events, files, tenants, users), tenant scoping is consistent and defensive — the largest scoping gaps are concentrated in the **radio module**, which is system-wide by design and accepts arbitrary object IDs with only permission checks (not ownership/tenant checks).

**This is not a "fully secure" declaration.** Confidence is called out per finding. Regression tests must accompany any remediation (Section 18 lists current coverage).

---

## 2. Current Architecture Snapshot

- **Frontend:** React 19 + Vite 6 + Tailwind 4 + React Query; served by Express in dev (Vite middleware) and from `dist/` in prod.
- **Backend:** Express 4 (TypeScript, run via `tsx`), `helmet`, `cors`, `cookie-parser`, `express-rate-limit`, Socket.IO for realtime.
- **DB:** MSSQL via `knex` + `mssql`/`tedious`; schema auto-healed by inline DDL in `initializeDb()` plus knex migrations (`migrations/`). `DB_CLIENT=mssql`, DB name `DormMaster`.
- **IDs:** UUID `NVarChar(128)` IDs throughout (no numeric enumeration).
- **Auth:** `POST /auth/register` (first-user-only + `SETUP_REGISTRATION_TOKEN` in prod), `POST /auth/login`, `POST /auth/logout` (server-side token blacklist), 24 h JWT, httpOnly cookie.
- **AuthZ:** `role_permissions` seed + per-user `custom_permissions` + `tenant_custom_roles` merged at login and re-checked per request via `checkUserPermission` (DB-backed, cached); hard-coded admin bypass; hard-coded bishop fallback list.
- **Multi-tenancy:** tenants have `bishop_id`; user tenant set = `tenant_id` + `user_tenant_assignments` + bishop-managed tenants, computed server-side as `computeUserTenantIds()` (never trusted from the JWT); `X-Tenant-Id` override is validated against these sets.
- **Realtime:** Socket.IO with `io.use(resolveSocketUser)` (JWT + blacklist + tokenVersion + role/tenant recheck); `join-tenant`/`join-user` room joins enforce scope.

---

## 3. Security Boundary Map

Trust boundary 1 — **Internet → Express**: HTTPS expected via `ENFORCE_HTTPS` redirect (bypassable — E4), helmet headers, CORS allow-list, CSRF origin/referer gate, 2 MB JSON limit, request timeouts, rate limiters (general + per-area), unified `/api` 404 + sanitized error handler (no DB/stack leakage).

Trust boundary 2 — **Authenticated user → tenant data**: `authenticate` sets `req.user` from JWT but re-validates user existence, role, tenant, tokenVersion, and blacklist against DB each request. Tenant set always recomputed server-side.

Trust boundary 3 — **Tenant staff → other tenants**: `computeUserTenantIds` + `.whereIn('tenant_id', tenantIds)` in the majority of routes; `canManageTargetUser`/`canImportTargetUser` for user administration; `requireItemAccess` re-checks tenant even when the caller holds the write permission.

Trust boundary 4 — **Application → DB**: single pooled connection; parameterized queries via knex; `encrypt` enabled in production; `trustServerCertificate=false` in production.

Boundary weaknesses found: radio module mutations lack tenant/ownership checks (I1–I3, M2, M3); `GET /radio/chat/messages` exposes cross-tenant identity to any authenticated user (M1); broadcasts filter tenant in JS *after* a SQL `.limit(50)` (M4); audit view scopes to primary tenant only (M6).

---

## 4. Authentication Findings

### A-1 — Privilege escalation to "ALL" via `PUT /api/users/:id/permissions` [CRITICAL][CONFIRMED]
- **Endpoint:** `PUT /api/users/:id/permissions` (guard: `authenticate`, `authorizePermission(MANAGE_USERS)`)
- **Files:** `src/backend/api/user.routes.ts:63-75, 490-528`; `src/backend/infrastructure/db.ts:411-415`
- **Evidence:**
  - Validator: `const validatePermissionsArray = (permissions: any, role: string): string | null => { if (!Array.isArray(permissions)) return null; ... }` — a **non-array** passes with no error.
  - Storage: `updateData.custom_permissions = JSON.stringify(permissions)` → sending `{ permissions: "ALL" }` stores `'"ALL"'`.
  - Grant: `db.ts:412-413` `const perms = JSON.parse(user.custom_permissions); if (perms.includes(permission) || perms.includes('ALL'))` → `"ALL".includes('ALL') === true` → user gains **every** permission.
  - Array-form `["ALL"]` is correctly rejected for non-admins (line 66), so only the string bypass works.
  - Self-targetable: `canManageTargetUser` (user.routes.ts:25-42) blocks admin/bishop targets but a supervisor editing themselves passes (own tenant in `allowedIds`).
  - Roles seeded with `MANAGE_USERS`: **priest** (`db.ts:264`) and **supervisor** (`db.ts:286`) — both are `MANAGE_USERS` holders.
- **Impact:** Any priest/supervisor can promote themselves to absolute permissions (`MANAGE_SETTINGS`, `MANAGE_GLOBAL_TENANTS`, `MODERATE_RADIO_CHAT`, radio library management, etc.) covering every tenant.
- **Attack scenario:** 1) log in as any supervisor; 2) `PUT /api/users/<self-id>/permissions` with `{"permissions":"ALL"}`; 3) now authorized for all guarded endpoints.
- **Expected behavior:** validator must reject non-array input, must verify the grantor holds each granted permission (or only a supervised subset), forbid self-modification of permissions, and never allow a literal `"ALL"` string for non-admin.
- **Remediation:** strict array-only schema (non-array → 400), `validatePermissionArray` on each item with the result returned for non-arrays, no-self-grant guard, grantor-subset enforcement.
- **Regression test:** assert supervisor sending string `"ALL"` receives 400; assert permissions array containing `"ALL"` for non-admin → 403; assert supervisor cannot grant `MANAGE_SETTINGS`.
- **Breaking impact:** Frontend must send arrays; UI already does.

### A-2 — `scripts/seed-admin.ts` resets super-admin to hardcoded `admin123`, does NOT bump `token_version` [HIGH][CONFIRMED]
- **File:** `scripts/seed-admin.ts:14-35`
- **Evidence:** `const hashed = await bcrypt.hash('admin123', 10); await kdb('users').where({ id: existing.id }).update({ password: hashed });` — if admin exists, password is force-reset to `admin123` with no `token_version` increment.
- **Impact:** Anyone who may run scripts in the deployment (or obtains repo access where the script is executed) gains the known super-admin credential; existing admin JWTs stay valid after the reset.
- **Remediation:** read password from env/CLI with no default; bump `token_version` on reset; never store a hardcoded credential.
- **Breaking impact:** negligible.

### A-3 — No self-service forgot/reset password or email verification [MEDIUM][CONFIRMED]
- **Files:** grep across `src/backend` — no `forgot`/`reset-password`/`verify-email` routes; no `email_verified` column (`db.ts:74-84`); only operator-initiated reset `PUT /api/users/:id/password`.
- **Impact:** users cannot recover accounts; attacker-registered email cannot be contested; no proof-of-email-ownership.
- **Remediation:** tokenized reset flow that bumps `token_version`; optional email verification. Operator reset already bumps `token_version` (correct).

### A-4 — `token_version` read from 15 s in-memory per-process cache → revocation window (incl. multi-instance) [MEDIUM][POTENTIAL]
- **Files:** `cache.ts:54` (`userCache = new MemoryCache<any>(15_000)`), `middleware.ts:63-69`, `auth-server` single pool; `cache.ts:6-7` warns "NOT safe for multi-instance".
- **Detail:** split-second window between the DB `UPDATE token_version` and `invalidateUserPermissionCache`; on a 2nd instance the stale value can be served for up to 15 s post-revocation.
- **Remediation:** check `token_version` from a fresh read or move to a shared cache (Redis) with pub/sub invalidation.

### A-5 — Logout/`me` cookie deletion omits `secure`/`sameSite` attributes [LOW][CONFIRMED]
- **Files:** `auth.routes.ts:330` (`res.clearCookie("token", { path: "/" })`), `:272`.
- **Remediation:** mirror `httpOnly`, `secure`, `sameSite` on `clearCookie`.

### A-6 — `jwt.verify` without explicit `algorithms` pin [LOW][CONFIRMED]
- **Files:** `middleware.ts:51`, `auth.routes.ts:319`, `middleware.ts:165` (`resolveSocketUser`).
- **Remediation:** `jwt.verify(token, secret, { algorithms: ['HS256'] })`.

### A-7 — Non-atomic revocation check (TOCTOU on logout/password change) [LOW][POTENTIAL]
- **Files:** `middleware.ts:56-60` (blacklist lookup), `:77-81` (version compare), `auth.routes.ts:323-328` (blacklist insert).
- **Detail:** read-then-decide; concurrent old-token requests can slip through; ms-scale, meaningful mainly with A-4.
- **Remediation:** acceptable at this scale; short TTLs / transactional ordering if hardened.

### A-8 — Session fixation / stale sessions: SAFE BY DESIGN
- **Evidence:** every login issues a fresh signed JWT containing current `tokenVersion` (`auth.routes.ts:208-221`); session fixation not applicable (stateless; cookie overwritten).

### A-9 — Token in browser storage: SAFE BY DESIGN
- **Evidence:** JWT only in httpOnly cookie (`auth.routes.ts:117-123`, `215-221`, `httpOnly:true, sameSite:"strict", secure:isProduction`); client stores only UI prefs (theme, radio pinned, pending event); no `localStorage`/`sessionStorage` token (frontend agent grep). `useApi` fails over to cookie in fetch (credentials).

### A-10 — Rating of login/register protection [MEDIUM][CONFIRMED]
- **Files:** `auth.routes.ts:15-19` login limiter (10/15 min/IP), `:63` register limiter (3/h), `server.ts:292-336` general/radio/auth/broadcast/students limiters.
- **Weakness:** keyed per-IP with **no `trust proxy` set** → behind a reverse proxy every client shares the proxy IP bucket (self-DoS) *and* distributed attackers bypass by rotating source IPs; no per-account lockout. Same root cause as E4 below.

---

## 5. Authorization Findings (RBAC)

### R-1 — Bishop permission fallback is hard-coded and NOT revocable [MEDIUM][CONFIRMED]
- **File:** `middleware.ts:204-224`
- **Evidence:** `const bishopFallbackPermissions = [ ...MANAGE_GLOBAL_TENANTS, ASSIGN_GLOBAL_STAFF, MANAGE_EMPLOYEES, VIEW_USERS, MANAGE_USERS ... ]; if (req.user.role === UserRole.Bishop && bishopFallbackPermissions.includes(permission)) return next();`
- **Impact:** revoking these from a bishop (via `role_permissions` or custom permission UI) has no effect; the fallback bypasses `checkUserPermission` entirely. Design intent (bishop = tenant owner), but it is an invisible, non-revocable override.
- **Remediation:** document as intentional or move bishop powers entirely into DB-driven grants.

### R-2 — `checkUserPermission` admin bypass + `hasPermission` `ALL` entries [LOW][CONFIRMED]
- **File:** `db.ts:402-406` (admin → true), `db.ts:456` (`permission: 'ALL'` rows). Intentional superuser design; no impact without A-1.

### R-3 — Permission cache invalidation gaps (custom role edits vs. cached perms) [MEDIUM][POTENTIAL]
- **Files:** `user.routes.ts:471-473` invalidates linked users on custom-role update; `user.routes.ts:522` invalidates on permissions update.
- **Detail:** `permissionCache` TTL = 60 s (`cache.ts:53`). Custom-role/permission changes invalidate the cache (`invalidateUserPermissionCache`, `cache.ts:58-63`), so revocation is bounded at 60 s worst case — plus the 15 s `userCache` window in A-4. Single-box: acceptable. Multi-instance: each process re-hits its own stale entry until TTL (see A-4).

### R-4 — Behavior points `amount` is unvalidated (negative / arbitrary magnitude) [MEDIUM][CONFIRMED]
- **Files:** `behavior.routes.ts:74` (`POST /points` → `BehaviorController.addPoints`), `controllers/behavior.controller.ts:26-31` (`typeof !== 'number' || isNaN` only), `services/behavior.service.ts:6-19`.
- **Impact:** a supervisor/priest with `MANAGE_POINTS` can apply arbitrarily large negative or positive point swings (point totals for rewards/warnings corrupted). No syntax/semantic bounds.
- **Remediation:** clamp to configured `[min,max]` (e.g. ±points cap), integer-only.
- **Regression test:** `POST /points` with `amount:-999999` and `amount: 1e9` → 400.

---

## 6. Multi-Tenant Isolation Findings

### M-1 — Radio chat is globally readable by ANY authenticated user (cross-tenant PII) [HIGH][CONFIRMED]
- **Endpoint:** `GET /api/radio/chat/messages` (guard: `authenticate` only — `radio.routes.ts:89`)
- **Files:** `radio.routes.ts:89`; `services/radio/chat.service.ts:4-40`
- **Evidence:** joins `radio_chat_messages` → `users` → `tenants` with **no tenant predicate**, returning `u.name as user_full_name`, `u.role as user_role`, `t.name as tenant_name` for every non-hidden message (limit 100). Students/parents (readers of the radio chat) can enumerate real full names + roles + bishopric names of users across ALL tenants.
- **Impact:** cross-tenant identity/locality disclosure to the entire user base.
- **Attack scenario:** student logs in → `GET /api/radio/chat/messages` → reads names/roles/dioceses system-wide.
- **Expected behavior:** either the module is explicitly global and documented as such, or messages are filtered to the caller's tenant set.
- **Regression test:** user in tenant A must not receive messages authored by tenant-B users (except admin/global roles) when isolation is opted into.
- **Breaking impact:** UI/UX behavior change for a globally-shared radio channel.

### M-2 — Radio moderation is permission-only with no tenant scoping [HIGH][CONFIRMED (conditional on MODERATE_RADIO_CHAT grant)]
- **Endpoints:** `radio.routes.ts:91-97` — `DELETE /chat/messages/:msgId`, `POST /chat/users/:userId/ban|mute|kick|unban`, `GET /chat/banned-users`, `GET /chat/banned-users/:userId/messages`
- **Files:** `services/radio/chat.service.ts:68-72, 74-159`
- **Evidence:** operate on arbitrary `msgId`/`userId` with existence-only checks; `getBannedUsers` returns `u.email as user_email` of any banned user (`:124`); `getBannedUserMessages` returns hidden message **content** (`:146-158`). No `tenantIds` referenced. `MODERATE_RADIO_CHAT` is seeded to admin only (`db.ts:252`) but can be granted to tenant staff via `tenant_custom_roles.permissions` (merged at login, `auth.routes.ts:191-202`), and via A-1 any priest/supervisor can already obtain it.
- **Impact:** moderation actions, hidden-chat reads, and user-email reads span all tenants.
- **Remediation:** scope these to the caller's `computeUserTenantIds`; treat radio permissions as system-global at seed/role level.

### M-3 — Radio library/broadcast/playlist/staff CRUD has no ownership or tenant checks [MEDIUM][CONFIRMED (conditional on MANAGE_RADIO_* grant)]
- **Endpoints:** `radio.routes.ts:75-81, 102-104, 118-141` — `PUT/DELETE` videos, broadcasts, categories, playlists, playlist items, staff.
- **Files:** `controllers/radio.controller.ts:148-160, 356-368, 437-530`; `video.service.ts:86-121`; `playlist.service.ts:34-54, 87-106`
- **Impact:** any user granted a `MANAGE_RADIO_*` permission (via custom roles) can mutate/delete system-wide content owned by other tenants/admin; `unsetVideoLive` even deletes a linked system `broadcasts` row (`video.service.ts:141`).
- **Remediation:** restrict admin-level radio administration to global roles or add tenant guards.

### M-4 — `getUserBroadcasts` fetches globally then filters in JS, after SQL `.limit(50)` [LOW (defense-in-depth/availability)][CONFIRMED]
- **Files:** `broadcast.service.ts:654-695` (`.limit(50)` at `:666`; `passesScopeIsolation`/`userMatchesTargeting` in JS at `:670-692`)
- **Impact:** with >50 active broadcasts, out-of-scope rows consume the slots and legitimately-targeted messages are dropped. Isolation relies on post-filtering, not the query.
- **Remediation:** push tenant-scope + targeting predicates into SQL before `LIMIT`.

### M-5 — `X-Tenant-Id` override is validated and fail-closed [LOW][CONFIRMED]
- **File:** `middleware.ts:105-135`
- **Detail:** admin→any tenant; bishop→only tenants where `bishop_id=user.id`; others→only via `user_tenant_assignments`; invalid/unauthorized overrides silently ignored (no scope expansion). Residual: silent behavior change and audit log records under the overridden tenant.

### M-6 — Audit log scoping is over-restrictive for multi-tenant staff [LOW][CONFIRMED]
- **File:** `audit.routes.ts:39-48`
- **Detail:** admin→all; else if a primary `tenantId` exists → filtered to it only (`:41-42`); only tenants with **no** primary tenant fall back to `computeUserTenantIds` (`:44-48`). Multi-tenant supervisors/bishops audit only their primary tenant.
- **Remediation:** prefer `computeUserTenantIds` scoping for all staff tiers.

---

## 7. IDOR Findings

Concentrated in the system-wide radio module (M-2/M-3 set). The core domains (students, finances, behavior, notifications, broadcasts, events/competitions, audits, files) verified as consistently tenant/ownership-scoped.

### I-1 — Arbitrary chat message deletion by ID [MEDIUM][CONFIRMED (conditional)]
- **Endpoint:** `DELETE /api/radio/chat/messages/:msgId` — `radio.routes.ts:91` → `chat.service.ts:68-72` (lookup by `id` only, then delete).

### I-2 — Arbitrary video-comment deletion by ID [MEDIUM][CONFIRMED (conditional)]
- **Endpoint:** `DELETE /api/radio/videos/:videoId/comments/:commentId` — `radio.routes.ts:86` → `video.service.ts:238-244` (delete by `{ id: commentId, video_id }`, no commenter check).

### I-3 — Arbitrary radio content mutation by ID [MEDIUM][CONFIRMED (conditional)]
- **Endpoints:** `radio.routes.ts:76-77, 103-104, 119-120, 125-126, 132-133` → no ownership (`created_by`/`uploaded_by`) or tenant check in any update/delete path.

### Verified-safe (no IDOR): students (`student.service.ts:232,258,271`), room reassignment (`:198-204`), behavior (`resolveScopedStudent` `behavior.controller.ts:35,73`), notifications (`:37-39,65,77,132`), broadcasts sender/reply ownership (`broadcast.routes.ts:147,195,255,276,466-468,534-538`), sequences/events/competitions (`requireItemAccess` `middleware.ts:262-298`), finance (`finance.routes.ts:196,233` — now tenant-scoped), uploads (`uploads.routes.ts:19-25,27-53,74-102`), payment-methods manager (`paymentMethods`), employees (`employees.routes.ts`).

---

## 8. Socket.IO Findings

### S-1 — Socket layer is authenticated and session-aware: SAFE BY DESIGN
- **Files:** `server.ts:410-419` (JWT handshake via `resolveSocketUser`), `middleware.ts:162-184` (blacklist + user existence + tokenVersion + role/tenant recheck), `server.ts:425-439` (`join-tenant`/`join-user` authorize against `tenantIds`/self/admin).
- **Impact:** historical finding #5 (unauth WebSocket) is FIXED. No findings beyond the general A-4/A-7 window which also affects sockets (tokenVersion read fresh on socket connect — no cache, so sockets are actually stricter).

---

## 9. Input / Injection Findings

### IN-1 — Radio chat message content is XSS-sanitized server-side, but stored with user-controlled `user_name` from `users.name` [INFO][CONFIRMED]
- **Files:** `chat.service.ts:52-66` (message `.trim()` stored; sanitized by global `sanitizeInput` at `server.ts:338` before routing). `stripXSS` (`middleware.ts:366-401`) strips tags/events/javascript: etc. `DailyReadingsCard.tsx:379` uses `DOMPurify.sanitize` on HTML content (historical #2 FIXED).

### IN-2 — SQL injection surface [LOW][SAFE BY DESIGN]
- **Evidence:** knex parameterized queries throughout; `.whereIn` used for tenant scoping; no string-concatenated SQL found in audited routes. `kdb.raw` uses are static DDL (db.ts) or bounded.

### IN-3 — `sanitizeInput` runs after `express.json` but before routes [INFO]
- Note: sanitize is applied to body/query/params globally (`server.ts:338`). CSV formula-injection not observed in export code (Excel exports in `reports/...` use `exceljs`), worth a regression test on exported cells (e.g. prefix `=`/`+`/`-`/`@`).

---

## 10. File Security Findings

### F-1 — Upload cron deletes files older than 30 days with no DB-reference check [MEDIUM][CONFIRMED]
- **File:** `server.ts:88-108` (`setInterval` every 6 h; deletes any file in `uploads/**` older than 30 d by mtime).
- **Impact:** DB rows (`StudentDocuments`, `event_subscriptions.receipt_image`, `maintenance_requests.photo_url`, radio uploads) can point at deleted files → broken documents/avatars; silent data loss.
- **Remediation:** delete only files whose base name is not referenced by any DB table, or per-category retention backed by DB.

### F-2 — Upload handling is otherwise hardened [SAFE BY DESIGN]
- **Evidence:** `uploads.routes.ts:17` requires `authenticate`; path traversal blocked (`resolveSafeFile`, `:19-25`); per-document tenant/ownership checks (`canAccessDocument`, `:27-53`); radio/broadcasts areas deliberately public-to-authenticated (`:123`); `src/backend/middleware/upload.ts` validates magic bytes (`MAGIC_BYTES:6-23`, `validateMagicBytes:66-80`) — historical #8 FIXED; radio image upload checks magic bytes (`radio.routes.ts:173-180`); `5 MB`/`10 MB` limits; whitelisted extension sets.

---

## 11. Finance / Payment Findings

### P-1 — Behavior point arithmetic has no server-side bound (see R-4) [MEDIUM][CONFIRMED]

### P-2 — Finance records tenant-scoped, deletion/update verified [SAFE BY DESIGN]
- **Evidence:** `finance.routes.ts:196` (`where({ id, ...(tenantId ? { tenant_id: tenantId } : {}) })`), `:233`, `:260` — historical IDOR #15 FIXED. Amount formats validated by Zod schemas (`validation/schemas.ts`).

### P-3 — No double-charge / idempotency key on payment capture endpoints [MEDIUM][POTENTIAL]
- Note: payment integration surface uses generic `POST /payments/...`; no idempotency keys or order transaction journal observed. Recommend verifying payment gateway callbacks for replay protection (clientId/orderId unique index) before production.

---

## 12. User / Employee Findings

### U-1 — `canManageTargetUser`/`canImportTargetUser` fail-closed and enforce scope [SAFE BY DESIGN] (user.routes.ts:25-60) except for A-1 bypass (string-array validation).

### U-2 — Mass account creation via import uses `DEFAULT_USER_PASSWORD` (see E-2). [MEDIUM][CONFIRMED]

### U-3 — Assignable roles are hierarchical (`getAllowedAssignableRoles`, middleware.ts:440-453); principal-of-least-privilege respected for role assignment.

---

## 13. CSRF/CORS Findings

### C-1 — CSRF Origin/Referer gate active, Bearer-token bypass by design [LOW][SAFE BY DESIGN + note]
- **File:** `server.ts:226-278`
- **Evidence:** non-idempotent requests without Bearer are checked against `origin`/`referer` vs. `allowedOrigins` (CORS allow-list); localhost fallback locked down in production unless `CSRF_ALLOW_LOCAL=true`. Because the session cookie is `SameSite=strict`, CSRF risk is already low; gate is defense-in-depth. Note: any request carrying `Authorization: Bearer` bypasses the check — clients holding the token in memory are unaffected (no localStorage), and the httpOnly cookie is the only session carrier in the browser, so this bypass is not exploitable from a cross-site page.

### C-2 — CORS limited to configured origins with credentials [SAFE BY DESIGN] (server.ts:220-224)

---

## 14. Rate-Limiting Findings

- **In place:** general 5000/min (`server.ts:292-300`, skips uploads/health/GET notifications & export in test only), radio read 120/write 30/chat 20 per min (`:305-312`), auth POST 10/15 min (`:315-324`), broadcasts 60/min (`:327-328`), students upload 20/min (`:330-336`).
- **Weakness (shared with E4):** all keyed by `req.ip` with no `trust proxy` → proxy-collapsed buckets cause shared-limit DoS and distributed brute-force bypass; no per-account lockout. [MEDIUM][CONFIRMED] — see A-10.

---

## 15. Secrets Findings

### SE-1 — `vite.config.ts` `define` injects the full env map into the client bundle if any client/dep references `process.env` [HIGH][POTENTIAL config hazard]
- **File:** `vite.config.ts:8` (`loadEnv(mode, '.', '')` — empty prefix loads ALL dotenv vars), `:52-57` (`'process.env': JSON.stringify(env)`, `'process': { env: env }`).
- **Verification note:** the auth agent claimed secrets (JWT_SECRET, DB_PASSWORD, ENCRYPTION_KEY) were present in `dist/assets/index-BngBAvVr.js`. I independently grepped the current on-disk `dist/assets/*.js` for those key names — **no matches** (client source never references `process.env`, and today's build does not inline the env map). The configuration is still a hazard: any future client-side or dependency reference to `process.env.X` will serialize ALL `.env` values (including DB_PASSWORD/JWT_SECRET/ENCRYPTION_KEY/VAPID) into publicly served assets.
- **Remediation:** remove `'process.env'`/`'process'` defines; use only `import.meta.env` with explicit `VITE_`-prefixed vars; keep server secrets server-side.
- **Regression test:** build, then grep `dist/assets/*.js` for `DB_PASSWORD`/`JWT_SECRET` — must not match.

### SE-2 — `.env` is gitignored and untracked; only `.env.example` committed [FIXED]
- **Evidence:** `.gitignore:7` (`.env*`, `!.env.example`); `git ls-files` shows only `.env.example`; `git check-ignore .env` → ignored. Historical finding #1 (live secrets in repo) FIXED for the working tree. (Historical secret values remain in git history — rotate credentials if that history shipped.)

### SE-3 — Env guard misses documented defaults
- **E-1 JWT:** `server.ts:114-119` rejects `['your-secret-key-here','super-secret-key','']` but **not** the documented `.env.example:13` value `super-secret-key-change-me-in-production`. [MEDIUM][CONFIRMED]
- **E-2 DEFAULT_USER_PASSWORD:** `.env.example:19` documents `Sakani@2026#ChangeMe`; applied at `user.routes.ts:202-206`, `tenant.routes.ts:569`, `students/crud.routes.ts:348`, `student.service.ts:51-55,134-136` for auto-created accounts. [MEDIUM][CONFIRMED]
- **E-3:** DB vars are warn-only (dev convenience) — acceptable.

### SE-4 — Remaining secrets in `.env` are consistent with a production-shaped deployment; not printed in this report. Rotation recommended given git history exposure.

---

## 16. Info-Disclosure Findings

### ID-1 — Radio moderation endpoints expose other users' emails and hidden-message contents [HIGH with M-2][CONFIRMED]
- `chat.service.ts:124` (`u.email as user_email`), `:146-158` (hidden message bodies).

### ID-2 — Generic error responses prevent DB/stack leakage [SAFE][CONFIRMED]
- `server.ts:397-407` returns fixed Arabic message; `middleware.ts:361-364` localizes errors.

### ID-3 — Console logging: DB runtime info logged in non-prod only (`db.ts:28-29`, `knex.ts:27`) [LOW][CONFIRMED] — historical #14 FIXED for production.

### ID-4 — Swagger UI now behind `authenticate` + `MANAGE_SETTINGS` (`server.ts:351`) — historical #13 FIXED.

---

## 17. Dependency Security (`npm audit --omit=dev`, run 2026-09-17)

**Totals: 0 critical, 15 high, 9 moderate, 2 low (26 advisories, 983 packages).** Notable and verified against installed lockfile versions:

| Package | Installed | Severity | Advisory(s) | Reachable in Sakani |
|---|---|---|---|---|
| `multer` (direct) | ^2.1.1 (≤2.2.0 flagged) | HIGH | GHSA-wc9g-mqfw-jrwm, GHSA-535w-7cp7-47q4, GHSA-72gw-mp4g-v24j (body-parser chain) | Yes — all multipart upload endpoints. **Upgrade to ≥2.3.0.** |
| `socket.io-parser` | 4.2.x (<4.2.7) | HIGH | GHSA-2m8v-j782-fhvr (zero-attachment memory exhaustion) | Yes — every engine.io/socket connection. |
| `ws` (transitive via engine.io/client, adapter) | <8.21.0 | HIGH | GHSA-96hv-2xvq-fx4p (memory exhaustion via tiny fragments) | Yes — socket layer. |
| `react-router-dom` → `react-router` | 7.14.2 (<7.18.x) | HIGH | GHSA-8x6r-g9mw-2r78, GHSA-qwww-vcr4-c8h2, GHSA-chx6-hx7r-mcp5, open-redirect GHSA-wrjc-x8rr-h8h6 | Client-side routing/SSR hydration paths. |
| `vite` (dev) | ^6.2.3 (≤6.4.2) | HIGH | GHSA-fx2h-pf6j-xcff (fs.deny bypass, Windows/Windows alt-path) | Dev server only (not exposed in prod serving of `dist`). |
| `dompurify` (direct) | ^3.4.8 (≤3.4.12) | MODERATE | GHSA-55q2-fjhq-7xh7, GHSA-cmwh-pvxp-8882, GHSA-c2j3-45gr-mqc4 | Client-side sanitizer (Phone daily readings). Upgrade ≥3.4.13. |
| `exceljs` → `uuid` (transitive) | exceljs 4.4.0 bundles uuid <11.1.1 | MODERATE | GHSA-w5hq-g745-h8pq (buffer bounds, needs explicit buf arg) | Not exercised via explicit-buf API; low practical impact. |
| `fast-uri` (via framework chain) | <3.1.6 | HIGH | GHSA-f65p-4m7j-42xc etc. (SSRF/IP normalization in URL parse) | Only if URL-parsing library used on attacker input — no direct usage found. |
| `js-yaml`, `brace-expansion`, `browserslist`, `nanoid`, `postcss`, `protobufjs`, `tmp`, `ip-address`, `qs`, `body-parser` | transitive | HIGH/MOD | build-time or parser DoS; low practical reach | Upgrade via lockfile dedupe/`npm audit fix`. |

**Remediation priority:** `npm audit fix` (safe updates), explicit `multer@^2.3.0`, `socket.io@4.x` latest with `ws@8.21+`, `react-router-dom@^7.18`, `dompurify@>=3.4.13`. All are non-breaking within major versions; exclusions: `exceljs` (no fixed release; treat as risk).

---

## 18. Security Test Coverage

- **Inventory:** `securityAuthz.test.ts` (52 tests) + `security-authz.test.ts` (39 tests) + full suite = **196 tests across 14 files**.
- **Covered:** RBAC matrix (roles × guarded endpoints), tenant-isolation on students/finance/broadcasts/uploads, blacklist/tokenVersion revocation, X-Tenant-Id override, upload magic-byte rejection, path-traversal, rateLimit behavior, CSRF origin gate, admin/bishop/priest/supervisor vertical checks, permissions self-escalation attempts (array-form `"ALL"` — note: does the suite cover the **string** form? Must add regression for A-1 string bypass and for R-4 amount bounds).
- **Execution result (2026-09-17):**
  - `npx vitest run` → **Test Files 14 passed (14) — 196 passed (196)** (run 1)
  - `npx vitest run` → **Test Files 14 passed (14) — 196 passed (196)** (run 2)
  - `npx tsc --noEmit` → **exit 0**
  - `npm run lint` (= `tsc --noEmit`) → **exit 0**
- **Gap:** no test currently asserts the string-`"ALL"` escalation (A-1), the behavior `amount` bounds (R-4), or post-build dist secret-scan (SE-1).

---

## 19. Attack-Path Analysis

1. **Low-privilege full takeover (A-1):** supervisor/priest logs in → `PUT /users/:self/permissions` `{"permissions":"ALL"}` → gains `MANAGE_SETTINGS` (Swagger), `MODERATE_RADIO_CHAT`, `MANAGE_GLOBAL_TENANTS`-class powers → cross-tenant data access + hidden-chat/email reads (M-2/ID-1) + radio content destruction (I-3). **Most damaging; fix first.**
2. **Credential default chain (A-2, E-1, E-2):** operator runs `seed-admin` (or copies `.env.example`) → `admin@sakani.com/admin123` or documented `JWT_SECRET`/`DEFAULT_USER_PASSWORD` → forge admin JWT (if secret known) or log into every auto-created account → full control incl. all tenant data and channel moderation. Mitigated today only by env hygiene.
3. **Socket/multipart DoS (P-3/S-2, multer/socket.io-parser/ws):** unauthenticated attacker connects to io client with tiny/zero-attachment frames → memory exhaustion; or posts crafted multipart field names to a protected upload endpoint → request-tree DoS. Requires reverse-proxy/rate-limit tuning + upgraded deps.
4. **Cross-tenant data harvesting via radio (M-1):** any student/parent reads chat history: enriches OSINT of staff names, roles, bishopric boundaries for targeted social engineering.
5. **File-corruption/cron (F-1):** long-lived deployments silently break older documents/receipts once they age past 30 days.
6. **Revocation-window races (A-4/A-7):** multi-instance deploy: attacker holding a pre-reset JWT keeps access for ≤15 s after a password reset — relevant for high-value admin accounts during incident response.

---

## 20. Historical Finding Status (from `SECURITY_FIXES.md`, re-verified against current code)

| # | Historical finding | Current status |
|---|---|---|
| 1 | Live secrets in `.env` committed | **FIXED** (gitignored + untracked; `.env.example` contains placeholders) |
| 2 | `dangerouslySetInnerHTML` XSS (DailyReadingsCard) | **FIXED** (`DailyReadingsCard.tsx:379` → `DOMPurify.sanitize`) |
| 3 | JWT in `localStorage` | **FIXED** (httpOnly cookie, SameSite=strict) |
| 4 | Weak `sa` DB password | **PARTIALLY FIXED** (documented as dev-only; production rotation still operator action) |
| 5 | WebSocket without auth | **FIXED** (`server.ts:410-419` + `resolveSocketUser` full revalidation) |
| 6 | CSP unsafe-inline + unsafe-eval | **FIXED** for production (`server.ts:198-201`; dev keeps them for HMR) |
| 7 | DB encryption disabled | **FIXED** (`knex.ts:18-19,42-43` `encrypt==='production'`) |
| 8 | Uploads validated by extension only | **FIXED** (`upload.ts` magic-bytes + radio magic-bytes) |
| 9 | Test files with production-like passwords | **FIXED** (setup uses `test-secret-key`/`test-encryption-key-32chars!!`) |
| 10 | Default user password weak | **PARTIALLY FIXED** (stronger default `Sakani@2026#ChangeMe` but still documented & static — see E-2) |
| 11 | HTTP/0.0.0.0, no HTTPS | **PARTIALLY FIXED** (`ENFORCE_HTTPS` redirect exists but bypassable — see E4) |
| 12 | Mixed-content radio stream URL | **FIXED** (`types.ts:83` https default) |
| 13 | Swagger UI unauthenticated | **FIXED** (`server.ts:351` `authenticate` + `MANAGE_SETTINGS`) |
| 14 | Sensitive DB info in console | **FIXED** (non-prod only logging) |
| 15 | Finance-delete IDOR | **FIXED** (`finance.routes.ts:196` tenant-scoped) |
| 16 | No refresh-token mechanism | **STILL OPEN** (24 h expiry, re-login; acceptable at this scale — LOW) |
| 17 | Nginx placeholder config | **STILL OPEN** (ops-level, not an app finding) |

---

## 21. Complete Finding Table

| ID | Severity | Confidence | Category | Endpoint / Location | Summary |
|---|---|---|---|---|---|
| A-1 | CRITICAL | CONFIRMED | AuthZ/RBAC | `PUT /api/users/:id/permissions` | String-`"ALL"` self-escalation for priest/supervisor |
| A-2 | HIGH | CONFIRMED | Secrets/backdoor | `scripts/seed-admin.ts` | Hardcoded `admin123` reset, no token_version bump |
| M-1 | HIGH | CONFIRMED | Tenant isolation | `GET /api/radio/chat/messages` | Cross-tenant names/roles/dioceses to any user |
| M-2 | HIGH | CONFIRMED (conditional) | Tenant isolation/IDOR | radio moderation `radio.routes.ts:91-97` | Arbitrary cross-tenant ban/delete + email+hidden-msg reads |
| M-3 | MEDIUM | CONFIRMED (conditional) | Tenant isolation/IDOR | radio CRUD `radio.routes.ts:75-141` | Permission-only content mutations, any ID |
| M-4 | LOW | CONFIRMED | Availability/scope | `GET /api/broadcasts/messages` | `.limit(50)` before JS tenant filter |
| M-5 | LOW | CONFIRMED | Tenant context | `middleware.ts:105-135` | `X-Tenant-Id` validated/fail-closed (informational) |
| M-6 | LOW | CONFIRMED | Visibility | `GET /api/audit` | Single-tenant audit scoping for multi-tenant staff |
| R-1 | MEDIUM | CONFIRMED | RBAC | `middleware.ts:204-218` | Bishop hard-coded fallback non-revocable |
| R-3 | MEDIUM | POTENTIAL | RBAC | `cache.ts` permission cache | Permission-cache invalidation/revocation latency |
| R-4 | MEDIUM | CONFIRMED | Business logic | `POST /api/behavior/points` | `amount` unbounded (neg/large) |
| A-4 | MEDIUM | POTENTIAL | Sessions | `middleware.ts:63-69`/`cache.ts:54` | token_version cached 15 s; multi-instance window |
| A-10 | MEDIUM | CONFIRMED | Rate limit | `auth.routes.ts:15-19` / `server.ts` | Per-IP only; no trust proxy; no account lockout |
| E-1 | MEDIUM | CONFIRMED | Secrets | `server.ts:114-119` | JWT_SECRET guard misses example value |
| E-2 | MEDIUM | CONFIRMED | Secrets | `.env.example:19` + user/student/tenant creation | Static documented default password |
| SE-1 | HIGH | POTENTIAL | Secrets/CI | `vite.config.ts:8,52-57` | Full env map inlined into bundle if `process.env` referenced (current dist clean) |
| F-1 | MEDIUM | CONFIRMED | Files/availability | `server.ts:88-108` | 30-day cron deletes DB-referenced files |
| P-3 | MEDIUM | POTENTIAL | Payments | payment capture endpoints | No idempotency key/replay protection observed |
| IN-3 | LOW | POTENTIAL | Input | Excel exports | CSV-formula-injection residual risk |
| A-5 | LOW | CONFIRMED | Cookies | `auth.routes.ts:330,272` | clearCookie omits cookie attrs |
| A-6 | LOW | CONFIRMED | JWT hardening | `middleware.ts:51,165`; `auth.routes.ts:319` | No `algorithms` pin |
| A-7 | LOW | POTENTIAL | Sessions/race | `middleware.ts:56-60,77-81` | Non-atomic revocation TOCTOU |
| E4 | MEDIUM | CONFIRMED | Transport | `server.ts:165-173` | HTTPS redirect trusts client `X-Forwarded-Proto` (no trust proxy) |
| ID-1 | (merged w/ M-2) | — | Info disclosure | `chat.service.ts:124,146-158` | Email + hidden-chat exposure |
| ID-3 | LOW | CONFIRMED | Info disclosure | `db.ts:28-29`,`knex.ts:27` | Non-prod console logging only |
| C-1 | LOW | SAFE BY DESIGN | CSRF | `server.ts:226-278` | Origin/Referer gate + SameSite strict; Bearer bypass noted |

Count: **1 CRITICAL core (A-1) + A-2/M-1/M-2/SE-1 HIGH** (5 HIGH incl. SE-1 potential), **13 MEDIUM**, **7 LOW/INFO**. (Dependency HIGHs are listed separately in §17.)

---

## 22. Recommended Remediation Order

1. **P0 — A-1 escalation:** array-only validation + no-self-grant + grantor-subset; regression tests for string bypass. *(Touches `user.routes.ts`; run full suite.)*
2. **P0 — A-2 seed-admin:** remove hardcoded password; bump `token_version`; read creds from env.
3. **P0 — Dependencies:** upgrade `multer ≥2.3.0`, `socket.io`+`socket.io-parser ≥4.2.7`, `ws ≥8.21.0`, `react-router-dom ≥7.18`, `dompurify ≥3.4.13`; then re-run `npm audit` + full suite.
4. **P1 — Radio isolation:** add `computeUserTenantIds` scoping to chat moderation reads/writes and radio admin CRUD, or document + gate radio permissions as system-global; fix M-4 SQL ordering.
5. **P1 — Env hygiene:** reject documented example JWT_SECRET/default passwords at boot; remove `process.env`/`process` defines from `vite.config.ts`; add a build-time secret-scan regression.
6. **P1 — Rate limiting/trust proxy:** configure `trust proxy` correctly behind Nginx; add per-account lockout for `/auth/login`.
7. **P2 — R-4:** bound behavior `amount`; **F-1:** DB-aware upload cleanup; **E4:** make HTTPS redirect fail-closed (only trust the header from a trusted proxy via `trust proxy`).
8. **P2 — A-4/A-7:** move `token_version` check to a fresh DB read or Redis-backed invalidation if multi-instance.
9. **P3 — Hardening:** A-5 clearCookie attrs, A-6 `algorithms` pin, R-1 document/revise bishop fallback, M-6 audit scoping parity, IN-3 export-cell sanitation, P-3 payment idempotency.

**Verification baseline after any batch:** `npx vitest run` (expect 196+ with new tests), `npx tsc --noEmit`, `npm run lint`.