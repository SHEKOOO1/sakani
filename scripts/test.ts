import db from './src/backend/infrastructure/db.js';

try {
  db.prepare(`
    INSERT INTO apartments (id, tenant_id, name, building, supervisor_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('test-id-123', 'fake-tenant', 'test', 'test', null, 1);
} catch (e: any) {
  console.log("Error:", e.message);
}

try {
  let tenants = db.prepare('SELECT id FROM tenants LIMIT 1').get();
  let tenantId = tenants ? tenants.id : null;
  console.log("Using Tenant ID:", tenantId);
  db.prepare(`
    INSERT INTO apartments (id, tenant_id, name, building, supervisor_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('test-id-124', tenantId, 'test', 'test', undefined, 1);
} catch (e: any) {
  console.log("Error 2:", e.message);
}
