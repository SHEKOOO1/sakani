import { kdb } from '../src/backend/infrastructure/knex';
import { initializeDb } from '../src/backend/infrastructure/db';

async function testConnection() {
  try {
    console.log('🔌 Testing SQL Server connection...');
    
    // Test basic connection
    const connection = await kdb.raw('SELECT 1');
    console.log('✅ Connection successful!');

    // Initialize database (create tables)
    console.log('📋 Initializing database schema...');
    await initializeDb();
    console.log('✅ Database schema initialized!');

    // List all tables
    console.log('\n📊 Checking tables in DormMaster database:');
    const tables = await kdb.raw(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log('\nTables found:');
    tables.recordset.forEach((t: any, index: number) => {
      console.log(`  ${index + 1}. ${t.TABLE_NAME}`);
    });

    // Check table structure for key tables
    const keyTables = ['users', 'students', 'rooms', 'apartments', 'tenants'];
    
    console.log('\n📐 Checking table structures:');
    for (const tableName of keyTables) {
      const columns = await kdb.raw(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [tableName]);

      if (columns.recordset.length > 0) {
        console.log(`\n✅ Table: ${tableName}`);
        console.log('   Columns:');
        columns.recordset.forEach((col: any) => {
          const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
          console.log(`     - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${nullable})`);
        });
      } else {
        console.log(`\n❌ Table: ${tableName} - NOT FOUND`);
      }
    }

    console.log('\n✅ All tests completed successfully!');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testConnection();
