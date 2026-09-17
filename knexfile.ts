import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import type { Knex } from 'knex';

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
        trustServerCertificate: false,
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
