import knex from 'knex';

async function main() {
  const config = {
    client: 'mssql',
    connection: {
      server: '127.0.0.1',
      user: 'sa',
      password: '123',
      database: 'DormMaster',
      port: 1433,
      options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, connectTimeout: 10000 }
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
