import { describe, it, expect, beforeEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────
// Router-level tests for the roll-call endpoints. The service layer,
// auth middleware and tenant-permission helpers are mocked so the tests
// pin the HTTP contract: who can access, and how service errors map to
// status codes. No live server or DB.
// ───────────────────────────────────────────────────────────────

vi.mock('../backend/api/middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));

const state = vi.hoisted(() => ({ canAccess: true, permOk: true }));

vi.mock('../backend/api/attendancePolicy.routes', () => ({
  canAccessTenant: vi.fn(async () => state.canAccess),
  requirePermOrAdmin: vi.fn(async (_req: any, res: any) => {
    if (!state.permOk) { res.status(403).json({ success: false, message: 'غير مصرح بالوصول' }); return false; }
    return true;
  }),
}));

const svc = vi.hoisted(() => ({
  getRollCall: vi.fn(async () => ({ id: 'rc1', state: 'open', entries: [] })),
  startRollCall: vi.fn(async () => ({ rollCall: { id: 'rc1' }, entries: [], created: true })),
  updateRollCallEntries: vi.fn(async () => ({ rollCall: { id: 'rc1' }, entries: [] })),
  submitRollCall: vi.fn(async () => ({ rollCall: { id: 'rc1', state: 'submitted' }, createdCases: 2 })),
  resolveStudentForUser: vi.fn(async () => ({ id: 'st1', user_id: 'stu1' })),
  getStudentRollCall: vi.fn(async () => ({ rollCall: { id: 'rc1', state: 'open' }, entry: { id: 'e1' } })),
  respondToRollCall: vi.fn(async () => ({ id: 'e1', answer_mark: 'present' })),
  broadcastRollCallOpened: vi.fn(async () => undefined),
}));
vi.mock('../backend/services/rollCall.service', () => svc);

import rollCallRoutes from '../backend/api/rollCall.routes';

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    done: false,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; this.done = true; return this; },
  };
  return res;
}

function call(method: string, url: string, opts: { params?: any; body?: any; query?: any; user?: any } = {}) {
  return new Promise<any>((resolve) => {
    const res = makeRes();
    const req: any = { method, url, params: opts.params ?? {}, body: opts.body ?? {}, query: opts.query ?? {}, headers: {}, user: opts.user ?? { id: 'sup1', role: 'supervisor', tenantId: 'A' } };
    const started = Date.now();
    const poll = () => {
      if (res.done || Date.now() - started > 2000) return resolve(res);
      setTimeout(poll, 5);
    };
    poll();
    (rollCallRoutes as any).handle(req, res, () => undefined);
  });
}

beforeEach(() => {
  state.canAccess = true;
  state.permOk = true;
  for (const fn of Object.values(svc)) (fn as any).mockClear();
});

describe('roll-call routes', () => {
  it('GET returns the sheet for an allowed tenant', async () => {
    const res = await call('GET', '/tenants/A/roll-call', { params: { tenantId: 'A' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(svc.getRollCall).toHaveBeenCalledWith('A', { date: undefined });
  });

  it('GET rejects a tenant the user cannot access (403)', async () => {
    state.canAccess = false;
    const res = await call('GET', '/tenants/B/roll-call', { params: { tenantId: 'B' } });
    expect(res.statusCode).toBe(403);
    expect(svc.getRollCall).not.toHaveBeenCalled();
  });

  it('POST start delegates and reports creation', async () => {
    const res = await call('POST', '/tenants/A/roll-call', { params: { tenantId: 'A' }, body: {} });
    expect(res.statusCode).toBe(200);
    expect(svc.startRollCall).toHaveBeenCalledOnce();
    expect(res.body.data.created).toBe(true);
  });

  it('PUT entries maps a locked sheet to 400', async () => {
    svc.updateRollCallEntries.mockRejectedValueOnce(new Error('ROLL_CALL_LOCKED'));
    const res = await call('PUT', '/tenants/A/roll-call/rc1/entries', { params: { tenantId: 'A', id: 'rc1' }, body: { entries: [] } });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST submit maps a missing sheet to 404', async () => {
    svc.submitRollCall.mockRejectedValueOnce(new Error('ROLL_CALL_NOT_FOUND'));
    const res = await call('POST', '/tenants/A/roll-call/rc1/submit', { params: { tenantId: 'A', id: 'rc1' } });
    expect(res.statusCode).toBe(404);
  });

  it('POST submit returns the created-case count', async () => {
    const res = await call('POST', '/tenants/A/roll-call/rc1/submit', { params: { tenantId: 'A', id: 'rc1' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.createdCases).toBe(2);
  });

  it('denies a user without MANAGE_ATTENDANCE on writes (403)', async () => {
    state.permOk = false;
    const res = await call('POST', '/tenants/A/roll-call', { params: { tenantId: 'A' } });
    expect(res.statusCode).toBe(403);
    expect(svc.startRollCall).not.toHaveBeenCalled();
  });
});

describe('student roll-call routes', () => {
  const student = { id: 'stu1', role: 'student', tenantId: 'A' };

  it('GET pending returns the card for a student', async () => {
    const res = await call('GET', '/students/roll-call/pending', { user: student });
    expect(res.statusCode).toBe(200);
    expect(svc.getStudentRollCall).toHaveBeenCalledWith('A', 'st1');
  });

  it('GET pending rejects a non-student account (403)', async () => {
    (svc.resolveStudentForUser as any).mockResolvedValueOnce(null);
    const res = await call('GET', '/students/roll-call/pending', { user: student });
    expect(res.statusCode).toBe(403);
    expect(svc.getStudentRollCall).not.toHaveBeenCalled();
  });

  it('POST respond rejects a missing answer (400)', async () => {
    const res = await call('POST', '/students/roll-call/rc1/respond', { params: { id: 'rc1' }, body: {}, user: student });
    expect(res.statusCode).toBe(400);
    expect(svc.respondToRollCall).not.toHaveBeenCalled();
  });

  it('POST respond records the answer with the reported location', async () => {
    const res = await call('POST', '/students/roll-call/rc1/respond', {
      params: { id: 'rc1' },
      body: { answer: 'present', lat: 30.1, lng: 31.2, accuracy: 12 },
      user: student,
    });
    expect(res.statusCode).toBe(200);
    expect(svc.respondToRollCall).toHaveBeenCalledWith({
      tenantId: 'A', rollCallId: 'rc1', studentId: 'st1', answer: 'present', lat: 30.1, lng: 31.2, accuracy: 12,
    });
  });

  it('POST respond maps a traveling student to 409', async () => {
    svc.respondToRollCall.mockRejectedValueOnce(new Error('ROLL_CALL_EXEMPT'));
    const res = await call('POST', '/students/roll-call/rc1/respond', { params: { id: 'rc1' }, body: { answer: 'absent' }, user: student });
    expect(res.statusCode).toBe(409);
  });
});
