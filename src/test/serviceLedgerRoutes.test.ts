import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { userCache, tenantCache, permissionCache } from '../backend/infrastructure/cache';

// ══════════════════════════════════════════════════════════════════
// Restaurant / canteen daily-journal routes (دفتر اليومية).
//
// Real routers + real authenticate/validate/canOperate middleware, minted
// JWTs, in-process HTTP. The ledger read/write helpers are mocked so we can
// assert the exact scope (tenantIds + ledgerKind) each request hands to the
// service, while the DB is an in-memory mock so the DELETE scope guard runs
// against seeded journal rows. This proves the two service books are read,
// written and deleted independently of the housing book.
// ══════════════════════════════════════════════════════════════════

const h = vi.hoisted(() => {
  class LedgerError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; this.name = 'LedgerError'; }
  }
  const mocks = {
    postEntry: vi.fn(async (..._args: any[]): Promise<any> => ({ id: 'led-1', amount: 0 })),
    reverseEntry: vi.fn(async (..._args: any[]): Promise<any> => ({ id: 'rev-1' })),
    getLedgerMovements: vi.fn(async (..._args: any[]): Promise<any[]> => []),
    countLedgerMovements: vi.fn(async (..._args: any[]): Promise<number> => 0),
    getLedgerClassTotals: vi.fn(async (..._args: any[]): Promise<any> => ({ income: 0, expense: 0, penalty: 0, discount: 0, reversal: 0, transactionCount: 0 })),
  };
  return { mocks, LedgerError };
});

type Op = { m: string; a: any[] };

function getKey(row: any, col: string): any {
  if (row == null || typeof row !== 'object') return undefined;
  if (col in row) return row[col];
  const last = col.split('.').pop();
  if (last && last in row) return row[last];
  return undefined;
}

function matchesWhere(row: any, args: any[]): boolean {
  if (typeof args[0] === 'object' && args[0] !== null) {
    return Object.entries(args[0]).every(([col, val]) => getKey(row, col) === val);
  }
  return getKey(row, String(args[0])) === args[1];
}

const FILTER_OPS = new Set(['where', 'whereIn', 'whereNull', 'whereNotNull', 'orWhere', 'orWhereIn', 'orWhereNull']);

function createKdbMock() {
  const rowsStore: Record<string, any[]> = {};
  const makeBuilder = (rec: { table: string; ops: Op[] }): any => {
    const proxy: any = new Proxy({ __rec: rec }, {
      get(_t, prop) {
        const resolve = (onF: any, onR: any) => {
          const table = rec.table.replace(/\s+as\s+\w+$/i, '').trim();
          const base = rowsStore[table] ?? [];
          const out = base.filter((row) => rec.ops.filter((o) => FILTER_OPS.has(o.m)).every((o) => matchesWhere(row, o.a)));
          const terminal = [...rec.ops].reverse().find((o) => !FILTER_OPS.has(o.m));
          let value: any = out;
          if (terminal) {
            if (terminal.m === 'count') value = [{ count: out.length }];
            else if (terminal.m === 'first') value = out.length ? { ...out[0] } : undefined;
            else if (terminal.m === 'del') { rowsStore[table] = base.filter((r) => !out.includes(r)); value = []; }
            else if (terminal.m === 'insert') { const rows = Array.isArray(terminal.a[0]) ? terminal.a[0] : [terminal.a[0]]; rowsStore[table] = base; rowsStore[table].push(...rows); value = []; }
          }
          return Promise.resolve(value).then(onF, onR);
        };
        if (prop === 'then') return resolve;
        if (prop === 'catch') return (onR: any) => resolve(undefined, onR);
        if (prop === 'finally') return (onFin: any) => resolve(undefined, undefined).finally(onFin);
        return (...args: any[]) => { rec.ops.push({ m: String(prop), a: args }); return proxy; };
      },
    });
    return proxy;
  };

  const kdb: any = vi.fn((table: string) => makeBuilder({ table, ops: [] }));
  kdb.transaction = (fn: (trx: any) => Promise<any>) => fn((table: string) => makeBuilder({ table, ops: [] }));
  kdb.raw = (...args: any[]) => ({ __raw: args });
  kdb.fn = { now: () => new Date().toISOString() };

  return {
    kdb,
    setRows(table: string, rows: any[]) { rowsStore[table] = rows; },
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
vi.mock('../backend/services/ledger.service', () => ({
  postEntry: (...a: any[]) => h.mocks.postEntry(...a),
  reverseEntry: (...a: any[]) => h.mocks.reverseEntry(...a),
  getLedgerMovements: (...a: any[]) => h.mocks.getLedgerMovements(...a),
  countLedgerMovements: (...a: any[]) => h.mocks.countLedgerMovements(...a),
  getLedgerClassTotals: (...a: any[]) => h.mocks.getLedgerClassTotals(...a),
  restaurantRevenueLines: (amount: number) => [
    { account: 'CASH', debit: amount, credit: 0 },
    { account: 'RESTAURANT_REVENUE', debit: 0, credit: amount },
  ],
  canteenRevenueLines: (amount: number) => [
    { account: 'CASH', debit: amount, credit: 0 },
    { account: 'CANTEEN_REVENUE', debit: 0, credit: amount },
  ],
  expenseLines: (amount: number) => [
    { account: 'EXPENSE', debit: amount, credit: 0 },
    { account: 'CASH', debit: 0, credit: amount },
  ],
  LedgerError: h.LedgerError,
}));
vi.mock('../backend/api/notifications.routes', () => ({
  createNotification: vi.fn(async () => ({ id: 'n1' })),
  notifyRestaurantOrderPlaced: vi.fn(async () => {}),
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
    { expiresIn: '1h' },
  );
}

async function request(path: string, opts: { method?: string; token?: string; body?: any; headers?: Record<string, string> } = {}): Promise<{ status: number; body: any }> {
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
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

const USERS = {
  supervisor: { id: 'uSup', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' },
  student: { id: 'uStudent', role: 'student', tenantId: 'A', email: 'st@test.com' },
};

const WORLD: Record<string, any[]> = {
  users: [
    { id: 'uSup', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com', token_version: 0 },
    { id: 'uStudent', role: 'student', tenant_id: 'A', email: 'st@test.com', token_version: 0 },
  ],
  tenants: [
    { id: 'A', name: 'Res A', laundry_enabled: 1, restaurant_enabled: 1, canteen_enabled: 1 },
    { id: 'B', name: 'Res B', laundry_enabled: 1, restaurant_enabled: 1, canteen_enabled: 1 },
  ],
  user_tenant_assignments: [],
  token_blacklist: [],
  journal_entries: [],
};

let invalidateServiceCache: (id: string) => void = () => {};

function seedWorld() {
  dbMock.reset();
  for (const [table, rows] of Object.entries(WORLD)) dbMock.setRows(table, rows.map((r) => ({ ...r })));
  userCache.clear();
  tenantCache.clear();
  permissionCache.clear();
  invalidateServiceCache('A');
  invalidateServiceCache('B');
  for (const fn of Object.values(h.mocks)) (fn as any).mockClear();
  h.mocks.getLedgerMovements.mockResolvedValue([]);
  h.mocks.countLedgerMovements.mockResolvedValue(0);
  h.mocks.getLedgerClassTotals.mockResolvedValue({ income: 0, expense: 0, penalty: 0, discount: 0, reversal: 0, transactionCount: 0 });
  h.mocks.postEntry.mockResolvedValue({ id: 'led-1', amount: 0 });
}

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const { invalidateServiceCache: invalidate } = await import('../backend/infrastructure/service-features');
  invalidateServiceCache = invalidate;
  const app = express();
  app.use(express.json());
  const { default: restaurantRouter } = await import('../backend/api/restaurant.routes');
  const { default: canteenRouter } = await import('../backend/api/canteen.routes');
  app.use('/api/restaurant', restaurantRouter);
  app.use('/api/canteen', canteenRouter);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(seedWorld);

// ─── Reading each book in isolation ───
describe('service ledger — list scoping', () => {
  it('restaurant list only ever asks for the restaurant book', async () => {
    const res = await request('/api/restaurant/ledger', { token: signToken(USERS.supervisor) });
    expect(res.status).toBe(200);
    expect(h.mocks.getLedgerMovements).toHaveBeenCalledTimes(1);
    const scope = h.mocks.getLedgerMovements.mock.calls[0][0];
    expect(scope.ledgerKind).toBe('restaurant');
    expect(scope.tenantIds).toEqual(['A']);
    expect(h.mocks.countLedgerMovements.mock.calls[0][0].ledgerKind).toBe('restaurant');
  });

  it('canteen list only ever asks for the canteen book', async () => {
    const res = await request('/api/canteen/ledger', { token: signToken(USERS.supervisor) });
    expect(res.status).toBe(200);
    const scope = h.mocks.getLedgerMovements.mock.calls[0][0];
    expect(scope.ledgerKind).toBe('canteen');
    expect(scope.tenantIds).toEqual(['A']);
  });

  it('forwards type/category/date/search filters to the service', async () => {
    await request('/api/restaurant/ledger?type=expense&category=صيانة&startDate=2026-01-01&endDate=2026-01-31&search=إصلاح', { token: signToken(USERS.supervisor) });
    const scope = h.mocks.getLedgerMovements.mock.calls[0][0];
    expect(scope.movementType).toBe('expense');
    expect(scope.category).toBe('صيانة');
    expect(scope.startDate).toBe('2026-01-01');
    expect(scope.endDate).toBe('2026-01-31');
    expect(scope.search).toBe('إصلاح');
  });

  it('summary uses the same book and returns income/expense/net', async () => {
    h.mocks.getLedgerClassTotals.mockResolvedValue({ income: 300, expense: 120, penalty: 0, discount: 0, reversal: 0, transactionCount: 4 });
    const res = await request('/api/canteen/ledger/summary', { token: signToken(USERS.supervisor) });
    expect(res.status).toBe(200);
    expect(h.mocks.getLedgerClassTotals.mock.calls[0][0].ledgerKind).toBe('canteen');
    expect(res.body.data).toEqual({ income: 300, expense: 120, net: 180, transactionCount: 4 });
  });

  it('forbids a user who may not operate the service', async () => {
    const { checkUserPermission } = await import('../backend/infrastructure/db');
    (checkUserPermission as any).mockResolvedValueOnce(false);
    const res = await request('/api/restaurant/ledger', { token: signToken(USERS.student) });
    expect(res.status).toBe(403);
    expect(h.mocks.getLedgerMovements).not.toHaveBeenCalled();
  });
});

// ─── Recording into each book ───
describe('service ledger — recording', () => {
  it('posts restaurant income as a payment into the restaurant book', async () => {
    const res = await request('/api/restaurant/ledger', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { type: 'income', category: 'مبيعات', amount: 100 },
    });
    expect(res.status).toBe(201);
    const input = h.mocks.postEntry.mock.calls[0][1];
    expect(input.entryType).toBe('payment');
    expect(input.ledgerKind).toBe('restaurant');
    expect(input.tenantId).toBe('A');
    expect(input.amount).toBe(100);
    expect(input.lines).toEqual([
      { account: 'CASH', debit: 100, credit: 0 },
      { account: 'RESTAURANT_REVENUE', debit: 0, credit: 100 },
    ]);
  });

  it('posts canteen expense into the canteen book with expense lines', async () => {
    const res = await request('/api/canteen/ledger', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { type: 'expense', category: 'مشتريات', amount: 55 },
    });
    expect(res.status).toBe(201);
    const input = h.mocks.postEntry.mock.calls[0][1];
    expect(input.entryType).toBe('expense');
    expect(input.ledgerKind).toBe('canteen');
    expect(input.lines).toEqual([
      { account: 'EXPENSE', debit: 55, credit: 0 },
      { account: 'CASH', debit: 0, credit: 55 },
    ]);
  });

  it('rejects an unknown movement type', async () => {
    const res = await request('/api/restaurant/ledger', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { type: 'bogus', category: 'مبيعات', amount: 10 },
    });
    expect(res.status).toBe(400);
    expect(h.mocks.postEntry).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount', async () => {
    const res = await request('/api/restaurant/ledger', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { type: 'income', category: 'مبيعات', amount: 0 },
    });
    expect(res.status).toBe(400);
    expect(h.mocks.postEntry).not.toHaveBeenCalled();
  });
});

// ─── Deleting = reversing, scoped to the right book + tenant ───
describe('service ledger — delete scope', () => {
  const entry = (over: any) => ({ id: 'e1', tenant_id: 'A', ledger_kind: 'restaurant', entry_type: 'payment', status: 'posted', amount: 10, ...over });

  it('reverses a restaurant entry in the same tenant', async () => {
    dbMock.setRows('journal_entries', [entry({})]);
    const res = await request('/api/restaurant/ledger/e1', { method: 'DELETE', token: signToken(USERS.supervisor) });
    expect(res.status).toBe(200);
    expect(h.mocks.reverseEntry).toHaveBeenCalledTimes(1);
  });

  it('refuses to delete a housing-book entry through the restaurant route', async () => {
    dbMock.setRows('journal_entries', [entry({ id: 'eDorm', ledger_kind: 'dorm' })]);
    const res = await request('/api/restaurant/ledger/eDorm', { method: 'DELETE', token: signToken(USERS.supervisor) });
    expect(res.status).toBe(404);
    expect(h.mocks.reverseEntry).not.toHaveBeenCalled();
  });

  it('refuses to delete a canteen entry through the restaurant route', async () => {
    dbMock.setRows('journal_entries', [entry({ id: 'eCant', ledger_kind: 'canteen' })]);
    const res = await request('/api/restaurant/ledger/eCant', { method: 'DELETE', token: signToken(USERS.supervisor) });
    expect(res.status).toBe(404);
    expect(h.mocks.reverseEntry).not.toHaveBeenCalled();
  });

  it('refuses cross-tenant deletes', async () => {
    dbMock.setRows('journal_entries', [entry({ id: 'eB', tenant_id: 'B' })]);
    const res = await request('/api/restaurant/ledger/eB', { method: 'DELETE', token: signToken(USERS.supervisor) });
    expect(res.status).toBe(404);
    expect(h.mocks.reverseEntry).not.toHaveBeenCalled();
  });

  it('refuses to delete a reversal entry', async () => {
    dbMock.setRows('journal_entries', [entry({ id: 'eRev', entry_type: 'reversal' })]);
    const res = await request('/api/restaurant/ledger/eRev', { method: 'DELETE', token: signToken(USERS.supervisor) });
    expect(res.status).toBe(409);
    expect(h.mocks.reverseEntry).not.toHaveBeenCalled();
  });
});
