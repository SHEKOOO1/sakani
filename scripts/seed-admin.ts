import knex from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../knexfile';

async function main() {
  const kdb = knex((config as any).default || config.development);
  try {
    const countRow = await kdb('users').count('id as cnt').first();
    const count = Number(countRow?.cnt || 0);
    console.log('Current user count:', count);

    // Check if admin already exists
    const existing = await kdb('users').where({ email: 'admin@sakani.com' }).first();
    if (existing) {
      console.log('Admin exists, email:', existing.email, 'role:', existing.role);
      // Update password
      const hashed = await bcrypt.hash('admin123', 10);
      await kdb('users').where({ id: existing.id }).update({ password: hashed });
      console.log('Password reset to admin123');
    } else {
      // Create admin
      const hashed = await bcrypt.hash('admin123', 10);
      await kdb('users').insert({
        id: uuidv4(),
        tenant_id: null,
        email: 'admin@sakani.com',
        password: hashed,
        role: 'admin',
        name: 'مدير النظام',
        gender: 'male',
        daily_readings_enabled: 1,
        radio_514_enabled: 1,
      });
      console.log('Admin user created: admin@sakani.com / admin123');
    }
  } catch (e: any) {
    console.log('ERR:', e.message);
    console.log('STACK:', e.stack?.substring(0, 500));
  }
  await kdb.destroy();
}

main();
