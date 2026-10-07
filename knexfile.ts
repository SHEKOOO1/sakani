import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { Knex } from 'knex';

// package.json sets "type": "module", so __dirname does not exist in this file —
// referencing it threw "ReferenceError: __dirname is not defined in ES module scope"
// and made every `npm run migrate*` command fail. Derive it from import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env') });

// P1-DB-4: honor the same trusted-CA bundle as the runtime connection so the
// migration CLI can talk to a SQL Server with a private/self-signed certificate
// WITHOUT setting trustServerCertificate=true. Fail closed if it is unreadable.
let productionCa: { ca: string } | undefined;
if (process.env.DB_SSL_CA_PATH) {
  try {
    productionCa = { ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8') };
  } catch {
    throw new Error('DB_SSL_CA_PATH is set but the CA certificate could not be read.');
  }
}

// Mirrors the runtime pool in src/backend/infrastructure/knex.ts so the migration
// CLI and the server agree on TLS behavior. DB_TRUST_SERVER_CERT=true is the
// explicit opt-out for instances carrying only SQL Server's auto-generated
// self-signed certificate.
const trustServerCertificate =
  process.env.DB_TRUST_SERVER_CERT === 'true'
    ? true
    : process.env.NODE_ENV === 'production'
      ? false
      : true;

const config: Record<string, Knex.Config> = {
  development: {
    client: 'mssql',
    connection: {
      server: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'DormMaster',
      port: parseInt(process.env.DB_PORT || '1433', 10),
      instanceName: process.env.DB_INSTANCE || undefined,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
      } as any,
    },
    pool: { min: 1, max: 10, acquireTimeoutMillis: 60000 },
    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
      extension: 'ts',
    },
  },
  production: {
    client: 'mssql',
    connection: {
      server: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '1433', 10),
      instanceName: process.env.DB_INSTANCE || undefined,
      options: {
        encrypt: true,
        trustServerCertificate,
        enableArithAbort: true,
        connectTimeout: 30000,
        ...(productionCa ? { cryptoCredentialsDetails: productionCa } : {}),
      } as any,
    },
    pool: { min: 1, max: 10, acquireTimeoutMillis: 60000 },
    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
      extension: 'ts',
    },
  },
};

export default config;
