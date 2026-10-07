import { kdb } from "./src/backend/infrastructure/knex";

async function main() {
  const eventId = 'db1d92e0-f0ce-44c5-9ffe-90421418f322';

  // Test 1: Direct event_attendance query
  try {
    const r = await kdb('event_attendance').select('*').limit(1);
    console.log('event_attendance OK:', JSON.stringify(r));
  } catch (e: any) {
    console.log('event_attendance ERROR:', e.message);
  }

  // Test 2: Direct event_subscriptions query  
  try {
    const r = await kdb('event_subscriptions').select('*').limit(1);
    console.log('event_subscriptions OK:', JSON.stringify(r));
  } catch (e: any) {
    console.log('event_subscriptions ERROR:', e.message);
  }

  // Test 3: Core comprehensive report query
  try {
    const r = await kdb.raw(`
      SELECT DISTINCT
        s.id as student_id, u.name as student_name, s.student_id_number,
        ea.status, ea.check_in_method, ea.excuse_reason as absence_reason, ea.attended_at,
        ? as event_id, NULL as session_id,
        NULL as is_paid
      FROM (
        SELECT student_id FROM event_subscriptions WHERE event_id = ? AND status = 'approved'
        UNION
        SELECT student_id FROM event_attendance WHERE event_id = ?
      ) AS participants
      JOIN students s ON participants.student_id = s.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN event_attendance ea ON ea.event_id = ? AND ea.student_id = s.id
      ORDER BY u.name
    `, [eventId, eventId, eventId, eventId]);
    console.log('Comprehensive report query OK, rows:', r.recordset?.length);
  } catch (e: any) {
    console.log('Comprehensive report ERROR:', e.message);
  }

  // Test 4: Subscriptions query
  try {
    const r = await kdb('event_subscriptions as es')
      .join('users as u', 'es.user_id', 'u.id')
      .leftJoin('students as s', 'es.student_id', 's.id')
      .leftJoin('payment_methods as pm', 'es.payment_method_id', 'pm.id')
      .select(
        'es.*',
        'u.name as user_name',
        's.name as student_name',
        's.student_id_number',
        'pm.name as payment_method_name',
        'pm.phone_number as payment_method_phone'
      )
      .where('es.event_id', eventId)
      .orderBy('es.created_at', 'desc')
      .limit(1);
    console.log('Subscriptions query OK, rows:', r.length);
  } catch (e: any) {
    console.log('Subscriptions ERROR:', e.message);
  }

  await kdb.destroy();
}
main().catch(err => { console.error(err); process.exit(1); });
