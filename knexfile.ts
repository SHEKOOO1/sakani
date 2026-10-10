import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Knex } from 'knex';
import { readCaCertificate } from './src/backend/config/db-ca';

// package.json sets "type": "module", so __dirname does not exist in this file —
// referencing it threw "ReferenceError: __dirname is not defined in ES module scope"
// and made every `npm run migrate*` command fail. Derive it from import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env') });

// P1-DB-4: honor the same trusted-CA bundle as the runtime connection so the
// migration CLI can talk to a SQL Server with a private/self-signed certificate
// WITHOUT setting trustServerCertificate=true. The helper FAILS CLOSED if the
// bundle is missing, unreadable, or not a valid PEM certificate.
const productionCa = readCaCertificate(process.env.DB_SSL_CA_PATH);

// Mirrors the runtime pool in src/backend/infrastructure/knex.ts so the migration
// CLI and the server agree on TLS behavior. Production always validates the SQL
// Server certificate (encrypt: true, trustServerCertificate: false) with no
// escape hatch; provide DB_SSL_CA_PATH for private/self-signed certificates.
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
        ...(productionCa ? { cryptoCredentialsDetails: { ca: productionCa.ca }, ...(productionCa.serverName ? { serverName: productionCa.serverName } : {}) } : {}),
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
