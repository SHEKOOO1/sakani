import knex from 'knex';

const config: any = {
  client: 'mssql',
  connection: {
    server: '127.0.0.1',
    user: 'sa',
    password: '123',
    database: 'DormMaster',
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 10000
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
