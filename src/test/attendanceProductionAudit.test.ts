import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { AppPermission } from '../types/permissions';

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
  let rawResult: any = { recordset: [], rows: [] };
  const kdb = vi.fn((table: string) => {
    const rec: { table: string; ops: Op[] } = { table, ops: [] };
    calls.push(rec);
    const proxy = new Proxy({ __rec: rec }, {
      get(t, prop) {
        if (prop === 'then') {
          return (onF: any, onR: any) => Promise.resolve(applyOps(rowsStore[rec.table] ?? [], rec.ops)).then(onF, onR);
        }
        if (prop === 'raw') {
          return (...args: any[]) => ({
            then: (onF: any) => Promise.resolve(rawResult).then(onF),
            _rawArgs: args,
          });
        }
        return (...args: any[]) => { rec.ops.push({ m: String(prop), a: args }); return proxy; };
      },
    });
    return proxy;
  });
  (kdb as any).transaction = async (cb: any) => cb(kdb);
  (kdb as any).raw = (...args: any[]) => ({
    then: (onF: any) => Promise.resolve(rawResult).then(onF),
    _rawArgs: args,
  });
  return {
    kdb,
    calls,
    setRows(table: string, rows: any[]) { rowsStore[table] = rows; },
    setRawResult(r: any) { rawResult = r; },
    reset() { for (const k of Object.keys(rowsStore)) rowsStore[k] = []; calls.length = 0; rawResult = { recordset: [], rows: [] }; },
    inserts(table: string) {
      return calls
        .filter((c) => c.table === table && c.ops?.some((o) => o.m === 'insert'))
        .map((c) => c.ops!.find((o) => o.m === 'insert')!.a[0]);
    },
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
type ServiceModule = typeof import('../backend/services/attendance.service');

let eventRoutes: EventRoutesModule;
let service: ServiceModule;

beforeAll(async () => {
  eventRoutes = await import('../backend/api/eventAttendance.routes');
  service = await import('../backend/services/attendance.service');
}, 60000);

beforeEach(() => {
  dbMock.reset();
  computeUserTenantIds.mockClear();
  checkUserPermission.mockResolvedValue(false);
  logAuditEvent.mockClear();
});

// ─────────────────── Router-level helpers ───────────────────
function makeRes() {
  const res: any = { statusCode: 200, body: null, done: false };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (o: any) => { res.body = o; res.done = true; return res; };
  res.set = () => res; res.send = () => { res.done = true; return res; }; res.end = () => res;
  res.headersSent = false; res.finished = false;
  res.getHeader = () => null; res.setHeader = () => res; res.removeHeader = () => res;
  return res;
}
function invoke(req: any, res: any) {
  return new Promise<void>((resolve) => {
    const started = Date.now();
    const poll = () => {
      if (res.done || Date.now() - started > 2000) return resolve();
      setTimeout(poll, 5);
    };
    poll();
    (eventRoutes.default as any).handle(req, res, () => undefined);
  });
}

const FUTURE_SESSION = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const operator = { id: 'op1', role: 'assistant_supervisor', tenantId: 'A' };
const seedAssignedSession = (eventId: string, sessionId: string) => {
  dbMock.setRows('events', [{ id: eventId, tenant_id: 'A' }]);
  dbMock.setRows('event_responsible', [{ event_id: eventId, user_id: 'op1', attendance_operator: 1 }]);
  dbMock.setRows('event_sessions', [{ id: sessionId, event_id: eventId, status: 'open', start_time: FUTURE_SESSION }]);
  dbMock.setRows('students', [{ id: 'stu1', tenant_id: 'A', name: 'طالب' }]);
};

describe('A: event-scoped operator (assigned to A cannot operate B)', () => {
  it('1. sessions list for an unassigned event → 403', async () => {
    dbMock.setRows('events', [{ id: 'ev2', tenant_id: 'A' }]);
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'op1', attendance_operator: 1 }]);
    const res = makeRes();
    await invoke({ method: 'GET', url: '/ev2/attendance-scan/sessions', params: { id: 'ev2' }, body: {}, query: {}, user: operator }, res);
    expect(res.statusCode).toBe(403);
  });

  it('2. scan for an unassigned event → 403 before any recording', async () => {
    dbMock.setRows('events', [{ id: 'ev2', tenant_id: 'A' }]);
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'op1', attendance_operator: 1 }]);
    dbMock.setRows('event_sessions', [{ id: 's2', event_id: 'ev2', status: 'open' }]);
    const qr = service.generateStudentQr({ id: 'stu1' }, 'A');
    const res = makeRes();
    await invoke({ method: 'POST', url: '/ev2/attendance-scan/sessions/s2/scan', params: { id: 'ev2', sessionId: 's2' }, body: { qr, method: 'qr' }, query: {}, user: operator }, res);
    expect(res.statusCode).toBe(403);
    expect(dbMock.calls.filter((c) => c.table === 'event_attendance_detailed' && c.ops?.some((o) => o.m === 'insert')).length).toBe(0);
  });

  it('3. the same operator reaches their own assigned event → 200', async () => {
    seedAssignedSession('ev1', 's1');
    const res = makeRes();
    await invoke({ method: 'GET', url: '/ev1/attendance-scan/sessions', params: { id: 'ev1' }, body: {}, query: {}, user: operator }, res);
    expect(res.statusCode).toBe(200);
  });

  it('4. cross-tenant event stays rejected even when assigned', async () => {
    dbMock.setRows('events', [{ id: 'evZ', tenant_id: 'Z' }]);
    dbMock.setRows('event_responsible', [{ event_id: 'evZ', user_id: 'op1', attendance_operator: 1 }]);
    computeUserTenantIds.mockResolvedValue(['A']);
    const res = makeRes();
    await invoke({ method: 'GET', url: '/evZ/attendance-scan/sessions', params: { id: 'evZ' }, body: {}, query: {}, user: operator }, res);
    expect(res.statusCode).toBe(403);
  });
});

describe('B: check-in replay never re-notifies or re-charges', () => {
  it('1. replaying the same status over an existing check-in → no notification, no penalty', async () => {
    seedAssignedSession('ev1', 's1');
    dbMock.setRows('event_attendance_detailed', [{
      id: 'atd1', event_id: 'ev1', session_id: 's1', student_id: 'stu1', tenant_id: 'A', status: 'present', unexcused: 0, created_at: new Date(),
    }]);
    dbMock.setRows('event_attendance', [{ event_id: 'ev1', student_id: 'stu1', status: 'present' }]);
    const qr = service.generateStudentQr({ id: 'stu1' }, 'A');
    const res = makeRes();
    await invoke({ method: 'POST', url: '/ev1/attendance-scan/sessions/s1/scan', params: { id: 'ev1', sessionId: 's1' }, body: { qr, method: 'qr' }, query: {}, user: operator }, res);
    expect(res.statusCode).toBe(200);
    expect(dbMock.inserts('notifications').length).toBe(0);
    expect(dbMock.inserts('attendance_penalties').length).toBe(0);
    expect(dbMock.inserts('finances').length).toBe(0);
  });

  it('2. a first check-in notifies exactly once', async () => {
    seedAssignedSession('ev1', 's1');
    const qr = service.generateStudentQr({ id: 'stu1' }, 'A');
    const res = makeRes();
    await invoke({ method: 'POST', url: '/ev1/attendance-scan/sessions/s1/scan', params: { id: 'ev1', sessionId: 's1' }, body: { qr, method: 'qr' }, query: {}, user: operator }, res);
    expect(res.statusCode).toBe(200);
    expect(dbMock.inserts('notifications').length).toBe(1);
  });
});

describe('C: re-running finalization never duplicates warnings/cases', () => {
  it('1. student with 3 unexcused absences and existing W1+W2 → only FINAL_WARNING created', async () => {
    dbMock.setRows('attendance_policy', [{ tenant_id: 'A', enforce_absence_thresholds: 1, weighted_attendance_enabled: 0, warning_1_threshold: 1, warning_2_threshold: 2, final_warning_threshold: 3, disciplinary_review_threshold: 4, residence_termination_review_threshold: 5, excuse_time_limit_hours: 48, parent_notify_on_absence: 1, parent_notify_on_late: 0, parent_notify_on_warning: 1, version: 1 }]);
    dbMock.setRows('student_warnings', [
      { student_id: 'stu1', warning_type: 'WARNING_1', is_attendance_warning: 1, attendance_id: 'ev1-s1-stu1' },
      { student_id: 'stu1', warning_type: 'WARNING_2', is_attendance_warning: 1, attendance_id: 'ev1-s1-stu1' },
    ]);
    dbMock.setRows('event_attendance_detailed', Array.from({ length: 3 }, (_, i) => ({
      id: `atd${i}`, tenant_id: 'A', student_id: 'stu1', status: 'absent', unexcused: 1, is_required_attendance: 1, attendance_weight: 1, counts_toward_absence_limit: 1,
    })));
    const created = await service.runEscalationsForStudent({ studentId: 'stu1', tenantId: 'A', userId: 'op1', eventId: 'ev1', sessionId: 's1' });
    expect(created).toBe(1);
    const inserted = dbMock.inserts('student_warnings');
    expect(inserted.length).toBe(1);
    expect(inserted[0].warning_type).toBe('FINAL_WARNING');
    expect(inserted[0].is_attendance_warning).toBe(1);
    expect(inserted[0].policy_version).toBe(1);
    expect(inserted[0].notify_parent).toBe(1);
  });
});

describe('D: closing a session twice is idempotent', () => {
  beforeEach(() => {
    dbMock.setRawResult({ recordset: [{ student_id: 'stu1' }], rows: [] });
    dbMock.setRows('attendance_policy', [{ tenant_id: 'A', enforce_absence_thresholds: 1, weighted_attendance_enabled: 0, warning_1_threshold: 1, warning_2_threshold: 2, final_warning_threshold: 3, disciplinary_review_threshold: 4, residence_termination_review_threshold: 5, excuse_time_limit_hours: 48, parent_notify_on_absence: 1, parent_notify_on_late: 0, parent_notify_on_warning: 1, version: 1 }]);
    dbMock.setRows('student_warnings', [{ student_id: 'stu1', warning_type: 'WARNING_1', is_attendance_warning: 1, attendance_id: 'ev1-s1-stu1' }]);
    dbMock.setRows('event_attendance_detailed', [{ id: 'atd1', event_id: 'ev1', session_id: 's1', student_id: 'stu1', tenant_id: 'A', status: 'absent', absence_processed: 1, unexcused: 1 }]);
  });

  it('1. first close after the row already exists finalizes nothing new', async () => {
    const result = await service.finalizeAbsencesForEvent({ id: 'ev1', tenant_id: 'A' }, { id: 's1' }, 'op1');
    expect(result).toEqual({ finalized: 0, escalated: 0 });
    expect(dbMock.inserts('event_attendance_detailed').length).toBe(0);
    expect(dbMock.inserts('student_warnings').length).toBe(0);
  });

  it('2. a second close performs no new domain writes at all', async () => {
    await service.finalizeAbsencesForEvent({ id: 'ev1', tenant_id: 'A' }, { id: 's1' }, 'op1');
    const result = await service.finalizeAbsencesForEvent({ id: 'ev1', tenant_id: 'A' }, { id: 's1' }, 'op1');
    expect(result).toEqual({ finalized: 0, escalated: 0 });
    for (const table of ['event_attendance_detailed', 'student_warnings', 'disciplinary_cases', 'attendance_penalties', 'finances', 'student_points', 'notifications']) {
      expect(dbMock.inserts(table).length).toBe(0);
    }
  });
});

describe('E: approved excuse reverses the penalty and clears the absence', () => {
  it('1. approve → attendance excused, unexcused cleared, penalty reversed with paired ledger rows', async () => {
    dbMock.setRows('attendance_policy', [{ tenant_id: 'A', enforce_absence_thresholds: 1, weighted_attendance_enabled: 0, warning_1_threshold: 1, warning_2_threshold: 2, final_warning_threshold: 3, disciplinary_review_threshold: 4, residence_termination_review_threshold: 5, excuse_time_limit_hours: 48, parent_notify_on_absence: 1, parent_notify_on_late: 0, parent_notify_on_warning: 1, version: 1 }]);
    dbMock.setRows('student_warnings', [{ student_id: 'stu1', warning_type: 'WARNING_1', is_attendance_warning: 1, attendance_id: 'ev1-s1-stu1' }]);
    dbMock.setRows('attendance_excuses', [{ id: 'ex1', student_id: 'stu1', event_id: 'ev1', session_id: 's1', attendance_id: 'atd1', tenant_id: 'A', reason: 'مرض', status: 'PENDING' }]);
    dbMock.setRows('events', [{ id: 'ev1', tenant_id: 'A' }]);
    dbMock.setRows('event_attendance_detailed', [{ id: 'atd1', event_id: 'ev1', session_id: 's1', student_id: 'stu1', tenant_id: 'A', status: 'absent', unexcused: 1, penalty_applied: 1, penalty_status: 'APPLIED' }]);
    dbMock.setRows('attendance_penalties', [{ id: 'pn1', attendance_id: 'atd1', student_id: 'stu1', event_id: 'ev1', session_id: 's1', tenant_id: 'A', status: 'APPLIED', financial_amount: 50, points_deduction: 0, finance_id: 'fin1', points_ledger_id: null }]);

    const excuse = { id: 'ex1', student_id: 'stu1', event_id: 'ev1', session_id: 's1', attendance_id: 'atd1', tenant_id: 'A', reason: 'مرض', status: 'PENDING' };
    await service.decideExcuse({ excuse, decision: 'APPROVED', decidedBy: 'op1', tenantId: 'A' });

    const excusesUpdate = dbMock.calls.filter((c) => c.table === 'attendance_excuses' && c.ops?.some((o) => o.m === 'update'));
    expect(excusesUpdate.length).toBeGreaterThan(0);
    const firstExcuseUpdate = excusesUpdate[0].ops!.find((o) => o.m === 'update')!;
    expect(firstExcuseUpdate.a[0].status).toBe('APPROVED');

    const detailedUpdate = dbMock.calls.filter((c) => c.table === 'event_attendance_detailed' && c.ops?.some((o) => o.m === 'update'))
      .map((c) => c.ops!.find((o) => o.m === 'update')!.a[0]);
    expect(detailedUpdate.some((u: any) => u.status === 'excused' && u.unexcused === 0)).toBe(true);

    const financeReversals = dbMock.inserts('finances').filter((f: any) => f.is_reversal === 1);
    expect(financeReversals.length).toBe(1);
    expect(financeReversals[0].type).toBe('revenue');
    expect(financeReversals[0].amount).toBe(50);
    expect(financeReversals[0].reversal_of_id).toBe('fin1');
    expect(financeReversals[0].reference).toBe('pn1');

    const penaltyUpdate = dbMock.calls.filter((c) => c.table === 'attendance_penalties' && c.ops?.some((o) => o.m === 'update'))
      .map((c) => c.ops!.find((o) => o.m === 'update')!.a[0]);
    expect(penaltyUpdate.some((u: any) => u.status === 'REVERSED')).toBe(true);
    expect(dbMock.inserts('student_points').length).toBe(0);
  });
});