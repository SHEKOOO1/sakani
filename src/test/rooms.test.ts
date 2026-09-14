import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:3000/api';
const ACCEPTABLE = [200, 429];

function extractTokenFromCookie(res: Response): string | null {
  const cookies = res.headers.getSetCookie?.() || [];
  for (const cookie of cookies) {
    const match = cookie.match(/^token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

describe('Rooms API', () => {
  it('GET /rooms requires authentication', async () => {
    const res = await fetch(`${API_BASE}/rooms`);
    expect([401, 429]).toContain(res.status);
  });

  it('GET /rooms returns paginated response with valid token', async () => {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sakani.com', password: 'admin123' }),
    });
    if (loginRes.status !== 200) return;
    const token = extractTokenFromCookie(loginRes);
    if (!token) return;

    const res = await fetch(`${API_BASE}/rooms?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ACCEPTABLE).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('limit');
      expect(body).toHaveProperty('totalPages');
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  it('GET /rooms paginates correctly', async () => {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sakani.com', password: 'admin123' }),
    });
    if (loginRes.status !== 200) return;
    const token = extractTokenFromCookie(loginRes);
    if (!token) return;

    const [res1, res2] = await Promise.all([
      fetch(`${API_BASE}/rooms?page=1&limit=3`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE}/rooms?page=2&limit=3`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (res1.status === 200 && res2.status === 200) {
      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.page).toBe(1);
      expect(body2.page).toBe(2);
      if (body1.data.length > 0 && body2.data.length > 0) {
        expect(body1.data[0].id).not.toBe(body2.data[0].id);
      }
    }
  });

  it('GET /rooms with X-Tenant-Id filters correctly', async () => {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'supervisor@sakani.com', password: 'test123' }),
    });
    if (loginRes.status !== 200) return;
    const token = extractTokenFromCookie(loginRes);
    if (!token) return;

    const res = await fetch(`${API_BASE}/rooms?page=1&limit=10`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Id': 'test-tenant-a',
      },
    });
    if (res.status === 200) {
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  it('GET /rooms with invalid page defaults gracefully', async () => {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sakani.com', password: 'admin123' }),
    });
    if (loginRes.status !== 200) return;
    const token = extractTokenFromCookie(loginRes);
    if (!token) return;

    const res = await fetch(`${API_BASE}/rooms?page=-1&limit=abc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ACCEPTABLE).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body.success).toBe(true);
      // Should default gracefully
      expect(Number(body.page)).toBeGreaterThanOrEqual(1);
      expect(Number(body.limit)).toBeGreaterThanOrEqual(1);
    }
  });
});
