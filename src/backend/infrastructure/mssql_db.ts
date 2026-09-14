// Re-exported from knex.ts to eliminate duplicate connection pool.
// Old code used to create a separate mssql.ConnectionPool here.
// All consumers now import from knex.ts directly.
export { poolPromise } from './knex.ts';
