import knex from 'knex';
import config from '../knexfile';

async function main() {
  const kdb = knex((config as any).default || config.development);
  try {
    const count = await kdb('users').count('id as cnt').first();
    console.log('COUNT:', JSON.stringify(count));
    const users = await kdb('users').select('id', 'email', 'role', 'name');
    console.log('USERS:', JSON.stringify(users));
  } catch (e: any) {
    console.log('ERR:', e.message);
  }
  await kdb.destroy();
}

main();
