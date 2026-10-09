import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { userCache, tenantCache, permissionCache } from '../backend/infrastructure/cache';

// ══════════════════════════════════════════════════════════════════
// Ledger isolation across real roles — parent / admin / bishop.
//
// Real routers + real authenticate/authorize middleware, minted JWTs,
// in-process HTTP. The DB is an in-memory mock, but unlike the shared
// security-authz harness it understands the OR/whereNull predicate style
// that applyLedgerScope() and visibilityFilter() build, so the
// is_admin_only isolation is actually evaluated against seeded rows.
//
// The scenarios:
//   • parent  GET /api/parent/child/:id/report  → getLedgerMovements({studentId, isAdmin:false})
//   • bishop  GET /api/finance                  → tenantId / tenantIds scope
//   • admin   GET /api/finance                  → isAdmin-only scope
//   • zero-scope user                          → nothing at all
// ══════════════════════════════════════════════════════════════════

type Op = { m: string; a: any[] };

// ── row / predicate engine (AND-groups joined by OR) ──

function getKey(row: any, col: string): any {
  if (row == null || typeof row !== 'object') return undefined;
  if (col in row) return row[col];
  const last = col.split('.').pop();
  if (last && last in row) return row[last];
  return undefined;
}

function matchesWhere(row: any, args: any[]): boolean {
  if (args.length >= 2 && typeof args[1] === 'string' && ['like', '=', '>', '<', '>=', '<='].includes(args[1])) {
    const op = args[1];
    const val = args[2];
    const actual = getKey(row, args[0]);
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

const FILTER_OPS = new Set(['where', 'whereIn', 'whereNull', 'whereNotNull', 'whereRaw', 'orWhere', 'orWhereIn', 'orWhereNull', 'orWhereRaw']);

function predicatesFor(rec: { ops: Op[] }, makeBuilder: (r: { table: string; ops: Op[] }) => any): ((row: any) => boolean)[] {
  const groups: ((row: any) => boolean)[][] = [[]];
  for (const { m, a } of rec.ops) {
    if (!FILTER_OPS.has(m)) continue;
    if (m.startsWith('or')) {
      groups.push([]);
    }
    const current = groups[groups.length - 1];
    if (m === 'orWhere') {
      if (typeof a[0] === 'function') {
        const child: { table: string; ops: Op[] } = { table: '', ops: [] };
        a[0].call(makeBuilder(child));
        current.push((row: any) => andOr(row, predicatesFor(child, makeBuilder)));
      } else {
        current.push((row: any) => matchesWhere(row, a));
      }
    } else if (m === 'where') {
      if (typeof a[0] === 'function') {
        const child: { table: string; ops: Op[] } = { table: '', ops: [] };
        a[0].call(makeBuilder(child));
        current.push((row: any) => andOr(row, predicatesFor(child, makeBuilder)));
      } else {
        current.push((row: any) => matchesWhere(row, a));
      }
    } else if (m === 'whereIn' || m === 'orWhereIn') {
      current.push((row: any) => a[1].includes(getKey(row, a[0])));
    } else if (m === 'whereNull' || m === 'orWhereNull') {
      current.push((row: any) => { const v = getKey(row, a[0]); return v === null || v === undefined; });
    } else if (m === 'whereNotNull') {
      current.push((row: any) => { const v = getKey(row, a[0]); return v !== null && v !== undefined; });
    } else if (m === 'whereRaw' || m === 'orWhereRaw') {
      // '1 = 0' fail-closed (empty tenantIds). Other raw predicates cannot be
      // evaluated here, but none of the isolation scopes rely on them.
      current.push(() => false);
    }
  }
  return groups.map((g) => (row: any) => g.every((p) => p(row)));
}

function andOr(row: any, groupPreds: ((row: any) => boolean)[]): boolean {
  if (!groupPreds.length) return true;
  return groupPreds.some((p) => p(row));
}

// ── mock kdb ──

function normalizeTable(table: string): string {
  return table.replace(/\s+as\s+\w+$/i, '').trim();
}

function createKdbMock() {
  const rowsStore: Record<string, any[]> = {};
  const makeBuilder = (rec: { table: string; ops: Op[] }): any => {
    const target: any = { __rec: rec };
    const proxy: any = new Proxy(target, {
      get(_t, prop) {
        if (prop === 'then') {
          return (onF: any, onR: any) => {
            const table = normalizeTable(rec.table);
            const base = rowsStore[table] ?? [];
            let out = base.filter((row) => andOr(row, predicatesFor(rec, makeBuilder)));
            // terminal command = last non-filter op
            const terminal = [...rec.ops].reverse().find((o) => !FILTER_OPS.has(o.m));
            let value: any = out;
            if (terminal) {
              if (terminal.m === 'count') {
                value = [{ count: out.length }];
              } else if (terminal.m === 'first') {
                value = out.length ? { ...out[0] } : undefined;
              } else if (terminal.m === 'del') {
                rowsStore[table] = rowsStore[table] ?? [];
                rowsStore[table] = rowsStore[table].filter((r) => !out.includes(r));
                value = [];
              } else if (terminal.m === 'insert') {
                const rows = Array.isArray(terminal.a[0]) ? terminal.a[0] : [terminal.a[0]];
                rowsStore[table] = rowsStore[table] ?? [];
                rowsStore[table].push(...rows);
                value = [];
              } else if (terminal.m === 'update' && typeof terminal.a[0] === 'object' && terminal.a[0] !== null) {
                for (const r of out) Object.assign(r, terminal.a[0]);
                value = [];
              }
            }
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

  const kdb: any = vi.fn((table: string) => makeBuilder({ table, ops: [] }));
  kdb.transaction = (fn: (trx: any) => Promise<any>) => fn((table: string) => makeBuilder({ table, ops: [] }));
  // raw() results are only ever passed through .select(...) here, which the
  // engine ignores — so a stub is enough to keep service code from throwing.
  kdb.raw = (...args: any[]) => ({ __raw: args });

  return {
    kdb,
    setRows(table: string, rows: any[]) { rowsStore[normalizeTable(table)] = rows; },
    reset() { for (const k of Object.keys(rowsStore)) rowsStore[k] = []; },
  };
}

const dbMock = createKdbMock();

vi.mock('../backend/infrastructure/db', () => ({
  kdb: dbMock.kdb,
  logAuditEvent: vi.fn(),
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

function signToken(user: { id: string; role: string; tenantId: string | null; email: string }): string {
  return jwt.sign(
    {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      gender: 'male',
      daily_readings_enabled: true,
      radio_514_enabled: true,
      tokenVersion: 0,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );
}

async function request(
  path: string,
  opts: { method?: string; token?: string; body?: any } = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

const WORLD = {
  users: [
    { id: 'uAdmin', role: 'admin', tenant_id: null, email: 'admin@test.com', daily_readings_enabled: 1, radio_514_enabled: 1 },
    { id: 'uBishop', role: 'bishop', tenant_id: 'A', email: 'bishop@test.com', daily_readings_enabled: 1, radio_514_enabled: 1 },
    { id: 'uBishopZero', role: 'bishop', tenant_id: null, email: 'bishopzero@test.com', daily_readings_enabled: 1, radio_514_enabled: 1 },
    { id: 'uSup', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com', daily_readings_enabled: 1, radio_514_enabled: 1 },
    { id: 'uParent', role: 'parent', tenant_id: 'A', email: 'parent@test.com', daily_readings_enabled: 1, radio_514_enabled: 1 },
    { id: 'usA', role: 'student', tenant_id: 'A', email: 'stA@test.com', daily_readings_enabled: 1, radio_514_enabled: 1 },
  ],
  tenants: [
    { id: 'A', name: 'Res A', bishop_id: 'uBishop' },
    { id: 'B', name: 'Res B', bishop_id: 'uBishop' },
  ],
  parents: [{ id: 'p1', user_id: 'uParent', tenant_id: 'A' }],
  students: [
    { id: 'sA', user_id: 'usA', tenant_id: 'A', room_id: 'r1' },
    { id: 'sB', user_id: null, tenant_id: 'B', room_id: 'r2' },
  ],
  student_guardians: [{ student_id: 'sA', guardian_id: 'p1' }],
  rooms: [{ id: 'r1', tenant_id: 'A' }, { id: 'r2', tenant_id: 'B' }],
  // ledger rows: one tenant payment for sA, one ADMIN-ONLY payment for sA
  journal_entries: [
    { id: 'eTenantPay', tenant_id: 'A', student_id: 'sA', is_admin_only: 0, entry_type: 'payment', status: 'posted', amount: 500, category: 'سكن', description: 'دفعة عادية', entry_date: '2026-01-05', created_at: '2026-01-05T10:00:00Z' },
    { id: 'eAdminPay', tenant_id: null, student_id: 'sA', is_admin_only: 1, entry_type: 'payment', status: 'posted', amount: 777, category: 'سكن', description: 'دفعة إدارية', entry_date: '2026-01-06', created_at: '2026-01-06T10:00:00Z' },
    { id: 'eTenantExpense', tenant_id: 'A', student_id: null, is_admin_only: 0, entry_type: 'expense', status: 'posted', amount: 100, category: 'صيانة', description: 'إصلاح', entry_date: '2026-01-07', created_at: '2026-01-07T10:00:00Z' },
    { id: 'eAdminExpense', tenant_id: null, student_id: null, is_admin_only: 1, entry_type: 'expense', status: 'posted', amount: 999, category: 'أخرى', description: 'مصروف إداري', entry_date: '2026-01-08', created_at: '2026-01-08T10:00:00Z' },
  ],
  journal_lines: [
    { id: 'lTenantPay1', entry_id: 'eTenantPay', line_no: 1, account: 'CASH', debit: 500, credit: 0, student_id: 'sA' },
    { id: 'lTenantPay2', entry_id: 'eTenantPay', line_no: 2, account: 'STUDENT_PAYMENT', debit: 0, credit: 500, student_id: 'sA' },
    { id: 'lAdminPay1', entry_id: 'eAdminPay', line_no: 1, account: 'CASH', debit: 777, credit: 0, student_id: 'sA' },
    { id: 'lAdminPay2', entry_id: 'eAdminPay', line_no: 2, account: 'ROOM_REVENUE', debit: 0, credit: 777, student_id: 'sA' },
    { id: 'lTenantExp1', entry_id: 'eTenantExpense', line_no: 1, account: 'EXPENSE', debit: 100, credit: 0, student_id: null },
    { id: 'lTenantExp2', entry_id: 'eTenantExpense', line_no: 2, account: 'CASH', debit: 0, credit: 100, student_id: null },
    { id: 'lAdminExp1', entry_id: 'eAdminExpense', line_no: 1, account: 'EXPENSE', debit: 999, credit: 0, student_id: null },
    { id: 'lAdminExp2', entry_id: 'eAdminExpense', line_no: 2, account: 'CASH', debit: 0, credit: 999, student_id: null },
  ],
  user_tenant_assignments: [{ user_id: 'uBishop', tenant_id: 'A' }, { user_id: 'uBishop', tenant_id: 'B' }],
};

function seedWorld() {
  dbMock.reset();
  for (const [table, rows] of Object.entries(WORLD)) dbMock.setRows(table, rows as any[]);
  userCache.clear();
  tenantCache.clear();
  permissionCache.clear();
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());

  const { default: parentRouter } = await import('../backend/api/parent.routes');
  const { default: financeRouter } = await import('../backend/api/finance.routes');

  app.use('/api/parent', parentRouter);
  app.use('/api/finance', financeRouter);

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(seedWorld);

// ── parent: must NEVER see the admin-only payment ──
describe('ledger isolation — parent role', () => {
  it('child report exposes tenant payments but hides is_admin_only rows', async () => {
    const res = await request('/api/parent/child/sA/report', { token: signToken({ id: 'uParent', role: 'parent', tenantId: 'A', email: 'parent@test.com' }) });
    expect(res.status).toBe(200);
    const finance = res.body?.data?.finance as any[];
    expect(Array.isArray(finance)).toBe(true);
    const amounts = finance.map((m: any) => m.amount);
    expect(amounts).toContain(500); // tenant payment visible
    expect(amounts).not.toContain(777); // admin-only payment must not leak
  });

  it('student card-style read via tenant visibility keeps admin-only penalties out', async () => {
    // bypasses HTTP to check visibilityFilter directly: getStudentLedgerEntries(.., tenant)
    const { getStudentLedgerEntries } = await import('../backend/services/ledger.service');
    const entries = await getStudentLedgerEntries('sA', { visibility: 'tenant' });
    const adminHits = entries.filter((e: any) => e.is_admin_only === 1);
    expect(adminHits).toHaveLength(0);
    const ids = entries.map((e: any) => e.id);
    expect(ids).toContain('eTenantPay');
  });
});

// ── bishop: sees managed tenants' books, never admin books ──
describe('ledger isolation — bishop role', () => {
  it('finance list for a managed residence contains tenant rows only', async () => {
    const res = await request('/api/finance', { token: signToken({ id: 'uBishop', role: 'bishop', tenantId: 'A', email: 'bishop@test.com' }) });
    expect(res.status).toBe(200);
    const data = res.body?.data as any[];
    expect(Array.isArray(data)).toBe(true);
    const amounts = data.map((m: any) => Number(m.amount));
    // tenant payment (500) and tenant expense (100) visible; admin rows absent
    expect(amounts).toContain(500);
    expect(amounts).toContain(100);
    expect(amounts).not.toContain(777);
    expect(amounts).not.toContain(999);
  });

  it('bishop with a null primary tenant still scopes to assigned tenants (A+B), no admin rows', async () => {
    // simulate bishop whose PRIMARY tenant is null but assignments exist
    dbMock.setRows('users', WORLD.users.map((u) => (u.id === 'uBishop' ? { ...u, tenant_id: null } : u)));
    const res = await request('/api/finance', { token: signToken({ id: 'uBishop', role: 'bishop', tenantId: null, email: 'bishop@test.com' }) });
    expect(res.status).toBe(200);
    const data = res.body?.data as any[];
    const amounts = data.map((m: any) => Number(m.amount));
    expect(amounts).toContain(500);
    expect(amounts).not.toContain(777);
    expect(amounts).not.toContain(999);
  });

  it('bishop with ZERO managed tenants sees an empty list, not the global books', async () => {
    const res = await request('/api/finance', { token: signToken({ id: 'uBishopZero', role: 'bishop', tenantId: null, email: 'bishopzero@test.com' }) });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

// ── admin: restricted to admin-only books ──
describe('ledger isolation — admin role', () => {
  it('admin reads only the admin ledger (is_admin_only = 1)', async () => {
    const res = await request('/api/finance', { token: signToken({ id: 'uAdmin', role: 'admin', tenantId: null, email: 'admin@test.com' }) });
    expect(res.status).toBe(200);
    const data = res.body?.data as any[];
    const amounts = data.map((m: any) => Number(m.amount));
    expect(amounts).toContain(777);
    expect(amounts).toContain(999);
    expect(amounts).not.toContain(500);
    expect(amounts).not.toContain(100);
  });

  it('admin summary route returns the revenue/expense shape', async () => {
    const res = await request('/api/finance/summary', { token: signToken({ id: 'uAdmin', role: 'admin', tenantId: null, email: 'admin@test.com' }) });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });
});

// ── supervisor: cross-tenant hard boundary ──
describe('ledger isolation — supervisor role', () => {
  it('supervisor of A never sees B rows through the list', async () => {
    dbMock.setRows('journal_entries', [
      ...WORLD.journal_entries,
      { id: 'eBPay', tenant_id: 'B', student_id: 'sB', is_admin_only: 0, entry_type: 'payment', status: 'posted', amount: 1234, category: 'سكن', description: 'دفعة B', entry_date: '2026-01-09', created_at: '2026-01-09T10:00:00Z' },
    ]);
    const res = await request('/api/finance', { token: signToken({ id: 'uSup', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' }) });
    expect(res.status).toBe(200);
    const amounts = (res.body?.data as any[]).map((m: any) => Number(m.amount));
    expect(amounts).not.toContain(1234);
    expect(amounts).not.toContain(777);
    expect(amounts).toContain(500);
  });
});

// ── record-level scope guard (PUT/DELETE probe) is fail-closed ──
describe('ledger isolation — record probe', () => {
  it('non-admin cannot PUT/DELETE an admin-only entry', async () => {
    const res = await request('/api/finance/eAdminPay', { method: 'PUT', token: signToken({ id: 'uSup', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' }), body: { description: 'hijack' } });
    expect(res.status).toBe(404);
    const del = await request('/api/finance/eAdminPay', { method: 'DELETE', token: signToken({ id: 'uSup', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' }) });
    expect(del.status).toBe(404);
  });

  it('admin can PUT/DELETE their own admin-only entry', async () => {
    const put = await request('/api/finance/eAdminPay', { method: 'PUT', token: signToken({ id: 'uAdmin', role: 'admin', tenantId: null, email: 'admin@test.com' }), body: { description: 'edit' } });
    expect(put.status).toBe(200);
    // PUT reverses the original entry, so DELETE targets a different untouched
    // admin-only entry to prove admin can destroy admin-ledger rows too.
    const del = await request('/api/finance/eAdminExpense', { method: 'DELETE', token: signToken({ id: 'uAdmin', role: 'admin', tenantId: null, email: 'admin@test.com' }) });
    expect(del.status).toBe(200);
  });
});