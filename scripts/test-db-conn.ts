import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// No hardcoded credentials — sourced from the environment, fail closed.
if (!process.env.DB_PASSWORD) {
  console.error('DB_PASSWORD is not set. Configure it in .env or the environment.');
  process.exit(1);
}

const config: any = {
  client: 'mssql',
  connection: {
    server: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'DormMaster',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 10000
    }
  },
  pool: { min: 1, max: 1, acquireTimeoutMillis: 15000 }
};

console.log('Connecting...');
const kdb = knex(config);
try {
  const result = await kdb.raw('SELECT 1 as test');
  console.log('Connection OK:', JSON.stringify(result));
} catch (e: any) {
  console.log('Connection FAILED:', e.message);
  if (e.stack) console.log('Stack:', e.stack.substring(0, 500));
}
await kdb.destroy();
console.log('Done');
