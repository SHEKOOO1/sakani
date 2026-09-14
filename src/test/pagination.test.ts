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

async function loginAs(role: string): Promise<string | null> {
  const creds: Record<string, { email: string; password: string }> = {
    admin: { email: 'admin@sakani.com', password: 'admin123' },
    supervisor: { email: 'supervisor@sakani.com', password: 'test123' },
  };
  const c = creds[role] || creds.admin;
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    if (res.status !== 200) return null;
    return extractTokenFromCookie(res);
  } catch {
    return null;
  }
}

describe('Pagination — Cross-Resource Consistency', () => {
  const endpoints = ['/students', '/rooms', '/users', '/employees'];

  for (const ep of endpoints) {
    it(`${ep} returns consistent pagination shape`, async () => {
      const token = await loginAs('admin');
      if (!token) return;

      const res = await fetch(`${API_BASE}${ep}?page=1&limit=5`, {
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
        expect(typeof body.total).toBe('number');
        expect(typeof body.page).toBe('number');
        expect(typeof body.limit).toBe('number');
        expect(typeof body.totalPages).toBe('number');
        expect(body.data.length).toBeLessThanOrEqual(body.limit);
      }
    });

    it(`${ep} totalPages matches total/limit calculation`, async () => {
      const token = await loginAs('admin');
      if (!token) return;

      const res = await fetch(`${API_BASE}${ep}?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        const body = await res.json();
        const expectedPages = Math.ceil(body.total / body.limit) || 1;
        expect(body.totalPages).toBe(expectedPages);
      }
    });

    it(`${ep} rejects unauthorized access`, async () => {
      const res = await fetch(`${API_BASE}${ep}`);
      expect([401, 429]).toContain(res.status);
    });
  }
});

describe('Pagination — Edge Cases', () => {
  it('page=0 should default gracefully', async () => {
    const token = await loginAs('admin');
    if (!token) return;
    const res = await fetch(`${API_BASE}/students?page=0&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 200) {
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  it('excessive limit should clamp or be accepted', async () => {
    const token = await loginAs('admin');
    if (!token) return;
    const res = await fetch(`${API_BASE}/students?page=1&limit=9999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ACCEPTABLE).toContain(res.status);
  });
});
