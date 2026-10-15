import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────
// Router-level tests for the residence-price policy:
//   - PATCH /api/students/:id/finance  (explicit admin price change)
//   - PUT   /api/rooms/:id             (freezes unfrozen occupants)
// kdb + middleware are mocked: no live server, no DB.
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
mockKdb.fn = { now: () => 'NOW' };
mockKdb.raw = (...args: any[]) => ({ __raw: args });
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

type ProfileRoutes = typeof import('../backend/api/students/profile.routes');
type RoomRoutes = typeof import('../backend/api/room.routes');
let profile: ProfileRoutes;
let rooms: RoomRoutes;

beforeAll(async () => {
  profile = await import('../backend/api/students/profile.routes');
  rooms = await import('../backend/api/room.routes');
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

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  inserts.length = 0;
  updates.length = 0;
});

describe('PATCH /students/:id/finance — explicit admin price change', () => {
  const student = { id: 'stu1', tenant_id: 'A', room_id: 'r1', agreed_price: 6000, billing_cycle: 'semester', price_frozen_at: null, price_daily: 150, price_monthly: 1000, price_semester: 6000 };

  it('rejects non-supervisors with 403 and writes nothing', async () => {
    store['students as s'] = [{ ...student }];
    const res = await call(profile.default, { method: 'PATCH', url: '/stu1/finance', params: { id: 'stu1' }, body: { value: 7000 }, user: { id: 'u2', role: 'priest', tenantId: 'A' } });
    expect(res.statusCode).toBe(403);
    expect(inserts.length).toBe(0);
    expect(updates.length).toBe(0);
  });

  it('rejects a student outside the supervisor tenant with 403', async () => {
    store['students as s'] = [{ ...student, tenant_id: 'B' }];
    const res = await call(profile.default, { method: 'PATCH', url: '/stu1/finance', params: { id: 'stu1' }, body: { value: 7000 }, user: supervisor });
    expect(res.statusCode).toBe(403);
    expect(updates.length).toBe(0);
  });

  it('rejects an invalid price with 400', async () => {
    store['students as s'] = [{ ...student }];
    const res = await call(profile.default, { method: 'PATCH', url: '/stu1/finance', params: { id: 'stu1' }, body: { value: -5 }, user: supervisor });
    expect(res.statusCode).toBe(400);
    expect(updates.length).toBe(0);
  });

  it('freezes the student price, logs the change, and posts NO journal entry', async () => {
    store['students as s'] = [{ ...student }];
    const res = await call(profile.default, {
      method: 'PATCH', url: '/stu1/finance', params: { id: 'stu1' },
      body: { value: 7500, reason: 'اتفاق جديد', effective_date: '2023-09-01' },
      user: supervisor,
    });
    expect(res.statusCode).toBe(200);

    // Student price is updated and frozen — the shared room price is untouched.
    const studentUpdate = updates.find(u => u.table === 'students');
    expect(studentUpdate).toBeTruthy();
    expect(studentUpdate!.patch.agreed_price).toBe(7500);
    expect(studentUpdate!.patch.price_frozen_at).toBeInstanceOf(Date);
    expect(updates.some(u => u.table === 'rooms')).toBe(false);

    // No automatic `adjustment` (or any) journal entry is created.
    expect(inserts.some(i => i.table === 'journal_entries')).toBe(false);

    // The change is logged with old/new, reason, user and effective date.
    const log = inserts.find(i => i.table === 'finance_edit_logs');
    expect(log).toBeTruthy();
    expect(log!.rows.edit_type).toBe('room_price');
    expect(log!.rows.delta).toBe(1500);
    expect(log!.rows.direction).toBe('increase');
    expect(log!.rows.created_by).toBe('sup1');
    expect(log!.rows.summary).toContain('7,500');
    expect(log!.rows.summary).toContain('6,000');
    expect(log!.rows.summary).toContain('اتفاق جديد');
    expect(log!.rows.summary).toContain('2023-09-01');
  });
});

describe('PUT /rooms/:id — freezes unfrozen occupants at their current price', () => {
  it('freezes a legacy occupant so the new room price does not rebase them', async () => {
    store['rooms'] = [{ id: 'r1', tenant_id: 'A', price_daily: 150, price_monthly: 1000, price_semester: 6000 }];
    store['students as s'] = [{
      id: 'occ1', agreed_price: 0, billing_cycle: 'semester', price_frozen_at: null,
      price_daily: 150, price_monthly: 1000, price_semester: 6000,
    }];
    const res = await call(rooms.default, {
      method: 'PUT', url: '/r1', params: { id: 'r1' },
      body: { roomNumber: 'r1', capacity: 4, price_daily: 160, price_monthly: 1100, price_semester: 7000 },
      user: { id: 'sup1', role: 'supervisor', tenantId: 'A' },
    });
    expect(res.statusCode).toBe(200);

    const roomUpdate = updates.find(u => u.table === 'rooms');
    expect(roomUpdate).toBeTruthy();
    expect(roomUpdate!.patch.price_semester).toBe(7000);

    const freeze = updates.find(u => u.table === 'students');
    expect(freeze).toBeTruthy();
    // Frozen at the OLD effective price (6000), not the new room price.
    expect(freeze!.patch.agreed_price).toBe(6000);
    expect(freeze!.patch.price_frozen_at).toBe('NOW');
  });

  it('does not freeze occupants when the room price is unchanged', async () => {
    store['rooms'] = [{ id: 'r1', tenant_id: 'A', price_daily: 150, price_monthly: 1000, price_semester: 6000 }];
    store['students as s'] = [{
      id: 'occ1', agreed_price: 0, billing_cycle: 'semester', price_frozen_at: null,
      price_daily: 150, price_monthly: 1000, price_semester: 6000,
    }];
    const res = await call(rooms.default, {
      method: 'PUT', url: '/r1', params: { id: 'r1' },
      body: { roomNumber: 'r1', capacity: 4, price_daily: 150, price_monthly: 1000, price_semester: 6000 },
      user: { id: 'sup1', role: 'supervisor', tenantId: 'A' },
    });
    expect(res.statusCode).toBe(200);
    expect(updates.some(u => u.table === 'students')).toBe(false);
  });
});
