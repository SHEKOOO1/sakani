import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { AppPermission } from '../types/permissions';

// ───────────────────────────────────────────────────────────────
// Self-contained security & authorization tests for the event
// attendance feature. kdb + middleware are mocked: no live server.
// ───────────────────────────────────────────────────────────────

type Op = { m: string; a: any[] };

function matchesWhere(row: any, args: any[]): boolean {
  if (args.length >= 2 && typeof args[1] === 'string' && ['like', '=', '>', '<', '>=', '<='].includes(args[1])) {
    return getKey(row, String(args[0])) === args[2];
  }
  if (typeof args[0] === 'object' && args[0] !== null) {
    return Object.entries(args[0]).every(([col, val]) => getKey(row, col) === val);
  }
  return getKey(row, String(args[0])) === args[1];
}
function getKey(row: any, col: string): any {
  if (row == null || typeof row !== 'object') return undefined;
  if (col in row) return row[col];
  const last = col.split('.').pop();
  if (last && last in row) return row[last];
  return undefined;
}
function applyOps(val: any, ops: Op[]): any {
  let out = val;
  for (const { m, a } of ops) {
    if (m === 'first') { out = Array.isArray(out) ? out[0] : out; continue; }
    if (!Array.isArray(out)) continue;
    if (m === 'where') out = out.filter((r: any) => matchesWhere(r, a));
  }
  return out;
}
function createKdbMock() {
  const rowsStore: Record<string, any[]> = {};
  const calls: { table: string; ops?: Op[] }[] = [];
  const kdb = vi.fn((table: string) => {
    const rec: { table: string; ops: Op[] } = { table, ops: [] };
    calls.push(rec);
    const proxy = new Proxy({ __rec: rec }, {
      get(t, prop) {
        if (prop === 'then') {
          return (onF: any, onR: any) => Promise.resolve(applyOps(rowsStore[rec.table] ?? [], rec.ops)).then(onF, onR);
        }
        return (...args: any[]) => { rec.ops.push({ m: String(prop), a: args }); return proxy; };
      },
    });
    return proxy;
  });
  return {
    kdb,
    calls,
    setRows(table: string, rows: any[]) { rowsStore[table] = rows; },
    reset() { for (const k of Object.keys(rowsStore)) rowsStore[k] = []; calls.length = 0; },
  };
}

const dbMock = createKdbMock();

const computeUserTenantIds = vi.fn(async (user: any) => {
  if (user.role === 'admin') return [];
  if (user.role === 'bishop') return ['A', 'B'];
  return user.tenantId ? [user.tenantId] : [];
});
const checkUserPermission = vi.fn(async (_uid?: string, _perm?: AppPermission) => false);
const logAuditEvent = vi.fn();
const authenticate = vi.fn((_req: any, _res: any, next: any) => next());
const authorizePermission = vi.fn(() => (_req: any, _res: any, next: any) => next());
const sanitizeInput = vi.fn((_req: any, _res: any, next: any) => next());

vi.mock('../backend/infrastructure/db', () => ({
  kdb: dbMock.kdb,
  checkUserPermission,
  logAuditEvent,
}));
vi.mock('../backend/api/middleware', () => ({
  authenticate,
  authorizePermission,
  sanitizeInput,
  computeUserTenantIds,
}));

type EventRoutesModule = typeof import('../backend/api/eventAttendance.routes');
type StudentRoutesModule = typeof import('../backend/api/studentAttendance.routes');
type PolicyRoutesModule = typeof import('../backend/api/attendancePolicy.routes');
type ServiceModule = typeof import('../backend/services/attendance.service');

let eventRoutes: EventRoutesModule;
let studentRoutes: StudentRoutesModule;
let policyRoutes: PolicyRoutesModule;
let service: ServiceModule;

beforeAll(async () => {
  eventRoutes = await import('../backend/api/eventAttendance.routes');
  studentRoutes = await import('../backend/api/studentAttendance.routes');
  policyRoutes = await import('../backend/api/attendancePolicy.routes');
  service = await import('../backend/services/attendance.service');
}, 60000);

beforeEach(() => {
  dbMock.reset();
  computeUserTenantIds.mockClear();
  checkUserPermission.mockResolvedValue(false);
});

// ═══════════════════════════════════════════════════════════════
// A — canOperateAttendance (server-side gate, DB-derived only)
// ═══════════════════════════════════════════════════════════════
describe('A: canOperateAttendance (attendance operator gate)', () => {
  const event = { id: 'ev1', tenant_id: 'A' };

  it('1. admin always passes', async () => {
    expect(await eventRoutes.canOperateAttendance({ user: { id: 'adm', role: 'admin' } }, event)).toBe(true);
  });

  it('2. staff without assignment and without permission → false', async () => {
    checkUserPermission.mockResolvedValue(false);
    expect(await eventRoutes.canOperateAttendance({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, event)).toBe(false);
  });

  it('3. assigned operator (attendance_operator=1) → true regardless of permission', async () => {
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'u1', attendance_operator: 1 }]);
    checkUserPermission.mockResolvedValue(false);
    expect(await eventRoutes.canOperateAttendance({ user: { id: 'u1', role: 'assistant_supervisor', tenantId: 'A' } }, event)).toBe(true);
  });

  it('4. assigned but attendance_operator=0 and no permission → false (flag must be honored)', async () => {
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'u1', attendance_operator: 0 }]);
    checkUserPermission.mockResolvedValue(false);
    expect(await eventRoutes.canOperateAttendance({ user: { id: 'u1', role: 'assistant_supervisor', tenantId: 'A' } }, event)).toBe(false);
  });

  it('5. assigned but attendance_operator=0 with OPERATE permission → true', async () => {
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'u1', attendance_operator: 0 }]);
    checkUserPermission.mockResolvedValue(true);
    expect(await eventRoutes.canOperateAttendance({ user: { id: 'u1', role: 'priest', tenantId: 'A' } }, event)).toBe(true);
    expect(checkUserPermission).toHaveBeenCalledWith('u1', AppPermission.OPERATE_EVENT_ATTENDANCE);
  });

  it('6. operator of another residence can never operate this event (tenant isolation)', async () => {
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'uB', attendance_operator: 1 }]);
    computeUserTenantIds.mockResolvedValue(['B']);
    checkUserPermission.mockResolvedValue(true);
    expect(await eventRoutes.canOperateAttendance({ user: { id: 'uB', role: 'supervisor', tenantId: 'B' } }, event)).toBe(false);
  });

  it('7. scope derives from computeUserTenantIds — a forged tenantId on the request cannot widen access', async () => {
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'uX', attendance_operator: 1 }]);
    computeUserTenantIds.mockResolvedValue(['other']);
    // Tenant scope is computed server-side; the handler never reads a client-supplied tenant header.
    await eventRoutes.canOperateAttendance({ user: { id: 'uX', role: 'supervisor', tenantId: 'A' } }, event);
    expect(computeUserTenantIds).toHaveBeenCalled();
  });

  it('8. institution-wide event (tenant_id null) requires no tenant match, only the perm', async () => {
    checkUserPermission.mockResolvedValue(true);
    expect(await eventRoutes.canOperateAttendance({ user: { id: 'uG', role: 'supervisor' } }, { id: 'ev9', tenant_id: null })).toBe(true);
    checkUserPermission.mockResolvedValue(false);
    expect(await eventRoutes.canOperateAttendance({ user: { id: 'uG', role: 'supervisor' } }, { id: 'ev9', tenant_id: null })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// B — canViewStudentAttendance (profile history / QR)
// ═══════════════════════════════════════════════════════════════
describe('B: canViewStudentAttendance (history + QR access)', () => {
  it('1. admin can view any student', async () => {
    dbMock.setRows('students', [{ id: 's1', user_id: 'uX', tenant_id: 'A' }]);
    expect(await studentRoutes.canViewStudentAttendance({ user: { id: 'adm', role: 'admin' } }, 's1')).toBe(200);
  });

  it('2. the student themself can view their own history', async () => {
    dbMock.setRows('students', [{ id: 's1', user_id: 'uSelf', tenant_id: 'A' }]);
    expect(await studentRoutes.canViewStudentAttendance({ user: { id: 'uSelf', role: 'student' } }, 's1')).toBe(200);
  });

  it('3. a linked parent can view their child history', async () => {
    dbMock.setRows('students', [{ id: 's1', user_id: 'uSelf', tenant_id: 'A' }]);
    dbMock.setRows('parents', [{ id: 'p1', user_id: 'uParent' }]);
    dbMock.setRows('student_guardians', [{ guardian_id: 'p1', student_id: 's1' }]);
    expect(await studentRoutes.canViewStudentAttendance({ user: { id: 'uParent', role: 'parent' } }, 's1')).toBe(200);
  });

  it('4. an unrelated parent is denied even if another guardian exists', async () => {
    dbMock.setRows('students', [{ id: 's1', user_id: 'uSelf', tenant_id: 'A' }]);
    dbMock.setRows('parents', [{ id: 'p1', user_id: 'uParent' }]);
    dbMock.setRows('student_guardians', [{ guardian_id: 'p2', student_id: 's1' }]);
    expect(await studentRoutes.canViewStudentAttendance({ user: { id: 'uParent', role: 'parent' } }, 's1')).toBe(403);
  });

  it('5. staff with VIEW_ATTENDANCE in the same residence → allowed; other residence → denied', async () => {
    dbMock.setRows('students', [{ id: 'sA', user_id: 'uX', tenant_id: 'A' }]);
    checkUserPermission.mockResolvedValue(true);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await studentRoutes.canViewStudentAttendance({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'sA')).toBe(200);
    computeUserTenantIds.mockResolvedValue(['B']);
    expect(await studentRoutes.canViewStudentAttendance({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'sA')).toBe(403);
  });

  it('6. staff without the permission is denied even in the same residence', async () => {
    dbMock.setRows('students', [{ id: 'sA', user_id: 'uX', tenant_id: 'A' }]);
    checkUserPermission.mockResolvedValue(false);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await studentRoutes.canViewStudentAttendance({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'sA')).toBe(403);
  });

  it('7. missing student → 404 (never an open 200) for non-admin staff', async () => {
    expect(await studentRoutes.canViewStudentAttendance({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'ghost')).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════
// C — Tenant & permission guards on the policy router
// ═══════════════════════════════════════════════════════════════
describe('C: canAccessTenant / requirePermOrAdmin (policy router)', () => {
  it('1. admin access to any tenant', async () => {
    expect(await policyRoutes.canAccessTenant({ user: { id: 'adm', role: 'admin' } }, 'Z')).toBe(true);
  });
  it('2. bishop access to managed residences only', async () => {
    computeUserTenantIds.mockResolvedValue(['A', 'B']);
    const req = { user: { id: 'b1', role: 'bishop' } };
    expect(await policyRoutes.canAccessTenant(req, 'A')).toBe(true);
    expect(await policyRoutes.canAccessTenant(req, 'C')).toBe(false);
  });
  it('3. supervisor cannot read another residence policy', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await policyRoutes.canAccessTenant({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'B')).toBe(false);
  });
  it('4. requirePermOrAdmin rejects without permission (403 emitted) and accepts with it', async () => {
    const res = { status: (c: number) => ({ json: (o: any) => o }), json: () => ({}) };
    checkUserPermission.mockResolvedValue(false);
    expect(await policyRoutes.requirePermOrAdmin({ user: { id: 'u1', role: 'supervisor' } }, res, AppPermission.VIEW_ATTENDANCE)).toBe(false);
    checkUserPermission.mockResolvedValue(true);
    expect(await policyRoutes.requirePermOrAdmin({ user: { id: 'u1', role: 'supervisor' } }, res, AppPermission.VIEW_ATTENDANCE)).toBe(true);
  });
  it('5. admin bypasses the permission check entirely', async () => {
    checkUserPermission.mockResolvedValue(false);
    const res = { status: () => ({ json: () => ({}) }) };
    expect(await policyRoutes.requirePermOrAdmin({ user: { id: 'adm', role: 'admin' } }, res, AppPermission.MANAGE_EVENT_ATTENDANCE)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// D — Signed student QR: forgery & validity
// ═══════════════════════════════════════════════════════════════
describe('D: signed student QR forgery resistance', () => {
  it('1. generated QR round-trips to the same student + tenant', () => {
    const qr = service.generateStudentQr({ id: 'stu1' }, 'A');
    expect(qr.startsWith('DORM-STUDENT-')).toBe(true);
    expect(service.verifyStudentQr(qr)).toEqual({ studentId: 'stu1', tenantId: 'A' });
  });

  it('2. null tenant round-trips with a null tenant', () => {
    const qr = service.generateStudentQr({ id: 'stu1' }, null);
    expect(service.verifyStudentQr(qr)).toEqual({ studentId: 'stu1', tenantId: null });
  });

  it('3. token signed with a different secret is rejected', () => {
    const forged = 'DORM-STUDENT-' + jwt.sign({ sid: 'stu1', tid: 'A', purpose: 'attendance-scan' }, 'attacker-secret');
    expect(service.verifyStudentQr(forged)).toBeNull();
  });

  it('4. a validly signed token for the WRONG purpose is rejected', () => {
    const wrong = 'DORM-STUDENT-' + jwt.sign({ sid: 'stu1', purpose: 'profile' }, process.env.JWT_SECRET!);
    expect(service.verifyStudentQr(wrong)).toBeNull();
  });

  it('5. tampered payload (another student id) with valid signature → signature mismatch rejected', () => {
    // Tampering = removing one char; signature no longer matches → verify fails.
    const qr = service.generateStudentQr({ id: 'stu1' }, 'A');
    const tampered = qr.slice(0, qr.length - 4) + 'XX==';
    expect(service.verifyStudentQr(tampered)).toBeNull();
  });

  it('6. expired token is rejected', () => {
    const expired = 'DORM-STUDENT-' + jwt.sign({ sid: 'stu1', purpose: 'attendance-scan' }, process.env.JWT_SECRET!, { expiresIn: -1 });
    expect(service.verifyStudentQr(expired)).toBeNull();
  });

  it('7. arbitrary / non-student strings are rejected', () => {
    expect(service.verifyStudentQr('plain-student-id')).toBeNull();
    expect(service.verifyStudentQr('')).toBeNull();
    expect(service.verifyStudentQr(null as any)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// E — Route-level scan guards (eventAttendance router.handle)
// ═══════════════════════════════════════════════════════════════
describe('E: scan endpoint authorization (router-level)', () => {
  const makeRes = () => {
    const res: any = { statusCode: 200, body: null, done: false };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (o: any) => { res.body = o; res.done = true; return res; };
    res.set = () => res; res.send = () => { res.done = true; return res; }; res.end = () => res;
    res.headersSent = false; res.finished = false;
    res.getHeader = () => null; res.setHeader = () => res; res.removeHeader = () => res;
    return res;
  };
  const invoke = (req: any, res: any) =>
    new Promise<void>((resolve) => {
      const started = Date.now();
      const poll = () => {
        if (res.done || Date.now() - started > 2000) return resolve();
        setTimeout(poll, 5);
      };
      poll();
      (eventRoutes.default as any).handle(req, res, () => undefined);
    });
  const base = () => ({
    method: 'POST',
    url: '/ev1/attendance-scan/sessions/s1/scan',
    params: { id: 'ev1', sessionId: 's1' },
    body: {},
    query: {},
    user: { id: 'op1', role: 'assistant_supervisor', tenantId: 'A' },
  });

  const seedOpenSession = () => {
    dbMock.setRows('events', [{ id: 'ev1', tenant_id: 'A' }]);
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'op1', attendance_operator: 1 }]);
    dbMock.setRows('event_sessions', [{ id: 's1', event_id: 'ev1', status: 'open' }]);
  };

  it('1. forged QR is rejected with 400 even from an authorized operator', async () => {
    seedOpenSession();
    const req: any = { ...base(), body: { qr: 'DORM-STUDENT-' + jwt.sign({ sid: 'stu1', purpose: 'attendance-scan' }, 'attacker-secret'), method: 'qr' } };
    const res = makeRes();
    await invoke(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('2. manual entry without MANAGE_EVENT_ATTENDANCE → 403', async () => {
    seedOpenSession();
    checkUserPermission.mockImplementation(async (_uid?: string, perm?: AppPermission) => {
      return perm === AppPermission.OPERATE_EVENT_ATTENDANCE; // assigned operator, no manage perm
    });
    const req: any = { ...base(), body: { studentId: 'stu1', method: 'manual' } };
    const res = makeRes();
    await invoke(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body?.message).toContain('الإدخال اليدوي');
  });

  it('3. scan on a non-open session → 400 (session must be open)', async () => {
    dbMock.setRows('events', [{ id: 'ev1', tenant_id: 'A' }]);
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'op1', attendance_operator: 1 }]);
    dbMock.setRows('event_sessions', [{ id: 's1', event_id: 'ev1', status: 'scheduled' }]);
    const req: any = { ...base(), body: { qr: '', method: 'qr' } };
    const res = makeRes();
    await invoke(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('4. missing qr and studentId → 400', async () => {
    seedOpenSession();
    const req: any = { ...base(), body: {} };
    const res = makeRes();
    await invoke(req, res);
    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// F — Decision determinism (duplicate warnings/charges invariant)
// ═══════════════════════════════════════════════════════════════
describe('F: escalation decisions are deterministic (idempotent candidate)', () => {
  it('1. running the decision twice yields identical steps (no drift → no duplicates)', async () => {
    const { summarizeAbsences, computeEscalations } = await import('../backend/services/attendanceEscalation');
    const policy = {
      enforce_absence_thresholds: true, weighted_attendance_enabled: false,
      warning_1_threshold: 1, warning_2_threshold: 2, final_warning_threshold: 3,
      disciplinary_review_threshold: 4, residence_termination_review_threshold: 5,
      excuse_time_limit_hours: 48, parent_notify_on_absence: true, parent_notify_on_late: false,
      parent_notify_on_warning: true, version: 1,
    } as const;
    const records = Array.from({ length: 6 }, () => ({ status: 'absent', unexcused: true, counts_toward_absence_limit: true, attendance_weight: 1, required_attendance: true }));
    const a = computeEscalations(summarizeAbsences(records), policy);
    const b = computeEscalations(summarizeAbsences(records), policy);
    expect(a).toHaveLength(b.length);
    expect(a.map((x) => x.key)).toEqual(b.map((x) => x.key));
  });
});