import { kdb } from "../src/backend/infrastructure/knex";
async function main() {
  // All users
  const users = await kdb('users').select('id', 'name', 'role', 'email');
  console.log('=== ALL USERS ===');
  users.forEach((u:any) => console.log(`  ${u.name} | role=${u.role} | email=${u.email} | id=${u.id}`));

  // Check if there's a separate permissions table
  const tables = await kdb.raw("SELECT name FROM sys.tables WHERE name LIKE '%permission%' OR name LIKE '%user_permission%' OR name LIKE '%custom_permission%'");
  console.log('\n=== Permission tables ===');
  (tables.recordset || []).forEach((t:any) => console.log(`  ${t.name}`));

  // Check role_permissions
  const rp = await kdb('role_permissions').where('role', 'student').select('permission');
  console.log(`\n=== Student permissions (${rp.length}) ===`);
  rp.forEach((p:any) => console.log(`  ${p.permission}`));

  // Check if there's a table for user-specific additional permissions
  const userPermTables = await kdb.raw("SELECT name FROM sys.tables WHERE name LIKE '%user%perm%' OR name LIKE '%custom_role%' OR name LIKE '%assign%perm%'");
  console.log('\n=== User-permission assignment tables ===');
  if (userPermTables.recordset?.length) {
    userPermTables.recordset.forEach((t:any) => console.log(`  ${t.name}`));
  } else {
    console.log('  (none found)');
  }

  await kdb.destroy();
}
main().catch(err => { console.error(err); process.exit(1); });
