import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { userCache, tenantCache, permissionCache } from '../backend/infrastructure/cache';

let invalidateServiceCache: (id: string) => void = () => { };

// ══════════════════════════════════════════════════════════════════
// Restaurant / canteen / per-tenant service toggles.
//
// Real routers + real authenticate/authorize/validate middleware, minted
// JWTs, in-process HTTP. The DB is an in-memory mock (row/predicate engine)
// so tenant isolation, stock math and ledger posting are actually evaluated.
// The ledger service is mocked so we can assert the exact postEntry /
// reverseEntry calls without standing up the journal tables.
// ══════════════════════════════════════════════════════════════════

type Op = { m: string; a: any[] };

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
    if (op === '>') return Number(actual) > Number(val);
    if (op === '>=') return Number(actual) >= Number(val);
    if (op === '<') return Number(actual) < Number(val);
    if (op === '<=') return Number(actual) <= Number(val);
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

function andOr(row: any, groupPreds: ((row: any) => boolean)[]): boolean {
  if (!groupPreds.length) return true;
  return groupPreds.some((p) => p(row));
}

function predicatesFor(rec: { ops: Op[] }, makeBuilder: (r: { table: string; ops: Op[] }) => any): ((row: any) => boolean)[] {
  const groups: ((row: any) => boolean)[][] = [[]];
  for (const { m, a } of rec.ops) {
    if (!FILTER_OPS.has(m)) continue;
    if (m.startsWith('or')) groups.push([]);
    const current = groups[groups.length - 1];
    if (m === 'orWhere' || m === 'where') {
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
      current.push(() => false);
    }
  }
  return groups.map((g) => (row: any) => g.every((p) => p(row)));
}

function normalizeTable(table: string): string {
  return table.replace(/\s+as\s+\w+$/i, '').trim();
}

function createKdbMock() {
  const rowsStore: Record<string, any[]> = {};
  const makeBuilder = (rec: { table: string; ops: Op[] }): any => {
    const target: any = { __rec: rec };
    const proxy: any = new Proxy(target, {
      get(_t, prop) {
        const resolve = (onF: any, onR: any) => {
          const table = normalizeTable(rec.table);
          const base = rowsStore[table] ?? [];
          let out = base.filter((row) => andOr(row, predicatesFor(rec, makeBuilder)));
          const terminal = [...rec.ops].reverse().find((o) => !FILTER_OPS.has(o.m));
          let value: any = out;
          if (terminal) {
            if (terminal.m === 'count') {
              value = [{ count: out.length }];
            } else if (terminal.m === 'first') {
              value = out.length ? { ...out[0] } : undefined;
            } else if (terminal.m === 'del') {
              rowsStore[table] = (rowsStore[table] ?? []).filter((r) => !out.includes(r));
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
        if (prop === 'then') return resolve;
        // Real knex builders expose .catch on the (thenable) query; mirror it so
        // wrappers like `kdb('x').where(..).first().catch(() => null)` work.
        if (prop === 'catch') return (onR: any) => resolve(undefined, onR);
        if (prop === 'finally') return (onFin: any) => resolve(undefined, undefined).finally(onFin);
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
  kdb.raw = (...args: any[]) => ({ __raw: args });
  kdb.fn = { now: () => new Date().toISOString() };

  const checkUserPermission = vi.fn(async () => true);
  const postEntry = vi.fn(async (_trx: any, input: any) => ({ id: `led-${postEntry.mock.calls.length}`, amount: input.amount }));
  const reverseEntry = vi.fn(async () => ({ id: 'rev-1' }));
  const createNotification = vi.fn(async () => ({ id: 'n1' }));

  return {
    kdb,
    checkUserPermission,
    postEntry,
    reverseEntry,
    createNotification,
    setRows(table: string, rows: any[]) { rowsStore[normalizeTable(table)] = rows; },
    getRows(table: string): any[] { return rowsStore[normalizeTable(table)] ?? []; },
    reset() { for (const k of Object.keys(rowsStore)) rowsStore[k] = []; },
  };
}

const dbMock = createKdbMock();

vi.mock('../backend/infrastructure/db', () => ({
  kdb: dbMock.kdb,
  logAuditEvent: vi.fn(),
  hasPermission: vi.fn(async () => true),
  checkUserPermission: (...args: any[]) => (dbMock.checkUserPermission as any)(...args),
}));
vi.mock('../backend/infrastructure/knex', () => ({
  kdb: dbMock.kdb,
  poolPromise: Promise.resolve(null),
  getDBClient: () => 'mssql',
  dateFormatColumn: (col: string) => col,
}));
vi.mock('../backend/services/ledger.service', () => ({
  postEntry: (...args: any[]) => (dbMock.postEntry as any)(...args),
  reverseEntry: (...args: any[]) => (dbMock.reverseEntry as any)(...args),
  restaurantRevenueLines: (amount: number) => [
    { account: 'CASH', debit: amount, credit: 0 },
    { account: 'RESTAURANT_REVENUE', debit: 0, credit: amount },
  ],
  canteenRevenueLines: (amount: number) => [
    { account: 'CASH', debit: amount, credit: 0 },
    { account: 'CANTEEN_REVENUE', debit: 0, credit: amount },
  ],
}));
vi.mock('../backend/api/notifications.routes', () => ({
  createNotification: (...args: any[]) => (dbMock.createNotification as any)(...args),
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

async function request(
  path: string,
  opts: { method?: string; token?: string; body?: any; headers?: Record<string, string> } = {},
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
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

const USERS = {
  admin: { id: 'uAdmin', role: 'admin', tenantId: null, email: 'admin@test.com' },
  supervisor: { id: 'uSup', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' },
  student: { id: 'uStudent', role: 'student', tenantId: 'A', email: 'st@test.com' },
  employee: { id: 'uEmp', role: 'employee', tenantId: 'A', email: 'emp@test.com' },
};

const WORLD: Record<string, any[]> = {
  users: [
    { id: 'uAdmin', role: 'admin', tenant_id: null, email: 'admin@test.com', token_version: 0 },
    { id: 'uSup', role: 'supervisor', tenant_id: 'A', email: 'sup@test.com', token_version: 0 },
    { id: 'uStudent', role: 'student', tenant_id: 'A', email: 'st@test.com', token_version: 0 },
    { id: 'uEmp', role: 'employee', tenant_id: 'A', email: 'emp@test.com', token_version: 0 },
  ],
  tenants: [
    { id: 'A', name: 'Res A', bishop_id: null, laundry_enabled: 1, restaurant_enabled: 1, canteen_enabled: 1 },
    { id: 'B', name: 'Res B', bishop_id: null, laundry_enabled: 1, restaurant_enabled: 1, canteen_enabled: 1 },
  ],
  user_tenant_assignments: [],
  token_blacklist: [],
  students: [{ id: 'sA', user_id: 'uStudent', tenant_id: 'A' }],
  restaurant_categories: [{ id: 'c1', tenant_id: 'A', name: 'وجبات', sort_order: 0, is_active: 1 }],
  restaurant_items: [
    { id: 'i1', tenant_id: 'A', name: 'كشري', price: 15, is_available: 1, is_included_meal: 0, category_id: 'c1' },
    { id: 'i2', tenant_id: 'A', name: 'فطار مجاني', price: 50, is_available: 1, is_included_meal: 1, category_id: 'c1' },
  ],
  restaurant_orders: [],
  restaurant_order_items: [],
  restaurant_operators: [],
  canteen_products: [
    { id: 'p1', tenant_id: 'A', name: 'مياه', sell_price: 5, cost_price: 3, quantity_on_hand: 10, is_active: 1, min_quantity: 2 },
  ],
  canteen_sales: [],
  canteen_sale_items: [],
  canteen_stock_movements: [],
  canteen_operators: [],
};

function seedWorld() {
  dbMock.reset();
  for (const [table, rows] of Object.entries(WORLD)) dbMock.setRows(table, rows.map((r) => ({ ...r })));
  userCache.clear();
  tenantCache.clear();
  permissionCache.clear();
  invalidateServiceCache('A');
  invalidateServiceCache('B');
  dbMock.checkUserPermission.mockReset();
  dbMock.checkUserPermission.mockResolvedValue(true);
  dbMock.postEntry.mockClear();
  dbMock.reverseEntry.mockClear();
  dbMock.createNotification.mockClear();
}

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const { invalidateServiceCache: invalidate } = await import('../backend/infrastructure/service-features');
  invalidateServiceCache = invalidate;
  const app = express();
  app.use(express.json());
  const { default: restaurantRouter } = await import('../backend/api/restaurant.routes');
  const { default: canteenRouter } = await import('../backend/api/canteen.routes');
  const { default: tenantRouter } = await import('../backend/api/tenant.routes');
  app.use('/api/restaurant', restaurantRouter);
  app.use('/api/canteen', canteenRouter);
  app.use('/api/tenants', tenantRouter);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(seedWorld);

// ─── Service toggles ───
describe('per-tenant service toggles', () => {
  it('GET /services defaults to all enabled', async () => {
    const res = await request('/api/tenants/services', { token: signToken(USERS.student) });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ laundry_enabled: true, restaurant_enabled: true, canteen_enabled: true });
  });

  it('PATCH /services is rejected for a supervisor even with MANAGE_SETTINGS', async () => {
    dbMock.checkUserPermission.mockResolvedValue(true);
    const res = await request('/api/tenants/services', {
      method: 'PATCH',
      token: signToken(USERS.supervisor),
      body: { restaurant_enabled: false },
    });
    expect(res.status).toBe(403);
  });

  it('a global admin toggles services per tenant via /:id/toggle-services', async () => {
    const res = await request('/api/tenants/A/toggle-services', {
      method: 'PATCH',
      token: signToken(USERS.admin),
      body: { restaurant_enabled: false },
    });
    expect(res.status).toBe(200);
    const after = await request('/api/tenants/services', { token: signToken(USERS.supervisor) });
    expect(after.body.data.restaurant_enabled).toBe(false);
  });

  it('a supervisor cannot toggle services via /:id/toggle-services', async () => {
    const res = await request('/api/tenants/A/toggle-services', {
      method: 'PATCH',
      token: signToken(USERS.supervisor),
      body: { canteen_enabled: false },
    });
    expect(res.status).toBe(403);
  });

  it('PATCH /services with an empty body is rejected', async () => {
    const res = await request('/api/tenants/services', {
      method: 'PATCH',
      token: signToken(USERS.admin),
      body: {},
    });
    expect(res.status).toBe(400);
  });
});

// ─── Disabled-service gating ───
describe('disabled-service gating', () => {
  it('rejects NEW restaurant operations when restaurant is disabled', async () => {
    dbMock.setRows('tenants', [
      { id: 'A', name: 'Res A', bishop_id: null, laundry_enabled: 1, restaurant_enabled: 0, canteen_enabled: 1 },
      { id: 'B', name: 'Res B', bishop_id: null, laundry_enabled: 1, restaurant_enabled: 1, canteen_enabled: 1 },
    ]);
    invalidateServiceCache('A');
    const res = await request('/api/restaurant/items', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { name: 'وجبة جديدة', price: 10 },
    });
    expect(res.status).toBe(403);
    expect(String(res.body.message)).toContain('المطعم');
  });

  it('lets a global admin bypass the disabled gate', async () => {
    dbMock.setRows('tenants', [
      { id: 'A', name: 'Res A', bishop_id: null, laundry_enabled: 1, restaurant_enabled: 0, canteen_enabled: 1 },
    ]);
    invalidateServiceCache('A');
    const res = await request('/api/restaurant/items', {
      method: 'POST',
      token: signToken(USERS.admin),
      headers: { 'X-Tenant-Id': 'A' },
      body: { name: 'وجبة إدارية', price: 10 },
    });
    expect(res.status).toBe(201);
  });

  it('keeps history readable when the service is disabled', async () => {
    dbMock.setRows('tenants', [
      { id: 'A', name: 'Res A', bishop_id: null, laundry_enabled: 1, restaurant_enabled: 0, canteen_enabled: 1 },
    ]);
    invalidateServiceCache('A');
    const res = await request('/api/restaurant/items', { token: signToken(USERS.supervisor) });
    expect(res.status).toBe(200);
    expect(res.body.data.some((i: any) => i.id === 'i1')).toBe(true);
  });

  it('rejects canteen sales when canteen is disabled', async () => {
    dbMock.setRows('tenants', [
      { id: 'A', name: 'Res A', bishop_id: null, laundry_enabled: 1, restaurant_enabled: 1, canteen_enabled: 0 },
    ]);
    invalidateServiceCache('A');
    const res = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'S-DISABLED', items: [{ product_id: 'p1', quantity: 1 }] },
    });
    expect(res.status).toBe(403);
    expect(String(res.body.message)).toContain('الكانتين');
  });
});

// ─── Restaurant orders ───
describe('restaurant orders', () => {
  it('computes the total from paid items and posts revenue on serve', async () => {
    const create = await request('/api/restaurant/orders', {
      method: 'POST',
      token: signToken(USERS.student),
      body: { items: [{ item_id: 'i1', quantity: 2 }] },
    });
    expect(create.status).toBe(201);
    expect(create.body.data.total).toBe(30);

    // advance ready → served as staff
    const orderId = create.body.data.id;
    dbMock.setRows('restaurant_orders', [{ id: orderId, tenant_id: 'A', ordered_by: 'uStudent', student_id: 'sA', status: 'ready', total: 30, ledger_entry_id: null }]);
    const serve = await request(`/api/restaurant/orders/${orderId}/status`, {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { action: 'serve' },
    });
    expect(serve.status).toBe(200);
    expect(serve.body.data.ledger_entry_id).toBeTruthy();
    expect(dbMock.postEntry).toHaveBeenCalledTimes(1);
    expect(dbMock.postEntry.mock.calls[0][1].amount).toBe(30);
    expect(dbMock.postEntry.mock.calls[0][1].reference).toBe(`restaurant-order:${orderId}`);
  });

  it('charges nothing for included meals', async () => {
    const res = await request('/api/restaurant/orders', {
      method: 'POST',
      token: signToken(USERS.student),
      body: { items: [{ item_id: 'i2', quantity: 3 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(0);
  });

  it('rejects an order referencing an item of another tenant', async () => {
    const res = await request('/api/restaurant/orders', {
      method: 'POST',
      token: signToken(USERS.student),
      body: { items: [{ item_id: 'ghost', quantity: 1 }] },
    });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid order payload', async () => {
    const res = await request('/api/restaurant/orders', {
      method: 'POST',
      token: signToken(USERS.student),
      body: { items: [] },
    });
    expect(res.status).toBe(400);
  });

  it('forbids a non-staff user from advancing someone else’s order', async () => {
    dbMock.checkUserPermission.mockResolvedValue(false);
    dbMock.setRows('restaurant_orders', [{ id: 'oX', tenant_id: 'A', ordered_by: 'someoneElse', student_id: null, status: 'pending', total: 10, ledger_entry_id: null }]);
    const res = await request('/api/restaurant/orders/oX/status', {
      method: 'POST',
      token: signToken(USERS.employee),
      body: { action: 'confirm' },
    });
    expect(res.status).toBe(403);
  });
});

// ─── Canteen sales ───
describe('canteen sales', () => {
  it('decrements stock, computes the total and posts revenue', async () => {
    const res = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'S1', items: [{ product_id: 'p1', quantity: 3 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(15);
    const product = dbMock.getRows('canteen_products').find((p) => p.id === 'p1');
    expect(product!.quantity_on_hand).toBe(7);
    expect(dbMock.postEntry).toHaveBeenCalledTimes(1);
    expect(dbMock.postEntry.mock.calls[0][1].lines).toEqual([
      { account: 'CASH', debit: 15, credit: 0 },
      { account: 'CANTEEN_REVENUE', debit: 0, credit: 15 },
    ]);
  });

  it('rejects a sale that would drive stock negative', async () => {
    const res = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'S2', items: [{ product_id: 'p1', quantity: 100 }] },
    });
    expect(res.status).toBe(400);
    expect(dbMock.postEntry).not.toHaveBeenCalled();
  });

  it('rejects a duplicate sale_ref with 409', async () => {
    const first = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'DUP', items: [{ product_id: 'p1', quantity: 1 }] },
    });
    expect(first.status).toBe(201);
    const second = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'DUP', items: [{ product_id: 'p1', quantity: 1 }] },
    });
    expect(second.status).toBe(409);
  });

  it('rejects an unknown product', async () => {
    const res = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'S3', items: [{ product_id: 'ghost', quantity: 1 }] },
    });
    expect(res.status).toBe(400);
  });
});

// ─── Canteen returns ───
describe('canteen returns', () => {
  it('restores stock and reverses the ledger entry on a full return', async () => {
    const sale = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'RET1', items: [{ product_id: 'p1', quantity: 3 }] },
    });
    expect(sale.status).toBe(201);
    const saleId = sale.body.data.id;

    const ret = await request('/api/canteen/returns', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_id: saleId, items: [{ product_id: 'p1', quantity: 3 }], reason: 'منتج تالف' },
    });
    expect(ret.status).toBe(200);
    const product = dbMock.getRows('canteen_products').find((p) => p.id === 'p1');
    expect(product!.quantity_on_hand).toBe(10);
    expect(dbMock.reverseEntry).toHaveBeenCalledTimes(1);
    const savedSale = dbMock.getRows('canteen_sales').find((s) => s.id === saleId);
    expect(savedSale!.status).toBe('returned');
  });

  it('rejects a return quantity larger than what was sold', async () => {
    const sale = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'RET2', items: [{ product_id: 'p1', quantity: 2 }] },
    });
    const saleId = sale.body.data.id;
    const ret = await request('/api/canteen/returns', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_id: saleId, items: [{ product_id: 'p1', quantity: 5 }], reason: 'محاولة زيادة' },
    });
    expect(ret.status).toBe(400);
    expect(dbMock.reverseEntry).not.toHaveBeenCalled();
  });

  it('rejects a return for an unknown sale', async () => {
    const ret = await request('/api/canteen/returns', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_id: 'nope', items: [{ product_id: 'p1', quantity: 1 }], reason: 'خطأ' },
    });
    expect(ret.status).toBe(404);
  });
});

// ─── Operators / assignable users ───
describe('operator assignment', () => {
  it('assignable-users lists tenant members but never a global admin', async () => {
    const res = await request('/api/restaurant/assignable-users', { token: signToken(USERS.supervisor) });
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: any) => u.id);
    expect(ids).toContain('uSup');
    expect(ids).toContain('uStudent');
    expect(ids).not.toContain('uAdmin');
  });

  it('rejects assigning a global admin as an operator', async () => {
    const res = await request('/api/canteen/operators', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { userId: 'uAdmin' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects assigning a user from another tenant', async () => {
    dbMock.setRows('users', [...WORLD.users.map((u) => ({ ...u })), { id: 'uB', role: 'employee', tenant_id: 'B', email: 'b@test.com', token_version: 0 }]);
    const res = await request('/api/restaurant/operators', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { userId: 'uB' },
    });
    expect(res.status).toBe(403);
  });

  it('assigns a valid tenant member as an operator', async () => {
    const res = await request('/api/canteen/operators', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { userId: 'uEmp' },
    });
    expect(res.status).toBe(201);
    expect(dbMock.getRows('canteen_operators')).toHaveLength(1);
  });
});

// ─── Discounts + images ───
describe('restaurant discounts', () => {
  it('stores a discount and image on a new item', async () => {
    const res = await request('/api/restaurant/items', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { name: 'بيتزا', price: 100, image_url: 'https://img/1.png', discount_type: 'percent', discount_value: 20 },
    });
    expect(res.status).toBe(201);
    const item = dbMock.getRows('restaurant_items').find((i) => i.name === 'بيتزا');
    expect(item!.discount_type).toBe('percent');
    expect(item!.discount_value).toBe(20);
    expect(item!.image_url).toBe('https://img/1.png');
  });

  it('applies a percentage discount to the order total and line breakdown', async () => {
    dbMock.setRows('restaurant_items', [
      { id: 'i3', tenant_id: 'A', name: 'مشويات', price: 20, is_available: 1, is_included_meal: 0, discount_type: 'percent', discount_value: 25 },
    ]);
    const res = await request('/api/restaurant/orders', {
      method: 'POST',
      token: signToken(USERS.student),
      body: { items: [{ item_id: 'i3', quantity: 2 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(30);
    const line = dbMock.getRows('restaurant_order_items')[0];
    expect(line.unit_price).toBe(15);
    expect(line.original_unit_price).toBe(20);
    expect(line.discount_amount).toBe(5);
    expect(line.line_total).toBe(30);
  });

  it('applies a fixed-amount discount to the order total', async () => {
    dbMock.setRows('restaurant_items', [
      { id: 'i4', tenant_id: 'A', name: 'عصير', price: 20, is_available: 1, is_included_meal: 0, discount_type: 'amount', discount_value: 5 },
    ]);
    const res = await request('/api/restaurant/orders', {
      method: 'POST',
      token: signToken(USERS.student),
      body: { items: [{ item_id: 'i4', quantity: 3 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(45);
  });

  it('ignores discounts on included meals', async () => {
    dbMock.setRows('restaurant_items', [
      { id: 'i5', tenant_id: 'A', name: 'فطار', price: 50, is_available: 1, is_included_meal: 1, discount_type: 'percent', discount_value: 50 },
    ]);
    const res = await request('/api/restaurant/orders', {
      method: 'POST',
      token: signToken(USERS.student),
      body: { items: [{ item_id: 'i5', quantity: 2 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(0);
  });

  it('rejects an unknown discount type', async () => {
    const res = await request('/api/restaurant/items', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { name: 'وجبة', price: 10, discount_type: 'bogus', discount_value: 5 },
    });
    expect(res.status).toBe(400);
  });
});

describe('canteen discounts', () => {
  it('stores a discount and image on a new product', async () => {
    const res = await request('/api/canteen/products', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { name: 'شوكولاتة', sell_price: 10, quantity_on_hand: 5, image_url: 'https://img/c.png', discount_type: 'amount', discount_value: 2 },
    });
    expect(res.status).toBe(201);
    const p = dbMock.getRows('canteen_products').find((x) => x.name === 'شوكولاتة');
    expect(p!.discount_type).toBe('amount');
    expect(p!.discount_value).toBe(2);
    expect(p!.image_url).toBe('https://img/c.png');
  });

  it('applies a percentage discount to the sale total and line breakdown', async () => {
    dbMock.setRows('canteen_products', [
      { id: 'p2', tenant_id: 'A', name: 'عصير', sell_price: 10, cost_price: 4, quantity_on_hand: 10, is_active: 1, min_quantity: 1, discount_type: 'percent', discount_value: 10 },
    ]);
    const res = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'DISC1', items: [{ product_id: 'p2', quantity: 3 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(27);
    const line = dbMock.getRows('canteen_sale_items')[0];
    expect(line.unit_price).toBe(9);
    expect(line.original_unit_price).toBe(10);
    expect(line.discount_amount).toBe(1);
    expect(line.line_total).toBe(27);
    expect(dbMock.postEntry.mock.calls[0][1].amount).toBe(27);
  });

  it('never lets a fixed discount drive the unit price below zero', async () => {
    dbMock.setRows('canteen_products', [
      { id: 'p3', tenant_id: 'A', name: 'هدية', sell_price: 5, cost_price: 1, quantity_on_hand: 10, is_active: 1, min_quantity: 1, discount_type: 'amount', discount_value: 999 },
    ]);
    const res = await request('/api/canteen/sales', {
      method: 'POST',
      token: signToken(USERS.supervisor),
      body: { sale_ref: 'DISC2', items: [{ product_id: 'p3', quantity: 2 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(0);
  });
});

// ─── Validation ───
describe('payload validation', () => {
  it('rejects a restaurant item without a name', async () => {
    const res = await request('/api/restaurant/items', { method: 'POST', token: signToken(USERS.supervisor), body: { price: 5 } });
    expect(res.status).toBe(400);
  });

  it('rejects a canteen sale without items', async () => {
    const res = await request('/api/canteen/sales', { method: 'POST', token: signToken(USERS.supervisor), body: { sale_ref: 'x' } });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown restaurant status action', async () => {
    const res = await request('/api/restaurant/orders/o/status', { method: 'POST', token: signToken(USERS.supervisor), body: { action: 'teleport' } });
    expect(res.status).toBe(400);
  });

  it('rejects a canteen adjustment with a short reason', async () => {
    const res = await request('/api/canteen/stock/adjustment', { method: 'POST', token: signToken(USERS.supervisor), body: { product_id: 'p1', new_quantity: 5, reason: 'x' } });
    expect(res.status).toBe(400);
  });
});
