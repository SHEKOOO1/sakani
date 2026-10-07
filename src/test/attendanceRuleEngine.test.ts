import { describe, it, expect } from 'vitest';
import {
  mergeRule,
  normalizeTiers,
  computeLateMinutes,
  pickTier,
  evaluatePenalty,
  serializeSnapshot,
  parseSnapshot,
  isPresence,
  isAbsentLike,
  type AttendanceRule,
} from '../backend/services/attendanceRuleEngine';

const baseRule: AttendanceRule = {
  grace_period_minutes: 10,
  penalty_mode: 'FINANCIAL',
  base_penalty: 50,
  base_points: 0,
  additional_penalty: 1,
  additional_penalty_unit: 'PER_MINUTE',
  additional_penalty_block_minutes: 1,
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

describe('mergeRule', () => {
  it('empty session rule inherits everything from the event rule', () => {
    const merged = mergeRule(baseRule, {});
    expect(merged.grace_period_minutes).toBe(10);
    expect(merged.penalty_mode).toBe('FINANCIAL');
    expect(merged.base_penalty).toBe(50);
    expect(merged.base_points).toBe(0);
  });

  it('session override replaces only provided fields', () => {
    const merged = mergeRule(baseRule, { base_penalty: 120, grace_period_minutes: 5 });
    expect(merged.base_penalty).toBe(120);
    expect(merged.grace_period_minutes).toBe(5);
    expect(merged.additional_penalty).toBe(1); // inherit
    expect((merged as any).extra_prop).toBeUndefined();
  });

  it('null event rule produces safe defaults', () => {
    const merged = mergeRule(null, {});
    expect(merged.grace_period_minutes).toBe(0);
    expect(merged.penalty_mode).toBe('NONE');
    expect(merged.attendance_weight).toBe(1);
    expect(merged.auto_apply_penalty).toBe(true);
  });

  it('session tiers override event tiers when set', () => {
    const merged = mergeRule(baseRule, { tiers: [{ minMinutes: 30, maxMinutes: null, penalty: 500, points: 0 }] });
    expect(merged.tiers).toHaveLength(1);
    expect(merged.tiers![0].penalty).toBe(500);
  });
});

describe('computeLateMinutes', () => {
  const start = '2026-01-01T10:00:00.000Z';
  it('arrival within grace → 0 late minutes', () => {
    expect(computeLateMinutes(start, '2026-01-01T10:05:00.000Z', 10)).toBe(0);
  });
  it('arrival after grace → full minutes beyond grace', () => {
    expect(computeLateMinutes(start, '2026-01-01T10:15:30.000Z', 10)).toBe(5);
  });
  it('early arrival → 0', () => {
    expect(computeLateMinutes(start, '2026-01-01T09:55:00.000Z', 10)).toBe(0);
  });
  it('missing timestamps → 0', () => {
    expect(computeLateMinutes(null, new Date(), 5)).toBe(0);
    expect(computeLateMinutes(start, null, 5)).toBe(0);
  });
});

describe('pickTier', () => {
  const tiers = normalizeTiers([
    { minMinutes: 15, maxMinutes: 29, penalty: 100, points: 1 },
    { minMinutes: 30, maxMinutes: null, penalty: 300, points: 2 },
  ]);
  it('no tiers → null', () => {
    expect(pickTier(null, 40)).toBeNull();
  });
  it('matches the exact band (upper bound is exclusive)', () => {
    expect(pickTier(tiers, 15)?.penalty).toBe(100);
    expect(pickTier(tiers, 28)?.penalty).toBe(100);
    // 29 lies between band 1 (ends <29) and band 2 (starts ≥30) → falls through
    expect(pickTier(tiers, 29)).toBeNull();
  });
  it('falls into the open-ended band', () => {
    expect(pickTier(tiers, 30)?.penalty).toBe(300);
    expect(pickTier(tiers, 120)?.penalty).toBe(300);
  });
  it('below the first band → null', () => {
    expect(pickTier(tiers, 14)).toBeNull();
  });
});

describe('evaluatePenalty', () => {
  it('on-time → present, no penalty', () => {
    const e = evaluatePenalty({ ...baseRule, grace_period_minutes: 10 }, 0);
    expect(e.status).toBe('present');
    expect(e.penalty.financial_amount).toBe(0);
    expect(e.penalty.mode).toBe('NONE');
    expect(e.within_grace).toBe(true);
  });

  it('regression: on-time arrival never charged even with a base penalty configured', () => {
    const rule = { ...baseRule, penalty_mode: 'BOTH' as const, base_penalty: 500, base_points: 50 };
    const e = evaluatePenalty(rule, 0);
    expect(e.penalty.financial_amount).toBe(0);
    expect(e.penalty.points_deduction).toBe(0);
    expect(e.penalty.mode).toBe('NONE');
  });

  it('late beyond grace → financial by minute above base', () => {
    const rule = { ...baseRule, grace_period_minutes: 5, base_penalty: 50, additional_penalty: 2, additional_penalty_unit: 'PER_MINUTE' as const };
    const e = evaluatePenalty(rule, 10);
    expect(e.status).toBe('late');
    expect(e.penalty.financial_amount).toBe(50 + 2 * 10);
  });

  it('disables rule → NONE penalty even if late', () => {
    const e = evaluatePenalty({ ...baseRule, enabled: false, penalty_mode: 'FINANCIAL' }, 30);
    expect(e.penalty.mode).toBe('NONE');
    expect(e.penalty.financial_amount).toBe(0);
  });

  it('POINTS mode deducts flat base points capped by maximum_points_deduction', () => {
    const e = evaluatePenalty({ ...baseRule, penalty_mode: 'POINTS', base_points: 20, maximum_points_deduction: 5 }, 8);
    expect(e.penalty.points_deduction).toBe(5);
    expect(e.penalty.mode).toBe('POINTS');
  });

  it('maximum_penalty caps the charge', () => {
    const rule = { ...baseRule, base_penalty: 0, additional_penalty: 10, additional_penalty_unit: 'PER_BLOCK' as const, additional_penalty_block_minutes: 1, maximum_penalty: 25 };
    const e = evaluatePenalty(rule, 10);
    expect(e.penalty.financial_amount).toBe(25);
    expect(e.breakdown.capped).toBe(true);
  });

  it('tier overrides base; FIXED unit adds a flat amount on top of the base outside tiers', () => {
    const rule = { ...baseRule, tiers: [{ minMinutes: 30, maxMinutes: null, penalty: 500, points: 0 }], additional_penalty: 7, additional_penalty_unit: 'FIXED' as const };
    const inTier = evaluatePenalty(rule, 45);
    expect(inTier.penalty.financial_amount).toBe(500);
    const belowTier = evaluatePenalty(rule, 20);
    expect(belowTier.penalty.financial_amount).toBe(50 + 7);
  });

  it('BOTH mode yields financial + points', () => {
    const e = evaluatePenalty({ ...baseRule, penalty_mode: 'BOTH', base_penalty: 60, base_points: 3 }, 12);
    expect(e.penalty.financial_amount).toBe(60 + 1 * 12);
    expect(e.penalty.points_deduction).toBe(3);
  });
});

describe('snapshot serialization', () => {
  it('round-trips rule + meta deterministically', () => {
    const when = new Date('2026-02-02T12:00:00.000Z');
    const snap = serializeSnapshot(baseRule, {
      sessionId: 's1',
      scheduledAt: '2026-01-01T10:00:00Z',
      evaluatedAt: when,
      generatedBy: 'u1',
      policyVersion: 2,
    });
    const parsed = parseSnapshot(snap)!;
    expect(parsed.rule.base_penalty).toBe(50);
    expect(parsed.rule.grace_period_minutes).toBe(10);
    expect(parsed.meta.sessionId).toBe('s1');
    expect(parsed.meta.policyVersion).toBe(2);
  });

  it('tampered / garbage snapshot → null (fail closed)', () => {
    expect(parseSnapshot('{"rule":')).toBeNull();
    expect(parseSnapshot('not-json')).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('{"rule":{"penalty_mode":"FINANCIAL"}}')).not.toBeNull();
  });
});

describe('semantic helpers', () => {
  it('isPresence covers present and late only', () => {
    expect(isPresence('present')).toBe(true);
    expect(isPresence('late')).toBe(true);
    expect(isPresence('absent')).toBe(false);
    expect(isPresence('excused')).toBe(false);
  });
  it('isAbsentLike flags plain absences only', () => {
    expect(isAbsentLike('absent')).toBe(true);
    expect(isAbsentLike('late')).toBe(false);
  });
});