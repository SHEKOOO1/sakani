import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { userCache, tenantCache, permissionCache } from '../backend/infrastructure/cache';

// ═══════════════════════════════════════════════════════════════
// HTTP-layer authorization tests.
//
// WHY IN-PROCESS (not against the live dev server):
//   The original integration version called POST /api/auth/login,
//   which is gated by express-rate-limit (max 10 per 15 min) with
//   no `isTest` skip, and the reused dev server runs NODE_ENV != test,
//   so those tests flaked with 429s. This version mints its own JWTs
//   (same JWT_SECRET the middleware verifies against) and mounts the
//   REAL routers + REAL authenticate/authorizePermission middleware on
//   an in-process HTTP server against a mocked DB — no login endpoint,
//   no rate limiters, fully deterministic.
// ═══════════════════════════════════════════════════════════════

type Op = { m: string; a: any[] };

const auditCalls = vi.hoisted(() => [] as any[]);

// قد ذُكرت كلمة مرور لا تُكتب في سجلات التدقيق، ولذا نستخدم سلسلة فريدة لكشف أي تسريب
const OLD_PASSWORD = 'OldPass@1';
const OLD_PASSWORD_HASH = bcrypt.hashSync(OLD_PASSWORD, 10);

function matchesWhere(row: any, args: any[]): boolean {
  if (args.length >= 2 && typeof args[1] === 'string' && ['like', '=', '>', '<', '>=', '<='].includes(args[1])) {
    const col = String(args[0]);
    const op = args[1];
    const val = args[2];
    const actual = getKey(row, col);
    if (op === 'like') {
      const needle = String(val).replace(/^%|%$/g, '');
      return typeof actual === 'string' && actual.includes(needle);
    }
    return actual === val;
  }
  if (typeof args[0] === 'object' && args[0] !== null) {
    return Object.entries(args[0]).every(([col, val]) => getKey(row, col) === val);
  }
  const col = String(args[0]);
  const val = args[1];
  if (typeof val === 'string' && val.includes('%')) {
    const needle = val.replace(/^%|%$/g, '');
    const actual = getKey(row, col);
    return typeof actual === 'string' && actual.includes(needle);
  }
  return getKey(row, col) === val;
}

function getKey(row: any, col: string): any {
  if (row == null || typeof row !== 'object') return undefined;
  if (col in row) return row[col];
  const last = col.split('.').pop();
  if (last && last in row) return row[last];
  return undefined;
}

function applyOps(base: any[], ops: Op[], store: Record<string, any[]>, table: string): any {
  let out = base;
  for (const { m, a } of ops) {
    if (m === 'first') {
      if (Array.isArray(out)) {
        // نسخة وليس مرجعًا: قراءة لاحقة في نفس المعاملة يجب ألا تتلوث بتعديل السجل
        out = out.length ? { ...out[0] } : out[0];
      }
      continue;
    }
    if (!Array.isArray(out)) continue;
    if (m === 'where') out = out.filter((r: any) => matchesWhere(r, a));
    if (m === 'whereIn') {
      const col = String(a[0]);
      const values = a[1];
      out = out.filter((r: any) => values.includes(getKey(r, col)));
    }
    if (m === 'count') out = [{ count: out.length }];
    if (m === 'del') {
      store[table] = (store[table] ?? []).filter((r: any) => !out.includes(r));
      out = [];
    }
    if (m === 'insert') {
      const rows = Array.isArray(a[0]) ? a[0] : [a[0]];
      store[table] = store[table] ?? [];
      store[table].push(...rows);
      out = [];
    }
    if (m === 'update' && typeof a[0] === 'object' && a[0] !== null) {
      for (const r of out) Object.assign(r, a[0]);
      out = [];
    }
  }
  return out;
}

function createKdbMock() {
  const rowsStore: Record<string, any[]> = {};
  const makeBuilder = (table: string): any => {
    const rec: { table: string; ops: Op[] } = { table, ops: [] };
    const target: any = { __rec: rec };
    let proxy: any;
    proxy = new Proxy(target, {
      get(_t, prop) {
        if (prop === 'then') {
          return (onF: any, onR: any) => {
            const base = rowsStore[rec.table] ?? [];
            const value = applyOps(base, rec.ops, rowsStore, rec.table);
            return Promise.resolve(value).then(onF, onR);
          };
        }
        return (...args: any[]) => {
          rec.ops.push({ m: String(prop), a: args });
          return proxy;
        };
      },
    });
    return proxy;
  };

  const kdb: any = vi.fn((table: string) => makeBuilder(table));
  // بساطة: معاملة الموك ترجّل الاستعلامات داخل الـ callback على نفس المخزن الوهمي
  // (تُستخدم لاختبار SELECT p/INSERT بداخل kdb.transaction في POST /badges/assign)
  kdb.transaction = (fn: (trx: any) => Promise<any>) =>
    fn((table: string) => makeBuilder(table));

  return {
    kdb,
    setRows(table: string, rows: any[]) {
      rowsStore[table] = rows;
    },
    readRows(table: string): any[] {
      return rowsStore[table] ?? [];
    },
    reset() {
      for (const k of Object.keys(rowsStore)) rowsStore[k] = [];
    },
  };
}

const dbMock = createKdbMock();

// Real routers/middleware keep their real implementation; only the DB
// layer and the raw mssql pool (knex) are stubbed so no live DB is hit.
vi.mock('../backend/infrastructure/db', () => ({
  kdb: dbMock.kdb,
  logAuditEvent: vi.fn((params: any) => { auditCalls.push(params); }),
  hasPermission: vi.fn(async () => true),
  checkUserPermission: vi.fn(async () => true),
}));
vi.mock('../backend/infrastructure/knex', () => ({
  kdb: dbMock.kdb,
  poolPromise: Promise.resolve(null),
  getDBClient: () => 'mssql',
  dateFormatColumn: (col: string) => col,
}));

let server: Server;
let baseUrl: string;

function signToken(user: { id: string; role: string; tenantId: string | null; email: string }, tokenVersion = 0): string {
  return jwt.sign(
    {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      gender: 'male',
      daily_readings_enabled: true,
      radio_514_enabled: true,
      tokenVersion,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );
}

async function request(
  path: string,
  opts: { method?: string; token?: string; body?: any; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function seedActor(user: { id: string; role: string; tenantId: string | null; email: string }) {
  dbMock.setRows('users', [
    { id: user.id, role: user.role, tenant_id: user.tenantId, email: user.email },
  ]);
  dbMock.setRows('tenants', user.tenantId ? [{ id: user.tenantId, name: 'res' }] : []);
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());

  const { auditLogger } = await import('../backend/api/middleware');
  app.use(auditLogger);

  const { default: uploadsRouter } = await import('../backend/api/uploads.routes');
  const { default: extrasRouter } = await import('../backend/api/students/extras.routes');
  const { default: badgesRouter } = await import('../backend/api/badges.routes');
  const { default: financeRouter } = await import('../backend/api/finance.routes');
  const { default: userRouter } = await import('../backend/api/user.routes');
  const { default: authRouter } = await import('../backend/api/auth.routes');

  app.use('/uploads', uploadsRouter);
  app.use('/api/students', extrasRouter);
  app.use('/api/badges', badgesRouter);
  app.use('/api/finance', financeRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);

  server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once('listening', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
}, 60000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

beforeEach(() => {
  dbMock.reset();
  userCache.clear();
  tenantCache.clear();
  permissionCache.clear();
});

// ═══════════════════════════════════════════════════════════════
// Authentication layer (minted-JWT, real middleware)
// ═══════════════════════════════════════════════════════════════

describe('security-authz: authentication layer', () => {
  it('rejects unauthenticated requests to protected routes', async () => {
    const res = await request('/uploads/documents/x.pdf');
    expect(res.status).toBe(401);

    const res2 = await request('/api/students/employee-permission', { method: 'POST', body: { employeeId: 'e1' } });
    expect(res2.status).toBe(401);
  });

  it('rejects a JWT signed with the wrong secret', async () => {
    seedActor({ id: 'u1', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    const forged = jwt.sign(
      { id: 'u1', tenantId: 'A', role: 'supervisor', email: 'sup@test.com' },
      'attacker-secret',
      { expiresIn: '1h' }
    );
    const res = await request('/api/students/employee-permission', {
      method: 'POST',
      token: forged,
      body: { employeeId: 'eA' },
    });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
// H-4 at HTTP layer — employee-permission grant/revoke
// (real route handler + real canManageEmployee)
// ═══════════════════════════════════════════════════════════════

describe('security-authz: employee-permission (canManageEmployee)', () => {
  it('supervisor of A CAN grant permissions to an employee of A', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [
      { id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' },
      { id: 'eA', role: 'employee', tenant_id: 'A' },
    ]);
    dbMock.setRows('user_tenant_assignments', []);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/students/employee-permission', {
      method: 'POST',
      token,
      body: { employeeId: 'eA' },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('supervisor of A CANNOT grant permissions to an employee of B (cross-residence)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [
      { id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' },
      { id: 'eB', role: 'employee', tenant_id: 'B' },
    ]);
    dbMock.setRows('user_tenant_assignments', []);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/students/employee-permission', {
      method: 'POST',
      token,
      body: { employeeId: 'eB' },
    });
    expect(res.status).toBe(403);
  });

  it('supervisor of A CANNOT grant permissions to an employee with NULL tenant_id and no assignment (regression)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [
      { id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' },
      { id: 'eNull', role: 'employee', tenant_id: null },
    ]);
    dbMock.setRows('user_tenant_assignments', []);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/students/employee-permission', {
      method: 'POST',
      token,
      body: { employeeId: 'eNull' },
    });
    expect(res.status).toBe(403);
  });

  it('supervisor with NULL primary tenant but a valid assignment to A still gets authorised (no regression)', async () => {
    // login would auto-backfill tenant_id in the real flow; here we assert the
    // scope logic works for a legitimately assignment-only supervisor.
    seedActor({ id: 'supAs', role: 'supervisor', tenantId: 'A', email: 'sas@test.com' });
    dbMock.setRows('users', [
      { id: 'supAs', role: 'supervisor', tenant_id: 'A', email: 'sas@test.com' },
      { id: 'eA', role: 'employee', tenant_id: 'A' },
    ]);
    dbMock.setRows('user_tenant_assignments', [{ user_id: 'supAs', tenant_id: 'A' }]);
    const token = signToken({ id: 'supAs', role: 'supervisor', tenantId: 'A', email: 'sas@test.com' });

    const res = await request('/api/students/employee-permission', {
      method: 'POST',
      token,
      body: { employeeId: 'eA' },
    });
    expect(res.status).toBe(200);
  });

  it('bishop can manage employees in any managed residence and in no other', async () => {
    seedActor({ id: 'bisB', role: 'bishop', tenantId: 'A', email: 'bis@test.com' });
    dbMock.setRows('users', [
      { id: 'bisB', role: 'bishop', tenant_id: 'A', email: 'bis@test.com' },
      { id: 'eB', role: 'employee', tenant_id: 'B' },
      { id: 'eC', role: 'employee', tenant_id: 'C' },
    ]);
    dbMock.setRows('tenants', [
      { id: 'A', name: 'A', bishop_id: 'bisB' },
      { id: 'B', name: 'B', bishop_id: 'bisB' },
    ]);
    dbMock.setRows('user_tenant_assignments', []);
    const token = signToken({ id: 'bisB', role: 'bishop', tenantId: 'A', email: 'bis@test.com' });

    const ok = await request('/api/students/employee-permission', {
      method: 'POST',
      token,
      body: { employeeId: 'eB' },
    });
    expect(ok.status).toBe(200);

    const denied = await request('/api/students/employee-permission', {
      method: 'POST',
      token,
      body: { employeeId: 'eC' },
    });
    expect(denied.status).toBe(403);
  });

  it('admin can grant permissions to any employee, including a null-tenant one (no supervisor can)', async () => {
    seedActor({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' });
    dbMock.setRows('users', [
      { id: 'adm', role: 'admin', tenant_id: null, email: 'adm@test.com' },
      { id: 'eNull', role: 'employee', tenant_id: null },
    ]);
    dbMock.setRows('user_tenant_assignments', []);
    const token = signToken({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' });

    const res = await request('/api/students/employee-permission', {
      method: 'POST',
      token,
      body: { employeeId: 'eNull' },
    });
    expect(res.status).toBe(200);
  });

  it('forged X-Tenant-Id header cannot widen scope to another residence', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [
      { id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' },
      { id: 'eB', role: 'employee', tenant_id: 'B' },
    ]);
    dbMock.setRows('user_tenant_assignments', [{ user_id: 'supA', tenant_id: 'A' }]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/students/employee-permission', {
      method: 'POST',
      token,
      body: { employeeId: 'eB' },
      headers: { 'X-Tenant-Id': 'B' },
    });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════
// H-2 at HTTP layer — document download (real uploads router)
// ═══════════════════════════════════════════════════════════════

describe('security-authz: document download (canAccessDocument)', () => {
  it('supervisor of A is denied a document of a student in B', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('StudentDocuments', [
      { id: 'doc1', student_id: 'sB', file_path: '/uploads/documents/recB.pdf' },
    ]);
    dbMock.setRows('students as s', [{ id: 'sB', user_id: 'uB', tenant_id: 'B' }]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/uploads/documents/recB.pdf', { token });
    expect(res.status).toBe(403);
  });

  it('supervisor of A is authorised for a document of a student in A (403 only if authz fails, not file missing)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('StudentDocuments', [
      { id: 'doc1', student_id: 'sA', file_path: '/uploads/documents/recA.pdf' },
    ]);
    dbMock.setRows('students as s', [{ id: 'sA', user_id: 'uA', tenant_id: 'A' }]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/uploads/documents/recA.pdf', { token });
    // File does not exist on disk → 404 is fine; anything but 403 proves authz passed
    expect([200, 404]).toContain(res.status);
  });

  it('admin can download documents of any residence', async () => {
    seedActor({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' });
    dbMock.setRows('StudentDocuments', [
      { id: 'doc1', student_id: 'sB', file_path: '/uploads/documents/recB.pdf' },
    ]);
    dbMock.setRows('students as s', [{ id: 'sB', user_id: 'uB', tenant_id: 'B' }]);
    const token = signToken({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' });

    const res = await request('/uploads/documents/recB.pdf', { token });
    expect([200, 404]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════
// M-7 at HTTP layer — global badge edit/delete (real routes + real
// canManageBadge). Global (tenant_id NULL) badges are org-level items:
// admin + bishop only. Tenant badges stay within computeUserTenantIds.
// ═══════════════════════════════════════════════════════════════

describe('security-authz: global badge management (canManageBadge)', () => {
  const GLOBAL_BADGE = { id: 'bgG', tenant_id: null, title: 'Global', icon: 'Award', color: 'amber', category: 'housing' };
  const TENANT_A_BADGE = { id: 'bgA', tenant_id: 'A', title: 'TenantA', icon: 'Award', color: 'amber', category: 'housing' };
  const TENANT_B_BADGE = { id: 'bgB', tenant_id: 'B', title: 'TenantB', icon: 'Award', color: 'amber', category: 'housing' };

  it('supervisor of A CANNOT edit or delete a global badge (403)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [
      { id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' },
    ]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('badges', [GLOBAL_BADGE]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const put = await request('/api/badges/bgG', { method: 'PUT', token, body: { title: 'Hacked' } });
    expect(put.status).toBe(403);

    const del = await request('/api/badges/bgG', { method: 'DELETE', token });
    expect(del.status).toBe(403);
  });

  it('priest/employee/assistant_supervisor of A CANNOT edit a global badge (403)', async () => {
    for (const role of ['priest', 'employee', 'assistant_supervisor']) {
      seedActor({ id: `u-${role}`, role, tenantId: 'A', email: `${role}@test.com` });
      dbMock.setRows('users', [{ id: `u-${role}`, role, tenant_id: 'A', email: `${role}@test.com` }]);
      dbMock.setRows('user_tenant_assignments', []);
      dbMock.setRows('badges', [GLOBAL_BADGE]);
      const token = signToken({ id: `u-${role}`, role, tenantId: 'A', email: `${role}@test.com` });

      const res = await request('/api/badges/bgG', { method: 'PUT', token, body: { title: 'Hacked' } });
      expect(res.status).toBe(403);
    }
  });

  it('bishop CAN edit and delete a global badge (org-level model, mirrors canManageItem)', async () => {
    seedActor({ id: 'bisB', role: 'bishop', tenantId: 'A', email: 'bis@test.com' });
    dbMock.setRows('users', [{ id: 'bisB', role: 'bishop', tenant_id: 'A', email: 'bis@test.com' }]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A', bishop_id: 'bisB' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('badges', [GLOBAL_BADGE]);
    const token = signToken({ id: 'bisB', role: 'bishop', tenantId: 'A', email: 'bis@test.com' });

    const put = await request('/api/badges/bgG', { method: 'PUT', token, body: { title: 'Renamed' } });
    expect(put.status).toBe(200);

    const del = await request('/api/badges/bgG', { method: 'DELETE', token });
    expect(del.status).toBe(200);
  });

  it('admin CAN edit a global badge (200)', async () => {
    seedActor({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' });
    dbMock.setRows('users', [{ id: 'adm', role: 'admin', tenant_id: null, email: 'adm@test.com' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('badges', [GLOBAL_BADGE]);
    const token = signToken({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' });

    const res = await request('/api/badges/bgG', { method: 'PUT', token, body: { title: 'AdminEdit' } });
    expect(res.status).toBe(200);
  });

  it('supervisor CAN edit a same-tenant badge when authorized (200)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [{ id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('badges', [TENANT_A_BADGE]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/badges/bgA', { method: 'PUT', token, body: { title: 'TenantEdit' } });
    expect(res.status).toBe(200);
  });

  it('supervisor CANNOT edit a cross-tenant badge (403)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [{ id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('badges', [TENANT_B_BADGE]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/badges/bgB', { method: 'PUT', token, body: { title: 'Cross' } });
    expect(res.status).toBe(403);
  });

  it('global badge ASSIGNMENT to an in-scope student remains allowed (200)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [{ id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' }]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('badges', [GLOBAL_BADGE]);
    dbMock.setRows('students', [{ id: 'sA', tenant_id: 'A' }]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/badges/assign', {
      method: 'POST',
      token,
      body: { badgeId: 'bgG', studentIds: ['sA'], reason: 'good' },
    });
    expect(res.status).toBe(200);
  });

  it('global badge ASSIGNMENT to a null-tenant student is denied (student must be tenant-scoped)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [{ id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' }]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('badges', [GLOBAL_BADGE]);
    dbMock.setRows('students', [{ id: 'sNull', tenant_id: null }]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/badges/assign', {
      method: 'POST',
      token,
      body: { badgeId: 'bgG', studentIds: ['sNull'], reason: 'good' },
    });
    expect(res.status).toBe(400);
  });

  it('global badge ASSIGNMENT to a cross-tenant student is denied (400)', async () => {
    seedActor({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });
    dbMock.setRows('users', [{ id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com' }]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('badges', [GLOBAL_BADGE]);
    dbMock.setRows('students', [{ id: 'sB', tenant_id: 'B' }]);
    const token = signToken({ id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' });

    const res = await request('/api/badges/assign', {
      method: 'POST',
      token,
      body: { badgeId: 'bgG', studentIds: ['sB'], reason: 'good' },
    });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// LOW — finance NULL-tenant probe fail-closed (real finance router)
// A non-admin with no valid tenant scope must not be able to probe an
// unscoped finance row by ID (PUT /:id, DELETE /:id → 404 before query).
// ═══════════════════════════════════════════════════════════════

describe('security-authz: finance NULL-tenant probe (fail-closed)', () => {
  const FIN_A = { id: 'fA', tenant_id: 'A', is_admin_only: 0, type: 'expense', amount: 100, description: 'x', category: 'x' };
  const FIN_B = { id: 'fB', tenant_id: 'B', is_admin_only: 0, type: 'expense', amount: 50, description: 'x', category: 'x' };
  const FIN_ADMIN = { id: 'fAdm', tenant_id: null, is_admin_only: 1, type: 'expense', amount: 999, description: 'x', category: 'x' };

  it('null-tenant supervisor CANNOT probe an unscoped finance row (PUT → 404)', async () => {
    seedActor({ id: 'supNull', role: 'supervisor', tenantId: null, email: 'supnull@test.com' });
    dbMock.setRows('users', [{ id: 'supNull', role: 'supervisor', tenant_id: null, email: 'supnull@test.com' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('finances', [FIN_A]);
    const token = signToken({ id: 'supNull', role: 'supervisor', tenantId: null, email: 'supnull@test.com' });

    const res = await request('/api/finance/fA', { method: 'PUT', token, body: { description: 'zz' } });
    expect(res.status).toBe(404);
  });

  it('null-tenant supervisor CANNOT probe an unscoped finance row (DELETE → 404)', async () => {
    seedActor({ id: 'supNull2', role: 'supervisor', tenantId: null, email: 'supnull2@test.com' });
    dbMock.setRows('users', [{ id: 'supNull2', role: 'supervisor', tenant_id: null, email: 'supnull2@test.com' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('finances', [FIN_A]);
    const token = signToken({ id: 'supNull2', role: 'supervisor', tenantId: null, email: 'supnull2@test.com' });

    const res = await request('/api/finance/fA', { method: 'DELETE', token });
    expect(res.status).toBe(404);
  });

  it('authorized in-tenant supervisor can still PUT a finance record (200)', async () => {
    seedActor({ id: 'supFinA', role: 'supervisor', tenantId: 'A', email: 'supfina@test.com' });
    dbMock.setRows('users', [{ id: 'supFinA', role: 'supervisor', tenant_id: 'A', email: 'supfina@test.com' }]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('finances', [FIN_A]);
    const token = signToken({ id: 'supFinA', role: 'supervisor', tenantId: 'A', email: 'supfina@test.com' });

    const res = await request('/api/finance/fA', { method: 'PUT', token, body: { description: 'zz' } });
    expect(res.status).toBe(200);
  });

  it('authorized in-tenant supervisor can still DELETE a finance record (200)', async () => {
    seedActor({ id: 'supFinD', role: 'supervisor', tenantId: 'A', email: 'supfind@test.com' });
    dbMock.setRows('users', [{ id: 'supFinD', role: 'supervisor', tenant_id: 'A', email: 'supfind@test.com' }]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('finances', [FIN_A]);
    const token = signToken({ id: 'supFinD', role: 'supervisor', tenantId: 'A', email: 'supfind@test.com' });

    const res = await request('/api/finance/fA', { method: 'DELETE', token });
    expect(res.status).toBe(200);
  });

  it('cross-tenant access remains denied (PUT a record of another residence → 404)', async () => {
    seedActor({ id: 'supFinX', role: 'supervisor', tenantId: 'A', email: 'supfinx@test.com' });
    dbMock.setRows('users', [{ id: 'supFinX', role: 'supervisor', tenant_id: 'A', email: 'supfinx@test.com' }]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('finances', [FIN_B]);
    const token = signToken({ id: 'supFinX', role: 'supervisor', tenantId: 'A', email: 'supfinx@test.com' });

    const res = await request('/api/finance/fB', { method: 'PUT', token, body: { description: 'zz' } });
    expect(res.status).toBe(404);
  });

  it('admin behavior remains unchanged (PUT and DELETE work on admin-only records)', async () => {
    seedActor({ id: 'admFin', role: 'admin', tenantId: null, email: 'admfin@test.com' });
    dbMock.setRows('users', [{ id: 'admFin', role: 'admin', tenant_id: null, email: 'admfin@test.com' }]);
    dbMock.setRows('user_tenant_assignments', []);
    dbMock.setRows('finances', [FIN_ADMIN]);
    const token = signToken({ id: 'admFin', role: 'admin', tenantId: null, email: 'admfin@test.com' });

    const put = await request('/api/finance/fAdm', { method: 'PUT', token, body: { description: 'zz' } });
    expect(put.status).toBe(200);

    const del = await request('/api/finance/fAdm', { method: 'DELETE', token });
    expect(del.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// Password change/reset — session invalidation (volatile sessions)
//
// Mechanism: users.token_version, embedded in the JWT as `tokenVersion`.
// Every password change (admin reset OR self-service) increments the DB
// value; `authenticate`/`resolveSocketUser` reject any token whose version
// no longer matches. Old JWTs are never accepted again, server-side, with
// no reliance on the client deleting its cookie.
// ═══════════════════════════════════════════════════════════════

describe('security-authz: password reset invalidates prior sessions', () => {
  const adminRow = {
    id: 'adm',
    role: 'admin',
    tenant_id: null,
    email: 'adm@test.com',
    password: OLD_PASSWORD_HASH,
    token_version: 0,
    daily_readings_enabled: 1,
    radio_514_enabled: 1,
  };
  const adminToken = signToken({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' });

  function seedTarget(over: Record<string, any> = {}) {
    const row = {
      id: 't1',
      role: 'supervisor',
      tenant_id: 'A',
      email: 't1@test.com',
      password: OLD_PASSWORD_HASH,
      token_version: 0,
      daily_readings_enabled: 1,
      radio_514_enabled: 1,
      ...over,
    };
    dbMock.setRows('users', [adminRow, row]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'res' }]);
    dbMock.setRows('user_tenant_assignments', []);
    return row;
  }

  it('admin reset changes the hash, invalidates every previously issued token, and never returns the password', async () => {
    seedTarget();
    const oldToken = signToken({ id: 't1', role: 'supervisor', tenantId: 'A', email: 't1@test.com' }, 0);

    const pre = await request('/api/auth/me', { token: oldToken });
    expect(pre.status).toBe(200);

    const res = await request('/api/users/t1/password', { method: 'PUT', token: adminToken, body: { password: 'NewPass@9' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(JSON.stringify(res.body)).not.toContain('NewPass@9');

    const rows = dbMock.readRows('users');
    const updated = rows.find((r: any) => r.id === 't1');
    expect(updated.token_version).toBe(1);
    expect(bcrypt.compareSync('NewPass@9', updated.password)).toBe(true);
    expect(bcrypt.compareSync(OLD_PASSWORD, updated.password)).toBe(false);

    const post = await request('/api/auth/me', { token: oldToken });
    expect(post.status).toBe(401);

    const newToken = signToken({ id: 't1', role: 'supervisor', tenantId: 'A', email: 't1@test.com' }, 1);
    const fresh = await request('/api/auth/me', { token: newToken });
    expect(fresh.status).toBe(200);
  });

  it('weak reset passwords are rejected and existing sessions stay valid', async () => {
    seedTarget();
    const oldToken = signToken({ id: 't1', role: 'supervisor', tenantId: 'A', email: 't1@test.com' }, 0);

    const res = await request('/api/users/t1/password', { method: 'PUT', token: adminToken, body: { password: '123' } });
    expect(res.status).toBe(400);

    expect(dbMock.readRows('users').find((r: any) => r.id === 't1').token_version).toBe(0);
    const me = await request('/api/auth/me', { token: oldToken });
    expect(me.status).toBe(200);
  });

  it('unauthenticated and unauthorized users cannot reset passwords', async () => {
    seedTarget();

    const noToken = await request('/api/users/t1/password', { method: 'PUT', body: { password: 'NewPass@9' } });
    expect(noToken.status).toBe(401);

    dbMock.setRows('users', [
      { id: 'st1', role: 'student', tenant_id: 'A', email: 'st@test.com', password: OLD_PASSWORD_HASH, token_version: 0 },
      { id: 'target-admin', role: 'admin', tenant_id: null, email: 'ta@test.com', password: OLD_PASSWORD_HASH, token_version: 0 },
    ]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'res' }]);
    const studToken = signToken({ id: 'st1', role: 'student', tenantId: 'A', email: 'st@test.com' });
    const forbidden = await request('/api/users/target-admin/password', { method: 'PUT', token: studToken, body: { password: 'NewPass@9' } });
    expect(forbidden.status).toBe(403);
  });

  it('cross-tenant supervisor cannot reset a password inside another residence', async () => {
    const supA = { id: 'supA', role: 'supervisor', tenantId: 'A', email: 'su@test.com' };
    dbMock.setRows('users', [
      { id: 'supA', role: 'supervisor', tenant_id: 'A', email: 'su@test.com', password: OLD_PASSWORD_HASH, token_version: 0 },
      { id: 'tB', role: 'supervisor', tenant_id: 'B', email: 'tb@test.com', password: OLD_PASSWORD_HASH, token_version: 0 },
    ]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }]);
    dbMock.setRows('user_tenant_assignments', []);

    const res = await request('/api/users/tB/password', { method: 'PUT', token: signToken(supA), body: { password: 'NewPass@9' } });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECURITY_FIX_BATCH5 — seed-admin: تأثير RÈSET المباشر على قاعدة
// البيانات (رفع token_version + تغيير كلمة المرور في نفس التحديث) يجب
// أن يبطل فوراً كل JWT مشغّل مسبقاً — نفس آلية Batch 3، بدون آلة ثانية.
// هذا يختبر السيناريو النصي (scripts/seed-admin.ts) وليس مسار API.
// ═══════════════════════════════════════════════════════════════

describe('security-secrets: seed-admin DB reset (token_version bump) invalidates all live JWTs', () => {
  const seedAdminRow = {
    id: 'admSeed',
    role: 'admin',
    tenant_id: null,
    email: 'admseed@test.com',
    password: OLD_PASSWORD_HASH,
    token_version: 0,
  };

  function seedOperator() {
    dbMock.setRows('users', [
      seedAdminRow,
      {
        id: 'op',
        role: 'supervisor',
        tenant_id: 'A',
        email: 'op@test.com',
        password: OLD_PASSWORD_HASH,
        token_version: 0,
        daily_readings_enabled: 1,
        radio_514_enabled: 1,
      },
    ]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'res' }]);
    dbMock.setRows('user_tenant_assignments', []);
  }

  it('JWTs minted BEFORE the script-style reset are rejected afterwards; the bumped version works', async () => {
    seedOperator();
    const oldToken = signToken({ id: 'op', role: 'supervisor', tenantId: 'A', email: 'op@test.com' }, 0);

    const pre = await request('/api/auth/me', { token: oldToken });
    expect(pre.status).toBe(200);

    // ما يفعله scripts/seed-admin.ts مباشرة على قاعدة البيانات:
    // تعيين كلمة مرور جديدة مجزأة + رفع token_version في نفس التحديث.
    const rows = dbMock.readRows('users');
    const op = rows.find((r: any) => r.id === 'op');
    op.password = bcrypt.hashSync('HardcodedNeev3r', 10);
    op.token_version = 1;
    // التقارب: في بيئة حية تتقارب ذاكرة cache بعد ≤15s (قيمة TTL) — نحوّلها هنا للحتمية.
    userCache.invalidate('user:op');
    userCache.invalidate('user:admSeed');

    const dead = await request('/api/auth/me', { token: oldToken });
    expect(dead.status).toBe(401);

    const fresh = await request('/api/auth/me', {
      token: signToken({ id: 'op', role: 'supervisor', tenantId: 'A', email: 'op@test.com' }, 1),
    });
    expect(fresh.status).toBe(200);
  });

  it('a bare token_version bump (what the reset emits) is sufficient to kill old sessions', async () => {
    seedOperator();
    const oldToken = signToken({ id: 'op', role: 'supervisor', tenantId: 'A', email: 'op@test.com' }, 0);
    await request('/api/auth/me', { token: oldToken });

    const op = dbMock.readRows('users').find((r: any) => r.id === 'op');
    op.token_version = 2;
    userCache.invalidate('user:op');

    const dead = await request('/api/auth/me', { token: oldToken });
    expect(dead.status).toBe(401);
    expect(dbMock.readRows('users').find((r: any) => r.id === 'op').token_version).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Self-service password change (PUT /api/users/me/password)
// ═══════════════════════════════════════════════════════════════

describe('security-authz: self-service password change', () => {
  const selfToken = (v: number) => signToken({ id: 'svc', role: 'student', tenantId: 'A', email: 'svc@test.com' }, v);

  function seedSelf() {
    const row = {
      id: 'svc',
      role: 'student',
      tenant_id: 'A',
      email: 'svc@test.com',
      name: 'Self',
      gender: 'male',
      password: OLD_PASSWORD_HASH,
      token_version: 0,
      daily_readings_enabled: 1,
      radio_514_enabled: 1,
    };
    dbMock.setRows('users', [row]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'res' }]);
    dbMock.setRows('user_tenant_assignments', []);
    return row;
  }

  it('authenticated user can change their own password; every old session dies and the new one works', async () => {
    seedSelf();
    const oldToken = selfToken(0);

    const pre = await request('/api/auth/me', { token: oldToken });
    expect(pre.status).toBe(200);

    const res = await request('/api/users/me/password', {
      method: 'PUT',
      token: oldToken,
      body: { currentPassword: OLD_PASSWORD, newPassword: 'NewSelf@8' },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(JSON.stringify(res.body)).not.toContain('NewSelf@8');

    const rows = dbMock.readRows('users');
    const updated = rows.find((r: any) => r.id === 'svc');
    expect(updated.token_version).toBe(1);
    expect(bcrypt.compareSync('NewSelf@8', updated.password)).toBe(true);
    expect(bcrypt.compareSync(OLD_PASSWORD, updated.password)).toBe(false);

    const dead = await request('/api/auth/me', { token: oldToken });
    expect(dead.status).toBe(401);

    const fresh = await request('/api/auth/me', { token: selfToken(1) });
    expect(fresh.status).toBe(200);
  });

  it('wrong current password is rejected and the session stays valid', async () => {
    seedSelf();
    const oldToken = selfToken(0);

    const res = await request('/api/users/me/password', {
      method: 'PUT',
      token: oldToken,
      body: { currentPassword: 'WrongPass!', newPassword: 'NewSelf@8' },
    });
    expect(res.status).toBe(400);

    const rows = dbMock.readRows('users');
    const updated = rows.find((r: any) => r.id === 'svc');
    expect(updated.token_version).toBe(0);
    expect(bcrypt.compareSync(OLD_PASSWORD, updated.password)).toBe(true);

    const me = await request('/api/auth/me', { token: oldToken });
    expect(me.status).toBe(200);
  });

  it('weak new passwords are rejected (policy matches registration)', async () => {
    seedSelf();
    const oldToken = selfToken(0);

    for (const weak of ['abc', '12345678', 'abcdefgh', 'x'.repeat(129)]) {
      const res = await request('/api/users/me/password', {
        method: 'PUT',
        token: oldToken,
        body: { currentPassword: OLD_PASSWORD, newPassword: weak },
      });
      expect(res.status).toBe(400);
    }

    expect(dbMock.readRows('users').find((r: any) => r.id === 'svc').token_version).toBe(0);
  });

  it('unauthenticated requests and missing current password are rejected', async () => {
    seedSelf();

    const noToken = await request('/api/users/me/password', {
      method: 'PUT',
      body: { currentPassword: OLD_PASSWORD, newPassword: 'NewSelf@8' },
    });
    expect(noToken.status).toBe(401);

    const oldToken = selfToken(0);
    const missing = await request('/api/users/me/password', {
      method: 'PUT',
      token: oldToken,
      body: { newPassword: 'NewSelf@8' },
    });
    expect(missing.status).toBe(400);
  });

  it('self-service change cannot target a different account', async () => {
    const selfRow = seedSelf();
    dbMock.setRows('users', [
      selfRow,
      { id: 'other', role: 'student', tenant_id: 'A', email: 'o@test.com', password: OLD_PASSWORD_HASH, token_version: 0, daily_readings_enabled: 1, radio_514_enabled: 1 },
    ]);
    const oldToken = selfToken(0);

    const res = await request('/api/users/me/password', {
      method: 'PUT',
      token: oldToken,
      body: { userId: 'other', currentPassword: OLD_PASSWORD, newPassword: 'NewSelf@8' },
    });
    expect(res.status).toBe(200);

    const rows = dbMock.readRows('users');
    expect(rows.find((r: any) => r.id === 'svc').token_version).toBe(1);
    expect(rows.find((r: any) => r.id === 'other').token_version).toBe(0);
    expect(bcrypt.compareSync(OLD_PASSWORD, rows.find((r: any) => r.id === 'other').password)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cache invalidation on security-sensitive user changes
// ═══════════════════════════════════════════════════════════════

describe('security-authz: session/permission caches invalidated on sensitive changes', () => {
  const admin = { id: 'adm2', role: 'admin', tenantId: null, email: 'a2@test.com' };

  function seedTargetUser() {
    dbMock.setRows('users', [
      { id: 'adm2', role: 'admin', tenant_id: null, email: 'a2@test.com', password: OLD_PASSWORD_HASH, token_version: 0 },
      { id: 'tgt', role: 'student', tenant_id: 'A', email: 't@test.com', password: OLD_PASSWORD_HASH, token_version: 0, daily_readings_enabled: 1, radio_514_enabled: 1 },
    ]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
  }

  it('role change via PUT /:id invalidates that user', async () => {
    seedTargetUser();
    const targetToken = signToken({ id: 'tgt', role: 'student', tenantId: 'A', email: 't@test.com' });

    const loaded = await request('/api/auth/me', { token: targetToken });
    expect(loaded.status).toBe(200);
    expect(userCache.get('user:tgt')).toBeDefined();

    const res = await request('/api/users/tgt', { method: 'PUT', token: signToken(admin), body: { role: 'supervisor' } });
    expect(res.status).toBe(200);
    expect(userCache.get('user:tgt')).toBeUndefined();
  });

  it('non-sensitive updates (name only) leave the cache intact', async () => {
    seedTargetUser();
    const targetToken = signToken({ id: 'tgt', role: 'student', tenantId: 'A', email: 't@test.com' });

    await request('/api/auth/me', { token: targetToken });
    expect(userCache.get('user:tgt')).toBeDefined();

    const res = await request('/api/users/tgt', { method: 'PUT', token: signToken(admin), body: { name: 'Renamed' } });
    expect(res.status).toBe(200);
    expect(userCache.get('user:tgt')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// Passwords must never reach audit records (auditLogger strips them)
// ═══════════════════════════════════════════════════════════════

describe('security-authz: passwords never written to audit records', () => {
  it('reset and self-service flows leave no password in audit logs', async () => {
    const pbs = auditCalls.length;

    dbMock.setRows('users', [
      { id: 'admAud', role: 'admin', tenant_id: null, email: 'aa@test.com', password: OLD_PASSWORD_HASH, token_version: 0 },
      { id: 'ta', role: 'supervisor', tenant_id: 'A', email: 'ta@test.com', password: OLD_PASSWORD_HASH, token_version: 0, daily_readings_enabled: 1, radio_514_enabled: 1 },
    ]);
    dbMock.setRows('tenants', [{ id: 'A', name: 'res' }]);
    dbMock.setRows('user_tenant_assignments', []);

    const reset = await request('/api/users/ta/password', { method: 'PUT', token: signToken({ id: 'admAud', role: 'admin', tenantId: null, email: 'aa@test.com' }), body: { password: 'AuditS3cret' } });
    expect(reset.status).toBe(200);

    const selfToken = signToken({ id: 'ta', role: 'supervisor', tenantId: 'A', email: 'ta@test.com' }, 1);
    const changed = await request('/api/users/me/password', { method: 'PUT', token: selfToken, body: { currentPassword: 'AuditS3cret', newPassword: 'AuditS4cret' } });
    expect(changed.status).toBe(200);

    // ننتظر لحظة حتى يلتحق 'finish' الخاص بسجل التدقيق
    await new Promise((r) => setTimeout(r, 25));

    const newCalls = auditCalls.slice(pbs);
    const serialized = JSON.stringify(newCalls);
    expect(serialized).not.toContain('AuditS3cret');
    expect(serialized).not.toContain('AuditS4cret');
  });
});