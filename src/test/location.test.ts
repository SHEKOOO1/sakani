import { describe, it, expect } from 'vitest';
import { isTrustworthyFix, MAX_TRUSTWORTHY_ACCURACY_M } from '../utils/location';

// Guards against IP/Wi-Fi "far away" readings being treated as a real position.
describe('location: isTrustworthyFix', () => {
  it('accepts GPS-grade accuracy (including 0 = unreported)', () => {
    expect(isTrustworthyFix({ accuracy: 0 })).toBe(true);
    expect(isTrustworthyFix({ accuracy: 5 })).toBe(true);
    expect(isTrustworthyFix({ accuracy: MAX_TRUSTWORTHY_ACCURACY_M })).toBe(true);
  });

  it('rejects coarse network/IP fixes', () => {
    expect(isTrustworthyFix({ accuracy: 201 })).toBe(false);
    expect(isTrustworthyFix({ accuracy: 1000 })).toBe(false);
    expect(isTrustworthyFix({ accuracy: 5000 })).toBe(false);
  });

  it('honours a custom threshold', () => {
    expect(isTrustworthyFix({ accuracy: 300 }, 500)).toBe(true);
    expect(isTrustworthyFix({ accuracy: 300 }, 100)).toBe(false);
  });
});
