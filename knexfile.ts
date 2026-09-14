import dotenv from 'dotenv';
import path from 'path';
import type { Knex } from 'knex';

dotenv.config({ path: path.resolve(__dirname, '.env') });

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
