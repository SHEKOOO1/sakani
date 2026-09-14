import knex from 'knex';
import mssql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config: knex.Knex.Config = {
  client: 'mssql',
  connection: {
    server: process.env.DB_HOST || '127.0.0.1', 
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'DormMaster',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    instanceName: process.env.DB_INSTANCE || undefined,
    options: {
      encrypt: process.env.NODE_ENV === 'production',
      trustServerCertificate: process.env.NODE_ENV === 'production' ? false : true,
      enableArithAbort: true,
      connectTimeout: 30000
    } as any
  } as any,
  pool: { min: 1, max: 10, acquireTimeoutMillis: 60000 }
};

if (process.env.NODE_ENV !== 'production') {
  console.log('🚀 Direct Connection Attempt:', { database: (config.connection as any).database });
}

export const kdb = knex(config);

// Shared raw mssql pool for code that needs native mssql queries (e.g. transactions).
// Uses the same connection config as knex to avoid duplicate connection pools.
const connConfig: mssql.config = {
  server: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'DormMaster',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.NODE_ENV === 'production',
    trustServerCertificate: process.env.NODE_ENV === 'production' ? false : true,
    enableArithAbort: true
  }
};

export const poolPromise = new mssql.ConnectionPool(connConfig)
  .connect()
  .then(pool => {
    console.log('✅ Raw MSSQL pool connected');
    return pool;
  })
  .catch(err => console.error('❌ Raw MSSQL pool connection failed:', err));

export function getDBClient(): string {
  return (config.client as string) || 'mssql';
}

export function dateFormatColumn(column: string, format: string = 'yyyy-MM'): string {
  return `FORMAT(${column}, '${format}')`;
}