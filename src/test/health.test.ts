import { describe, it, expect } from 'vitest';

const BASE_URL = 'http://localhost:3000';
const ACCEPTABLE = [200, 429]; // 429 = rate limited

describe('Health & System', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
  });

  it('GET /api/not-found returns expected status', async () => {
    const res = await fetch(`${BASE_URL}/api/nonexistent-route`);
    expect(ACCEPTABLE).toContain(res.status);
  });

  it('GET /api/auth/setup-status returns expected status', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/setup-status`);
    expect(ACCEPTABLE).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('needsSetup');
    }
  });
});
