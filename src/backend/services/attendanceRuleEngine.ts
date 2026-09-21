// ───────────────────────────────────────────────────────────────
// Attendance rule engine — PURE, deterministic, side-effect-free.
// All penalty/lateness math lives here so it can be unit-tested
// exhaustively without a database. The service layer persists the
// inputs and the resulting snapshot; it never re-computes history.
// ───────────────────────────────────────────────────────────────

export type PenaltyMode = 'NONE' | 'FINANCIAL' | 'POINTS' | 'BOTH';
export type AdditionalPenaltyUnit = 'PER_MINUTE' | 'PER_BLOCK' | 'FIXED';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'travel';

// ── Event rules engine (independent condition + action rules) ──
// Unlike the tier engine (one timed rule per event/session), event_rules is a
// LIST of independent rules. Each rule has a condition (which status it fires
// on, optionally constrained by lateness) and an action (points / financial
// fee / notification / residence-exclusion review). Evaluation mode selects
// FIRST_APPLICABLE (stop at the first match by sort_order) or ALL_APPLICABLE
// (apply every matching rule). Pure + deterministic so it is unit-testable.

export type RuleEvaluationMode = 'FIRST_APPLICABLE' | 'ALL_APPLICABLE';
export type EventRuleConditionStatus = 'late' | 'absent' | 'unexcused';
export type EventRuleActionType = 'NONE' | 'DEDUCT_POINTS' | 'FINANCIAL_FEE' | 'SEND_NOTIFICATION' | 'EXCLUDE_FROM_RESIDENCE';

export interface EventRule {
  id: string | null;
  condition_status: EventRuleConditionStatus;
  condition_min_late_minutes: number | null;
  condition_max_late_minutes: number | null;
  action_type: EventRuleActionType;
  points_amount: number;
  fee_amount: number;
  notification_message: string | null;
  enabled: boolean;
  sort_order: number;
}

export interface EventRuleFiringInput {
  status: AttendanceStatus;
  unexcused: boolean;
  late_minutes: number;
}

export interface EventRuleEvaluation {
  rule: EventRule;
  matched: boolean;
  late_minutes: number | null;
}

export const RULE_ACTION_LABELS: Record<EventRuleActionType, string> = {
  NONE: 'لا يوجد إجراء',
  DEDUCT_POINTS: 'خصم نقاط',
  FINANCIAL_FEE: 'غرامة مالية',
  SEND_NOTIFICATION: 'إرسال إشعار',
  EXCLUDE_FROM_RESIDENCE: 'مراجعة إنهاء الإقامة',
};

export function normalizeEventRules(rules: (Partial<EventRule> | null | undefined)[] | null | undefined): EventRule[] {
  if (!Array.isArray(rules)) return [];
  return rules
    .filter((r): r is Partial<EventRule> => !!r && (r.condition_status === 'late' || r.condition_status === 'absent' || r.condition_status === 'unexcused'))
    .map((r) => ({
      id: r.id ?? null,
      condition_status: r.condition_status as EventRuleConditionStatus,
      condition_min_late_minutes: r.condition_min_late_minutes == null ? null : Math.max(0, Math.floor(Number(r.condition_min_late_minutes))),
      condition_max_late_minutes: r.condition_max_late_minutes == null ? null : Math.max(0, Math.floor(Number(r.condition_max_late_minutes))),
      action_type: (r.action_type && ['NONE', 'DEDUCT_POINTS', 'FINANCIAL_FEE', 'SEND_NOTIFICATION', 'EXCLUDE_FROM_RESIDENCE'].includes(r.action_type)
        ? r.action_type
        : 'NONE') as EventRuleActionType,
      points_amount: Math.max(0, Math.floor(Number(r.points_amount) || 0)),
      fee_amount: Math.max(0, Number(r.fee_amount) || 0),
      notification_message: r.notification_message ?? null,
      enabled: r.enabled !== false,
      sort_order: Math.max(0, Math.floor(Number(r.sort_order) || 0)),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

// Which rule-condition groups a finalized attendance record belongs to.
//   late      → any late arrival
//   absent    → any absence record (excused or not)
//   unexcused → absence classified UNEXCUSED (punitive group)
export function eventRuleGroups(input: EventRuleFiringInput): EventRuleConditionStatus[] {
  const groups: EventRuleConditionStatus[] = [];
  if (input.status === 'late') groups.push('late');
  if (input.status === 'absent') {
    groups.push('absent');
    if (input.unexcused) groups.push('unexcused');
  }
  return groups;
}

function ruleMatchesLateCondition(rule: EventRule, lateMinutes: number): boolean {
  if (rule.condition_status !== 'late') return true;
  if (rule.condition_min_late_minutes != null && lateMinutes < rule.condition_min_late_minutes) return false;
  if (rule.condition_max_late_minutes != null && lateMinutes > rule.condition_max_late_minutes) return false;
  return true;
}

// Pure evaluation: which event rules fire for a record, honoring evaluation mode.
// Returns fired rules in sort_order; no side effects (service applies actions).
export function evaluateEventRules(
  rules: EventRule[],
  input: EventRuleFiringInput,
  mode: RuleEvaluationMode
): EventRule[] {
  const groups = eventRuleGroups(input);
  if (groups.length === 0) return [];
  const ordered = normalizeEventRules(rules).filter((r) => r.enabled && groups.includes(r.condition_status));
  const fired: EventRule[] = [];
  for (const rule of ordered) {
    if (!ruleMatchesLateCondition(rule, input.late_minutes)) continue;
    fired.push(rule);
    if (mode === 'FIRST_APPLICABLE') break;
  }
  return fired;
}

// Serializes the immutable record of the event rules applied to an attendance
// row (stored in event_attendance_detailed.applied_rules_snapshot). Kept as a
// compatible object so existing corrections/tests can read `.rule` / `.meta`.
export function serializeAppliedRules(rule: EventRule, meta: {
  mode: RuleEvaluationMode; attendanceStatus: AttendanceStatus; lateMinutes: number; evaluatedAt: Date;
}): string {
  return serializeAppliedRulesList([rule], meta);
}

export function serializeAppliedRulesList(rules: EventRule[], meta: {
  mode: RuleEvaluationMode; attendanceStatus: AttendanceStatus; lateMinutes: number; evaluatedAt: Date;
}): string {
  return JSON.stringify({
    mode: meta.mode,
    rules: rules.map((rule) => ({
      id: rule.id,
      condition_status: rule.condition_status,
      condition_min_late_minutes: rule.condition_min_late_minutes,
      condition_max_late_minutes: rule.condition_max_late_minutes,
      action_type: rule.action_type,
      points_amount: rule.points_amount,
      fee_amount: rule.fee_amount,
      notification_message: rule.notification_message,
    })),
    meta: {
      mode: meta.mode,
      attendance_status: meta.attendanceStatus,
      late_minutes: meta.lateMinutes,
      evaluated_at: new Date(meta.evaluatedAt).toISOString(),
    },
  });
}

// Extracts the set of rule ids already recorded in a stored snapshot (read-before-
// write idempotency for re-evaluations, e.g. classification after a late scan).
export function appliedRuleIdsFromSnapshot(snapshot: string | null | undefined): string[] {
  if (!snapshot) return [];
  try {
    const parsed = JSON.parse(snapshot);
    const rules = Array.isArray(parsed?.rules) ? parsed.rules : [];
    return rules.map((r: any) => r?.id).filter((id: any) => typeof id === 'string');
  } catch {
    // legacy single-rule snapshot shape
    try {
      const parsed = JSON.parse(snapshot);
      if (parsed?.rule?.id) return [String(parsed.rule.id)];
    } catch { /* empty */ }
    return [];
  }
}

export interface AttendanceTier {
  minMinutes: number;
  maxMinutes: number | null;
  penalty: number; // financial amount when the tier fires
  points: number; // points deduction when the tier fires
}

export interface AttendanceRule {
  grace_period_minutes: number;
  penalty_mode: PenaltyMode;
  base_penalty: number; // financial base (EGP)
  base_points: number; // points base (flat, tier overrides)
  additional_penalty: number; // per-unit additional financial amount
  additional_penalty_unit: AdditionalPenaltyUnit;
  additional_penalty_block_minutes: number;
  maximum_penalty: number | null;
  maximum_points_deduction: number | null;
  absent_after_minutes: number | null;
  auto_apply_penalty: boolean;
  enabled: boolean;
  tiers: AttendanceTier[] | null;
  required_attendance: boolean;
  counts_toward_absence_limit: boolean;
  attendance_weight: number;
  eventLevelRuleId?: string | null;
  sessionRuleId?: string | null;
}

export interface PenaltyLedger {
  mode: PenaltyMode;
  financial_amount: number;
  points_deduction: number;
  reason: string;
}

export interface EvaluationResult {
  status: AttendanceStatus;
  late_minutes: number;
  within_grace: boolean;
  penalty: PenaltyLedger;
  breakdown: {
    tier_applied: boolean;
    tier_label: string | null;
    base_penalty: number;
    base_points: number;
    additional_amount: number;
    capped: boolean;
  };
}

export const GRACE_LABEL = 'في المدة المسموحة';
export const TIER_PREFIX = 'شريحة تأخير';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Effective rule = event-level defaults merged with the session-level override.
// A null/undefined field in the session rule means "inherit from the event rule".
export function mergeRule(
  eventRule: AttendanceRule | null | undefined,
  sessionRule: Partial<AttendanceRule> | null | undefined
): AttendanceRule {
  const base: AttendanceRule = {
    grace_period_minutes: eventRule?.grace_period_minutes ?? 0,
    penalty_mode: eventRule?.penalty_mode ?? 'NONE',
    base_penalty: eventRule?.base_penalty ?? 0,
    base_points: eventRule?.base_points ?? 0,
    additional_penalty: eventRule?.additional_penalty ?? 0,
    additional_penalty_unit: eventRule?.additional_penalty_unit ?? 'PER_MINUTE',
    additional_penalty_block_minutes: eventRule?.additional_penalty_block_minutes ?? 1,
    maximum_penalty: eventRule?.maximum_penalty ?? null,
    maximum_points_deduction: eventRule?.maximum_points_deduction ?? null,
    absent_after_minutes: eventRule?.absent_after_minutes ?? null,
    auto_apply_penalty: eventRule?.auto_apply_penalty ?? true,
    enabled: eventRule?.enabled ?? true,
    tiers: eventRule?.tiers ?? null,
    required_attendance: eventRule?.required_attendance ?? true,
    counts_toward_absence_limit: eventRule?.counts_toward_absence_limit ?? true,
    attendance_weight: eventRule?.attendance_weight ?? 1,
    eventLevelRuleId: eventRule?.eventLevelRuleId ?? null,
    sessionRuleId: eventRule?.sessionRuleId ?? null,
  };
  if (!sessionRule) return base;
  return {
    ...base,
    grace_period_minutes: sessionRule.grace_period_minutes ?? base.grace_period_minutes,
    penalty_mode: (sessionRule.penalty_mode as PenaltyMode | undefined) ?? base.penalty_mode,
    base_penalty: sessionRule.base_penalty ?? base.base_penalty,
    base_points: sessionRule.base_points ?? base.base_points,
    additional_penalty: sessionRule.additional_penalty ?? base.additional_penalty,
    additional_penalty_unit: (sessionRule.additional_penalty_unit as AdditionalPenaltyUnit | undefined) ?? base.additional_penalty_unit,
    additional_penalty_block_minutes: sessionRule.additional_penalty_block_minutes ?? base.additional_penalty_block_minutes,
    maximum_penalty: sessionRule.maximum_penalty ?? base.maximum_penalty,
    maximum_points_deduction: sessionRule.maximum_points_deduction ?? base.maximum_points_deduction,
    absent_after_minutes: sessionRule.absent_after_minutes ?? base.absent_after_minutes,
    auto_apply_penalty: sessionRule.auto_apply_penalty ?? base.auto_apply_penalty,
    enabled: sessionRule.enabled ?? base.enabled,
    tiers: sessionRule.tiers ? normalizeTiers(sessionRule.tiers) : base.tiers,
    required_attendance: sessionRule.required_attendance ?? base.required_attendance,
    counts_toward_absence_limit: sessionRule.counts_toward_absence_limit ?? base.counts_toward_absence_limit,
    attendance_weight: sessionRule.attendance_weight ?? base.attendance_weight,
    sessionRuleId: sessionRule.sessionRuleId ?? base.sessionRuleId,
  };
}

export function normalizeTiers(tiers: AttendanceTier[] | null | undefined): AttendanceTier[] | null {
  if (!tiers) return null;
  const clean = tiers
    .filter((t) => t && typeof t.minMinutes === 'number' && Number.isFinite(t.minMinutes))
    .map((t) => ({
      minMinutes: Math.max(0, Math.floor(t.minMinutes)),
      maxMinutes: t.maxMinutes == null ? null : Math.max(0, Math.floor(t.maxMinutes)),
      penalty: Number(t.penalty) || 0,
      points: Math.floor(Number(t.points) || 0),
    }))
    .sort((a, b) => a.minMinutes - b.minMinutes);
  return clean.length > 0 ? clean : null;
}

// Whole minutes of lateness BEYOND the grace period. Never negative.
export function computeLateMinutes(scheduledStart: Date | string | null, checkedInAt: Date | string | null, graceMinutes: number): number {
  if (!scheduledStart || !checkedInAt) return 0;
  const start = new Date(scheduledStart).getTime();
  const arrived = new Date(checkedInAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(arrived)) return 0;
  const rawLate = arrived - start;
  if (rawLate <= 0) return 0;
  const lateMin = Math.floor(rawLate / 60000);
  return Math.max(0, lateMin - Math.max(0, Math.floor(graceMinutes || 0)));
}

export function pickTier(tiers: AttendanceTier[] | null, lateMinutes: number): AttendanceTier | null {
  if (!tiers) return null;
  let best: AttendanceTier | null = null;
  for (const tier of tiers) {
    if (lateMinutes < tier.minMinutes) continue;
    if (tier.maxMinutes != null && lateMinutes >= tier.maxMinutes) continue;
    if (!best || tier.minMinutes > best.minMinutes) best = tier;
  }
  return best;
}

export function evaluatePenalty(rule: AttendanceRule, lateMinutes: number): EvaluationResult {
  const status: AttendanceStatus = lateMinutes > 0 ? 'late' : 'present';
  if (!rule.enabled) {
    return {
      status,
      late_minutes: lateMinutes,
      within_grace: lateMinutes === 0,
      penalty: { mode: 'NONE', financial_amount: 0, points_deduction: 0, reason: 'attendance-rule-disabled' },
      breakdown: { tier_applied: false, tier_label: null, base_penalty: 0, base_points: 0, additional_amount: 0, capped: false },
    };
  }

  const tier = pickTier(rule.tiers, lateMinutes);
  const tierApplied = tier !== null;
  const isLate = lateMinutes > 0;
  const basePenalty = tier ? tier.penalty : rule.base_penalty;
  const basePoints = tier ? tier.points : rule.base_points;

  let additionalAmount = 0;
  if (!tier && isLate) {
    const unit = rule.additional_penalty_unit;
    const block = Math.max(1, rule.additional_penalty_block_minutes || 1);
    if (unit === 'PER_MINUTE') additionalAmount = rule.additional_penalty * lateMinutes;
    else if (unit === 'PER_BLOCK') additionalAmount = rule.additional_penalty * Math.ceil(lateMinutes / block);
    else additionalAmount = rule.additional_penalty;
  }

  // On-time arrivals (within grace) never incur a penalty.
  const rawFinancial = !isLate ? 0 : (tier ? basePenalty : basePenalty + additionalAmount);
  const cappedFinancial = rule.maximum_penalty != null ? Math.min(rawFinancial, rule.maximum_penalty) : rawFinancial;
  const rawPoints = !isLate ? 0 : basePoints;
  const cappedPoints = rule.maximum_points_deduction != null ? Math.min(rawPoints, rule.maximum_points_deduction) : rawPoints;

  const mode: PenaltyMode = rule.penalty_mode;
  const financial = mode === 'FINANCIAL' || mode === 'BOTH' ? cappedFinancial : 0;
  const points = mode === 'POINTS' || mode === 'BOTH' ? Math.floor(cappedPoints) : 0;

  return {
    status,
    late_minutes: lateMinutes,
    within_grace: lateMinutes === 0,
    penalty: {
      mode: financial === 0 && points === 0 ? 'NONE' : mode,
      financial_amount: Math.round(financial * 100) / 100,
      points_deduction: points,
      reason: tier ? `${TIER_PREFIX} (${tier.minMinutes}+ دقيقة)` : GRACE_LABEL,
    },
    breakdown: {
      tier_applied: tierApplied,
      tier_label: tier ? `${TIER_PREFIX}: ${tier.minMinutes}+ دقيقة` : null,
      base_penalty: Math.round(basePenalty * 100) / 100,
      base_points: basePoints,
      additional_amount: Math.round(additionalAmount * 100) / 100,
      capped: rawFinancial > cappedFinancial || basePoints > cappedPoints,
    },
  };
}

// Serializes the immutable calc snapshot that gets stored on the attendance
// record so historical decisions never recompute with current rules.
export function serializeSnapshot(
  rule: AttendanceRule,
  meta: { sessionId?: string | null; scheduledAt?: Date | string | null; evaluatedAt: Date; generatedBy: string; policyVersion?: number | null }
): string {
  return JSON.stringify({
    rule: {
      grace_period_minutes: rule.grace_period_minutes,
      penalty_mode: rule.penalty_mode,
      base_penalty: rule.base_penalty,
      base_points: rule.base_points,
      additional_penalty: rule.additional_penalty,
      additional_penalty_unit: rule.additional_penalty_unit,
      additional_penalty_block_minutes: rule.additional_penalty_block_minutes,
      maximum_penalty: rule.maximum_penalty,
      maximum_points_deduction: rule.maximum_points_deduction,
      absent_after_minutes: rule.absent_after_minutes,
      auto_apply_penalty: rule.auto_apply_penalty,
      enabled: rule.enabled,
      tiers: rule.tiers,
      required_attendance: rule.required_attendance,
      counts_toward_absence_limit: rule.counts_toward_absence_limit,
      attendance_weight: rule.attendance_weight,
    },
    meta: {
      sessionId: meta.sessionId ?? null,
      scheduledAt: meta.scheduledAt ? new Date(meta.scheduledAt).toISOString() : null,
      evaluatedAt: new Date(meta.evaluatedAt).toISOString(),
      generatedBy: meta.generatedBy,
      policyVersion: meta.policyVersion ?? null,
    },
  });
}

export function parseSnapshot(snapshot: string | null | undefined): { rule: AttendanceRule; meta: Record<string, unknown> } | null {
  if (!snapshot) return null;
  try {
    const parsed = JSON.parse(snapshot);
    if (!parsed?.rule) return null;
    return { rule: parsed.rule, meta: parsed.meta || {} };
  } catch {
    return null;
  }
}

// Softer helper used by the dashboard: a lateness is "excusable" look-up only.
export function isAbsentLike(status: AttendanceStatus | string | null | undefined): boolean {
  return status === 'absent';
}

export function isPresence(status: AttendanceStatus | string | null | undefined): boolean {
  return status === 'present' || status === 'late';
}