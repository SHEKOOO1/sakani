import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { assertProductionDbConfig, describeDbConfigRejection } from '../src/backend/config/db-config';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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

const config: any = {
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
