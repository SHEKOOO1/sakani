import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────
// Router-level tests for canteen returns. kdb + middleware are mocked
// with a small filtered in-memory query builder, so the return flow runs
// end-to-end (validate → lock → stock → ledger reversal) without a DB.
//
// Regression guard: each return must take an update lock on the sale row
// (`forUpdate`) so two concurrent returns for the same sale cannot both read
// "no prior returns" and together exceed the sold quantity (over-return), nor
// reverse the same ledger entry twice.
// ───────────────────────────────────────────────────────────────

const store: Record<string, any[]> = {};
const inserts: { table: string; rows: any }[] = [];
const updates: { table: string; patch: any }[] = [];
const lockCalls: string[] = [];
const reverseEntry = vi.fn(async () => ({ id: 'reversal-1' }));

function createKdb() {
  const kdb: any = vi.fn((table: string) => {
    const filters: ((row: any) => boolean)[] = [];
    let firstMode = false;
    const matches = () => (store[table] ?? []).filter((r) => filters.every((f) => f(r)));
    const proxy: any = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve: any) => resolve(firstMode ? matches()[0] ?? undefined : matches());
        if (prop === 'forUpdate') return () => { lockCalls.push(table); return proxy; };
        if (prop === 'whereNull') return (col: string) => { filters.push((r) => r[col] == null); return proxy; };
        if (prop === 'where') return (...args: any[]) => {
          if (args.length === 1 && args[0] && typeof args[0] === 'object') {
            const obj = args[0];
            filters.push((r) => Object.entries(obj).every(([k, v]) => r[k] === v));
          } else {
            const [col, val] = args;
            filters.push((r) => r[col] === val);
          }
          return proxy;
        };
        if (prop === 'first') return () => { firstMode = true; return proxy; };
        if (prop === 'insert') return async (rows: any) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          inserts.push({ table, rows });
          (store[table] ||= []).push(...arr.map((x: any) => ({ ...x })));
          return arr.map((x: any) => x.id || 'id');
        };
        if (prop === 'update') return async (patch: any) => {
          updates.push({ table, patch });
          const rows = matches();
          for (const r of rows) Object.assign(r, patch);
          return rows.length;
        };
        if (prop === 'del') return async () => 1;
        if (prop === 'raw') return (...a: any[]) => ({ __raw: a });
        return () => proxy;
      },
    });
    return proxy;
  });
  kdb.transaction = async (cb: any) => cb(kdb);
  kdb.fn = { now: () => 'NOW' };
  kdb.raw = (...a: any[]) => ({ __raw: a });
  return kdb;
}

const mockKdb = createKdb();
const checkUserPermission = vi.fn(async () => false);

vi.mock('../backend/infrastructure/db', () => ({
  kdb: mockKdb,
  checkUserPermission,
  logAuditEvent: vi.fn(),
}));

vi.mock('../backend/api/middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  authorizePermission: () => (_req: any, _res: any, next: any) => next(),
  computeUserTenantIds: vi.fn(async () => []),
  sanitizeInput: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../backend/validation/middleware', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../backend/infrastructure/service-features', () => ({
  requireServiceEnabled: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../backend/services/ledger.service', () => ({
  postEntry: vi.fn(async () => ({ id: 'entry-1' })),
  reverseEntry,
  canteenRevenueLines: () => [],
}));

type CanteenRoutes = typeof import('../backend/api/canteen.routes');
let routes: CanteenRoutes;

beforeAll(async () => {
  routes = await import('../backend/api/canteen.routes');
}, 60000);

const supervisor = { id: 'u1', role: 'supervisor', tenantId: 'A' };

function seedSale(overrides: Record<string, any> = {}, items: any[] = [{ id: 'si1', sale_id: 'sale1', product_id: 'p1', product_name: 'شيبسي', quantity: 5, unit_price: 10 }], product: any = { id: 'p1', tenant_id: 'A', quantity_on_hand: 10 }) {
  store['canteen_sales'] = [{ id: 'sale1', tenant_id: 'A', status: 'completed', ledger_entry_id: 'entry1', student_id: 'stu1', ...overrides }];
  store['canteen_sale_items'] = items;
  store['canteen_products'] = [product];
  store['canteen_stock_movements'] = [];
}

const makeRes = () => {
  const res: any = { statusCode: 200, body: null, done: false };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (o: any) => { res.body = o; res.done = true; return res; };
  res.set = () => res; res.send = () => { res.done = true; return res; };
  res.getHeader = () => null; res.setHeader = () => res;
  return res;
};

const invoke = (body: any, user: any = supervisor) =>
  new Promise<any>((resolve) => {
    const res = makeRes();
    const req: any = { method: 'POST', url: '/returns', body, query: {}, params: {}, user, headers: {} };
    const started = Date.now();
    const poll = () => {
      if (res.done || Date.now() - started > 2000) return resolve(res);
      setTimeout(poll, 5);
    };
    poll();
    (routes.default as any).handle(req, res, () => undefined);
  });

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  inserts.length = 0;
  updates.length = 0;
  lockCalls.length = 0;
  reverseEntry.mockClear();
  seedSale();
});

describe('Canteen returns — concurrency & validation', () => {
  it('locks the sale row with an update lock before reading returns/stock', async () => {
    await invoke({ sale_id: 'sale1', items: [{ product_id: 'p1', quantity: 2 }] });
    expect(lockCalls).toContain('canteen_sales');
  });

  it('rejects an over-return (prior returns + requested > sold) with 400 and writes nothing', async () => {
    store['canteen_stock_movements'] = [
      { id: 'm0', tenant_id: 'A', sale_id: 'sale1', product_id: 'p1', movement_type: 'return', quantity: 4 },
    ];
    const res = await invoke({ sale_id: 'sale1', items: [{ product_id: 'p1', quantity: 2 }] });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('أكبر من المباع');
    expect(inserts.some((i) => i.table === 'canteen_stock_movements')).toBe(false);
    expect(updates.some((u) => u.table === 'canteen_products')).toBe(false);
    expect(reverseEntry).not.toHaveBeenCalled();
  });

  it('accepts a valid partial return and restocks the product', async () => {
    const res = await invoke({ sale_id: 'sale1', items: [{ product_id: 'p1', quantity: 2 }] });
    expect(res.statusCode).toBe(200);
    const movement = inserts.find((i) => i.table === 'canteen_stock_movements')!.rows;
    expect(movement.movement_type).toBe('return');
    expect(movement.quantity).toBe(2);
    expect(store['canteen_products'][0].quantity_on_hand).toBe(12);
    expect(reverseEntry).not.toHaveBeenCalled();
  });

  it('a full return reverses the ledger entry once and marks the sale returned', async () => {
    const res = await invoke({ sale_id: 'sale1', items: [{ product_id: 'p1', quantity: 5 }], reason: 'إرجاع كامل' });
    expect(res.statusCode).toBe(200);
    expect(reverseEntry).toHaveBeenCalledTimes(1);
    expect(reverseEntry).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ entryId: 'entry1' }));
    expect(store['canteen_sales'][0].status).toBe('returned');
  });

  it('rejects a return for a sale that is not completed', async () => {
    seedSale({ status: 'returned' });
    const res = await invoke({ sale_id: 'sale1', items: [{ product_id: 'p1', quantity: 1 }] });
    expect(res.statusCode).toBe(400);
    expect(reverseEntry).not.toHaveBeenCalled();
  });

  it('returns 404 for a sale outside the caller tenant', async () => {
    seedSale({ tenant_id: 'B' });
    const res = await invoke({ sale_id: 'sale1', items: [{ product_id: 'p1', quantity: 1 }] });
    expect(res.statusCode).toBe(404);
    expect(inserts.length).toBe(0);
  });

  it('rejects a product that is not on the invoice', async () => {
    const res = await invoke({ sale_id: 'sale1', items: [{ product_id: 'pX', quantity: 1 }] });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('ليس ضمن الفاتورة');
    expect(inserts.some((i) => i.table === 'canteen_stock_movements')).toBe(false);
  });

  it('stamps the caller-supplied return_ref on the return movement', async () => {
    const res = await invoke({ sale_id: 'sale1', items: [{ product_id: 'p1', quantity: 2 }], reason: 'إرجاع', return_ref: 'R2' });
    expect(res.statusCode).toBe(200);
    const movement = inserts.find((i) => i.table === 'canteen_stock_movements')!.rows;
    expect(movement.return_ref).toBe('R2');
  });

  it('treats a replayed return with the same return_ref as a no-op (no double restock/reversal)', async () => {
    store['canteen_stock_movements'] = [
      { id: 'm1', tenant_id: 'A', sale_id: 'sale1', product_id: 'p1', movement_type: 'return', quantity: 2, return_ref: 'R1' },
    ];
    const res = await invoke({ sale_id: 'sale1', items: [{ product_id: 'p1', quantity: 2 }], reason: 'إرجاع', return_ref: 'R1' });
    expect(res.statusCode).toBe(200);
    expect(inserts.some((i) => i.table === 'canteen_stock_movements')).toBe(false);
    expect(store['canteen_products'][0].quantity_on_hand).toBe(10);
    expect(reverseEntry).not.toHaveBeenCalled();
  });
});
