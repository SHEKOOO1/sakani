import type { Knex } from 'knex';

// Excuse (عذر) workflow for events.
// Adds:
//  - events.excuse_deadline_minutes: the cutoff (minutes BEFORE the event
//    start/date) by which a student (or his guardian) may submit an excuse,
//    set by the supervisor/priest inside the event rules. NULL = no deadline.
// Guards are idempotent; mirrors the boot-time guards in db.ts and the fresh
// DDL contract in schema_mssql.sql.

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'excuse_deadline_minutes')
     ALTER TABLE [dbo].[events] ADD [excuse_deadline_minutes] INT NULL;`
  );
  await knex.raw(
    `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_attendance_excuses_event_student' AND object_id = OBJECT_ID('attendance_excuses'))
     CREATE INDEX IX_attendance_excuses_event_student ON [dbo].[attendance_excuses] (event_id, student_id, status);`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'excuse_deadline_minutes')
     ALTER TABLE [dbo].[events] DROP COLUMN [excuse_deadline_minutes];`
  ).catch(() => undefined);
}