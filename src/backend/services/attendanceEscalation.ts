// ───────────────────────────────────────────────────────────────
// Absence policy + escalation decision logic — PURE.
// Determines absence counters, attendance rate, and which warnings /
// disciplinary cases a student's current state should create.
// The service persists decisions guarded by unique indexes so a
// decision can never be created twice (idempotency).
// ───────────────────────────────────────────────────────────────

export interface AbsenceRecordInput {
  status: string;
  unexcused: boolean;
  counts_toward_absence_limit: boolean;
  attendance_weight: number;
  required_attendance: boolean;
}

export interface AbsenceSummary {
  unexcusedCount: number;
  weightedUnexcused: number;
  attendedCount: number;
  requiredTotal: number;
  attendanceRate: number; // weighted-attendance percent 0..100
}

export interface AttendancePolicyConfig {
  enforce_absence_thresholds: boolean;
  weighted_attendance_enabled: boolean;
  warning_1_threshold: number;
  warning_2_threshold: number;
  final_warning_threshold: number;
  disciplinary_review_threshold: number;
  residence_termination_review_threshold: number;
  excuse_time_limit_hours: number;
  parent_notify_on_absence: boolean;
  parent_notify_on_late: boolean;
  parent_notify_on_warning: boolean;
  version: number;
}

export type EscalationKind = 'WARNING' | 'CASE';

export type WarningType = 'WARNING_1' | 'WARNING_2' | 'FINAL_WARNING' | 'DISCIPLINARY_REVIEW' | 'RESIDENCE_TERMINATION_REVIEW';
export type CaseType = 'DISCIPLINARY_REVIEW' | 'RESIDENCE_TERMINATION_REVIEW';

export interface EscalationStep {
  kind: EscalationKind;
  key: WarningType;
  caseType: CaseType | null;
  threshold: number;
  label: string;
}

export const WARNING_LABELS: Record<WarningType, string> = {
  WARNING_1: 'الإنذار الأول',
  WARNING_2: 'الإنذار الثاني',
  FINAL_WARNING: 'الإنذار الأخير',
  DISCIPLINARY_REVIEW: 'مراجعة تأديبية',
  RESIDENCE_TERMINATION_REVIEW: 'مراجعة إنهاء الإقامة',
};

// Required attendance only (absent rows with required_attendance=1).
export function summarizeAbsences(records: AbsenceRecordInput[]): AbsenceSummary {
  let unexcusedCount = 0;
  let weightedUnexcused = 0;
  let attendedWeight = 0;
  let requiredTotalWeight = 0;
  let requiredTotal = 0;

  for (const rec of records) {
    if (!rec.required_attendance) continue;
    const weight = Number(rec.attendance_weight) || 1;
    requiredTotal += 1;
    requiredTotalWeight += weight;
    const isAbsent = rec.status === 'absent';
    if (isAbsent) {
      if (rec.unexcused && rec.counts_toward_absence_limit) {
        unexcusedCount += 1;
        weightedUnexcused += weight;
      }
    } else {
      attendedWeight += weight;
    }
  }

  const attendanceRate = requiredTotalWeight > 0 ? Math.round((attendedWeight / requiredTotalWeight) * 10000) / 100 : 100;
  return {
    unexcusedCount,
    weightedUnexcused: Math.round(weightedUnexcused * 100) / 100,
    attendedCount: Math.round(attendedWeight * 100) / 100,
    requiredTotal: requiredTotalWeight,
    attendanceRate,
  };
}

function stepFor(kind: EscalationKind, key: WarningType, caseType: CaseType | null, threshold: number, label: string): EscalationStep {
  return { kind, key, caseType, threshold, label };
}

// All thresholds already crossed (ascending). Callers create only the steps
// that do not already exist (guarded in the DB by unique indexes), and a
// residence termination REVIEW is NEVER auto-approved — it always opens a case.
export function computeEscalations(summary: AbsenceSummary, policy: AttendancePolicyConfig): EscalationStep[] {
  if (!policy.enforce_absence_thresholds) return [];
  const count = policy.weighted_attendance_enabled ? Math.ceil(summary.weightedUnexcused) : Math.ceil(summary.unexcusedCount);
  if (count <= 0) return [];

  const steps: EscalationStep[] = [];
  if (count >= policy.warning_1_threshold) steps.push(stepFor('WARNING', 'WARNING_1', null, policy.warning_1_threshold, WARNING_LABELS.WARNING_1));
  if (count >= policy.warning_2_threshold) steps.push(stepFor('WARNING', 'WARNING_2', null, policy.warning_2_threshold, WARNING_LABELS.WARNING_2));
  if (count >= policy.final_warning_threshold) steps.push(stepFor('WARNING', 'FINAL_WARNING', null, policy.final_warning_threshold, WARNING_LABELS.FINAL_WARNING));
  if (count >= policy.disciplinary_review_threshold) {
    steps.push(stepFor('CASE', 'DISCIPLINARY_REVIEW', 'DISCIPLINARY_REVIEW', policy.disciplinary_review_threshold, WARNING_LABELS.DISCIPLINARY_REVIEW));
  }
  if (count >= policy.residence_termination_review_threshold) {
    steps.push(stepFor('CASE', 'RESIDENCE_TERMINATION_REVIEW', 'RESIDENCE_TERMINATION_REVIEW', policy.residence_termination_review_threshold, WARNING_LABELS.RESIDENCE_TERMINATION_REVIEW));
  }
  return steps;
}

// Which grades map to which warning severity label on the dashboard.
export function policeWarningLevelFor(warningType: WarningType): string {
  switch (warningType) {
    case 'WARNING_1': return 'first';
    case 'WARNING_2': return 'medium';
    case 'FINAL_WARNING': return 'high';
    case 'DISCIPLINARY_REVIEW': return 'critical';
    case 'RESIDENCE_TERMINATION_REVIEW': return 'critical';
    default: return 'first';
  }
}