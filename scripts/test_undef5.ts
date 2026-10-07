import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from './src/backend/infrastructure/db.js';

try {
  let tenantId = 'fake-tenant-id';
  
  db.prepare(`
    INSERT INTO apartments (id, tenant_id, name, building, supervisor_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), tenantId, "test", "test", null, 1);
  console.log("Success!");
} catch (e: any) {
  console.log("Error:", e.name, e.message);
}
