import type { Knex } from 'knex';

/**
 * Closes the last two write-path gaps found by the column audit:
 *
 * - students.travel_reason  : written by POST /api/students/travel/start and
 *                            cleared by POST /api/students/travel/end. Both UI
 *                            entry points (AttendancePage, Dashboard) refuse to
 *                            submit without a reason, so the whole travel flow
 *                            500'd on "Invalid column name 'travel_reason'".
 * - student_archive.notes  : collected by ArchiveModal and posted to
 *                            POST /api/students/:id/leave, which failed before
 *                            the student was ever archived.
 *
 * Both are additive + nullable, so existing rows stay valid and no lock escalation
 * beyond a metadata-only change is required.
 *
 * Idempotent: safe on fresh and drifted databases, and safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'travel_reason')
      ALTER TABLE [dbo].[students] ADD [travel_reason] NVARCHAR(500) NULL;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('student_archive') AND name = 'notes')
      ALTER TABLE [dbo].[student_archive] ADD [notes] NVARCHAR(MAX) NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Additive columns required by the application; no rollback.
}
