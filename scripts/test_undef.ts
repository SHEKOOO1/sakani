import db from './src/backend/infrastructure/db.js';

let tenants = db.prepare('SELECT id FROM tenants LIMIT 1').get() as any;
let tenantId = tenants ? tenants.id : null;
console.log("Using Tenant ID:", tenantId);
db.prepare(`
  INSERT INTO apartments (id, tenant_id, name, building, supervisor_id, is_active) 
  VALUES (?, ?, ?, ?, ?, ?)
`).run('test-id-124', tenantId, 'test', 'test', undefined, 1);
