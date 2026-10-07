import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from './src/backend/infrastructure/db.js';

try {
  let tenantId = 'system-tenant';
  let s: any = undefined;
  const cleanSup = s && s.trim() !== '' ? s.trim() : null;
  // cleanSup is undefined
  
  db.prepare(`
    INSERT INTO apartments (id, tenant_id, name, building, supervisor_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), tenantId, "test", "test", cleanSup, 1);
  console.log("Success!");
} catch (e: any) {
  console.log("Error:", e.name, e.message);
}
