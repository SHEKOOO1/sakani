const BASE = 'http://localhost:3000';

async function test(label: string, method: string, url: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts: any = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const resp = await fetch(`${BASE}${url}`, opts);
    const text = await resp.text();
    let summary = text.substring(0, 250);
    // prettify if json
    try { summary = JSON.stringify(JSON.parse(summary), null, 2).substring(0, 300); } catch {}
    console.log(`[${resp.status}] ${method} ${url}`);
    console.log(`  ${summary}`);
    return { status: resp.status, ok: resp.ok, body: text };
  } catch (e: any) {
    console.log(`[ERR] ${method} ${url}: ${e.message}`);
    return { status: 0, ok: false, body: '' };
  }
}

async function main() {
  // Login admin
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'shoukry@dorm.App', password: '123456' })
  });
  const loginData = await loginRes.json();
  const adminToken = loginData.data.token;
  console.log('Admin token obtained\n');

  // Login bishop
  const bishopLogin = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bemwa@drom.app', password: '123456' })
  });
  const bishopData = await bishopLogin.json();
  const bishopToken = bishopData.data.token;
  console.log('Bishop token obtained\n');

  // ========== ADMIN ENDPOINTS ==========
  console.log('=== ADMIN ENDPOINTS ===');
  
  await test('My Tenants', 'GET', '/api/admin/my-tenants', undefined, adminToken);
  await test('Tenants List', 'GET', '/api/admin/tenants', undefined, adminToken);
  await test('Roles List', 'GET', '/api/admin/roles', undefined, adminToken);
  await test('Bishops List', 'GET', '/api/admin/bishops', undefined, adminToken);
  await test('All Staff', 'GET', '/api/admin/all-staff', undefined, adminToken);
  
  // Create a role
  const roleRes = await test('Create Role', 'POST', '/api/admin/roles', {
    name: 'مشرف طلاب',
    permissions: ['VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'VIEW_FINANCE', 'VIEW_FINANCE_REPORTS']
  }, adminToken);
  
  // Extract role ID and test update/delete
  let roleId: string | null = null;
  try {
    const parsed = JSON.parse(roleRes.body);
    if (parsed.success && parsed.data?.id) {
      roleId = parsed.data.id;
      console.log(`  -> Created role ID: ${roleId}`);
      await test('Update Role', 'PUT', `/api/admin/roles/${roleId}`, {
        name: 'مشرف طلاب ممتاز',
        permissions: ['VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT', 'VIEW_FINANCE', 'VIEW_FINANCE_REPORTS', 'ADD_REVENUE']
      }, adminToken);
      await test('Delete Role', 'DELETE', `/api/admin/roles/${roleId}`, undefined, adminToken);
    }
  } catch (e) {
    console.log('  -> Role CRUD: parse error');
  }

  // ========== REPORTS ENDPOINTS ==========
  console.log('\n=== REPORTS ENDPOINTS (ADMIN) ===');
  
  await test('Global Stats', 'GET', '/api/reports/global-stats', undefined, adminToken);
  await test('Finance Summary', 'GET', '/api/reports/finance-summary', undefined, adminToken);
  
  // Global stats with tenant_ids
  await test('Global Stats (tenant_ids)', 'GET', '/api/reports/global-stats?tenant_ids=20f7556f-dd45-4384-9494-04962728e98e', undefined, adminToken);
  
  // Finance with tenant_ids
  await test('Finance Summary (tenant_ids)', 'GET', '/api/reports/finance-summary?tenant_ids=20f7556f-dd45-4384-9494-04962728e98e', undefined, adminToken);

  // ========== BISHOP ENDPOINTS ==========
  console.log('\n=== BISHOP ENDPOINTS ===');
  
  await test('My Tenants (bishop)', 'GET', '/api/admin/my-tenants', undefined, bishopToken);
  await test('Tenants List (bishop)', 'GET', '/api/admin/tenants', undefined, bishopToken);
  await test('Roles List (bishop)', 'GET', '/api/admin/roles', undefined, bishopToken);
  await test('All Staff (bishop)', 'GET', '/api/admin/all-staff', undefined, bishopToken);
  
  // Bishop creates a role
  const bishopRoleRes = await test('Create Role (bishop)', 'POST', '/api/admin/roles', {
    name: 'دور تجريبي للأسقف',
    permissions: ['VIEW_STUDENT', 'ADD_STUDENT']
  }, bishopToken);
  
  try {
    const parsed = JSON.parse(bishopRoleRes.body);
    if (parsed.success && parsed.data?.id) {
      roleId = parsed.data.id;
      console.log(`  -> Bishop created role ID: ${roleId}`);
      await test('Delete Role (bishop)', 'DELETE', `/api/admin/roles/${roleId}`, undefined, bishopToken);
    }
  } catch (e) {
    console.log('  -> Bishop role CRUD: parse error');
  }

  // ========== REPORTS (BISHOP) ==========
  console.log('\n=== REPORTS ENDPOINTS (BISHOP) ===');
  
  await test('Global Stats (bishop)', 'GET', '/api/reports/global-stats', undefined, bishopToken);
  await test('Finance Summary (bishop)', 'GET', '/api/reports/finance-summary', undefined, bishopToken);
  
  // ========== EMPLOYEES ==========
  console.log('\n=== EMPLOYEES ENDPOINTS ===');
  
  await test('Employees List (admin)', 'GET', '/api/employees', undefined, adminToken);
  await test('Employees List (bishop)', 'GET', '/api/employees', undefined, bishopToken);

  // ========== DOCUMENTS STATS ==========
  console.log('\n=== DOCUMENTS STATS ===');
  await test('Documents Stats (admin)', 'GET', '/api/admin/stats/documents', undefined, adminToken);
  await test('Documents Stats (bishop)', 'GET', '/api/admin/stats/documents', undefined, bishopToken);
  
  console.log('\n=== ALL TESTS DONE ===');
}

main();
