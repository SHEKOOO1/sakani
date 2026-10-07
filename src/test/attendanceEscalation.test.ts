import { describe, it, expect } from 'vitest';
import {
  summarizeAbsences,
  computeEscalations,
  policeWarningLevelFor,
  type AbsenceRecordInput,
  type AttendancePolicyConfig,
} from '../backend/services/attendanceEscalation';

const basePolicy: AttendancePolicyConfig = {
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
};

function absent(weight = 1, overrides: Partial<AbsenceRecordInput> = {}): AbsenceRecordInput {
  return { status: 'absent', unexcused: true, counts_toward_absence_limit: true, attendance_weight: weight, required_attendance: true, ...overrides };
}
function present(weight = 1): AbsenceRecordInput {
  return { status: 'present', unexcused: false, counts_toward_absence_limit: true, attendance_weight: weight, required_attendance: true };
}

describe('summarizeAbsences', () => {
  it('ignores non-required and excused absences for the unexcused count', () => {
    const s = summarizeAbsences([
      absent(), // 1 unexcused
      absent(1, { unexcused: false }), // excused → not counted
      absent(1, { counts_toward_absence_limit: false }), // not toward limit
      present(),
    ]);
    expect(s.unexcusedCount).toBe(1);
  });

  it('non-required attendance does not affect rate', () => {
    const s = summarizeAbsences([present(1), absent(1, { required_attendance: false })]);
    expect(s.requiredTotal).toBe(1);
    expect(s.attendanceRate).toBe(100);
  });

  it('weighted rate computes by weight not by row count', () => {
    const s = summarizeAbsences([present(3), absent(2)]);
    expect(s.attendanceRate).toBe(60); // 3 / (3+2)
    expect(s.weightedUnexcused).toBe(2);
  });

  it('empty records → 100% rate, zero counters', () => {
    const s = summarizeAbsences([]);
    expect(s).toMatchObject({ unexcusedCount: 0, weightedUnexcused: 0, attendedCount: 0, requiredTotal: 0, attendanceRate: 100 });
  });
});

describe('computeEscalations', () => {
  it('policy disabled → no escalations ever', () => {
    const s = summarizeAbsences([absent(), absent(), absent(), absent(), absent()]);
    expect(computeEscalations(s, { ...basePolicy, enforce_absence_thresholds: false })).toEqual([]);
  });

  it('no unexcused absences → nothing', () => {
    expect(computeEscalations(summarizeAbsences([present()]), basePolicy)).toEqual([]);
  });

  it('crossing a threshold yields monotonically the warning levels up to it', () => {
    const s = summarizeAbsences([absent(), absent(), absent()]);
    const steps = computeEscalations(s, basePolicy);
    expect(steps.map((x) => x.key)).toEqual(['WARNING_1', 'WARNING_2', 'FINAL_WARNING']);
    expect(steps.every((x) => x.kind === 'WARNING')).toBe(true);
  });

  it('disciplinary review threshold opens a CASE (never a silent termination)', () => {
    const s = summarizeAbsences([absent(), absent(), absent(), absent()]);
    const steps = computeEscalations(s, basePolicy);
    const caseSteps = steps.filter((x) => x.kind === 'CASE');
    expect(caseSteps).toHaveLength(1);
    expect(caseSteps[0].caseType).toBe('DISCIPLINARY_REVIEW');
  });

  it('residence termination is a REVIEW case only — never auto-approved', () => {
    const many = [absent(), absent(), absent(), absent(), absent(), absent()];
    const steps = computeEscalations(summarizeAbsences(many), basePolicy);
    const term = steps.find((x) => x.key === 'RESIDENCE_TERMINATION_REVIEW');
    expect(term).toBeDefined();
    expect(term!.kind).toBe('CASE');
    expect(term!.caseType).toBe('RESIDENCE_TERMINATION_REVIEW');
  });

  it('weighted mode counts ceil(weightedUnexcused)', () => {
    // 5 absences × weight 0.6 = 3.0 → final warning, no disciplinary case
    const s = summarizeAbsences([absent(0.6), absent(0.6), absent(0.6), absent(0.6), absent(0.6)]);
    const steps = computeEscalations(s, { ...basePolicy, weighted_attendance_enabled: true });
    expect(s.weightedUnexcused).toBe(3);
    expect(steps.map((x) => x.key)).toEqual(['WARNING_1', 'WARNING_2', 'FINAL_WARNING']);
  });
});

describe('policeWarningLevelFor', () => {
  it('maps severity labels', () => {
    expect(policeWarningLevelFor('WARNING_1')).toBe('first');
    expect(policeWarningLevelFor('FINAL_WARNING')).toBe('high');
    expect(policeWarningLevelFor('RESIDENCE_TERMINATION_REVIEW')).toBe('critical');
  });
});