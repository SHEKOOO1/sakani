import { kdb } from "../src/backend/infrastructure/knex";

async function main() {
  const rooms = await kdb.raw("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'rooms' ORDER BY ORDINAL_POSITION");
  console.log('ROOMS:', rooms.map((c: any) => c.COLUMN_NAME).join(', '));
  const st = await kdb.raw("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'students' ORDER BY ORDINAL_POSITION");
  console.log('STUDENTS:', st.map((c: any) => c.COLUMN_NAME).join(', '));
  const sf = await kdb.raw("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'student_files' ORDER BY ORDINAL_POSITION");
  console.log('STUDENT_FILES:', sf.map((c: any) => c.COLUMN_NAME).join(', '));
  const notif = await kdb.raw("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notifications' ORDER BY ORDINAL_POSITION");
  console.log('NOTIFICATIONS:', notif.map((c: any) => c.COLUMN_NAME).join(', '));
  await kdb.destroy();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('❌', e?.message || e);
  try { await kdb.destroy(); } catch {}
  process.exit(1);
});