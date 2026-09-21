import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { kdb, logAuditEvent } from '../infrastructure/db';
import { createNotification, notifyExcuseDecided, notifyExcuseSubmitted, notifyPenaltyApplied } from '../api/notifications.routes';
import {
  AttendanceRule,
  EvaluationResult,
  EventRule,
  PenaltyMode,
  RuleEvaluationMode,
  appliedRuleIdsFromSnapshot,
  computeLateMinutes,
  evaluateEventRules,
  evaluatePenalty,
  mergeRule,
  normalizeEventRules,
  normalizeTiers,
  serializeAppliedRulesList,
  serializeSnapshot,
} from './attendanceRuleEngine';
import {
  AttendancePolicyConfig,
  EscalationStep,
  WARNING_LABELS,
  computeEscalations,
  policeWarningLevelFor,
  summarizeAbsences,
} from './attendanceEscalation';

// ───────────────────────────────────────────────────────────────
// Event attendance domain service. ALL authorization must be done
// by the routes BEFORE calling in; the service only trusts caller
// tenant/event/scanner identity. Timestamps are server-authoritative.
// ───────────────────────────────────────────────────────────────

type Executor = typeof kdb;
type MaybeRow = any;

export const STATUS_PRESENT = 'present';
export const STATUS_LATE = 'late';
export const STATUS_ABSENT = 'absent';
export const STATUS_EXCUSED = 'excused';
export const STATUS_TRAVEL = 'travel';

export const FINAL_STATUS_PENDING_REVIEW = 'PENDING_REVIEW';
export const FINAL_STATUS_UNEXCUSED = 'UNEXCUSED';
export const FINAL_STATUS_EXCUSED = 'EXCUSED';
export const FINAL_STATUS_TRAVEL = 'TRAVEL';
export const REVIEW_CLASSIFICATIONS = [FINAL_STATUS_UNEXCUSED, FINAL_STATUS_EXCUSED, FINAL_STATUS_TRAVEL] as const;
export type ReviewClassification = typeof REVIEW_CLASSIFICATIONS[number];

const DEFAULT_RULE: AttendanceRule = {
  grace_period_minutes: 0,
  penalty_mode: 'NONE',
  base_penalty: 0,
  base_points: 0,
  additional_penalty: 0,
  additional_penalty_unit: 'PER_MINUTE',
  additional_penalty_block_minutes: 5,
  maximum_penalty: null,
  maximum_points_deduction: null,
  absent_after_minutes: null,
  auto_apply_penalty: true,
  enabled: true,
  tiers: null,
  required_attendance: true,
  counts_toward_absence_limit: true,
  attendance_weight: 1,
};

export function mapRuleRow(row: MaybeRow | undefined): AttendanceRule | null {
  if (!row) return null;
  let tiers = null;
  if (row.tiers) {
    try { tiers = normalizeTiers(JSON.parse(row.tiers)); } catch { tiers = null; }
  }
  return {
    grace_period_minutes: Number(row.grace_period_minutes ?? 0),
    penalty_mode: (row.penalty_mode || 'NONE') as PenaltyMode,
    base_penalty: Number(row.base_penalty ?? 0),
    base_points: Number(row.base_points ?? 0),
    additional_penalty: Number(row.additional_penalty ?? 0),
    additional_penalty_unit: (row.additional_penalty_unit || 'PER_MINUTE') as AttendanceRule['additional_penalty_unit'],
    additional_penalty_block_minutes: Number(row.additional_penalty_block_minutes ?? 1),
    maximum_penalty: row.maximum_penalty == null ? null : Number(row.maximum_penalty),
    maximum_points_deduction: row.maximum_points_deduction == null ? null : Number(row.maximum_points_deduction),
    absent_after_minutes: row.absent_after_minutes == null ? null : Number(row.absent_after_minutes),
    auto_apply_penalty: !!row.auto_apply_penalty,
    enabled: !!row.enabled,
    tiers,
    required_attendance: !!row.required_attendance,
    counts_toward_absence_limit: !!row.counts_toward_absence_limit,
    attendance_weight: Number(row.attendance_weight ?? 1),
  };
}

// Effective rule for a session: event-level default overlaid with session rule.
export async function getEffectiveRule(executor: Executor, eventId: string, sessionId: string | null): Promise<AttendanceRule> {
  const eventRuleRow = await executor('event_attendance_rules')
    .where({ event_id: eventId }).whereNull('session_id').first();
  const sessionRuleRow = sessionId
    ? await executor('event_attendance_rules').where({ event_id: eventId, session_id: sessionId }).first()
    : undefined;
  return mergeRule(mapRuleRow(eventRuleRow), { ...mapRuleRow(sessionRuleRow as any) });
}

export async function getPolicy(tenantId: string, actorId?: string): Promise<AttendancePolicyConfig> {
  let row = await kdb('attendance_policy').where({ tenant_id: tenantId }).first();
  if (!row) {
    row = {
      tenant_id: tenantId,
      enforce_absence_thresholds: true,
      weighted_attendance_enabled: false,
      warning_1_threshold: 1,
      warning_2_threshold: 2,
      final_warning_threshold: 3,
      disciplinary_review_threshold: 4,
      residence_termination_review_threshold: 5,
      excuse_time_limit_hours: 48,
      parent_notify_on_absence: true,
      parent_notify_on_late: false,
      parent_notify_on_warning: true,
      version: 1,
      created_by: actorId || null,
    };
    await kdb('attendance_policy').insert(row).catch(() => undefined);
  }
  return {
    enforce_absence_thresholds: !!row.enforce_absence_thresholds,
    weighted_attendance_enabled: !!row.weighted_attendance_enabled,
    warning_1_threshold: Number(row.warning_1_threshold ?? 1),
    warning_2_threshold: Number(row.warning_2_threshold ?? 2),
    final_warning_threshold: Number(row.final_warning_threshold ?? 3),
    disciplinary_review_threshold: Number(row.disciplinary_review_threshold ?? 4),
    residence_termination_review_threshold: Number(row.residence_termination_review_threshold ?? 5),
    excuse_time_limit_hours: Number(row.excuse_time_limit_hours ?? 48),
    parent_notify_on_absence: !!row.parent_notify_on_absence,
    parent_notify_on_late: !!row.parent_notify_on_late,
    parent_notify_on_warning: !!row.parent_notify_on_warning,
    version: Number(row.version ?? 1),
  };
}

export async function updatePolicy(input: {
  tenantId: string; userId: string; note?: string;
  config: Partial<Omit<AttendancePolicyConfig, 'version'>>;
}): Promise<AttendancePolicyConfig> {
  const current = await getPolicy(input.tenantId, input.userId);
  const next = { ...current, ...input.config };
  await kdb.transaction(async (trx) => {
    await trx('attendance_policy_versions').insert({
      id: uuidv4(),
      tenant_id: input.tenantId,
      version: current.version,
      snapshot: JSON.stringify(current),
      changed_by: input.userId,
      changed_at: new Date(),
      note: input.note || null,
    });
    await trx('attendance_policy').where({ tenant_id: input.tenantId }).update({
      enforce_absence_thresholds: next.enforce_absence_thresholds ? 1 : 0,
      weighted_attendance_enabled: next.weighted_attendance_enabled ? 1 : 0,
      warning_1_threshold: next.warning_1_threshold,
      warning_2_threshold: next.warning_2_threshold,
      final_warning_threshold: next.final_warning_threshold,
      disciplinary_review_threshold: next.disciplinary_review_threshold,
      residence_termination_review_threshold: next.residence_termination_review_threshold,
      excuse_time_limit_hours: next.excuse_time_limit_hours,
      parent_notify_on_absence: next.parent_notify_on_absence ? 1 : 0,
      parent_notify_on_late: next.parent_notify_on_late ? 1 : 0,
      parent_notify_on_warning: next.parent_notify_on_warning ? 1 : 0,
      version: current.version + 1,
      updated_by: input.userId,
      updated_at: new Date(),
    });
  });
  logAuditEvent({
    tenantId: input.tenantId, userId: input.userId, action: 'UPDATE attendance_policy',
    entityType: 'attendance_policy', entityId: input.tenantId, method: 'PUT', path: `/api/tenants/${input.tenantId}/attendance/policy`,
    status: '200', details: { note: input.note || null, fromVersion: current.version, toVersion: current.version + 1 },
  });
  return { ...next, version: current.version + 1 };
}

// ────────────────────────────── Sessions ──────────────────────────────

export async function openSession(event: MaybeRow, session: MaybeRow, userId: string): Promise<void> {
  await kdb('event_sessions').where({ id: session.id }).update({
    status: 'open', opened_by: userId, opened_at: new Date(), updated_at: new Date(),
  });
  logAuditEvent({
    tenantId: event.tenant_id, userId, action: 'OPEN event session', entityType: 'event_session', entityId: session.id,
    method: 'POST', path: `/api/events/${event.id}/sessions/${session.id}/open`, status: '200',
    details: { sessionTitle: session.title },
  });
}

export async function closeSession(event: MaybeRow, session: MaybeRow, userId: string): Promise<{ finalized: number; escalated: number }> {
  const now = new Date();
  await kdb('event_sessions').where({ id: session.id }).update({
    status: 'closed', closed_by: userId, closed_at: now, updated_at: now,
  });
  const result = await finalizeAbsencesForEvent(event, session, userId);
  logAuditEvent({
    tenantId: event.tenant_id, userId, action: 'CLOSE event session', entityType: 'event_session', entityId: session.id,
    method: 'POST', path: `/api/events/${event.id}/sessions/${session.id}/close`, status: '200',
    details: result,
  });
  return result;
}

// Expected students for a session: approved subscriptions ∪ registrations ∪
// anyone already recorded for this event (covers manual flows & targeting).
async function expectedStudentIds(trx: Executor, eventId: string): Promise<string[]> {
  const rows = await trx.raw(`
    SELECT student_id FROM event_subscriptions WHERE event_id = ? AND status = 'approved' AND student_id IS NOT NULL
    UNION
    SELECT student_id FROM event_registrations WHERE event_id = ?
    UNION
    SELECT student_id FROM event_attendance_detailed WHERE event_id = ?
  `, [eventId, eventId, eventId]);
  const set = new Set<string>((rows.recordset || rows || []).filter((r: any) => r && r.student_id).map((r: any) => r.student_id));
  return [...set];
}

// Records an 'absent' row for every expected student lacking a recorded row for
// this (session, event). Idempotent: guarded by re-check + UQ(session, student).
async function ensureAbsentRows(trx: Executor, event: MaybeRow, session: MaybeRow, userId: string): Promise<number> {
  const rule = await getEffectiveRule(trx, event.id, session.id);
  const studentIds = await expectedStudentIds(trx, event.id);
  let created = 0;
  for (const studentId of studentIds) {
    const existing = await trx('event_attendance_detailed')
      .where({ session_id: session.id, student_id: studentId })
      .first();
    if (existing) continue;
    await trx('event_attendance_detailed').insert({
      id: uuidv4(),
      event_id: event.id,
      session_id: session.id,
      student_id: studentId,
      tenant_id: event.tenant_id,
      status: STATUS_ABSENT,
      absence_processed: 1,
      absence_processed_at: new Date(),
      // Absences materialized at close start UNCLASSIFIED: a supervisor reviews
      // them (بدون عذر / بعذر / مسافر). Nothing is auto-marked unexcused and no
      // escalation fires at close — that happens only at classification.
      unexcused: 0,
      final_status: FINAL_STATUS_PENDING_REVIEW,
      is_required_attendance: rule.required_attendance ? 1 : 0,
      counts_toward_absence_limit: rule.counts_toward_absence_limit ? 1 : 0,
      attendance_weight: rule.attendance_weight,
      check_in_method: 'system',
      created_by: userId,
      created_at: new Date(),
    });
    created += 1;
  }
  return created;
}

// Session-close finalization: materialize ABSENT rows as PENDING_REVIEW and set
// absence_processed. Close does NOT mark unexcused and does NOT escalate — the
// supervisor classifies (UNEXCUSED/EXCUSED/TRAVEL) afterwards, and classification
// is what triggers rule actions + escalations. `escalated` is kept as 0 for API
// compat (close returns { finalized, escalated }).
export async function finalizeAbsencesForEvent(event: MaybeRow, session: MaybeRow, userId: string): Promise<{ finalized: number; escalated: number }> {
  const now = new Date();
  let finalized = 0;
  await kdb.transaction(async (trx) => {
    finalized = await ensureAbsentRows(trx, event, session, userId);
    // existing absent rows never processed by an earlier close run → pending review
    await trx('event_attendance_detailed')
      .where({ event_id: event.id, session_id: session.id, status: STATUS_ABSENT, absence_processed: 0 })
      .update({
        absence_processed: 1,
        absence_processed_at: now,
        final_status: trx.raw('CASE WHEN final_status IS NULL THEN ? ELSE final_status END', [FINAL_STATUS_PENDING_REVIEW]),
        unexcused: trx.raw('CASE WHEN unexcused = 1 THEN 1 ELSE 0 END'),
      });
  });
  return { finalized, escalated: 0 };
}

// The per-student absence counter + warning/case engine. Returns count created.
// Only threshold steps that do not yet exist are created (DB unique guards
// back this up, so concurrent closes cannot duplicate a warning).
export async function runEscalationsForStudent(args: {
  trx?: Executor; studentId: string; tenantId: string; userId: string; eventId?: string; sessionId?: string;
}, forceNow?: Date): Promise<number> {
  const trx: Executor = args.trx ?? kdb;
  const studentId = args.studentId;
  const tenantId = args.tenantId;
  const now = forceNow ?? new Date();
  const policy = await getPolicy(tenantId, args.userId);

  const records = await trx('event_attendance_detailed')
    .where({ tenant_id: tenantId, student_id: studentId })
    .select('status', 'unexcused', 'is_required_attendance', 'attendance_weight', 'counts_toward_absence_limit');
  const summary = summarizeAbsences((records as any[]).map((r) => ({
    status: r.status,
    unexcused: !!r.unexcused,
    counts_toward_absence_limit: r.counts_toward_absence_limit !== 0,
    attendance_weight: r.attendance_weight || 1,
    required_attendance: r.is_required_attendance !== 0,
  })));

  const steps = computeEscalations(summary, policy);
  let created = 0;
  for (const step of steps) {
    const made = await persistEscalationStep({ trx, step, studentId, tenantId, userId: args.userId, eventId: args.eventId, sessionId: args.sessionId, policy, summary, count: summary.unexcusedCount, weighted: summary.weightedUnexcused, rate: summary.attendanceRate, now });
    if (made) created += 1;
  }
  return created;
}

async function persistEscalationStep(args: {
  trx: Executor; step: EscalationStep; studentId: string; tenantId: string; userId: string;
  eventId?: string; sessionId?: string; policy: AttendancePolicyConfig;
  summary: ReturnType<typeof summarizeAbsences>; count: number; weighted: number; rate: number; now: Date;
}): Promise<boolean> {
  const { trx, step, studentId, tenantId, userId, eventId, sessionId, policy, summary, count, weighted, rate, now } = args;
  const attendanceId = sessionId ? `${eventId}-${sessionId}-${studentId}` : null;

  // Warnings: skip if an attendance warning of this type already exists.
  const existingWarning = await trx('student_warnings')
    .where({ student_id: studentId, warning_type: step.key, is_attendance_warning: 1 })
    .first();
  if (existingWarning) return false;

  await trx('student_warnings').insert({
    id: uuidv4(),
    tenant_id: tenantId,
    student_id: studentId,
    level: policeWarningLevelFor(step.key),
    reason: `وصل الطالب إلى ${step.label} لتجاوزه حد الغياب غير المبرر (${step.threshold}). عدد الغياب غير المبرر الحالي: ${count}.`,
    status: 'active',
    warning_type: step.key,
    threshold: step.threshold,
    unexcused_absence_count_at_time: count,
    policy_version: policy.version,
    attendance_id: attendanceId,
    is_attendance_warning: 1,
    notify_parent: policy.parent_notify_on_warning ? 1 : 0,
    notify_priest: 0,
    created_by: userId,
    created_at: now,
  }).catch(() => undefined); // unique index absorbed the duplicate

  if (step.kind === 'CASE') {
    await trx('disciplinary_cases').insert({
      id: uuidv4(),
      tenant_id: tenantId,
      student_id: studentId,
      case_type: step.caseType,
      status: 'OPEN',
      unexcused_absence_count: count,
      attended_sessions: Math.round(summary.attendedCount * 100) / 100,
      total_sessions: Math.round(summary.requiredTotal * 100) / 100,
      weighted_attendance_rate: Math.round(rate * 100) / 100,
      summary: `تم فتح ${step.label} تلقائياً لتجاوز حد الغياب غير المبرر (${step.threshold}).`,
      policy_version: policy.version,
      related_data: JSON.stringify({ triggerEventId: eventId || null, triggerSessionId: sessionId || null, weightedUnexcused: weighted }),
      created_by: userId,
      created_at: now,
    }).catch(() => undefined);
  }

  logAuditEvent({
    tenantId, userId, action: `ESCALATION ${step.key}`, entityType: 'student_warning', entityId: studentId,
    method: 'POST', path: '/api/internal/attendance/escalation', status: '200', details: { count, weighted, rate, policyVersion: policy.version },
  });
  return true;
}

// ────────────────────────────── Scanning ──────────────────────────────

async function notifyCheckIn(args: {
  event: MaybeRow; session: MaybeRow; student: MaybeRow; status: string;
  evaluation: EvaluationResult; tenantId: string;
}): Promise<void> {
  const { event, session, student, status, evaluation, tenantId } = args;
  const amount = evaluation.penalty.financial_amount;
  const points = evaluation.penalty.points_deduction;
  const penaltyNote =
    amount + points > 0
      ? ` غرامة: ${amount > 0 ? `${amount} ج.م` : ''}${amount > 0 && points > 0 ? ' + ' : ''}${points > 0 ? `-${points} نقطة` : ''}.`
      : '';
  if (status === STATUS_ABSENT || status === STATUS_LATE) {
    await createNotification({
      userId: student.id,
      tenantId,
      title: status === STATUS_ABSENT ? 'تسجيل غياب' : 'تسجيل حضور متأخر',
      message: status === STATUS_ABSENT
        ? `تم تسجيل غيابك في ${event.title} (${session.title || 'جلسة'}).${penaltyNote}`
        : `تم تسجيل حضورك متأخراً في ${event.title} (${session.title || 'جلسة'}) بفارق ${args.evaluation.late_minutes} دقيقة.${penaltyNote}`,
      type: status === STATUS_ABSENT ? 'error' : 'warning',
      event_id: event.id,
    }).catch(() => undefined);
  }
  if (status === STATUS_PRESENT) {
    await createNotification({
      userId: student.id,
      tenantId,
      title: 'حضور',
      message: `تم تسجيل حضورك في ${event.title} (${session.title || 'جلسة'}). ${penaltyNote}`,
      type: 'success',
      event_id: event.id,
    }).catch(() => undefined);
  }
}

export interface ScanResult {
  attendance: MaybeRow;
  firstCheckIn: boolean;
  evaluation: EvaluationResult;
  penalty: MaybeRow | null;
  rule: AttendanceRule;
  snapshot: string;
}

export async function recordCheckIn(args: {
  event: MaybeRow; session: MaybeRow; student: MaybeRow; userId: string; method: string;
}): Promise<ScanResult> {
  const { event, session, student, userId } = args;
  const method = args.method || 'qr';
  const now = new Date();
  const rule = await getEffectiveRule(kdb, event.id, session.id);
  const scheduled = session.start_time ? new Date(session.start_time) : now;
  const lateMinutes = computeLateMinutes(scheduled, now, rule.grace_period_minutes);
  const evaluation = evaluatePenalty(rule, lateMinutes);

  // Arriving beyond absent_after_minutes never counts as presence.
  let status = evaluation.status;
  if (rule.absent_after_minutes != null && lateMinutes >= rule.absent_after_minutes) {
    status = STATUS_ABSENT;
  }

  const snapshot = serializeSnapshot(rule, {
    sessionId: session.id, scheduledAt: scheduled, evaluatedAt: now, generatedBy: userId,
  });

  // Event rules (independent condition+action): late arrivals evaluate their
  // 'late' rules right at check-in; boundary-arrival absences (factual unexcused,
  // counted immediately) evaluate their absent/unexcused rules right away too.
  const eventMode = await getEventEvaluationMode(event);
  const eventRules = await getEventRulesForRecord(kdb, event.id, session.id);
  const firedEventRules = status === STATUS_PRESENT || eventRules.length === 0
    ? []
    : evaluateEventRules(eventRules, { status: status as any, unexcused: status === STATUS_ABSENT, late_minutes: lateMinutes }, eventMode);

  let attendance: MaybeRow | null = null;
  let firstCheckIn = false;
  let penalty: MaybeRow | null = null;
  let priorStatus: string | null = null;

  await kdb.transaction(async (trx) => {
    const existing = await trx('event_attendance_detailed')
      .where({ session_id: session.id, student_id: student.id })
      .first();
    firstCheckIn = !existing;
    priorStatus = existing?.status ?? null;

    const row = {
      status,
      checked_in_at: now,
      scheduled_at: scheduled,
      late_minutes: lateMinutes,
      grace_minutes: rule.grace_period_minutes,
      rule_snapshot: snapshot,
      penalty_mode: evaluation.penalty.mode,
      penalty_amount: evaluation.penalty.financial_amount || null,
      penalty_points: evaluation.penalty.points_deduction || null,
      penalty_applied: evaluation.penalty.financial_amount > 0 || evaluation.penalty.points_deduction > 0 ? 1 : 0,
      penalty_status: evaluation.penalty.financial_amount > 0 || evaluation.penalty.points_deduction > 0 ? 'APPLIED' : null,
      check_in_method: method,
      is_required_attendance: rule.required_attendance ? 1 : 0,
      attendance_weight: rule.attendance_weight,
      unexcused: status === STATUS_ABSENT ? 1 : 0,
      final_status: status === STATUS_ABSENT ? FINAL_STATUS_UNEXCUSED : null,
      absence_processed: 0,
      absence_reason: status === STATUS_ABSENT ? 'وصل بعد الوقت المحدد كحد أقصى (غياب محسوب)' : null,
      created_by: userId,
      updated_at: now,
    };

    if (existing) {
      // A valid check-in supersedes an earlier system-marked absence row.
      await trx('event_attendance_detailed').where({ id: existing.id }).update(row);
      attendance = { ...existing, ...row };
    } else {
      const id = uuidv4();
      await trx('event_attendance_detailed').insert({ id, event_id: event.id, session_id: session.id, student_id: student.id, tenant_id: event.tenant_id, created_at: now, ...row });
      attendance = { id, event_id: event.id, session_id: session.id, student_id: student.id, tenant_id: event.tenant_id, ...row };
    }

    // Event-level summary row kept in sync for the existing attendance lists.
    const evExisting = await trx('event_attendance').where({ event_id: event.id, student_id: student.id }).first();
    if (evExisting) {
      await trx('event_attendance').where({ id: evExisting.id }).update({
        status, check_in_method: method, attended_at: now,
      });
    } else {
      await trx('event_attendance').insert({
        id: uuidv4(), event_id: event.id, student_id: student.id, status, check_in_method: method, attended_at: now,
      });
    }

    // Penalty ledger (idempotent: one APPLIED row per attendance row).
    if (rule.auto_apply_penalty && evaluation.penalty.financial_amount + evaluation.penalty.points_deduction > 0) {
      penalty = await applyPenaltyLedger({ trx, event, session, student, attendanceId: attendance.id, evaluation, rule, userId, tenantId: event.tenant_id, snapshot, now });
    }

    // Event-rule actions (idempotent via read-before-write snapshot + ledgers).
    if (firedEventRules.length > 0) {
      const eventRulesSnapshot = await applyEventRuleActions({
        trx, event, session, attendance, student, rules: firedEventRules, mode: eventMode,
        status, unexcused: status === STATUS_ABSENT, lateMinutes, userId, now,
      });
      await trx('event_attendance_detailed').where({ id: attendance.id }).update({ applied_rules_snapshot: eventRulesSnapshot, updated_at: now });
    }
  });

  // Notifications are idempotent: only a new check-in or an actual status
  // change notifies the student — replaying the same QR never re-notifies.
  const statusChanged = priorStatus !== null && priorStatus !== status;
  if (firstCheckIn || statusChanged) {
    await notifyCheckIn({ event, session, student, status, evaluation, tenantId: event.tenant_id });
  }
  // Boundary-arrival absences are factual (unexcused immediately): re-tally the
  // student's standing right away. Idempotent — replay skips.
  if (status === STATUS_ABSENT && (firstCheckIn || statusChanged)) {
    await runEscalationsForStudent({ studentId: student.id, tenantId: event.tenant_id, userId, eventId: event.id, sessionId: session.id }, now);
  }
  logAuditEvent({
    tenantId: event.tenant_id, userId, action: `CHECKIN ${status} (${method})`, entityType: 'event_attendance_detailed', entityId: attendance!.id,
    method: 'POST', path: `/api/events/${event.id}/sessions/${session.id}/scan`, status: '200',
    details: { lateMinutes, method, penalty: evaluation.penalty },
  });
  return { attendance: attendance!, firstCheckIn, evaluation, penalty, rule, snapshot };
}

// Creates the attendance-penalty ledger row + writes through to the existing
// finance ledger and the points ledger (append-only, never mutated).
export async function applyPenaltyLedger(args: {
  trx: Executor; event: MaybeRow; session: MaybeRow; student: MaybeRow;
  attendanceId: string; evaluation: EvaluationResult; rule: AttendanceRule;
  userId: string; tenantId: string; snapshot: string; now?: Date;
}): Promise<MaybeRow | null> {
  const { trx, event, session, student, attendanceId, evaluation, rule, userId, tenantId, snapshot } = args;
  const now = args.now ?? new Date();
  const active = await trx('attendance_penalties').where({ attendance_id: attendanceId, status: 'APPLIED' }).first();
  if (active) return active; // already charged → never double-charge

  const financial = evaluation.penalty.financial_amount;
  const points = evaluation.penalty.points_deduction;
  const mode: PenaltyMode = financial > 0 && points > 0 ? 'BOTH' : financial > 0 ? 'FINANCIAL' : 'POINTS';
  const policy = await getPolicy(tenantId, userId);

  const penaltyId = uuidv4();
  let financeId: string | null = null;
  let pointsLedgerId: string | null = null;

  if (financial > 0) {
    financeId = uuidv4();
    await trx('finances').insert({
      id: financeId,
      tenant_id: tenantId,
      student_id: student.id,
      type: 'expense',
      category: 'غرامة تأخير حضور',
      amount: financial,
      description: `غرامة تأخير حضور: ${event.title} — ${session.title || 'جلسة'} (${new Date(scheduledLabel(session)).toLocaleString('ar-EG')})`,
      date: new Date(),
      created_by: userId,
      event_id: event.id,
      session_id: session.id,
      attendance_id: attendanceId,
      reference: penaltyId,
      is_reversal: 0,
    });
  }
  if (points > 0) {
    pointsLedgerId = uuidv4();
    await trx('student_points').insert({
      id: pointsLedgerId,
      tenant_id: tenantId,
      student_id: student.id,
      amount: -points,
      reason: `خصم نقاط لتأخير الحضور: ${event.title} — ${session.title || 'جلسة'}`,
      category: 'penalty',
      created_by: userId,
      event_id: event.id,
      session_id: session.id,
      attendance_id: attendanceId,
      reference: penaltyId,
      is_reversal: 0,
    });
  }

  await trx('attendance_penalties').insert({
    id: penaltyId,
    attendance_id: attendanceId,
    student_id: student.id,
    event_id: event.id,
    session_id: session.id || null,
    tenant_id: tenantId,
    mode,
    financial_amount: financial || null,
    points_deduction: points || null,
    status: 'APPLIED',
    rule_snapshot: snapshot,
    policy_version: policy.version,
    reason: evaluation.penalty.reason,
    finance_id: financeId,
    points_ledger_id: pointsLedgerId,
    created_by: userId,
    created_at: now,
  });

  // إشعار للطالب وولي أمره بتوقيع العقوبة/الغرامة مع السبب.
  await notifyPenaltyApplied({
    tenantId,
    studentId: student.id,
    eventId: event.id,
    eventTitle: event.title || 'الفعالية',
    sessionTitle: session?.title || null,
    financial,
    points,
    reason: evaluation.penalty.reason || undefined,
  }).catch(() => undefined);

  return { id: penaltyId, mode, financial_amount: financial, points_deduction: points, status: 'APPLIED' };
}

function scheduledLabel(session: MaybeRow): Date {
  return session.start_time ? new Date(session.start_time) : new Date();
}

// ────────────────────────────── Event rules (independent) ──────────────────────────────

function parseTargeting(value: any): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  if (typeof value === 'object') return value;
  return null;
}

// Server-side eligibility mirror of the events targeting used at creation time.
// Explicit per-student whitelist wins; otherwise tenant/college/major/gov/church
// filters must be satisfied (missing student attribute passes — the filter just
// doesn't apply). An approved subscription/registration always grants access
// (باقة/عضويات معتمدة).
export async function studentMatchesEventTargeting(student: MaybeRow, targeting: any): Promise<boolean> {
  const t = parseTargeting(targeting);
  if (!t || Object.keys(t).length === 0) return true;
  if (Array.isArray(t.students) && t.students.length > 0) return t.students.includes(student.id);
  if (Array.isArray(t.tenants) && t.tenants.length > 0 && student.tenant_id && !t.tenants.includes(student.tenant_id)) return false;
  if (Array.isArray(t.exclude_tenants) && t.exclude_tenants.length > 0 && student.tenant_id && t.exclude_tenants.includes(student.tenant_id)) return false;
  if (Array.isArray(t.colleges) && t.colleges.length > 0 && student.college && !t.colleges.includes(student.college)) return false;
  if (Array.isArray(t.majors) && t.majors.length > 0 && student.major && !t.majors.includes(student.major)) return false;
  if (Array.isArray(t.governorates) && t.governorates.length > 0 && student.governorate && !t.governorates.includes(student.governorate)) return false;
  if (Array.isArray(t.churches) && t.churches.length > 0 && student.church_name && !t.churches.includes(student.church_name)) return false;
  return true;
}

export async function isStudentEligibleForAttendance(event: MaybeRow, student: MaybeRow): Promise<{ eligible: boolean; reason?: string }> {
  if (await studentMatchesEventTargeting(student, event.targeting)) return { eligible: true };
  const [sub, reg] = await Promise.all([
    kdb('event_subscriptions').where({ event_id: event.id, student_id: student.id, status: 'approved' }).first().catch(() => null),
    kdb('event_registrations').where({ event_id: event.id, student_id: student.id }).first().catch(() => null),
  ]);
  if (sub || reg) return { eligible: true };
  return { eligible: false, reason: 'هذا النشاط مخصص للفئة المستهدفة فقط' };
}

export async function getEventEvaluationMode(event: MaybeRow): Promise<RuleEvaluationMode> {
  return event.rule_evaluation_mode === 'FIRST_APPLICABLE' ? 'FIRST_APPLICABLE' : 'ALL_APPLICABLE';
}

// Event rules applying to a session: session-scoped rules plus event default
// rules (session_id NULL). Session rules take the same evaluation pipe — the
// mode + sort_order decide what actually fires.
export async function getEventRulesForRecord(executor: Executor, eventId: string, sessionId: string | null): Promise<EventRule[]> {
  const rows = await executor('event_rules')
    .where({ event_id: eventId, enabled: 1 })
    .where(function () {
      if (sessionId) this.where('session_id', sessionId).orWhereNull('session_id');
      else this.whereNull('session_id');
    })
    .orderBy('sort_order', 'asc');
  return normalizeEventRules(rows as any[]);
}

// Applies the fired event-rule actions for a record, idempotently:
//   - FINANCIAL_FEE / DEDUCT_POINTS write through to the finance & points
//     ledgers with reference `event-rule:<ruleId>` (read-before-write guard).
//   - SEND_NOTIFICATION posts to the student (idempotent per applied-snapshot).
//   - EXCLUDE_FROM_RESIDENCE opens a review-only disciplinary case (DB unique
//     guard absorbs a duplicate; never terminates automatically).
// Returns the new applied_rules_snapshot (full list, immutable record).
export async function applyEventRuleActions(args: {
  trx: Executor; event: MaybeRow; session: MaybeRow | null; attendance: MaybeRow; student: MaybeRow;
  rules: EventRule[]; mode: RuleEvaluationMode; status: string; unexcused: boolean; lateMinutes: number;
  userId: string; now?: Date;
}): Promise<string> {
  const { trx, event, session, attendance, student, rules, mode, status, unexcused, lateMinutes, userId } = args;
  const now = args.now ?? new Date();
  const alreadyApplied = new Set(appliedRuleIdsFromSnapshot(attendance.applied_rules_snapshot));
  const applied: EventRule[] = [];

  for (const rule of rules) {
    if (rule.id && alreadyApplied.has(rule.id)) continue;
    const ref = rule.id ? `event-rule:${rule.id}` : `event-rule:${rule.condition_status}`;
    const tenantId = event.tenant_id || student.tenant_id || null;

    switch (rule.action_type) {
      case 'FINANCIAL_FEE': {
        if (rule.fee_amount <= 0) break;
        const existing = await trx('finances').where({ attendance_id: attendance.id, reference: ref, is_reversal: 0 }).first();
        if (existing) break;
        await trx('finances').insert({
          id: uuidv4(), tenant_id: tenantId, student_id: student.id, type: 'expense',
          category: 'غرامة نشاط', amount: rule.fee_amount,
          description: `غرامة وفق قاعدة النشاط: ${event.title}${session?.title ? ` — ${session.title}` : ''}`,
          date: now, created_by: userId, event_id: event.id, session_id: session?.id ?? null,
          attendance_id: attendance.id, reference: ref, is_reversal: 0,
        });
        await notifyPenaltyApplied({
          tenantId, studentId: student.id, eventId: event.id,
          eventTitle: event.title || 'الفعالية', sessionTitle: session?.title || null,
          financial: rule.fee_amount, points: 0,
          reason: rule.notification_message || `غرامة وفق قاعدة النشاط (${rule.condition_status})`,
        }).catch(() => undefined);
        applied.push(rule);
        break;
      }
      case 'DEDUCT_POINTS': {
        if (rule.points_amount <= 0) break;
        const existing = await trx('student_points').where({ attendance_id: attendance.id, reference: ref, is_reversal: 0 }).first();
        if (existing) break;
        await trx('student_points').insert({
          id: uuidv4(), tenant_id: tenantId, student_id: student.id, amount: -rule.points_amount,
          reason: `خصم نقاط وفق قاعدة النشاط: ${event.title}${session?.title ? ` — ${session.title}` : ''}`,
          category: 'penalty', created_by: userId, event_id: event.id, session_id: session?.id ?? null,
          attendance_id: attendance.id, reference: ref, is_reversal: 0,
        });
        await notifyPenaltyApplied({
          tenantId, studentId: student.id, eventId: event.id,
          eventTitle: event.title || 'الفعالية', sessionTitle: session?.title || null,
          financial: 0, points: rule.points_amount,
          reason: `خصم نقاط وفق قاعدة النشاط (${rule.condition_status})`,
        }).catch(() => undefined);
        applied.push(rule);
        break;
      }
      case 'SEND_NOTIFICATION': {
        if (!rule.notification_message) break;
        await createNotification({
          userId: student.id,
          tenantId,
          title: 'إشعار حضور فعالية',
          message: rule.notification_message,
          type: 'info',
          event_id: event.id,
        }).catch(() => undefined);
        applied.push(rule);
        break;
      }
      case 'EXCLUDE_FROM_RESIDENCE': {
        await trx('disciplinary_cases').insert({
          id: uuidv4(), tenant_id: tenantId, student_id: student.id,
          case_type: 'RESIDENCE_TERMINATION_REVIEW', status: 'OPEN',
          unexcused_absence_count: unexcused ? 1 : null,
          attended_sessions: null, total_sessions: null, weighted_attendance_rate: null,
          summary: `فتح مراجعة إنهاء الإقامة وفق قاعدة النشاط: ${event.title}`,
          policy_version: null,
          related_data: JSON.stringify({ triggerEventId: event.id, triggerSessionId: session?.id ?? null, ruleId: rule.id }),
          created_by: userId, created_at: now,
        }).catch(() => undefined); // unique open-case guard absorbs duplicates (مراجعة فقط، لا إنهاء تلقائي)
        applied.push(rule);
        break;
      }
      default:
        break; // NONE → recorded in the snapshot but no side effect
    }
  }

  // The snapshot must also record rules whose action was NONE (idempotent record).
  for (const rule of rules) {
    if (rule.id && !applied.some((a) => a.id === rule.id) && rule.action_type === 'NONE') {
      applied.push(rule);
    }
  }

  return serializeAppliedRulesList(applied, {
    mode,
    attendanceStatus: status as any,
    lateMinutes: lateMinutes || 0,
    evaluatedAt: now,
  });
}

// Reverses event-rule ledger rows (finances / student_points with reference
// `event-rule:*`) for a record by writing paired reversal rows — corrections and
// EXCUSED/TRAVEL classification never delete history.
async function reverseEventRuleLedger(args: {
  trx: Executor; event: MaybeRow; attendance: MaybeRow; reason: string; userId: string; now: Date;
}): Promise<void> {
  const { trx, event, attendance, reason, userId, now } = args;
  const tenantId = event.tenant_id || null;
  const finances = await trx('finances')
    .where({ attendance_id: attendance.id, is_reversal: 0 })
    .whereNotNull('reference').where('reference', 'like', 'event-rule:%');
  for (const f of finances as any[]) {
    if (Number(f.amount) <= 0) continue;
    await trx('finances').insert({
      id: uuidv4(), tenant_id: f.tenant_id ?? tenantId, student_id: f.student_id, type: 'revenue',
      category: 'إلغاء غرامة نشاط', amount: Number(f.amount),
      description: `إلغاء غرامة نشاط. السبب: ${reason}`,
      date: now, created_by: userId, event_id: f.event_id, session_id: f.session_id,
      attendance_id: f.attendance_id, reference: f.reference, is_reversal: 1, reversal_of_id: f.id,
    });
  }
  const points = await trx('student_points')
    .where({ attendance_id: attendance.id, is_reversal: 0 })
    .whereNotNull('reference').where('reference', 'like', 'event-rule:%');
  for (const p of points as any[]) {
    if (Math.abs(Number(p.amount)) <= 0) continue;
    await trx('student_points').insert({
      id: uuidv4(), tenant_id: p.tenant_id ?? tenantId, student_id: p.student_id,
      amount: Math.abs(Number(p.amount)),
      reason: `استرداد نقاط نشاط. السبب: ${reason}`,
      category: 'penalty', created_by: userId, event_id: p.event_id, session_id: p.session_id,
      attendance_id: p.attendance_id, reference: p.reference, is_reversal: 1, reversal_of_id: p.id,
    });
  }
}

// ────────────────────────────── Absence review workflow ──────────────────────────────

// Pending-review rows for an event (auto-materialized absences waiting for a
// supervisor decision, including legacy absences without a final_status).
export async function getPendingReviewRows(event: MaybeRow): Promise<any[]> {
  const rows = await kdb('event_attendance_detailed as ead')
    .leftJoin('students as s', 'ead.student_id', 's.id')
    .leftJoin('event_sessions as es', 'ead.session_id', 'es.id')
    .select(
      'ead.id', 'ead.event_id', 'ead.session_id', 'ead.student_id', 'ead.status', 'ead.final_status',
      'ead.unexcused', 'ead.absence_reason', 'ead.checked_in_at', 'ead.late_minutes',
      'ead.applied_rules_snapshot', 'ead.created_at',
      's.name as student_name', 's.class_name as student_class',
      'es.title as session_title',
    )
    .where('ead.event_id', event.id)
    .where('ead.status', STATUS_ABSENT)
    .where(function () {
      this.where('ead.final_status', FINAL_STATUS_PENDING_REVIEW).orWhereNull('ead.final_status');
    })
    .orderBy('ead.checked_in_at', 'desc')
    .orderBy('ead.created_at', 'desc');
  return rows as any[];
}

// Supervisor classification of an auto-materialized absence.
//   UNEXCUSED → status stays absent, final_status UNEXCUSED, unexcused=1;
//               fires condition absent/unexcused event rules, then escalations.
//   EXCUSED  → status excused, final_status EXCUSED, unexcused=0, penalties
//              reversed (same as an approved excuse).
//   TRAVEL   → status travel, final_status TRAVEL, unexcused=0, penalties reversed.
// Guards: row must exist in this event and must be an unreviewed absence
// (present/late/checked rows or already-reviewed rows are rejected).
export async function classifyAbsence(args: {
  event: MaybeRow; attendanceId: string; classification: ReviewClassification; reason?: string; userId: string;
}): Promise<MaybeRow> {
  const { event, attendanceId, classification, userId } = args;
  const now = new Date();
  let updated: MaybeRow = null as any;

  await kdb.transaction(async (trx) => {
    const attendance = await trx('event_attendance_detailed').where({ id: attendanceId, event_id: event.id }).first();
    if (!attendance) throw new Error('NOT_FOUND');
    const reviewed = attendance.final_status != null && attendance.final_status !== FINAL_STATUS_PENDING_REVIEW;
    if (reviewed || attendance.status !== STATUS_ABSENT) throw new Error('ALREADY_REVIEWED');

    const student = await trx('students').where({ id: attendance.student_id }).first();
    if (!student) throw new Error('STUDENT_NOT_FOUND');

    const status = classification === FINAL_STATUS_EXCUSED ? STATUS_EXCUSED
      : classification === FINAL_STATUS_TRAVEL ? STATUS_TRAVEL
      : STATUS_ABSENT;
    const unexcused = classification === FINAL_STATUS_UNEXCUSED ? 1 : 0;
    const reason = args.reason || attendance.absence_reason || null;

    await trx('event_attendance_detailed').where({ id: attendance.id }).update({
      status,
      final_status: classification,
      unexcused,
      reviewed_by: userId,
      reviewed_at: now,
      absence_reason: reason,
      absence_processed: 1,
      absence_processed_at: now,
      updated_at: now,
    });

    await trx('event_attendance')
      .where({ event_id: event.id, student_id: student.id })
      .update({ status, excuse_reason: classification === FINAL_STATUS_EXCUSED ? reason : null });

    const session = attendance.session_id ? await trx('event_sessions').where({ id: attendance.session_id }).first() : null;
    const lateMinutes = Number(attendance.late_minutes || 0);

    if (classification === FINAL_STATUS_UNEXCUSED) {
      const mode = await getEventEvaluationMode(event);
      const eventRules = await getEventRulesForRecord(trx, event.id, session?.id ?? null);
      const fired = evaluateEventRules(eventRules, { status: STATUS_ABSENT, unexcused: true, late_minutes: lateMinutes }, mode);
      const snapshot = await applyEventRuleActions({
        trx, event, session, attendance, student, rules: fired, mode,
        status: STATUS_ABSENT, unexcused: true, lateMinutes, userId, now,
      });
      await trx('event_attendance_detailed').where({ id: attendance.id }).update({ applied_rules_snapshot: snapshot, updated_at: now });
      await runEscalationsForStudent({ trx, studentId: student.id, tenantId: event.tenant_id, userId, eventId: event.id, sessionId: attendance.session_id }, now);
    } else {
      // EXCUSED / TRAVEL: reverse any applied tier penalty + event-rule ledgers.
      const active = await trx('attendance_penalties').where({ attendance_id: attendance.id, status: 'APPLIED' }).first();
      if (active) {
        await doReversePenalty({ trx, penaltyId: active.id, reason: `تصنيف الغياب ${classification}: ${reason || ''}`.trim(), userId, tenantId: event.tenant_id, now });
        await trx('event_attendance_detailed').where({ id: attendance.id }).update({ penalty_applied: 0, penalty_status: 'REVERSED', updated_at: now });
      }
      await reverseEventRuleLedger({ trx, event, attendance, reason: `تصنيف الغياب ${classification}: ${reason || ''}`.trim(), userId, now });
      await runEscalationsForStudent({ trx, studentId: student.id, tenantId: event.tenant_id, userId, eventId: event.id, sessionId: attendance.session_id }, now);
    }

    updated = await trx('event_attendance_detailed').where({ id: attendance.id }).first();
  });

  logAuditEvent({
    tenantId: event.tenant_id, userId, action: `CLASSIFY ${classification}`, entityType: 'event_attendance_detailed', entityId: attendanceId,
    method: 'POST', path: `/api/events/${event.id}/attendance/${attendanceId}/review`, status: '200', details: { reason: args.reason || null },
  });
  return updated;
}

// ────────────────────────────── Corrections / Reversals ──────────────────────────────

// Attendance corrections NEVER rewrite history silently. Any applied penalty on
// the record is reversed (creating reversing ledger rows) instead.
export async function correctAttendance(args: {
  event: MaybeRow; session: MaybeRow | null; attendance: MaybeRow; student: MaybeRow;
  newStatus: string; reason: string; userId: string;
}): Promise<{ attendance: MaybeRow; reversedPenaltyIds: string[] }> {
  const { event, attendance, student, newStatus, reason, userId } = args;
  const now = new Date();
  const reversed: string[] = [];

  await kdb.transaction(async (trx) => {
    const activePenalties = await trx('attendance_penalties')
      .where({ attendance_id: attendance.id, status: 'APPLIED' })
      .select('id');
    for (const p of (activePenalties as any[])) {
      await doReversePenalty({ trx, penaltyId: p.id, reason: `تصحيح حالة الحضور إلى ${newStatus}: ${reason}`, userId, tenantId: event.tenant_id, now });
      reversed.push(p.id);
    }
    // Corrections also reverse any independently-applied event-rule ledgers.
    await reverseEventRuleLedger({ trx, event, attendance, reason: `تصحيح حالة الحضور إلى ${newStatus}: ${reason}`, userId, now });

    const finalStatus =
      newStatus === STATUS_EXCUSED ? FINAL_STATUS_EXCUSED
      : newStatus === STATUS_TRAVEL ? FINAL_STATUS_TRAVEL
      : newStatus === STATUS_ABSENT ? (attendance.final_status || FINAL_STATUS_PENDING_REVIEW)
      : null;
    const unexcused = newStatus === STATUS_ABSENT ? 1 : 0;
    await trx('event_attendance_detailed').where({ id: attendance.id }).update({
      status: newStatus,
      final_status: finalStatus,
      unexcused,
      absence_reason: reason || (newStatus === STATUS_ABSENT ? 'غياب' : null),
      penalty_applied: reversed.length > 0 ? 0 : attendance.penalty_applied,
      penalty_status: reversed.length > 0 ? 'REVERSED' : attendance.penalty_status,
      absence_processed: newStatus === STATUS_ABSENT ? attendance.absence_processed : 0,
      updated_at: now,
    });

    await trx('event_attendance').where({ event_id: event.id, student_id: student.id }).update({
      status: newStatus,
      excuse_reason: newStatus === STATUS_EXCUSED ? reason : null,
      updated_at: now,
    });

    await runEscalationsForStudent({ trx, studentId: student.id, tenantId: event.tenant_id, userId, eventId: event.id, sessionId: attendance.session_id }, now);
  });

  logAuditEvent({
    tenantId: event.tenant_id, userId, action: `CORRECT attendance ${attendance.status} → ${newStatus}`, entityType: 'event_attendance_detailed', entityId: attendance.id,
    method: 'POST', path: `/api/events/${event.id}/attendance/${attendance.id}/correction`, status: '200', details: { reason, reversed },
  });
  return { attendance: { ...attendance, status: newStatus }, reversedPenaltyIds: reversed };
}

export async function reversePenalty(args: {
  event: MaybeRow; penalty: MaybeRow; reason: string; userId: string;
}): Promise<void> {
  const { event, penalty, reason, userId } = args;
  await kdb.transaction(async (trx) => {
    await doReversePenalty({ trx, penaltyId: penalty.id, reason, userId, tenantId: event.tenant_id, now: new Date() });
    await trx('event_attendance_detailed').where({ id: penalty.attendance_id }).update({
      penalty_applied: 0,
      penalty_status: 'REVERSED',
      updated_at: new Date(),
    });
  });
  logAuditEvent({
    tenantId: event.tenant_id, userId, action: 'REVERSE attendance penalty', entityType: 'attendance_penalty', entityId: penalty.id,
    method: 'POST', path: `/api/events/${event.id}/attendance/${penalty.attendance_id}/penalty/reverse`, status: '200', details: { reason },
  });
}

async function doReversePenalty(args: {
  trx: Executor; penaltyId: string; reason: string; userId: string; tenantId: string; now: Date;
}): Promise<void> {
  const { trx, penaltyId, reason, userId, tenantId, now } = args;
  const penalty = await trx('attendance_penalties').where({ id: penaltyId, status: 'APPLIED' }).first();
  if (!penalty) return;
  const studentId = penalty.student_id;
  const financial = Number(penalty.financial_amount || 0);
  const points = Number(penalty.points_deduction || 0);

  if (financial > 0) {
    await trx('finances').insert({
      id: uuidv4(),
      tenant_id: tenantId,
      student_id: studentId,
      type: 'revenue',
      category: 'إلغاء غرامة تأخير حضور',
      amount: financial,
      description: `إلغاء غرامة تأخير الحضور (${penalty.id.split('-')[0]}). السبب: ${reason}`,
      date: now,
      created_by: userId,
      event_id: penalty.event_id,
      session_id: penalty.session_id,
      attendance_id: penalty.attendance_id,
      reference: penaltyId,
      is_reversal: 1,
      reversal_of_id: penalty.finance_id || null,
    });
  }
  if (points > 0) {
    await trx('student_points').insert({
      id: uuidv4(),
      tenant_id: tenantId,
      student_id: studentId,
      amount: points,
      reason: `استرداد نقاط خصم تأخير الحضور. السبب: ${reason}`,
      category: 'penalty',
      created_by: userId,
      event_id: penalty.event_id,
      session_id: penalty.session_id,
      attendance_id: penalty.attendance_id,
      reference: penaltyId,
      is_reversal: 1,
      reversal_of_id: penalty.points_ledger_id || null,
    });
  }
  await trx('attendance_penalties').where({ id: penaltyId }).update({
    status: 'REVERSED', reversed_by: userId, reversed_at: now, reversal_reason: reason,
  });
}

// ────────────────────────────── Excuse workflow ──────────────────────────────

export async function submitExcuse(input: {
  studentId: string; eventId: string; sessionId: string | null; attendanceId: string | null;
  reason: string; notes: string | null; submittedBy: string; submittedByRole: string | null; tenantId: string;
}): Promise<MaybeRow> {
  const event = await kdb('events').where({ id: input.eventId }).first();
  if (!event) throw new Error('EVENT_NOT_FOUND');

  // الموعد النهائي (قبل بدء الفعالية) — يضبطه المشرف/الكاهن في قوانين الفعالية.
  if (event.excuse_deadline_minutes != null && Number(event.excuse_deadline_minutes) > 0) {
    const start = event.start_time ? new Date(event.start_time) : (event.event_date ? new Date(event.event_date) : null);
    if (start) {
      const deadline = start.getTime() - Number(event.excuse_deadline_minutes) * 60000;
      if (Date.now() > deadline) {
        throw new Error('EXCUSE_DEADLINE_PASSED');
      }
    }
  }

  // عذر واحد معلق بانتظار المراجعة لكل طالب/فعالية.
  const pending = await kdb('attendance_excuses')
    .where({ student_id: input.studentId, event_id: input.eventId })
    .where('status', 'PENDING')
    .first();
  if (pending) throw new Error('EXCUSE_ALREADY_PENDING');

  const id = uuidv4();
  await kdb('attendance_excuses').insert({
    id,
    student_id: input.studentId,
    event_id: input.eventId,
    session_id: input.sessionId || null,
    attendance_id: input.attendanceId || null,
    tenant_id: input.tenantId,
    reason: input.reason,
    notes: input.notes || null,
    submitted_by: input.submittedBy,
    submitted_by_role: input.submittedByRole || null,
    submitted_at: new Date(),
    status: 'PENDING',
  });
  logAuditEvent({
    tenantId: input.tenantId, userId: input.submittedBy, action: 'SUBMIT attendance excuse', entityType: 'attendance_excuse', entityId: id,
    method: 'POST', path: `/api/students/${input.studentId}/attendance/excuse`, status: '201',
    details: { eventId: input.eventId, sessionId: input.sessionId || null, attendanceId: input.attendanceId || null },
  });

  // إشعار فوري لمشرف السكن والأب الكاهن بتفاصيل العذر + رسالة الطالب (مع زرَّي القبول/الرفض).
  await notifyExcuseSubmitted({
    tenantId: input.tenantId,
    studentId: input.studentId,
    eventId: input.eventId,
    eventTitle: event.title || 'الفعالية',
    reason: input.reason,
    excuseId: id,
    submittedByRole: input.submittedByRole,
  }).catch(() => undefined);

  return { id, ...input };
}

export async function decideExcuse(input: {
  excuse: MaybeRow; decision: 'APPROVED' | 'REJECTED'; notes?: string; decidedBy: string; tenantId: string;
}): Promise<void> {
  const { excuse, decision, decidedBy, tenantId } = input;
  const now = new Date();
  await kdb.transaction(async (trx) => {
    await trx('attendance_excuses').where({ id: excuse.id }).update({
      status: decision, decided_by: decidedBy, decided_at: now, decided_notes: input.notes || null,
    });
    if (decision === 'APPROVED' && excuse.attendance_id) {
      const attendance = await trx('event_attendance_detailed').where({ id: excuse.attendance_id }).first();
      const event = await trx('events').where({ id: excuse.event_id }).first();
      if (attendance && event) {
        await trx('event_attendance_detailed').where({ id: attendance.id }).update({
          status: STATUS_EXCUSED, unexcused: 0, absence_reason: excuse.reason, updated_at: now,
        });
        await trx('event_attendance').where({ event_id: excuse.event_id, student_id: excuse.student_id }).update({
          status: STATUS_EXCUSED, excuse_reason: excuse.reason,
        });
        const active = await trx('attendance_penalties').where({ attendance_id: attendance.id, status: 'APPLIED' }).first();
        if (active) {
          await doReversePenalty({ trx, penaltyId: active.id, reason: `قبول عذر: ${excuse.reason}`, userId: decidedBy, tenantId, now });
          await trx('event_attendance_detailed').where({ id: attendance.id }).update({ penalty_applied: 0, penalty_status: 'REVERSED', updated_at: now });
        }
        await runEscalationsForStudent({ trx, studentId: excuse.student_id, tenantId, userId: decidedBy, eventId: excuse.event_id, sessionId: excuse.session_id }, now);
      }
    }
  });
  logAuditEvent({
    tenantId, userId: decidedBy, action: `EXCUSE ${decision}`, entityType: 'attendance_excuse', entityId: excuse.id,
    method: 'POST', path: `/api/attendance/excuses/${excuse.id}/decide`, status: '200', details: { notes: input.notes || null },
  });

  // إشعار للطالب + ولي أمره بقرار القبول/الرفض (في كل الحالات).
  const event = await kdb('events').where({ id: excuse.event_id }).first().catch(() => null);
  await notifyExcuseDecided({
    tenantId,
    studentId: excuse.student_id,
    eventId: excuse.event_id,
    eventTitle: event?.title || 'الفعالية',
    decision,
    notes: input.notes || null,
  }).catch(() => undefined);
}

// ────────────────────────────── Reads ──────────────────────────────

export async function getSessionAttendance(event: MaybeRow, session: MaybeRow): Promise<any[]> {
  const rows = await kdb('event_attendance_detailed as ead')
    .leftJoin('students as s', 'ead.student_id', 's.id')
    .leftJoin('attendance_penalties as ap', function () {
      this.on('ap.attendance_id', 'ead.id').andOn('ap.status', 'APPLIED');
    })
    .select(
      'ead.id', 'ead.student_id', 'ead.status', 'ead.checked_in_at', 'ead.late_minutes',
      'ead.penalty_mode', 'ead.penalty_amount', 'ead.penalty_points', 'ead.penalty_status',
      'ead.unexcused', 'ead.absence_reason', 'ead.check_in_method', 'ead.rule_snapshot',
      'ead.final_status', 'ead.reviewed_by', 'ead.reviewed_at',
      's.name as student_name', 's.class_name as student_class',
      'ap.id as penalty_ledger_id', 'ap.financial_amount as penalty_financial', 'ap.points_deduction as penalty_points_ledger'
    )
    .where('ead.event_id', event.id)
    .where('ead.session_id', session.id)
    .orderBy('ead.created_at', 'desc');
  return rows as any[];
}

export async function getStudentAttendanceHistory(args: {
  studentId: string; tenantId: string; limit?: number;
}): Promise<any[]> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const rows = await kdb('event_attendance_detailed as ead')
    .leftJoin('events as e', 'ead.event_id', 'e.id')
    .leftJoin('event_sessions as es', 'ead.session_id', 'es.id')
    .leftJoin('attendance_penalties as ap', function () {
      this.on('ap.attendance_id', 'ead.id').andOn('ap.status', 'APPLIED');
    })
    .select(
      'ead.id', 'ead.event_id', 'ead.session_id', 'ead.status', 'ead.checked_in_at', 'ead.late_minutes',
      'ead.penalty_mode', 'ead.penalty_amount', 'ead.penalty_points', 'ead.penalty_status',
      'ead.unexcused', 'ead.absence_reason', 'ead.rule_snapshot', 'ead.created_at',
      'e.title as event_title', 'es.title as session_title', 'es.start_time as session_start',
      'ap.id as penalty_ledger_id', 'ap.status as penalty_status_ledger'
    )
    .where('ead.student_id', args.studentId)
    .where('ead.tenant_id', args.tenantId)
    .orderBy('ead.created_at', 'desc')
    .limit(limit);
  return rows as any[];
}

export async function getEventReport(event: MaybeRow): Promise<any[]> {
  const rows = await kdb.raw(`
    SELECT
      s.id AS student_id, s.name AS student_name,
      COUNT(*) AS total_sessions,
      SUM(CASE WHEN ead.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
      SUM(CASE WHEN ead.status = 'late' THEN 1 ELSE 0 END) AS late_count,
      SUM(CASE WHEN ead.status = 'absent' THEN 1 ELSE 0 END) AS absences,
      SUM(CASE WHEN ead.status = 'absent' AND ead.unexcused = 1 THEN 1 ELSE 0 END) AS unexcused_absences,
      ISNULL(SUM(ap.financial_amount), 0) AS total_penalties,
      ISNULL(SUM(ap.points_deduction), 0) AS total_points_deducted
    FROM event_attendance_detailed ead
    JOIN students s ON s.id = ead.student_id
    LEFT JOIN attendance_penalties ap ON ap.attendance_id = ead.id AND ap.status = 'APPLIED'
    WHERE ead.event_id = ?
    GROUP BY s.id, s.name
    ORDER BY s.name
  `, [event.id]);
  return rows.recordset || [];
}

// ────────────────────────────── Event roll overview ──────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
  [STATUS_EXCUSED]: 5,
  [STATUS_TRAVEL]: 4,
  present: 3,
  late: 2,
  absent: 1,
};

// كشف حضور/غياب/أعذار على مستوى الفعالية للمشرف/الكاهن:
// كل طالب سجل حضوراً أو تغيّب (في أي جلسة) يظهر بصفة مجمّعة، مع مدة التأخير،
// إجمالي الغرامات الموقعة حسب قوانين الفعالية، وحالة العذر وأزرار القبول/الرفض.
export async function getEventOverview(event: MaybeRow): Promise<{
  counts: Record<string, number>;
  rows: any[];
}> {
  const [detailed, summary, penalties, excuses] = await Promise.all([
    kdb('event_attendance_detailed as ead')
      .leftJoin('students as s', 'ead.student_id', 's.id')
      .leftJoin('users as u', 's.user_id', 'u.id')
      .select('ead.student_id', 'ead.status', 'ead.late_minutes', 'ead.absence_reason', 'ead.attendance_weight', 'u.name as student_name', 's.student_id_number')
      .where('ead.event_id', event.id),
    kdb('event_attendance').where({ event_id: event.id }).select('student_id', 'status', 'excuse_reason'),
    kdb('attendance_penalties').where({ event_id: event.id, status: 'APPLIED' }).select('student_id', 'financial_amount', 'points_deduction', 'reason'),
    kdb('attendance_excuses').where({ event_id: event.id }).orderBy('submitted_at', 'desc').select(
      'id', 'student_id', 'reason', 'notes', 'status', 'submitted_at', 'decided_at', 'decided_notes', 'decided_by'
    ),
  ]);

  const counts: Record<string, number> = { present: 0, late: 0, absent: 0, excused: 0, travel: 0, none: 0 };
  const byStudent = new Map<string, { student_id: string; name: string; student_id_number: string; rows: any[]; summary: any | null }>();
  const putStudent = (studentId: string, name: string, idx: string) => {
    if (!byStudent.has(studentId)) {
      byStudent.set(studentId, { student_id: studentId, name: name || '', student_id_number: idx || '', rows: [], summary: null });
    }
  };
  for (const r of detailed as any[]) {
    putStudent(r.student_id, r.student_name, r.student_id_number);
    byStudent.get(r.student_id)!.rows.push(r);
  }
  for (const r of summary as any[]) {
    putStudent(r.student_id, '', '');
    byStudent.get(r.student_id)!.summary = r;
  }

  const penaltiesByStudent = new Map<string, { financial: number; points: number; reasons: Set<string> }>();
  for (const p of penalties as any[]) {
    const cur = penaltiesByStudent.get(p.student_id) || { financial: 0, points: 0, reasons: new Set<string>() };
    cur.financial += Number(p.financial_amount || 0);
    cur.points += Number(p.points_deduction || 0);
    if (p.reason) cur.reasons.add(p.reason);
    penaltiesByStudent.set(p.student_id, cur);
  }
  const excusesByStudent = new Map<string, any>();
  for (const e of excuses as any[]) {
    if (!excusesByStudent.has(e.student_id)) excusesByStudent.set(e.student_id, e);
  }

  const rows: any[] = [];
  const roll = Array.from(byStudent.values()).sort((a, b) => (a.name || a.student_id).localeCompare(b.name || b.student_id, 'ar'));
  const norm = (s: string | null | undefined) => String(s || '').toLowerCase();
  for (const s of roll) {
    const has = s.rows;
    const excuse = excusesByStudent.get(s.student_id) || null;
    // الطالب الذي له عذر (قيد المراجعة أو مقبول) يُعد في العمود "معتذر" حتى لا يظهر
    // ضمن الحضور/الغياب قبل البت في عذره. (العذر المرفوض يرجع لحالة حضوره الفعلية).
    const excUsed = excuse && excuse.status !== 'REJECTED';
    const rollStatus = excUsed ? 'excused' :
      has.some((r: any) => norm(r.status) === 'excused') ? 'excused' :
      has.some((r: any) => norm(r.status) === 'present') ? 'present' :
      has.some((r: any) => norm(r.status) === 'late') ? 'late' :
      has.some((r: any) => norm(r.status) === 'absent') ? 'absent' :
      has.some((r: any) => norm(r.status) === 'travel') ? 'travel' :
      norm(s.summary?.status) || 'none';
    if (!counts[rollStatus]) counts[rollStatus] = 0;
    counts[rollStatus] += 1;
    const pen = penaltiesByStudent.get(s.student_id) || { financial: 0, points: 0, reasons: new Set() };
    const lateMax = has.reduce((m: number, r: any) => (r.status === 'late' || r.status === 'absent') ? Math.max(m, Number(r.late_minutes || 0)) : m, 0);
    rows.push({
      student_id: s.student_id,
      name: s.name || s.student_id,
      student_id_number: s.student_id_number || '',
      status: rollStatus,
      late_minutes: lateMax,
      penalty_financial: Math.round(pen.financial * 100) / 100,
      penalty_points: pen.points,
      penalty_reasons: Array.from(pen.reasons),
      excuse,
    });
  }
  // أضف من لديه عذر لكن لم يسجل حضور فعلي (قدم العذر قبل الفعالية)
  for (const [studentId, excuse] of excusesByStudent) {
    if (!byStudent.has(studentId)) {
      counts.excused += 1;
      rows.push({
        student_id: studentId,
        name: '',
        student_id_number: '',
        class_name: '',
        status: 'excused',
        late_minutes: 0,
        penalty_financial: 0,
        penalty_points: 0,
        penalty_reasons: [],
        excuse,
      });
    }
  }

  return { counts, rows };
}

// ────────────────────────────── Student QR ──────────────────────────────

const QR_TTL_SECONDS = 365 * 24 * 3600;

// Signed student QR payload. The QR is self-contained but signed (HMAC via
// JWT) so it cannot be forged, and every scanner re-validates:
// signature → tenant/student existence → student belongs to the event's tenant.
export function generateStudentQr(student: MaybeRow, tenantId: string | null): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return `DORM-STUDENT-${jwt.sign(
    { sid: student.id, tid: tenantId || null, purpose: 'attendance-scan' },
    secret,
    { expiresIn: QR_TTL_SECONDS }
  )}`;
}

export function verifyStudentQr(qrText: string): { studentId: string; tenantId: string | null } | null {
  if (typeof qrText !== 'string') return null;
  const prefix = 'DORM-STUDENT-';
  if (!qrText.startsWith(prefix)) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const decoded = jwt.verify(qrText.slice(prefix.length), secret) as any;
    if (!decoded || !decoded.sid || decoded.purpose !== 'attendance-scan') return null;
    return { studentId: String(decoded.sid), tenantId: decoded.tid ? String(decoded.tid) : null };
  } catch {
    return null;
  }
}

export { WARNING_LABELS, normalizeEventRules };