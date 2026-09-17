import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { assertProductionDbConfig, describeDbConfigRejection } from '../src/backend/config/db-config';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';

  // P1-SCR-1: never bypass production DB hardening. Fail closed on missing/weak
  // credentials or the `sa` account before opening any connection.
  const dbConfigCheck = assertProductionDbConfig(process.env);
  if (!dbConfigCheck.ok) {
    console.error(`DB configuration ${describeDbConfigRejection(dbConfigCheck)}. Refusing to run.`);
    process.exit(1);
  }

  // No hardcoded credentials — sourced from the environment, fail closed.
  if (!process.env.DB_PASSWORD) {
    console.error('DB_PASSWORD is not set. Configure it in .env or the environment.');
    process.exit(1);
  }

  // Honor DB_SSL_CA_PATH; never disable certificate validation in production.
  let ca: { ca: string } | undefined;
  if (process.env.DB_SSL_CA_PATH) {
    try {
      ca = { ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8') };
    } catch {
      console.error('DB_SSL_CA_PATH is set but the CA certificate could not be read. Refusing to run.');
      process.exit(1);
    }
  }

  const config = {
    client: 'mssql',
    connection: {
      server: process.env.DB_HOST || (isProduction ? undefined : '127.0.0.1'),
      user: process.env.DB_USER || (isProduction ? undefined : 'sa'),
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || (isProduction ? undefined : 'DormMaster'),
      port: parseInt(process.env.DB_PORT || '1433', 10),
      options: {
        encrypt: isProduction,
        trustServerCertificate: !isProduction,
        enableArithAbort: true,
        connectTimeout: 10000,
        ...(ca ? { cryptoCredentialsDetails: ca } : {}),
      }
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
