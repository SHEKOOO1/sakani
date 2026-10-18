import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────
// Router-level tests for the per-student discount endpoints:
//   - PUT    /api/students/:id/discount
//   - DELETE /api/students/:id/discount
//
// Only the housing supervisor may manage a discount, and a discount must
// always carry an uploaded letter (new file or a previously stored one).
// kdb, middleware and the account service are mocked: no live server/DB.
// ───────────────────────────────────────────────────────────────

const store: Record<string, any[]> = {};
const inserts: { table: string; rows: any }[] = [];
const updates: { table: string; patch: any }[] = [];

function createKdb() {
  const kdb: any = vi.fn((table: string) => {
    let firstMode = false;
    const proxy: any = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: any) => resolve(firstMode ? (store[table] ?? [])[0] ?? undefined : (store[table] ?? []));
        }
        if (prop === 'insert') return async (rows: any) => { inserts.push({ table, rows }); return [rows?.id || 'id']; };
        if (prop === 'update') return async (patch: any) => { updates.push({ table, patch }); return 1; };
        if (prop === 'first') return () => { firstMode = true; return proxy; };
        if (prop === 'raw') return (...args: any[]) => ({ __raw: args });
        return () => proxy;
      },
    });
    return proxy;
  });
  kdb.transaction = async (cb: any) => cb(kdb);
  kdb.fn = { now: () => 'NOW' };
  kdb.raw = (...args: any[]) => ({ __raw: args });
  return kdb;
}

const mockKdb = createKdb();

vi.mock('../backend/infrastructure/db', () => ({
  kdb: mockKdb,
  checkUserPermission: vi.fn(async () => false),
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

const logFinanceEdit = vi.fn(async (_opts: any) => undefined);
const notifyStudentFinance = vi.fn(async (_id: string, _message: string, _title?: string) => undefined);
vi.mock('../backend/services/student-account.service', () => ({
  getStudentAccount: vi.fn(async () => ({ invoice: 5400, grossInvoice: 6000, discountAmount: 600, remaining: 5400 })),
  notifyStudentFinance,
  formatMoney: (n: number) => `${Number(n || 0).toLocaleString('en-US')} ج.م`,
  logFinanceEdit,
}));

type ProfileRoutes = typeof import('../backend/api/students/profile.routes');
let profile: ProfileRoutes;

beforeAll(async () => {
  profile = await import('../backend/api/students/profile.routes');
}, 60000);

const makeRes = () => {
  const res: any = { statusCode: 200, body: null, done: false };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (o: any) => { res.body = o; res.done = true; return res; };
  res.set = () => res; res.send = () => { res.done = true; return res; };
  res.getHeader = () => null; res.setHeader = () => res;
  return res;
};

const call = (router: any, { method, url, body, params, user }: any) =>
  new Promise<any>((resolve) => {
    const res = makeRes();
    const req: any = { method, url, body: body ?? {}, query: {}, params: params ?? {}, user, headers: {} };
    const started = Date.now();
    const poll = () => {
      if (res.done || Date.now() - started > 2000) return resolve(res);
      setTimeout(poll, 5);
    };
    poll();
    router.handle(req, res, () => undefined);
  });

const supervisor = { id: 'sup1', role: 'supervisor', tenantId: 'A' };
const studentBase = { id: 'stu1', tenant_id: 'A', room_id: 'r1', agreed_price: 0, billing_cycle: 'semester', price_frozen_at: null, price_daily: 150, price_monthly: 1000, price_semester: 6000, discount_document_id: null };

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  inserts.length = 0;
  updates.length = 0;
  logFinanceEdit.mockClear();
  notifyStudentFinance.mockClear();
});

describe('PUT /students/:id/discount', () => {
  it('rejects non-supervisors with 403 and writes nothing', async () => {
    store['students as s'] = [{ ...studentBase }];
    const res = await call(profile.default, { method: 'PUT', url: '/stu1/discount', params: { id: 'stu1' }, body: { type: 'percent', value: 10 }, user: { id: 'u2', role: 'priest', tenantId: 'A' } });
    expect(res.statusCode).toBe(403);
    expect(updates.length).toBe(0);
  });

  it('rejects a student outside the supervisor tenant with 403', async () => {
    store['students as s'] = [{ ...studentBase, tenant_id: 'B' }];
    const res = await call(profile.default, { method: 'PUT', url: '/stu1/discount', params: { id: 'stu1' }, body: { type: 'percent', value: 10 }, user: supervisor });
    expect(res.statusCode).toBe(403);
    expect(updates.length).toBe(0);
  });

  it('rejects an invalid discount type or value with 400', async () => {
    store['students as s'] = [{ ...studentBase, discount_document_id: 7 }];
    const badType = await call(profile.default, { method: 'PUT', url: '/stu1/discount', params: { id: 'stu1' }, body: { type: 'nonsense', value: 10 }, user: supervisor });
    expect(badType.statusCode).toBe(400);
    const badValue = await call(profile.default, { method: 'PUT', url: '/stu1/discount', params: { id: 'stu1' }, body: { type: 'percent', value: 0 }, user: supervisor });
    expect(badValue.statusCode).toBe(400);
    const over100 = await call(profile.default, { method: 'PUT', url: '/stu1/discount', params: { id: 'stu1' }, body: { type: 'percent', value: 120 }, user: supervisor });
    expect(over100.statusCode).toBe(400);
    expect(updates.length).toBe(0);
  });

  it('requires a letter before activating a discount', async () => {
    store['students as s'] = [{ ...studentBase, discount_document_id: null }];
    const res = await call(profile.default, { method: 'PUT', url: '/stu1/discount', params: { id: 'stu1' }, body: { type: 'percent', value: 10 }, user: supervisor });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('جواب');
    expect(updates.some(u => u.table === 'students')).toBe(false);
  });

  it('sets the discount, logs it as a discount edit, and posts no journal entry', async () => {
    store['students as s'] = [{ ...studentBase, discount_document_id: 7 }];
    const res = await call(profile.default, {
      method: 'PUT', url: '/stu1/discount', params: { id: 'stu1' },
      body: { type: 'percent', value: 10, note: 'منحة' },
      user: supervisor,
    });
    expect(res.statusCode).toBe(200);

    const studentUpdate = updates.find(u => u.table === 'students');
    expect(studentUpdate).toBeTruthy();
    expect(studentUpdate!.patch.discount_type).toBe('percent');
    expect(studentUpdate!.patch.discount_value).toBe(10);
    expect(studentUpdate!.patch.discount_note).toBe('منحة');
    expect(studentUpdate!.patch.discount_document_id).toBe(7);
    expect(studentUpdate!.patch.discount_set_by).toBe('sup1');
    // The shared room price is never touched.
    expect(updates.some(u => u.table === 'rooms')).toBe(false);

    expect(logFinanceEdit).toHaveBeenCalledTimes(1);
    const args = logFinanceEdit.mock.calls[0][0] as any;
    expect(args.editType).toBe('discount');
    expect(args.delta).toBe(600);
    expect(args.direction).toBe('decrease');
    expect(notifyStudentFinance).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /students/:id/discount', () => {
  it('rejects non-supervisors with 403', async () => {
    store['students as s'] = [{ ...studentBase, discount_type: 'percent', discount_value: 10, discount_document_id: 7 }];
    const res = await call(profile.default, { method: 'DELETE', url: '/stu1/discount', params: { id: 'stu1' }, user: { id: 'u2', role: 'priest', tenantId: 'A' } });
    expect(res.statusCode).toBe(403);
    expect(updates.length).toBe(0);
  });

  it('rejects when no discount is active with 400', async () => {
    store['students as s'] = [{ ...studentBase, discount_type: null }];
    const res = await call(profile.default, { method: 'DELETE', url: '/stu1/discount', params: { id: 'stu1' }, user: supervisor });
    expect(res.statusCode).toBe(400);
    expect(updates.length).toBe(0);
  });

  it('clears every discount column and logs the removal', async () => {
    store['students as s'] = [{ ...studentBase, discount_type: 'amount', discount_value: 600, discount_document_id: 7, discount_note: 'x', discount_set_by: 'sup1' }];
    const res = await call(profile.default, { method: 'DELETE', url: '/stu1/discount', params: { id: 'stu1' }, user: supervisor });
    expect(res.statusCode).toBe(200);

    const studentUpdate = updates.find(u => u.table === 'students');
    expect(studentUpdate).toBeTruthy();
    expect(studentUpdate!.patch.discount_type).toBeNull();
    expect(studentUpdate!.patch.discount_value).toBeNull();
    expect(studentUpdate!.patch.discount_document_id).toBeNull();

    expect(logFinanceEdit).toHaveBeenCalledTimes(1);
    const args = logFinanceEdit.mock.calls[0][0] as any;
    expect(args.editType).toBe('discount');
    expect(args.direction).toBe('increase');
  });
});
