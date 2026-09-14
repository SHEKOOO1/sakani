import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Broadcast queries: ticker/messages filter by display_type, status, dates
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_broadcasts_display_status')
      CREATE INDEX IX_broadcasts_display_status ON [dbo].[broadcasts]([display_type], [status], [start_at], [end_at]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_broadcasts_sender_id')
      CREATE INDEX IX_broadcasts_sender_id ON [dbo].[broadcasts]([sender_id], [created_at] DESC);
  `);

  // Notifications: per-user unread queries
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_user_read')
      CREATE INDEX IX_notifications_user_read ON [dbo].[notifications]([user_id], [is_read]) WHERE is_read = 0;
  `);

  // Attendance: filtered by tenant, ordered by date
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_attendance_tenant_date')
      CREATE INDEX IX_attendance_tenant_date ON [dbo].[attendance]([tenant_id], [created_at] DESC);
  `);

  // Finances: filtered by tenant, ordered by date
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_finances_tenant_date')
      CREATE INDEX IX_finances_tenant_date ON [dbo].[finances]([tenant_id], [date] DESC);
  `);

  // Students: common filter by tenant + status
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_students_tenant_status')
      CREATE INDEX IX_students_tenant_status ON [dbo].[students]([tenant_id], [status]);
  `);

  // Audit logs: tenant + created_at for tenant-scoped queries
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_audit_logs_tenant_created')
      CREATE INDEX IX_audit_logs_tenant_created ON [dbo].[audit_logs]([tenant_id], [created_at] DESC);
  `);

  // Radio videos: active + created_at for archive browsing
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_videos_active_created')
      CREATE INDEX IX_radio_videos_active_created ON [dbo].[radio_videos]([is_active], [created_at] DESC);
  `);

  // Broadcast reads: per-user notification reads
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_broadcast_reads_user')
      CREATE INDEX IX_broadcast_reads_user ON [dbo].[broadcast_reads]([user_id], [broadcast_id]);
  `);

  console.log("✅ Additional performance indexes created");
}

export async function down(knex: Knex): Promise<void> {
  const indexes = [
    "IX_broadcasts_display_status", "IX_broadcasts_sender_id",
    "IX_notifications_user_read", "IX_attendance_tenant_date",
    "IX_finances_tenant_date", "IX_students_tenant_status",
    "IX_audit_logs_tenant_created", "IX_radio_videos_active_created",
    "IX_broadcast_reads_user",
  ];

  for (const name of indexes) {
    // Extract table name from index name (remove IX_ prefix, get first part before next _)
    const parts = name.replace("IX_", "").split("_");
    const table = parts.slice(0, -1).join("_");
    await knex.raw(`IF EXISTS (SELECT * FROM sys.indexes WHERE name = '${name}') DROP INDEX [${name}] ON [dbo].[${table}]`);
  }
}
