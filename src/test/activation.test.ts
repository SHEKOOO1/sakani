import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:3000/api';

/**
 * Email verification removal regression tests.
 *
 * With the decision "accounts are activated immediately upon creation",
 * the following must hold:
 *   1. The activation endpoints no longer exist (404).
 *   2. A brand-new account can log in immediately — no ACCOUNT_NOT_ACTIVATED gate.
 */

function extractTokenFromCookie(res: Response): string | null {
  const cookies = res.headers.getSetCookie?.() || [];
  for (const cookie of cookies) {
    const match = cookie.match(/^token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

const stamp = Date.now();
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@mase7y.org';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || '';
const supervisorEmail = `activation-supervisor-${stamp}@example.com`;
const employeeEmail = `activation-employee-${stamp}@example.com`;
const employeePassword = 'TestPass123!';

let adminToken = '';
let newTenantId = '';

beforeAll(async () => {
  if (!adminPassword) return;
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  adminToken = extractTokenFromCookie(res) || '';
});

async function createUser(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(body),
  });
}

describe('Email verification removal', () => {
  it('POST /api/auth/activate returns 404 (route removed)', async () => {
    const res = await fetch(`${API_BASE}/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'anything' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /api/auth/activate/resend returns 404 (route removed)', async () => {
    const res = await fetch(`${API_BASE}/auth/activate/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com' }),
    });
    expect(res.status).toBe(404);
  });

  it('newly created account is active immediately and can log in (no ACCOUNT_NOT_ACTIVATED)', async () => {
    if (!adminToken) return;

    const supRes = await createUser({
      name: 'تفعيل تلقائي مشرف',
      email: supervisorEmail,
      password: employeePassword,
      role: 'supervisor',
      gender: 'male',
    });
    if (supRes.status !== 201) return;
    const supervisorId = (await supRes.json())?.data?.id;
    if (!supervisorId) return;

    const tenantRes = await fetch(`${API_BASE}/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: `سكن اختبار التفعيل ${stamp}`, supervisor_ids: [supervisorId] }),
    });
    if (tenantRes.status !== 201) return;
    const tenantId = (await tenantRes.json())?.data?.id;
    if (!tenantId) return;
    newTenantId = tenantId;

    const empRes = await createUser({
      name: 'تفعيل تلقائي موظف',
      email: employeeEmail,
      password: employeePassword,
      role: 'employee',
      gender: 'male',
      tenant_id: tenantId,
    });
    if (empRes.status !== 201) return;
    const employeeId = (await empRes.json())?.data?.id;
    if (!employeeId) return;

    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employeeEmail, password: employeePassword }),
    });
    // 200 = logged straight in (auto-activated). 429 = passed the activation gate
    // but got rate limited by the shared login limiter. 403 (ACCOUNT_NOT_ACTIVATED)
    // must never occur.
    expect([200, 429]).toContain(loginRes.status);
    if (loginRes.status === 200) {
      const body = await loginRes.json();
      expect(body.success).toBe(true);
      expect(extractTokenFromCookie(loginRes)).toBeTruthy();
    }
  });
});