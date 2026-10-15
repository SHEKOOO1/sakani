import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────
// Router-level tests for trusted-device binding. kdb + middleware
// are mocked: no live server, no DB.
//
// Guarantees pinned here:
//   * the server (not the client) mints the device identity/token;
//   * the raw token is returned once and only its hash is stored;
//   * a new device is `pending` and cannot be trusted until approved;
//   * approve/revoke are tenant-scoped and refuse revoked devices;
//   * isTrustedDevice only trusts `approved` devices.
// ───────────────────────────────────────────────────────────────

const tables: Record<string, any[]> = {};
const inserts: { table: string; rows: any }[] = [];
const updates: { table: string; patch: any }[] = [];

function matchRow(row: any, where: any): boolean {
  return Object.entries(where || {}).every(([k, v]) => row[k] === v);
}

function createKdb() {
  const kdb: any = vi.fn((table: string) => {
    const state: { where: any; order: any } = { where: {}, order: null };
    const rows = () => (tables[table] ?? []);
    const filtered = () => rows().filter((r) => matchRow(r, state.where));
    const proxy: any = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'where') return (arg: any) => { Object.assign(state.where, arg); return proxy; };
        if (prop === 'andWhere') return (arg: any) => { Object.assign(state.where, arg); return proxy; };
        if (prop === 'select') return () => proxy;
        if (prop === 'orderBy') return (col: string, dir: string) => {
          state.order = { col, dir };
          return proxy;
        };
        if (prop === 'insert') return async (r: any) => { inserts.push({ table, rows: r }); (tables[table] ??= []).push(r); return [r?.id || 'id']; };
        if (prop === 'update') return async (patch: any) => {
          updates.push({ table, patch });
          for (const r of filtered()) Object.assign(r, patch);
          return 1;
        };
        if (prop === 'first') return async () => filtered()[0] ?? undefined;
        if (prop === 'then') {
          return (resolve: any) => {
            let out = filtered();
            if (state.order) {
              const { col, dir } = state.order;
              out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
            }
            resolve(out);
          };
        }
        return () => proxy;
      },
    });
    return proxy;
  });
  kdb.transaction = async (cb: any) => cb(kdb);
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

type DeviceRoutes = typeof import('../backend/api/devices.routes');
let routes: DeviceRoutes;

beforeAll(async () => {
  routes = await import('../backend/api/devices.routes');
}, 60000);

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  inserts.length = 0;
  updates.length = 0;
  tables['students'] = [{ id: 'stu1', user_id: 'u1', tenant_id: 'A' }];
  tables['student_devices'] = [];
});

const makeRes = () => {
  const res: any = { statusCode: 200, body: null, done: false };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (o: any) => { res.body = o; res.done = true; return res; };
  return res;
};

const invoke = (method: string, url: string, body: any, params: any, user: any) =>
  new Promise<{ res: any }>((resolve) => {
    const res = makeRes();
    const req: any = { method, url, body, query: {}, params, headers: { 'user-agent': 'vitest' }, user };
    const started = Date.now();
    const poll = () => {
      if (res.done || Date.now() - started > 2000) return resolve({ res });
      setTimeout(poll, 5);
    };
    poll();
    (routes.default as any).handle(req, res, () => undefined);
  });

const student = { id: 'u1', role: 'student', tenantId: 'A' };
const supervisor = { id: 'sup1', role: 'supervisor', tenantId: 'A' };

describe('Trusted devices — registration', () => {
  it('server mints the token, returns it once, and stores only its hash', async () => {
    const { res } = await invoke('POST', '/register', { label: 'My phone', platform: 'android' }, {}, student);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(typeof res.body.data.device_token).toBe('string');
    expect(res.body.data.device_token.length).toBe(64);

    const insert = inserts.find((i) => i.table === 'student_devices')?.rows;
    expect(insert.device_token_hash).toBeTruthy();
    // The stored value must NOT be the raw token.
    expect(insert.device_token_hash).not.toBe(res.body.data.device_token);
    expect(insert.device_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(insert.status).toBe('pending');
    expect(insert.tenant_id).toBe('A');
    expect(insert.student_id).toBe('stu1');
  });

  it('refuses registration for a user that is not a student (403)', async () => {
    tables['students'] = [];
    const { res } = await invoke('POST', '/register', {}, {}, student);
    expect(res.statusCode).toBe(403);
    expect(inserts.length).toBe(0);
  });

  it('never trusts client-supplied device ids (identity comes from the server)', async () => {
    const { res } = await invoke('POST', '/register', { device_uid: 'attacker-chosen', token: 'x' }, {}, student);
    const insert = inserts.find((i) => i.table === 'student_devices')?.rows;
    expect(insert.device_token_hash).not.toContain('attacker-chosen');
    expect(res.body.data.device_token).not.toBe('attacker-chosen');
  });
});

describe('Trusted devices — approval and revocation', () => {
  beforeEach(() => {
    tables['student_devices'] = [{
      id: 'd1', tenant_id: 'A', student_id: 'stu1',
      device_token_hash: 'a'.repeat(64), status: 'pending',
      created_at: new Date(),
    }];
  });

  it('approves a pending device and records the approver', async () => {
    const { res } = await invoke('POST', '/d1/approve', {}, { id: 'd1' }, supervisor);
    expect(res.statusCode).toBe(200);
    const row = tables['student_devices'][0];
    expect(row.status).toBe('approved');
    expect(row.approved_by).toBe('sup1');
    expect(row.approved_at).toBeTruthy();
  });

  it('refuses to approve a device that was revoked', async () => {
    tables['student_devices'][0].status = 'revoked';
    const { res } = await invoke('POST', '/d1/approve', {}, { id: 'd1' }, supervisor);
    expect(res.statusCode).toBe(400);
    expect(tables['student_devices'][0].status).toBe('revoked');
  });

  it('does not touch a device from another tenant', async () => {
    tables['student_devices'][0].tenant_id = 'B';
    const { res } = await invoke('POST', '/d1/approve', {}, { id: 'd1' }, supervisor);
    expect(res.statusCode).toBe(404);
    expect(tables['student_devices'][0].status).toBe('pending');
  });

  it('revokes a device and stamps revoked_at', async () => {
    const { res } = await invoke('POST', '/d1/revoke', {}, { id: 'd1' }, supervisor);
    expect(res.statusCode).toBe(200);
    expect(tables['student_devices'][0].status).toBe('revoked');
    expect(tables['student_devices'][0].revoked_at).toBeTruthy();
  });
});

describe('isTrustedDevice', () => {
  it('trusts only approved devices and only when the token hash matches', async () => {
    const crypto = await import('crypto');
    const token = 'f'.repeat(64);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    tables['student_devices'] = [
      { id: 'd1', student_id: 'stu1', device_token_hash: hash, status: 'approved' },
    ];
    expect(await routes.isTrustedDevice('stu1', token)).toBe(true);
    expect(await routes.isTrustedDevice('stu1', '0'.repeat(64))).toBe(false);
    expect(await routes.isTrustedDevice('stu1', null)).toBe(false);

    tables['student_devices'][0].status = 'pending';
    expect(await routes.isTrustedDevice('stu1', token)).toBe(false);
  });
});
