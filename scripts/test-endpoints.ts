import jwt from 'jsonwebtoken';

const SECRET = 'sakani-secret-key-change-in-production-2024';
const BASE = 'http://localhost:3000';

// Create a test admin token
const adminToken = jwt.sign(
  { id: 'test-admin-id', tenantId: null, role: 'admin', email: 'admin@sakani.com', gender: 'male' },
  SECRET,
  { expiresIn: '1h' }
);

// Create a test bishop token (with tenantIds in custom claim - real middleware may not have this)
const bishopToken = jwt.sign(
  { id: 'test-bishop-id', tenantId: null, role: 'bishop', email: 'bishop@test.com', gender: 'male' },
  SECRET,
  { expiresIn: '1h' }
);

async function test(label: string, url: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  try {
    const resp = await fetch(url, { headers });
    const text = await resp.text();
    console.log(`[${resp.status}] ${label}`);
    // Show first 300 chars
    console.log('  ', text.substring(0, 300));
    console.log('');
    return { status: resp.status, ok: resp.ok, body: text };
  } catch (e: any) {
    console.log(`[ERR] ${label}: ${e.message}\n`);
    return { status: 0, ok: false, body: e.message };
  }
}

async function testPost(label: string, url: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  try {
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await resp.text();
    console.log(`[${resp.status}] ${label}`);
    console.log('  ', text.substring(0, 300));
    console.log('');
    return { status: resp.status, ok: resp.ok, body: text };
  } catch (e: any) {
    console.log(`[ERR] ${label}: ${e.message}\n`);
    return { status: 0, ok: false, body: e.message };
  }
}

async function main() {
  console.log('=== TESTING ADMIN ENDPOINTS ===\n');

  // 1. My Tenants (admin)
  await test('GET /api/admin/my-tenants (admin)', `${BASE}/api/admin/my-tenants`, adminToken);

  // 2. Roles list (admin)
  await test('GET /api/admin/roles (admin)', `${BASE}/api/admin/roles`, adminToken);

  // 3. Tenants list (admin)
  await test('GET /api/admin/tenants (admin)', `${BASE}/api/admin/tenants`, adminToken);

  // 4. Create a custom role
  const createRoleRes = await testPost('POST /api/admin/roles (admin)', `${BASE}/api/admin/roles`, {
    name: 'مشرف طلاب تجريبي',
    permissions: ['VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'VIEW_FINANCE']
  }, adminToken);

  // 5. If created, get the role ID and try update
  let roleId: string | null = null;
  try {
    const parsed = JSON.parse(createRoleRes.body);
    if (parsed.success && parsed.data?.id) {
      roleId = parsed.data.id;
      console.log(`  -> Created role ID: ${roleId}`);
      
      // Update it
      await testPost(`PUT /api/admin/roles/${roleId}`, `${BASE}/api/admin/roles/${roleId}`, {
        name: 'مشرف طلاب معدل',
        permissions: ['VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT', 'VIEW_FINANCE']
      }, adminToken);
      
      // Delete it
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };
      const delResp = await fetch(`${BASE}/api/admin/roles/${roleId}`, { method: 'DELETE', headers });
      const delText = await delResp.text();
      console.log(`[${delResp.status}] DELETE /api/admin/roles/${roleId}`);
      console.log('  ', delText.substring(0, 200));
    } else {
      console.log('  -> Create failed or unexpected response');
    }
  } catch (e) {
    console.log('  -> Error parsing create response');
  }

  console.log('\n=== TESTING REPORTS ENDPOINTS ===\n');

  // 6. Global stats (admin)
  await test('GET /api/reports/global-stats (admin)', `${BASE}/api/reports/global-stats`, adminToken);

  // 7. Finance summary (admin)
  await test('GET /api/reports/finance-summary (admin)', `${BASE}/api/reports/finance-summary`, adminToken);

  console.log('\n=== TESTING BISHOP ENDPOINTS ===\n');

  // 8. My tenants (bishop)
  await test('GET /api/admin/my-tenants (bishop)', `${BASE}/api/admin/my-tenants`, bishopToken);

  // 9. Roles (bishop)
  await test('GET /api/admin/roles (bishop)', `${BASE}/api/admin/roles`, bishopToken);

  console.log('\n=== DONE ===');
}

main();
