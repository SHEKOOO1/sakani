import { kdb } from '../src/backend/infrastructure/knex';
import fs from 'fs';
import path from 'path';

async function initializeMSSQL() {
  try {
    console.log('🔌 Connecting to SQL Server...');
    
    // Create database if it doesn't exist
    console.log('📦 Creating DormMaster database if not exists...');
    try {
      await kdb.raw(`
        IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'DormMaster')
        BEGIN
          CREATE DATABASE DormMaster;
        END
      `);
      console.log('✅ Database created or already exists');
    } catch (e: any) {
      console.log('Note:', e.message);
    }

    // Switch to DormMaster database
    console.log('🔄 Switching to DormMaster database...');
    await kdb.raw('USE DormMaster');

    // Read and execute the schema file
    console.log('📋 Reading schema file...');
    const schemaPath = path.resolve('./schema_mssql.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('🛠️  Creating tables...');
    // Split the schema into individual statements and execute them
    const statements = schemaSql.split('GO').filter(s => s.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        try {
          await kdb.raw(stmt);
          console.log(`  ✓ Statement ${i + 1} executed`);
        } catch (e: any) {
          console.warn(`  ⚠ Statement ${i + 1} error (may be expected):`, e.message.substring(0, 100));
        }
      }
    }

    console.log('\n✅ Schema creation completed!');

    // List all tables
    console.log('\n📊 Tables in DormMaster database:');
    const tables = await kdb.raw(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    if (tables.recordset && tables.recordset.length > 0) {
      tables.recordset.forEach((t: any, index: number) => {
        console.log(`  ${index + 1}. ✅ ${t.TABLE_NAME}`);
      });
      console.log(`\n✅ Total tables: ${tables.recordset.length}`);
    } else {
      console.log('❌ No tables found');
    }

    // Check key tables structure
    console.log('\n📐 Verifying key tables:');
    const keyTables = ['users', 'students', 'rooms', 'apartments', 'tenants'];
    
    for (const tableName of keyTables) {
      const columns = await kdb.raw(`
        SELECT COUNT(*) as col_count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
      `, [tableName]);

      const count = columns.recordset[0].col_count;
      if (count > 0) {
        console.log(`  ✅ ${tableName}: ${count} columns`);
      } else {
        console.log(`  ❌ ${tableName}: NOT FOUND`);
      }
    }

    console.log('\n✅ DormMaster database is ready!');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Initialization Error:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

initializeMSSQL();
