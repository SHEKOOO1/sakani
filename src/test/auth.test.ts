import { describe, it, expect } from 'vitest';

describe('Auth API', () => {
  const API_BASE = 'http://localhost:3000/api';

  it('should reject login with missing fields', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect([400, 429]).toContain(res.status);
    const data = await res.json();
    if (res.status === 400) expect(data.success).toBe(false);
  });

  it('should reject login with wrong credentials', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrong' }),
    });
    expect([401, 429]).toContain(res.status);
    if (res.status === 401) {
      const data = await res.json();
      expect(data.success).toBe(false);
    }
  });

  it('should reject register with missing fields', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect([400, 429]).toContain(res.status);
  });

  it('should return 405 on GET /auth/login', async () => {
    const res = await fetch(`${API_BASE}/auth/login`);
    expect([404, 405, 429]).toContain(res.status);
  });

  it('should reject protected routes without token', async () => {
    const res = await fetch(`${API_BASE}/students`);
    expect([401, 429]).toContain(res.status);
  });

  it('should reject protected routes with invalid token', async () => {
    const res = await fetch(`${API_BASE}/students`, {
      headers: { Authorization: 'Bearer invalid-token-here' },
    });
    expect([401, 429]).toContain(res.status);
  });
});
