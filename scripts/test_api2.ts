import { v4 as uuidv4 } from 'uuid';
import db from './src/backend/infrastructure/db.js';

// db.js already has `db.pragma("foreign_keys = ON");` but let's be sure
db.pragma("foreign_keys = ON");

let tenantId = 'system-tenant';
let req = {
    body: {
        name: "test",
        building: "test",
        supervisor_id: undefined,
        is_active: true
    }
};

const id = uuidv4();
const { name, building, supervisor_id, is_active } = req.body;
try {
  const cleanSupervisorId = supervisor_id && typeof supervisor_id === 'string' && supervisor_id.trim() !== '' ? supervisor_id.trim() : null;
  db.prepare(`
    INSERT INTO apartments (id, tenant_id, name, building, supervisor_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, tenantId, name, building || null, cleanSupervisorId, is_active ? 1 : 0);
  console.log("Success with undefined!");
} catch (e: any) {
  console.log("Error with undefined:", e.message);
}

req.body.supervisor_id = "" as any;
const id2 = uuidv4();
try {
  const { name, building, supervisor_id, is_active } = req.body;
  const cleanSupervisorId = supervisor_id && typeof supervisor_id === 'string' && supervisor_id.trim() !== '' ? supervisor_id.trim() : null;
  db.prepare(`
    INSERT INTO apartments (id, tenant_id, name, building, supervisor_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id2, tenantId, name, building || null, cleanSupervisorId, is_active ? 1 : 0);
  console.log("Success with empty string!");
} catch (e: any) {
  console.log("Error with empty string:", e.message);
}

req.body.supervisor_id = "test-sup" as any;
const id3 = uuidv4();
try {
  const { name, building, supervisor_id, is_active } = req.body;
  const cleanSupervisorId = supervisor_id && typeof supervisor_id === 'string' && supervisor_id.trim() !== '' ? supervisor_id.trim() : null;
  db.prepare(`
    INSERT INTO apartments (id, tenant_id, name, building, supervisor_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id3, tenantId, name, building || null, cleanSupervisorId, is_active ? 1 : 0);
  console.log("Success with 'test-sup'!");
} catch (e: any) {
  console.log("Error with test-sup:", e.message);
}
