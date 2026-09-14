import { kdb } from '../src/backend/infrastructure/knex';

async function verifyConnection() {
  try {
    console.log('🔌 Testing application connection to SQL Server...\n');
    
    // Test basic connection
    const serverVersion = await kdb.raw('SELECT @@VERSION as version');
    console.log('✅ SQL Server Connection: SUCCESS');
    console.log(`   Version: ${serverVersion.recordset[0].version.substring(0, 50)}...\n`);

    // Count tables
    const tables = await kdb.raw(`
        SELECT COUNT(*) as table_count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' 
        AND TABLE_NAME IN (
            'users', 'tenants', 'apartments', 'rooms', 'students', 
            'student_guardians', 'student_archive', 'attendance',
            'student_points', 'student_rewards', 'student_warnings',
            'competitions', 'events', 'finances', 'complaints',
            'parents', 'student_delays', 'StudentDocuments', 'StudentPhones',
            'user_tenant_assignments', 'notifications', 'profile_shares',
            'rewards_definitions', 'tenant_custom_roles', 'item_managers', 'maintenance'
        )
    `);
    
    const tableCount = tables.recordset[0].table_count;
    console.log(`✅ Database Tables: ${tableCount} tables found\n`);

    // Verify key tables
    const keyTables = [
      'users', 'tenants', 'apartments', 'rooms', 'students', 
      'student_guardians', 'student_archive', 'attendance',
      'student_points', 'student_rewards', 'student_warnings',
      'competitions', 'events', 'finances', 'complaints',
      'parents', 'student_delays', 'StudentDocuments', 'StudentPhones',
      'user_tenant_assignments', 'notifications', 'profile_shares',
      'rewards_definitions', 'tenant_custom_roles', 'item_managers', 'maintenance'
    ];

    console.log('📋 Checking key tables:\n');
    let allTablesExist = true;
    
    for (const tableName of keyTables) {
      const result = await kdb.raw(`
        SELECT COUNT(*) as col_count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
      `, [tableName]);

      const columnCount = result.recordset[0].col_count;
      if (columnCount > 0) {
        console.log(`   ✅ ${tableName.padEnd(30)} - ${columnCount} columns`);
      } else {
        console.log(`   ❌ ${tableName.padEnd(30)} - NOT FOUND`);
        allTablesExist = false;
      }
    }

    console.log('\n');

    // Check for specific columns in students table (the one that had issues)
    console.log('🔍 Verifying students table structure:\n');
    const studentColumns = await kdb.raw(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'students'
      ORDER BY ORDINAL_POSITION
    `);

    const criticalColumns = ['id', 'tenant_id', 'user_id', 'room_id', 'student_id_number', 'status', 'created_at'];
    studentColumns.recordset.forEach((col: any) => {
      if (criticalColumns.includes(col.COLUMN_NAME)) {
        console.log(`   ✅ ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
      }
    });

    // Make sure student_real_name is NOT in students table
    const hasRealNameColumn = studentColumns.recordset.some((col: any) => col.COLUMN_NAME === 'student_real_name');
    if (!hasRealNameColumn) {
      console.log(`   ✅ student_real_name: NOT IN TABLE (correct - it\'s only an alias)\n`);
    } else {
      console.log(`   ❌ student_real_name: FOUND (this would cause SQL errors)\n`);
    }

    if (allTablesExist) {
      console.log('🎉 SUCCESS: DormMaster database is properly configured!');
      console.log('   ✅ All tables created successfully');
      console.log('   ✅ All key tables verified');
      console.log('   ✅ Ready for application use\n');
    } else {
      console.log('⚠️  WARNING: Some tables are missing!');
    }

    process.exit(0);

  } catch (error: any) {
    console.error('❌ Connection Error:');
    console.error('Message:', error.message);
    console.error('\nMake sure:');
    console.error('  1. SQL Server is running (service: MSSQL$SQLEXPRESS)');
    console.error('  2. .env file has correct credentials');
    console.error('  3. DormMaster database exists');
    console.error('  4. schema_mssql.sql has been executed');
    process.exit(1);
  }
}

verifyConnection();
