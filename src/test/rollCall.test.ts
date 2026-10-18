import { describe, it, expect } from 'vitest';
import { summarizeRollCall, classifyRollCallOutcome } from '../backend/services/rollCall.service';

// ───────────────────────────────────────────────────────────────
// The roll-call is the human-confirmed replacement for the GPS-only
// lock check. These tests pin the two pure decisions that make it
// trustworthy: how the tallies are counted, and which marks create a
// case on submit. No DB, no network.
// ───────────────────────────────────────────────────────────────

describe('roll-call: summarizeRollCall', () => {
  it('counts present / absent / unmarked and separates travelers as excluded', () => {
    const counts = summarizeRollCall([
      { mark: 'present', is_traveling: 0 },
      { mark: 'present', is_traveling: 0 },
      { mark: 'absent', is_traveling: 0 },
      { mark: 'unmarked', is_traveling: 0 },
      { mark: 'present', is_traveling: 1 }, // traveling must NOT count as present
    ]);
    expect(counts).toEqual({ present: 2, absent: 1, unmarked: 1, excluded: 1 });
  });

  it('treats any non-present/non-absent mark as unmarked', () => {
    expect(summarizeRollCall([{ mark: '', is_traveling: 0 }, { mark: 'weird', is_traveling: 0 }]))
      .toEqual({ present: 0, absent: 0, unmarked: 2, excluded: 0 });
  });

  it('is all zeros for an empty sheet', () => {
    expect(summarizeRollCall([])).toEqual({ present: 0, absent: 0, unmarked: 0, excluded: 0 });
  });
});

describe('roll-call: classifyRollCallOutcome', () => {
  it('never creates a case for present or traveling residents', () => {
    expect(classifyRollCallOutcome('present', false)).toBeNull();
    expect(classifyRollCallOutcome('absent', true)).toBeNull();
    expect(classifyRollCallOutcome('unmarked', true)).toBeNull();
  });

  it('opens a confirmed case only for an explicit human "absent"', () => {
    expect(classifyRollCallOutcome('absent', false)).toBe('open');
  });

  it('treats an unmarked resident as unconfirmed (needs review), never absent', () => {
    expect(classifyRollCallOutcome('unmarked', false)).toBe('unconfirmed');
  });
});
