import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────
// Router-level tests for the dorm (residence) check-in/check-out
// endpoint. kdb + middleware are mocked: no live server, no DB.
// These pin the server-authoritative geofence + validation rules.
// ───────────────────────────────────────────────────────────────

const store: Record<string, any[]> = {};
const inserts: { table: string; rows: any }[] = [];

function createKdb() {
  const kdb: any = vi.fn((table: string) => {
    const proxy: any = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: any) => resolve(store[table] ?? []);
        }
        if (prop === 'insert') {
          return async (rows: any) => { inserts.push({ table, rows }); return [rows?.id || 'id']; };
        }
        if (prop === 'first') {
          return async () => (store[table] ?? [])[0] ?? undefined;
        }
        return () => proxy;
      },
    });
    return proxy;
  });
  kdb.transaction = async (cb: any) => cb(kdb);
  return kdb;
}

const rawCalls: { sql: string; bindings?: any[] }[] = [];
const mockKdb = createKdb();
mockKdb.raw = async (sql: string, bindings?: any[]) => { rawCalls.push({ sql, bindings }); return []; };
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

type AttendanceRoutes = typeof import('../backend/api/attendance.routes');
let routes: AttendanceRoutes;

beforeAll(async () => {
  routes = await import('../backend/api/attendance.routes');
}, 60000);

// ~40m north of (30, 31); used to exercise GPS-accuracy uncertainty
const NEAR = { lat: 30.0003, lng: 31 };

function setStudent(overrides: Record<string, any> = {}) {
  store['students as s'] = [{
    id: 'stu1', user_id: 'u1', tenant_id: 'A', student_name: 'طالب',
    is_traveling: 0, curfew_time: '23:59',
    location_lat: 30, location_lng: 31, location_radius: 50,
    ...overrides,
  }];
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  inserts.length = 0;
  rawCalls.length = 0;
  setStudent();
  store['user_tenant_assignments as uta'] = [];
  store['student_guardians as sg'] = [];
});

const makeRes = () => {
  const res: any = { statusCode: 200, body: null, done: false };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (o: any) => { res.body = o; res.done = true; return res; };
  res.set = () => res; res.send = () => { res.done = true; return res; };
  res.getHeader = () => null; res.setHeader = () => res;
  return res;
};

const invoke = (body: any) =>
  new Promise<{ res: any }>((resolve) => {
    const res = makeRes();
    const req: any = { method: 'POST', url: '/check-in', body, query: {}, params: {}, user: { id: 'u1', role: 'student' } };
    const started = Date.now();
    const poll = () => {
      if (res.done || Date.now() - started > 2000) return resolve({ res });
      setTimeout(poll, 5);
    };
    poll();
    (routes.default as any).handle(req, res, () => undefined);
  });

const attendanceInsert = () => inserts.find((i) => i.table === 'attendance')?.rows;

describe('Dorm attendance — validation', () => {
  it('rejects an unknown type with 400 and never touches the DB', async () => {
    const { res } = await invoke({ lat: 30, lng: 31, type: 'hack' });
    expect(res.statusCode).toBe(400);
    expect(inserts.length).toBe(0);
  });

  it('rejects non-numeric coordinates with 400', async () => {
    const { res } = await invoke({ lat: 'abc', lng: 31, type: 'check-in' });
    expect(res.statusCode).toBe(400);
    expect(inserts.length).toBe(0);
  });

  it('rejects out-of-range coordinates with 400', async () => {
    const { res } = await invoke({ lat: 999, lng: 31, type: 'check-in' });
    expect(res.statusCode).toBe(400);
    expect(inserts.length).toBe(0);
  });
});

describe('Dorm attendance — check-in geofence', () => {
  it('accepts a check-in inside the dorm circle and stores numeric coordinates', async () => {
    const { res } = await invoke({ lat: '30.0001', lng: '31', type: 'check-in', accuracy: 5 });
    expect(res.statusCode).toBe(200);
    const row = attendanceInsert();
    expect(row.location_lat).toBe(30.0001);
    expect(row.location_lng).toBe(31);
    expect(row.type).toBe('check-in');
  });

  it('rejects a check-in outside the dorm circle', async () => {
    const { res } = await invoke({ lat: 30.5, lng: 31, type: 'check-in' });
    expect(res.statusCode).toBe(400);
    expect(inserts.length).toBe(0);
  });

  it('rejects when the dorm centre is not configured', async () => {
    setStudent({ location_lat: null, location_lng: null });
    const { res } = await invoke({ lat: 30, lng: 31, type: 'check-in' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('غير مضبوطة');
    expect(inserts.length).toBe(0);
  });
});

describe('Dorm attendance — check-out geofence', () => {
  it('accepts a check-out inside the dorm centre circle', async () => {
    setStudent({ location_lat: 31, location_lng: 30, location_radius: 50 });
    const { res } = await invoke({ lat: 31.0001, lng: 30, type: 'check-out', accuracy: 5 });
    expect(res.statusCode).toBe(200);
    expect(attendanceInsert().type).toBe('check-out');
  });

  it('rejects a check-out outside the dorm centre circle', async () => {
    setStudent({ location_lat: 31, location_lng: 30, location_radius: 50 });
    const { res } = await invoke({ lat: 30, lng: 31, type: 'check-out', accuracy: 5 });
    expect(res.statusCode).toBe(400);
    expect(inserts.length).toBe(0);
  });

  it('rejects a check-out when the dorm centre is not configured', async () => {
    setStudent({ location_lat: null, location_lng: null });
    const { res } = await invoke({ lat: 30, lng: 31, type: 'check-out' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('غير مضبوطة');
    expect(inserts.length).toBe(0);
  });
});

describe('Dorm attendance — GPS accuracy', () => {
  it('rejects a reading whose accuracy band straddles the circle boundary', async () => {
    setStudent({ location_lat: 30, location_lng: 31, location_radius: 50 });
    // ~33m from the circle centre with ±30m accuracy → cannot decide reliably
    const { res } = await invoke({ lat: NEAR.lat, lng: NEAR.lng, type: 'check-out', accuracy: 30 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('دقة');
    expect(inserts.length).toBe(0);
  });

  it('accepts when the whole accuracy band is inside the circle', async () => {
    setStudent({ location_lat: 30, location_lng: 31, location_radius: 50 });
    const { res } = await invoke({ lat: 30.00005, lng: 31, type: 'check-out', accuracy: 3 });
    expect(res.statusCode).toBe(200);
  });
});

describe('Dorm attendance — debounce & isolation', () => {
  it('returns 400 (not a second row) when the same type was recorded within 5 minutes', async () => {
    store['attendance'] = [{ student_id: 'stu1', type: 'check-in', created_at: new Date() }];
    const { res } = await invoke({ lat: 30, lng: 31, type: 'check-in' });
    expect(res.statusCode).toBe(400);
    expect(inserts.length).toBe(0);
  });

  it('never trusts a client-supplied tenant_id — the student tenant is used', async () => {
    const { res } = await invoke({ lat: 30, lng: 31, type: 'check-in', tenant_id: 'HACK' });
    expect(res.statusCode).toBe(200);
    expect(attendanceInsert().tenant_id).toBe('A');
  });

  it('acquires a per-student-and-type application lock before writing', async () => {
    const { res } = await invoke({ lat: 30, lng: 31, type: 'check-in', accuracy: 5 });
    expect(res.statusCode).toBe(200);
    const lock = rawCalls.find((c) => c.sql.includes('sp_getapplock'));
    expect(lock).toBeTruthy();
    expect(lock!.bindings?.[0]).toBe('attendance:stu1:check-in');
  });
});
