import { describe, it, expect } from 'vitest';
import { evaluateAutoCrossing, isInsideGate, haversineMeters } from '../components/attendance/autoCrossing';

// Auto-mode crossing logic — the dorm is a single official centre circle:
// check-in when the student ENTERS it, check-out when they LEAVE it.
const center = { lat: 30, lng: 31, radius: 50 };

describe('haversineMeters / isInsideGate', () => {
  it('distance to self is ~0 and a point is inside its own gate', () => {
    expect(haversineMeters(30, 31, 30, 31)).toBeLessThan(0.001);
    expect(isInsideGate(30, 31, center)).toBe(true);
  });

  it('a missing gate is never "inside"', () => {
    expect(isInsideGate(30, 31, null)).toBe(false);
    expect(isInsideGate(30, 31, { lat: null, lng: null, radius: 50 })).toBe(false);
  });
});

describe('evaluateAutoCrossing (centre circle)', () => {
  it('entering the circle from outside → check-in only', () => {
    const r = evaluateAutoCrossing({ latitude: 30, longitude: 31, center, wasInside: false });
    expect(r.inside).toBe(true);
    expect(r.checkIn).toBe(true);
    expect(r.checkOut).toBe(false);
  });

  it('leaving the circle from inside → check-out only', () => {
    const r = evaluateAutoCrossing({ latitude: 31, longitude: 30, center, wasInside: true });
    expect(r.inside).toBe(false);
    expect(r.checkIn).toBe(false);
    expect(r.checkOut).toBe(true);
  });

  it('staying inside does not re-trigger', () => {
    const r = evaluateAutoCrossing({ latitude: 30, longitude: 31, center, wasInside: true });
    expect(r.checkIn).toBe(false);
    expect(r.checkOut).toBe(false);
  });

  it('staying outside does not re-trigger', () => {
    const r = evaluateAutoCrossing({ latitude: 31, longitude: 30, center, wasInside: false });
    expect(r.checkIn).toBe(false);
    expect(r.checkOut).toBe(false);
  });

  it('an unconfigured centre never produces a crossing', () => {
    const r = evaluateAutoCrossing({ latitude: 30, longitude: 31, center: { lat: null, lng: null, radius: 50 }, wasInside: true });
    expect(r.inside).toBe(false);
    expect(r.checkOut).toBe(false);
  });
});
