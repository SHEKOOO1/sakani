import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  // No hardcoded credentials — sourced from the environment, fail closed.
  if (!process.env.DB_PASSWORD) {
    console.error('DB_PASSWORD is not set. Configure it in .env or the environment.');
    process.exit(1);
  }

  const config = {
    client: 'mssql',
    connection: {
      server: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'DormMaster',
      port: parseInt(process.env.DB_PORT || '1433', 10),
      options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, connectTimeout: 10000 }
    },
    pool: { min: 1, max: 1, acquireTimeoutMillis: 15000 }
  };
  
  const kdb = knex(config);
  
  try {
    console.log('Testing DB connection...');
    const r = await kdb.raw('SELECT 1 as ok');
    console.log('SELECT 1:', JSON.stringify(r[0]));
    
    const tenants = await kdb('tenants').select('id', 'name');
    console.log('Tenants:', JSON.stringify(tenants));
    
    const users = await kdb('users').select('id', 'email', 'role', 'name');
    console.log('Users:', JSON.stringify(users));
    
    await kdb.destroy();
    console.log('ALL OK');
  } catch (e: any) {
    console.log('ERROR:', e.message);
    console.log(e.stack?.substring(0, 1000));
    await kdb.destroy();
  }
}

main();
