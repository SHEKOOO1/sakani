import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (process.env.DB_CLIENT !== 'mssql') {
  console.error('Reset script only supports MSSQL mode. Set DB_CLIENT=mssql and reset the DormMaster database using SQL Server tools.');
  process.exit(1);
}

console.log('Reset script is disabled for MSSQL-only configuration.');
console.log('Use SQL Server Management Studio or a database reset script against localhost\\SQLEXPRESS and DormMaster.');
process.exit(0);
