import knex from 'knex';
import bcrypt from 'bcryptjs';

const kdb = knex({
  client: 'mssql',
  connection: { server: '127.0.0.1', user: 'sa', password: '123', database: 'DormMaster', port: 1433,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, connectTimeout: 10000 }
  },
  pool: { min: 1, max: 1 }
});

try {
  const hash = await bcrypt.hash('123456', 10);
  await kdb('users').update({ password: hash });
  console.log('All users password set to 123456');
} catch (e: any) {
  console.log('ERR: ' + e.message);
}
await kdb.destroy();
console.log('DONE');
