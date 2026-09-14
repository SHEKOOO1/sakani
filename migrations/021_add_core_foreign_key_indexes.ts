import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const idx = (name: string, table: string, cols: string, filter?: string) =>
    knex.raw(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = '${name}')
        CREATE INDEX ${name} ON [dbo].[${table}](${cols})${filter ? ` WHERE ${filter}` : ''};
    `);

  // Add missing columns that may not exist in older schemas
  for (const { table, cols } of [
    { table: 'attendance', cols: ['user_id', 'student_id'] },
    { table: 'maintenance_requests', cols: ['student_id', 'user_id', 'assigned_to'] },
  ]) {
    for (const col of cols) {
      await knex.raw(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${col}')
          ALTER TABLE ${table} ADD ${col} NVARCHAR(128);
      `);
    }
  }

  await idx('IX_rooms_apartment_id', 'rooms', '[apartment_id]');
  await idx('IX_rooms_tenant_id', 'rooms', '[tenant_id]');
  await idx('IX_students_room_id', 'students', '[room_id]');
  await idx('IX_students_student_id_number', 'students', '[student_id_number]');
  await idx('IX_attendance_student_id', 'attendance', '[student_id]');
  await idx('IX_attendance_user_id', 'attendance', '[user_id]');
  await idx('IX_finances_student_id', 'finances', '[student_id]');
  await idx('IX_finances_created_by', 'finances', '[created_by]');
  await idx('IX_events_tenant_id', 'events', '[tenant_id]');
  await idx('IX_events_event_date', 'events', '[event_date]');
  await idx('IX_maintenance_requests_student_id', 'maintenance_requests', '[student_id]');
  await idx('IX_maintenance_requests_user_id', 'maintenance_requests', '[user_id]');
  await idx('IX_maintenance_requests_assigned_to', 'maintenance_requests', '[assigned_to]');
  await idx('IX_maintenance_requests_status', 'maintenance_requests', '[status]');
  await idx('IX_laundry_queue_student_id', 'laundry_queue', '[student_id]');
  await idx('IX_laundry_queue_tenant_id', 'laundry_queue', '[tenant_id]');
  await idx('IX_laundry_queue_status', 'laundry_queue', '[status]');
  await idx('IX_notifications_tenant_id', 'notifications', '[tenant_id]');
  await idx('IX_user_tenant_assignments_tenant_id', 'user_tenant_assignments', '[tenant_id]');
  await idx('IX_audit_logs_user_id', 'audit_logs', '[user_id]');
  await idx('IX_student_points_student_id', 'student_points', '[student_id]');
  await idx('IX_student_warnings_student_id', 'student_warnings', '[student_id]');
  await idx('IX_student_delays_student_id', 'student_delays', '[student_id]');
  await idx('IX_event_attendance_student_id', 'event_attendance', '[student_id]');
  await idx('IX_competitions_tenant_id', 'competitions', '[tenant_id]');
  await idx('IX_broadcast_attachments_broadcast_id', 'broadcast_attachments', '[broadcast_id]');
  await idx('IX_parents_tenant_id', 'parents', '[tenant_id]');
  await idx('IX_parents_user_id', 'parents', '[user_id]');
  await idx('IX_student_guardians_student_id', 'student_guardians', '[student_id]');
  await idx('IX_student_guardians_guardian_id', 'student_guardians', '[guardian_id]');
  await idx('IX_decisions_log_tenant_id', 'decisions_log', '[tenant_id]');
  await idx('IX_apartments_supervisor_id', 'apartments', '[supervisor_id]');
  await idx('IX_event_registrations_event_id', 'event_registrations', '[event_id]');
  await idx('IX_event_registrations_student_id', 'event_registrations', '[student_id]');
  await idx('IX_radio_videos_youtube_id', 'radio_videos', '[youtube_id]');
  await idx('IX_token_blacklist_user_id', 'token_blacklist', '[user_id]');

  // Filtered index for active warnings lookup
  await idx('IX_student_warnings_status', 'student_warnings', '[status]');

  console.log("✅ Core foreign-key indexes created");
}

export async function down(knex: Knex): Promise<void> {
  const indexes = [
    'IX_rooms_apartment_id', 'IX_rooms_tenant_id', 'IX_students_room_id',
    'IX_students_student_id_number', 'IX_attendance_student_id', 'IX_attendance_user_id',
    'IX_finances_student_id', 'IX_finances_created_by', 'IX_events_tenant_id',
    'IX_events_event_date', 'IX_maintenance_requests_student_id', 'IX_maintenance_requests_user_id',
    'IX_maintenance_requests_assigned_to', 'IX_maintenance_requests_status',
    'IX_laundry_queue_student_id', 'IX_laundry_queue_tenant_id', 'IX_laundry_queue_status',
    'IX_notifications_tenant_id', 'IX_user_tenant_assignments_tenant_id', 'IX_audit_logs_user_id',
    'IX_student_points_student_id', 'IX_student_warnings_student_id', 'IX_student_delays_student_id',
    'IX_event_attendance_student_id', 'IX_competitions_tenant_id', 'IX_broadcast_attachments_broadcast_id',
    'IX_parents_tenant_id', 'IX_parents_user_id', 'IX_student_guardians_student_id',
    'IX_student_guardians_guardian_id', 'IX_decisions_log_tenant_id', 'IX_apartments_supervisor_id',
    'IX_event_registrations_event_id', 'IX_event_registrations_student_id',
    'IX_radio_videos_youtube_id', 'IX_token_blacklist_user_id', 'IX_student_warnings_status',
  ];

  for (const name of indexes) {
    const parts = name.replace('IX_', '').split('_');
    const table = parts.slice(0, -1).join('_');
    await knex.raw(`IF EXISTS (SELECT * FROM sys.indexes WHERE name = '${name}') DROP INDEX [${name}] ON [dbo].[${table}]`);
  }
}
