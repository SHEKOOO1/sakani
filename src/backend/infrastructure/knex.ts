import knex from 'knex';
import mssql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { assertProductionDbConfig, describeDbConfigRejection } from '../config/db-config.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isProduction = process.env.NODE_ENV === 'production';

// P0-4: production FAILS CLOSED on missing/weak DB credentials or the `sa`
// account. This runs at module load — before any connection is opened — so a
// misconfigured production container never attempts a privileged connection.
if (isProduction) {
  const dbConfigCheck = assertProductionDbConfig(process.env);
  if (!dbConfigCheck.ok) {
    console.error(
      `❌ ERROR: database configuration ${describeDbConfigRejection(dbConfigCheck)}. ` +
        `Refusing to start in production without a dedicated, strong database account.`,
    );
    process.exit(1);
  }
}

// Optional trusted-CA bundle for SQL Server instances using a private or
// self-signed certificate. Supplying the CA keeps `trustServerCertificate` at
// false instead of disabling certificate validation.
function loadDbCa(): { ca: string } | undefined {
  const caPath = process.env.DB_SSL_CA_PATH;
  if (!caPath) return undefined;
  try {
    return { ca: fs.readFileSync(caPath, 'utf8') };
  } catch {
    console.error('❌ ERROR: DB_SSL_CA_PATH is set but the CA certificate could not be read. Refusing to start.');
    process.exit(1);
  }
}

const dbCa = loadDbCa();

// Production has NO fallbacks (invalid values were rejected above); development
// keeps the local SQL Express defaults so the local workflow is unchanged.
const dbServer = process.env.DB_HOST || (isProduction ? undefined : '127.0.0.1');
const dbUser = process.env.DB_USER || (isProduction ? undefined : 'sa');
const dbPassword = process.env.DB_PASSWORD;
const dbDatabase = process.env.DB_NAME || (isProduction ? undefined : 'DormMaster');
const dbPort = parseInt(process.env.DB_PORT || '1433', 10);
const dbInstance = process.env.DB_INSTANCE || undefined;

const sharedOptions = {
  encrypt: process.env.NODE_ENV === 'production',
  trustServerCertificate: process.env.NODE_ENV === 'production' ? false : true,
  enableArithAbort: true,
  connectTimeout: 30000,
  ...(dbCa ? { cryptoCredentialsDetails: dbCa } : {}),
} as any;

const config: knex.Knex.Config = {
  client: 'mssql',
  connection: {
    server: dbServer,
    user: dbUser,
    password: dbPassword,
    database: dbDatabase,
    port: dbPort,
    instanceName: dbInstance,
    options: sharedOptions
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
  // In production dbServer is guaranteed by the fail-closed guard above; in
  // development it defaults to 127.0.0.1.
  server: dbServer as string,
  port: dbPort,
  database: dbDatabase,
  user: dbUser,
  password: dbPassword,
  options: sharedOptions
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