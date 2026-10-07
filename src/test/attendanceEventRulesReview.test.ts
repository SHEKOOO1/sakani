import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { AppPermission } from '../types/permissions';

// ───────────────────────────────────────────────────────────────
// Event rules (multi-rule engine), absence review workflow, and
// scan eligibility. Pure engine tests + mocked-service integration
// (same kdb mock harness as attendanceProductionAudit.test.ts).
// ───────────────────────────────────────────────────────────────

type Op = { m: string; a: any[] };

function getKey(row: any, col: string): any {
  if (row == null || typeof row !== 'object') return undefined;
  if (col in row) return row[col];
  const last = col.split('.').pop();
  if (last && last in row) return row[last];
  return undefined;
}
function likeMatch(value: any, pattern: string): boolean {
  const p = String(pattern);
  if (p.endsWith('%')) return String(value).startsWith(p.slice(0, -1));
  if (p.startsWith('%')) return String(value).endsWith(p.slice(1));
  return String(value) === p;
}
function rowMatches(row: any, ops: Op[]): boolean {
  for (const op of ops) {
    const a = op.a ?? [];
    if (op.m === 'where') {
      // where({obj}) / where(col, val) / where(col, op, val); where(fn) → pass-all
      if (typeof a[0] === 'function' || typeof a[0] !== 'string') {
        if (typeof a[0] === 'object' && a[0] !== null) {
          for (const [c, v] of Object.entries(a[0])) if (getKey(row, c) !== v) return false;
        }
        continue;
      }
      const key = String(a[0]);
      if (typeof a[1] === 'string' && ['like', '=', '>', '<', '>=', '<='].includes(a[1])) {
        const rv = getKey(row, key);
        if (a[1] === 'like') { if (!likeMatch(rv, a[2])) return false; }
        else if (a[1] === '=') { if (rv !== a[2]) return false; }
        else { const n = Number(rv), m = Number(a[2]); if (a[1] === '>') { if (!(n > m)) return false; } else if (a[1] === '<') { if (!(n < m)) return false; } else if (a[1] === '>=') { if (!(n >= m)) return false; } else { if (!(n <= m)) return false; } }
      } else if (getKey(row, key) !== a[1]) {
        return false;
      }
    } else if (op.m === 'whereIn') {
      const rv = getKey(row, String(a[0]));
      if (!(Array.isArray(a[1]) ? a[1].includes(rv) : a[1] === rv)) return false;
    } else if (op.m === 'whereNull') {
      if (getKey(row, String(a[0])) != null) return false;
    } else if (op.m === 'whereNotNull') {
      if (getKey(row, String(a[0])) == null) return false;
    }
  }
  return true;
}
function rowResolve(table: string, rowsStore: Record<string, any[]>, ops: Op[]): any {
  let out = rowsStore[table] ?? [];
  for (const op of ops) {
    const a = op.a ?? [];
    if (op.m === 'where' || op.m === 'whereIn' || op.m === 'whereNull' || op.m === 'whereNotNull') {
      out = out.filter((r: any) => rowMatches(r, [op]));
    } else if (op.m === 'first') {
      out = Array.isArray(out) ? out.slice(0, 1) : out;
    } else if (op.m === 'limit') {
      out = out.slice(0, Number(a[0]) || 0);
    }
  }
  return Array.isArray(out) ? (ops.some((o) => o.m === 'first') ? out[0] : out) : out;
}
function isRawLike(v: any): boolean {
  return v && typeof v === 'object' && typeof v.sql === 'string';
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
          return (onF: any, onR: any) => Promise.resolve(rowResolve(rec.table, rowsStore, rec.ops)).then(onF, onR);
        }
        if (prop === 'raw') {
          return (...args: any[]) => ({
            then: (onF: any) => Promise.resolve(rawResult).then(onF),
            _rawArgs: args,
          });
        }
        if (prop === 'insert') {
          return (rows: any) => {
            rec.ops.push({ m: 'insert', a: [rows] });
            if (!rowsStore[rec.table]) rowsStore[rec.table] = [];
            if (Array.isArray(rows)) rowsStore[rec.table].push(...rows);
            else rowsStore[rec.table].push(rows);
            return proxy;
          };
        }
        if (prop === 'del') {
          return () => {
            rec.ops.push({ m: 'del', a: [] });
            rowsStore[rec.table] = (rowsStore[rec.table] ?? []).filter((r: any) => !rowMatches(r, rec.ops.filter((o) => o.m !== 'del')));
            return proxy;
          };
        }
        if (prop === 'update') {
          return (obj: any) => {
            rec.ops.push({ m: 'update', a: [obj] });
            const filters = rec.ops.filter((o) => o.m !== 'update');
            for (const r of rowsStore[rec.table] ?? []) {
              if (rowMatches(r, filters)) {
                for (const [kk, vv] of Object.entries(obj)) {
                  if (!isRawLike(vv)) r[kk] = vv;
                }
              }
            }
            return proxy;
          };
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
    updates(table: string, filter?: (u: any) => boolean) {
      return calls
        .filter((c) => c.table === table && c.ops?.some((o) => o.m === 'update'))
        .map((c) => c.ops!.find((o) => o.m === 'update')!.a[0])
        .filter((u: any) => !filter || filter(u));
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

type EngineModule = typeof import('../backend/services/attendanceRuleEngine');
type ServiceModule = typeof import('../backend/services/attendance.service');
type RoutesModule = typeof import('../backend/api/eventAttendance.routes');

let engine: EngineModule;
let service: ServiceModule;
let routes: RoutesModule;

beforeAll(async () => {
  engine = await import('../backend/services/attendanceRuleEngine');
  service = await import('../backend/services/attendance.service');
  routes = await import('../backend/api/eventAttendance.routes');
}, 60000);

beforeEach(() => {
  dbMock.reset();
  computeUserTenantIds.mockClear();
  checkUserPermission.mockResolvedValue(false);
  logAuditEvent.mockClear();
});

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
    (routes.default as any).handle(req, res, () => undefined);
  });
}

const rule = (over: any = {}) => ({
  id: 'r-late-1',
  condition_status: 'late' as const,
  condition_min_late_minutes: null,
  condition_max_late_minutes: null,
  action_type: 'FINANCIAL_FEE' as const,
  points_amount: 0,
  fee_amount: 100,
  notification_message: null,
  enabled: true,
  sort_order: 0,
  ...over,
});

// ════════════════════════ A — Engine (pure) ════════════════════════
describe('A: evaluateEventRules (pure engine)', () => {
  it('1. late rule fires for a late arrival within bounds', () => {
    const fired = engine.evaluateEventRules(
      [rule({ condition_min_late_minutes: 5, condition_max_late_minutes: 30 })],
      { status: 'late', unexcused: false, late_minutes: 12 },
      'ALL_APPLICABLE'
    );
    expect(fired.map((r) => r.id)).toEqual(['r-late-1']);
  });
  it('2. late rule does NOT fire outside the lateness bounds', () => {
    const out = engine.evaluateEventRules(
      [rule({ condition_min_late_minutes: 5, condition_max_late_minutes: 30 })],
      { status: 'late', unexcused: false, late_minutes: 45 },
      'ALL_APPLICABLE'
    );
    expect(out).toEqual([]);
  });
  it('3. FIRST_APPLICABLE stops at the first match by sort_order', () => {
    const rules = [
      rule({ id: 'r1', condition_min_late_minutes: 0, condition_max_late_minutes: 10, sort_order: 2 }),
      rule({ id: 'r2', condition_min_late_minutes: 0, condition_max_late_minutes: 60, sort_order: 1 }),
      rule({ id: 'r3', condition_min_late_minutes: 0, condition_max_late_minutes: 5, sort_order: 3 }),
    ];
    const fired = engine.evaluateEventRules(rules, { status: 'late', unexcused: false, late_minutes: 7 }, 'FIRST_APPLICABLE');
    expect(fired.map((r) => r.id)).toEqual(['r2']);
  });
  it('4. ALL_APPLICABLE fires every matching rule in sort_order', () => {
    const rules = [
      rule({ id: 'r1', action_type: 'DEDUCT_POINTS', points_amount: 5, sort_order: 2 }),
      rule({ id: 'r2', sort_order: 1 }),
    ];
    const fired = engine.evaluateEventRules(rules, { status: 'late', unexcused: false, late_minutes: 7 }, 'ALL_APPLICABLE');
    expect(fired.map((r) => r.id)).toEqual(['r2', 'r1']);
  });
  it('5. present → nothing fires; excused/travel → nothing fires', () => {
    const rs = [rule({ condition_status: 'absent' }), rule({ condition_status: 'late' })];
    expect(engine.evaluateEventRules(rs, { status: 'present', unexcused: false, late_minutes: 0 }, 'ALL_APPLICABLE')).toEqual([]);
    expect(engine.evaluateEventRules(rs, { status: 'excused', unexcused: false, late_minutes: 0 }, 'ALL_APPLICABLE')).toEqual([]);
    expect(engine.evaluateEventRules(rs, { status: 'travel', unexcused: false, late_minutes: 0 }, 'ALL_APPLICABLE')).toEqual([]);
  });
  it('6. absent+unexcused fires absent AND unexcused groups; excused absence fires only absent', () => {
    const rs = [
      rule({ id: 'abs', condition_status: 'absent' }),
      rule({ id: 'unx', condition_status: 'unexcused' }),
    ];
    expect(engine.evaluateEventRules(rs, { status: 'absent', unexcused: true, late_minutes: 0 }, 'ALL_APPLICABLE').map((r) => r.id)).toEqual(['abs', 'unx']);
    expect(engine.evaluateEventRules(rs, { status: 'absent', unexcused: false, late_minutes: 0 }, 'ALL_APPLICABLE').map((r) => r.id)).toEqual(['abs']);
  });
  it('7. normalizeEventRules drops invalid rules, clamps numbers, honors sort_order, preserves disabled', () => {
    const norm = engine.normalizeEventRules([
      { condition_status: 'late', sort_order: 3 },
      { condition_status: 'absent', action_type: 'DEDUCT_POINTS', points_amount: -9, sort_order: 1 },
      null,
      { sort_order: 2 }, // no condition → dropped
      { condition_status: 'unexcused', enabled: false, sort_order: 0 },
    ]);
    expect(norm.map((r) => r.condition_status)).toEqual(['unexcused', 'absent', 'late']);
    expect(norm[1].points_amount).toBe(0);
    expect(norm[0].enabled).toBe(false);
    expect(norm[1].enabled).toBe(true);
    expect(norm[2].enabled).toBe(true);
  });
  it('8. appliedRuleIdsFromSnapshot reads the list shape (and legacy single shape)', () => {
    const snap = engine.serializeAppliedRulesList(
      [rule({ id: 'a1' }), rule({ id: 'a2', action_type: 'NONE' })],
      { mode: 'ALL_APPLICABLE', attendanceStatus: 'late', lateMinutes: 3, evaluatedAt: new Date() }
    );
    expect(engine.appliedRuleIdsFromSnapshot(snap)).toEqual(['a1', 'a2']);
    expect(engine.appliedRuleIdsFromSnapshot(engine.serializeAppliedRules(rule({ id: 'legacy' }), { mode: 'ALL_APPLICABLE', attendanceStatus: 'late', lateMinutes: 0, evaluatedAt: new Date() }))).toEqual(['legacy']);
    expect(engine.appliedRuleIdsFromSnapshot('garbage')).toEqual([]);
    expect(engine.appliedRuleIdsFromSnapshot(null)).toEqual([]);
  });
});

// ════════════════════════ B — Targeting eligibility ════════════════════════
describe('B: student targeting eligibility', () => {
  const student = { id: 'stu1', tenant_id: 'A', college: 'الهندسة', major: 'كهرباء', governorate: 'القاهرة', church_name: 'كنيسة مارمرقس' };
  it('1. no targeting / empty targeting → eligible', async () => {
    expect(await service.studentMatchesEventTargeting(student, null)).toBe(true);
    expect(await service.studentMatchesEventTargeting(student, {})).toBe(true);
  });
  it('2. explicit students whitelist wins', async () => {
    expect(await service.studentMatchesEventTargeting(student, { students: ['stu9'] })).toBe(false);
    expect(await service.studentMatchesEventTargeting(student, { students: ['stu1'] })).toBe(true);
  });
  it('3. tenant filter enforced', async () => {
    expect(await service.studentMatchesEventTargeting(student, { tenants: ['B'] })).toBe(false);
    expect(await service.studentMatchesEventTargeting(student, { tenants: ['A', 'B'] })).toBe(true);
  });
  it('4. college/major/governorate/church filters enforced', async () => {
    expect(await service.studentMatchesEventTargeting(student, { colleges: ['طب'] })).toBe(false);
    expect(await service.studentMatchesEventTargeting(student, { colleges: ['الهندسة'] })).toBe(true);
    expect(await service.studentMatchesEventTargeting(student, { majors: ['طب'] })).toBe(false);
    expect(await service.studentMatchesEventTargeting(student, { governorates: ['المنيا'] })).toBe(false);
    expect(await service.studentMatchesEventTargeting(student, { churches: ['كنيسة أخرى'] })).toBe(false);
  });
  it('5. approved subscription overrides an excluding targeting (باقة معتمدة)', async () => {
    dbMock.setRows('event_subscriptions', [{ event_id: 'ev1', student_id: 'stu1', status: 'approved' }]);
    dbMock.setRows('event_registrations', []);
    const r = await service.isStudentEligibleForAttendance({ id: 'ev1', targeting: { students: ['other'] } }, student);
    expect(r.eligible).toBe(true);
  });
  it('6. unapproved student is denied with a reason', async () => {
    dbMock.setRows('event_subscriptions', []);
    dbMock.setRows('event_registrations', []);
    const r = await service.isStudentEligibleForAttendance({ id: 'ev1', targeting: { students: ['other'] } }, student);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBeDefined();
  });
});

// ════════════════════════ C — Close → PENDING_REVIEW (no auto-escalation) ════════════════════════
describe('C: session close materializes PENDING_REVIEW without auto-escalation', () => {
  beforeEach(() => {
    dbMock.setRows('attendance_policy', [{ tenant_id: 'A', enforce_absence_thresholds: 1, weighted_attendance_enabled: 0, warning_1_threshold: 1, warning_2_threshold: 2, final_warning_threshold: 3, disciplinary_review_threshold: 4, residence_termination_review_threshold: 5, excuse_time_limit_hours: 48, parent_notify_on_absence: 1, parent_notify_on_late: 0, parent_notify_on_warning: 1, version: 1 }]);
  });

  it('1. absent student materialized as PENDING_REVIEW, unexcused stays 0, no warnings', async () => {
    dbMock.setRawResult({ recordset: [{ student_id: 'stu1' }], rows: [] });
    const result = await service.finalizeAbsencesForEvent({ id: 'ev1', tenant_id: 'A' }, { id: 's1' }, 'op1');
    expect(result).toEqual({ finalized: 1, escalated: 0 });
    const created = dbMock.inserts('event_attendance_detailed');
    expect(created.length).toBe(1);
    expect(created[0].status).toBe('absent');
    expect(created[0].final_status).toBe('PENDING_REVIEW');
    expect(created[0].unexcused).toBe(0);
    expect(created[0].absence_processed).toBe(1);
    expect(dbMock.inserts('student_warnings').length).toBe(0);
    expect(dbMock.inserts('disciplinary_cases').length).toBe(0);
  });
});

// ════════════════════════ D — classifyAbsence workflow ════════════════════════
describe('D: classifyAbsence (supervisor absence review)', () => {
  const policy = { tenant_id: 'A', enforce_absence_thresholds: 1, weighted_attendance_enabled: 0, warning_1_threshold: 1, warning_2_threshold: 2, final_warning_threshold: 3, disciplinary_review_threshold: 4, residence_termination_review_threshold: 5, excuse_time_limit_hours: 48, parent_notify_on_absence: 1, parent_notify_on_late: 0, parent_notify_on_warning: 1, version: 1 };
  const pendingRow = () => ({ id: 'atd1', event_id: 'ev1', session_id: 's1', student_id: 'stu1', tenant_id: 'A', status: 'absent', final_status: 'PENDING_REVIEW', unexcused: 0, absence_processed: 1, late_minutes: 0, absence_reason: null });

  beforeEach(() => {
    dbMock.setRows('attendance_policy', [policy]);
    dbMock.setRows('students', [{ id: 'stu1', tenant_id: 'A', name: 'طالب' }]);
    dbMock.setRows('event_sessions', [{ id: 's1', event_id: 'ev1', title: 'جلسة' }]);
    dbMock.setRows('event_attendance', [{ event_id: 'ev1', student_id: 'stu1', status: 'absent' }]);
  });

  it('1. UNEXCUSED sets final_state, unexcused, reviewer + fires rules + escalates', async () => {
    dbMock.setRows('event_attendance_detailed', [pendingRow()]);
    dbMock.setRows('event_rules', [{ id: 'r-unx', event_id: 'ev1', session_id: null, tenant_id: 'A', condition_status: 'unexcused', action_type: 'FINANCIAL_FEE', fee_amount: 150, points_amount: 0, notification_message: null, enabled: 1, sort_order: 0 }]);
    const updated = await service.classifyAbsence({ event: { id: 'ev1', tenant_id: 'A' }, attendanceId: 'atd1', classification: 'UNEXCUSED', reason: 'بدون عذر', userId: 'op1' });
    expect(updated.final_status).toBe('UNEXCUSED');
    expect(updated.unexcused).toBe(1);
    expect(updated.reviewed_by).toBe('op1');
    expect(updated.status).toBe('absent');
    const finance = dbMock.inserts('finances').find((f: any) => f.is_reversal === 0 && f.reference === 'event-rule:r-unx');
    expect(finance).toBeTruthy();
    expect(finance.amount).toBe(150);
    const warning = dbMock.inserts('student_warnings')[0];
    expect(warning).toBeTruthy();
    expect(warning.unexcused_absence_count_at_time).toBe(1);
  });

  it('2. EXCUSED classifies as excused + reverses tier penalty and event-rule ledger', async () => {
    dbMock.setRows('event_attendance_detailed', [pendingRow()]);
    dbMock.setRows('attendance_penalties', [{ id: 'pn1', attendance_id: 'atd1', student_id: 'stu1', event_id: 'ev1', session_id: 's1', tenant_id: 'A', status: 'APPLIED', financial_amount: 50, points_deduction: 0, finance_id: 'fin1', points_ledger_id: null }]);
    dbMock.setRows('finances', [{ id: 'finX', attendance_id: 'atd1', student_id: 'stu1', event_id: 'ev1', session_id: 's1', tenant_id: 'A', type: 'expense', amount: 30, reference: 'event-rule:r-unx', is_reversal: 0 }]);
    const updated = await service.classifyAbsence({ event: { id: 'ev1', tenant_id: 'A' }, attendanceId: 'atd1', classification: 'EXCUSED', reason: 'مرض مثبت بتقرير طبي', userId: 'op1' });
    expect(updated.final_status).toBe('EXCUSED');
    expect(updated.status).toBe('excused');
    expect(updated.unexcused).toBe(0);
    const reversals = dbMock.inserts('finances').filter((f: any) => f.is_reversal === 1);
    expect(reversals.length).toBe(2); // tier penalty reversal + event-rule reversal
    expect(reversals.some((r: any) => r.reversal_of_id === 'fin1')).toBe(true);
    expect(reversals.some((r: any) => r.reversal_of_id === 'finX' && r.reference === 'event-rule:r-unx')).toBe(true);
  });

  it('3. TRAVEL classifies as travel and keeps no unexcused flag', async () => {
    dbMock.setRows('event_attendance_detailed', [pendingRow()]);
    const updated = await service.classifyAbsence({ event: { id: 'ev1', tenant_id: 'A' }, attendanceId: 'atd1', classification: 'TRAVEL', reason: 'سفر خارج المحافظة', userId: 'op1' });
    expect(updated.status).toBe('travel');
    expect(updated.final_status).toBe('TRAVEL');
    expect(updated.unexcused).toBe(0);
  });

  it('4. already-reviewed or non-absent rows are rejected', async () => {
    dbMock.setRows('event_attendance_detailed', [{ ...pendingRow(), final_status: 'EXCUSED', status: 'excused' }]);
    await expect(service.classifyAbsence({ event: { id: 'ev1', tenant_id: 'A' }, attendanceId: 'atd1', classification: 'UNEXCUSED', userId: 'op1' })).rejects.toThrow('ALREADY_REVIEWED');
  });

  it('5. recordCheckIn boundary-arrival → factual UNEXCUSED + fires late/absent rules + escalates immediately', async () => {
    const past = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    dbMock.setRows('event_attendance_rules', [{ event_id: 'ev1', session_id: 's1', auto_apply_penalty: 1, penalty_mode: 'NONE', required_attendance: 1, counts_toward_absence_limit: 1, attendance_weight: 1, absent_after_minutes: 60, grace_period_minutes: 0, enabled: 1 }]);
    dbMock.setRows('event_rules', [{ id: 'r-abs', event_id: 'ev1', session_id: null, tenant_id: 'A', condition_status: 'unexcused', action_type: 'FINANCIAL_FEE', fee_amount: 80, points_amount: 0, notification_message: null, enabled: 1, sort_order: 0 }]);
    dbMock.setRows('attendance_policy', [policy]);
    dbMock.setRows('student_warnings', []);
    const event = { id: 'ev1', tenant_id: 'A', rule_evaluation_mode: 'ALL_APPLICABLE' };
    const session = { id: 's1', event_id: 'ev1', start_time: past };
    const student = { id: 'stu1', tenant_id: 'A', name: 'طالب' };
    const result = await service.recordCheckIn({ event, session, student, userId: 'op1', method: 'manual' });
    expect(result.attendance.status).toBe('absent');
    expect(result.attendance.final_status).toBe('UNEXCUSED');
    const finance = dbMock.inserts('finances').find((f: any) => f.reference === 'event-rule:r-abs' && f.is_reversal === 0);
    expect(finance).toBeTruthy();
    expect(finance.amount).toBe(80);
    expect(dbMock.inserts('student_warnings').length).toBe(1);
    expect(dbMock.inserts('notifications').length).toBe(1); // absence notification
  });
});

// ════════════════════════ E — Router-level: scan eligibility + rules + review ════════════════════════
describe('E: router-level integrations', () => {
  const operator = { id: 'op1', role: 'assistant_supervisor', tenantId: 'A' };

  it('1. scan of a non-targeted student → 403 with a reason, nothing recorded', async () => {
    dbMock.setRows('events', [{ id: 'ev1', tenant_id: 'A', targeting: JSON.stringify({ students: ['otherStu'] }) }]);
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'op1', attendance_operator: 1 }]);
    dbMock.setRows('event_sessions', [{ id: 's1', event_id: 'ev1', status: 'open', start_time: new Date().toISOString() }]);
    dbMock.setRows('students', [{ id: 'stu1', tenant_id: 'A', name: 'طالب' }]);
    dbMock.setRows('event_subscriptions', []);
    dbMock.setRows('event_registrations', []);
    const qr = service.generateStudentQr({ id: 'stu1' }, 'A');
    const res = makeRes();
    await invoke({ method: 'POST', url: '/ev1/attendance-scan/sessions/s1/scan', params: { id: 'ev1', sessionId: 's1' }, body: { qr, method: 'qr' }, query: {}, user: operator }, res);
    expect(res.statusCode).toBe(403);
    expect(dbMock.calls.filter((c) => c.table === 'event_attendance_detailed' && c.ops?.some((o) => o.m === 'insert')).length).toBe(0);
  });

  it('2. targeted student scans fine', async () => {
    dbMock.setRows('events', [{ id: 'ev1', tenant_id: 'A', targeting: JSON.stringify({ students: ['stu1'] }) }]);
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'op1', attendance_operator: 1 }]);
    dbMock.setRows('event_sessions', [{ id: 's1', event_id: 'ev1', status: 'open', start_time: new Date().toISOString() }]);
    dbMock.setRows('students', [{ id: 'stu1', tenant_id: 'A', name: 'طالب' }]);
    const qr = service.generateStudentQr({ id: 'stu1' }, 'A');
    const res = makeRes();
    await invoke({ method: 'POST', url: '/ev1/attendance-scan/sessions/s1/scan', params: { id: 'ev1', sessionId: 's1' }, body: { qr, method: 'qr' }, query: {}, user: operator }, res);
    expect(res.statusCode).toBe(200);
  });

  it('3. PUT rules persists the event_rules list + evaluation mode', async () => {
    dbMock.setRows('events', [{ id: 'ev1', tenant_id: 'A' }]);
    const res = makeRes();
    await invoke({
      method: 'PUT',
      url: '/ev1/attendance/rules',
      params: { id: 'ev1' },
      body: {
        rules: [{ condition_status: 'late', condition_min_late_minutes: 5, action_type: 'FINANCIAL_FEE', fee_amount: 50, sort_order: 1 }],
        evaluation_mode: 'FIRST_APPLICABLE',
      },
      query: {},
      user: operator,
    }, res);
    expect(res.statusCode).toBe(200);
    const inserted = dbMock.inserts('event_rules');
    expect(inserted.length).toBe(1);
    expect(inserted[0].condition_status).toBe('late');
    expect(inserted[0].fee_amount).toBe(50);
    const eventsUpdate = dbMock.updates('events');
    expect(eventsUpdate.some((u: any) => u.rule_evaluation_mode === 'FIRST_APPLICABLE')).toBe(true);
  });

  it('4. GET review returns pending absences; POST review classifies through the router', async () => {
    checkUserPermission.mockImplementation(async (_uid?: string, perm?: AppPermission) => perm === AppPermission.MANAGE_EVENT_ATTENDANCE);
    dbMock.setRows('events', [{ id: 'ev1', tenant_id: 'A' }]);
    dbMock.setRows('event_responsible', [{ event_id: 'ev1', user_id: 'op1', attendance_operator: 1 }]);
    dbMock.setRows('students', [{ id: 'stu1', tenant_id: 'A', name: 'طالب' }]);
    dbMock.setRows('event_attendance_detailed', [{ id: 'atd1', event_id: 'ev1', session_id: 's1', student_id: 'stu1', tenant_id: 'A', status: 'absent', final_status: 'PENDING_REVIEW', unexcused: 0, absence_processed: 1, absence_reason: null, created_at: new Date() }]);
    dbMock.setRows('attendance_policy', [{ tenant_id: 'A', enforce_absence_thresholds: 1, weighted_attendance_enabled: 0, warning_1_threshold: 1, warning_2_threshold: 2, final_warning_threshold: 3, disciplinary_review_threshold: 4, residence_termination_review_threshold: 5, excuse_time_limit_hours: 48, parent_notify_on_absence: 1, parent_notify_on_late: 0, parent_notify_on_warning: 1, version: 1 }]);

    const listRes = makeRes();
    await invoke({ method: 'GET', url: '/ev1/attendance/review', params: { id: 'ev1' }, body: {}, query: {}, user: operator }, listRes);
    expect(listRes.statusCode).toBe(200);

    const postRes = makeRes();
    await invoke({ method: 'POST', url: '/ev1/attendance/atd1/review', params: { id: 'ev1', attendanceId: 'atd1' }, body: { classification: 'EXCUSED', reason: 'مرض مثبت' }, query: {}, user: operator }, postRes);
    expect(postRes.statusCode).toBe(200);
    expect(postRes.body.data.attendance.final_status).toBe('EXCUSED');
  });
});