import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  evaluateGeofence,
  parseAccuracy,
  isValidCoordinate,
} from '../backend/services/geo';
import {
  resolveDormGate,
  presenceStatus,
  isConfirmedAbsence,
  PRESENCE_STALE_MINUTES,
  type PresenceRecord,
} from '../backend/services/presence.service';
import { lockDateString, RE_ESCALATE_MINUTES } from '../backend/services/absenceLock.service';

// ───────────────────────────────────────────────────────────────
// The absence system is only as trustworthy as its "inside/outside"
// decision. These tests pin the pure, server-authoritative logic:
// geofence math (accuracy-aware), the tri-state presence collapse,
// and the dorm-gate selection. No DB, no network.
// ───────────────────────────────────────────────────────────────

describe('geo: calculateDistance', () => {
  it('is zero for identical points', () => {
    expect(calculateDistance(30.0, 31.0, 30.0, 31.0)).toBe(0);
  });

  it('matches a known ~111km per degree of latitude', () => {
    const d = calculateDistance(30.0, 31.0, 31.0, 31.0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('is symmetric', () => {
    const a = calculateDistance(30.1, 31.2, 30.5, 31.9);
    const b = calculateDistance(30.5, 31.9, 30.1, 31.2);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
});

describe('geo: evaluateGeofence (accuracy-aware tri-state)', () => {
  it('accuracy 0 → classic point-in-circle', () => {
    expect(evaluateGeofence(10, 50, 0)).toBe('inside');
    expect(evaluateGeofence(50, 50, 0)).toBe('inside');
    expect(evaluateGeofence(51, 50, 0)).toBe('outside');
  });

  it('fully inside the error band → inside', () => {
    // distance 40 + accuracy 5 = 45 <= 50
    expect(evaluateGeofence(40, 50, 5)).toBe('inside');
  });

  it('fully outside the error band → outside', () => {
    // distance 60 - accuracy 5 = 55 > 50
    expect(evaluateGeofence(60, 50, 5)).toBe('outside');
  });

  it('straddling the boundary → uncertain (never a confirmed absence)', () => {
    // 48 - 5 = 43 <= 50 < 48 + 5 = 53
    expect(evaluateGeofence(48, 50, 5)).toBe('uncertain');
  });

  it('huge accuracy that swallows the circle → uncertain', () => {
    expect(evaluateGeofence(20, 50, 100)).toBe('uncertain');
  });
});

describe('geo: parseAccuracy & isValidCoordinate', () => {
  it('parseAccuracy rejects negatives/NaN to 0, keeps legit numbers', () => {
    expect(parseAccuracy(12.5)).toBe(12.5);
    expect(parseAccuracy(0)).toBe(0);
    expect(parseAccuracy(-3)).toBe(0);
    expect(parseAccuracy('nope')).toBe(0);
    expect(parseAccuracy(null)).toBe(0);
  });

  it('isValidCoordinate accepts real WGS-84 pairs', () => {
    expect(isValidCoordinate(30.04, 31.23)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);
    expect(isValidCoordinate('30', '31')).toBe(true);
  });

  it('isValidCoordinate rejects out-of-range / empty / NaN', () => {
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate('', 31)).toBe(false);
    expect(isValidCoordinate(null, 31)).toBe(false);
    expect(isValidCoordinate('abc', 31)).toBe(false);
  });
});

describe('presence: resolveDormGate', () => {
  it('uses the configured dorm centre', () => {
    const gate = resolveDormGate({ location_lat: 30, location_lng: 31, location_radius: 120 });
    expect(gate).toEqual({ lat: 30, lng: 31, radius: 120, label: 'موقع السكن' });
  });

  it('ignores legacy entry-point fields (no centre → null)', () => {
    expect(resolveDormGate({ entry_lat: 40, entry_lng: 41, entry_radius: 30 } as any)).toBeNull();
  });

  it('defaults the radius to 50 when missing', () => {
    expect(resolveDormGate({ location_lat: 30, location_lng: 31 })?.radius).toBe(50);
  });

  it('returns null when nothing is configured (no circle → never absent)', () => {
    expect(resolveDormGate({})).toBeNull();
    expect(resolveDormGate(null)).toBeNull();
    expect(resolveDormGate({ location_lat: 30 })).toBeNull();
  });
});

describe('presence: presenceStatus tri-state', () => {
  const now = new Date('2026-06-01T22:00:00Z');
  const make = (over: Partial<PresenceRecord>): PresenceRecord => ({
    studentId: 's1', tenantId: 'A', lat: 30, lng: 31, accuracy: 5, inside: true, updatedAt: new Date(now.getTime() - 60_000), ...over,
  });

  it('no record → unknown', () => {
    expect(presenceStatus(null, now)).toBe('unknown');
  });

  it('fresh inside → inside', () => {
    expect(presenceStatus(make({ inside: true }), now)).toBe('inside');
  });

  it('fresh outside → outside', () => {
    expect(presenceStatus(make({ inside: false }), now)).toBe('outside');
  });

  it('NULL inside (uncertain ping) → unknown, not an absence', () => {
    expect(presenceStatus(make({ inside: null }), now)).toBe('unknown');
  });

  it('stale reading collapses to unknown', () => {
    const stale = new Date(now.getTime() - (PRESENCE_STALE_MINUTES + 1) * 60_000);
    expect(presenceStatus(make({ inside: false, updatedAt: stale }), now)).toBe('unknown');
  });

  it('exactly at the staleness edge is still fresh', () => {
    const edge = new Date(now.getTime() - PRESENCE_STALE_MINUTES * 60_000);
    expect(presenceStatus(make({ inside: false, updatedAt: edge }), now)).toBe('outside');
  });
});

describe('presence: isConfirmedAbsence', () => {
  const now = new Date('2026-06-01T22:00:00Z');
  it('confirms only a fresh, explicit outside', () => {
    const outside: PresenceRecord = { studentId: 's1', tenantId: 'A', lat: 30, lng: 31, accuracy: 5, inside: false, updatedAt: now };
    const unknown: PresenceRecord = { ...outside, inside: null };
    expect(isConfirmedAbsence(outside, now)).toBe(true);
    expect(isConfirmedAbsence(unknown, now)).toBe(false);
    expect(isConfirmedAbsence(null, now)).toBe(false);
  });
});

describe('absenceLock: lockDateString & escalation threshold', () => {
  it('zero-pads the lock date (server-local)', () => {
    expect(lockDateString(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(lockDateString(new Date(2026, 11, 25, 0, 5))).toBe('2026-12-25');
  });

  it('exposes the 20-minute re-escalation window', () => {
    expect(RE_ESCALATE_MINUTES).toBe(20);
  });
});
