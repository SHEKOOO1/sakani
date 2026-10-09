import type { Knex } from 'knex';

/**
 * Phase 5 — attendance-side cutover off `finances`.
 *
 * Attendance penalties used to live in `finances` with two extra columns that
 * made them findable and idempotent: `attendance_id` (which record charged it)
 * and `reference` (the penalty id or `event-rule:<ruleId>` that identifies the
 * charge so a re-run never fines twice). Their cancellations were written as
 * separate `is_reversal = 1` rows linked by `reversal_of_id`.
 *
 * Once attendance stops writing `finances`, those coordinates have to live on
 * the ledger, or the module loses its idempotency and its reversal link. These
 * columns carry them:
 *
 *   reference      penalty id / 'event-rule:<ruleId>' — the idempotency key
 *   attendance_id  the event_attendance_detailed row the charge belongs to
 *   event_id       denormalised for scoped reads/cancellations
 *   session_id     denormalised for scoped reads/cancellations
 *
 * The partial index serves the two hot lookups: "does a posted charge already
 * exist for this reference" (idempotency) and "find the charge to reverse".
 * Filtered on attendance_id so manual/reporting entries stay out of it.
 *
 * Additive and idempotent: safe on fresh and drifted databases, safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  const columns: Array<[string, string]> = [
    ['reference', 'NVARCHAR(255)'],
    ['attendance_id', 'NVARCHAR(128)'],
    ['event_id', 'NVARCHAR(128)'],
    ['session_id', 'NVARCHAR(128)'],
  ];

  for (const [name, type] of columns) {
    await knex.raw(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns
                     WHERE object_id = OBJECT_ID('journal_entries') AND name = '${name}')
        ALTER TABLE [dbo].[journal_entries] ADD [${name}] ${type} NULL;
    `);
  }

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'IX_journal_entries_attendance_ref' AND object_id = OBJECT_ID('journal_entries'))
      CREATE INDEX [IX_journal_entries_attendance_ref]
        ON [dbo].[journal_entries] ([attendance_id], [reference])
        WHERE [attendance_id] IS NOT NULL;
  `);

  console.log('Ledger: journal_entries reference/attendance_id/event_id/session_id (attendance cutover)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_journal_entries_attendance_ref' AND object_id = OBJECT_ID('journal_entries'))
      DROP INDEX [IX_journal_entries_attendance_ref] ON [dbo].[journal_entries];
  `);

  for (const name of ['reference', 'attendance_id', 'event_id', 'session_id']) {
    await knex.raw(`
      DECLARE @constraint NVARCHAR(200);
      SELECT @constraint = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID('journal_entries') AND c.name = '${name}';
      IF @constraint IS NOT NULL EXEC('ALTER TABLE [dbo].[journal_entries] DROP CONSTRAINT [' + @constraint + ']');

      IF EXISTS (SELECT 1 FROM sys.columns
                 WHERE object_id = OBJECT_ID('journal_entries') AND name = '${name}')
        ALTER TABLE [dbo].[journal_entries] DROP COLUMN [${name}];
    `);
  }
}
