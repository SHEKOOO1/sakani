import type { Knex } from 'knex';

/**
 * Phase 3 closes the loop on student deletion.
 *
 * students/crud.routes.ts used to hard-delete the row, which left orphan
 * `finances` behind and would have orphaned `journal_entries` too — a student
 * identifier that points at nobody, on rows that still hold real money. That
 * endpoint now refuses to drop anyone with financial history (archive-or-block
 * via "leave"), and these foreign keys are what makes the refusal a database
 * invariant rather than a convention every caller has to remember.
 *
 * NO ACTION on purpose: there is no safe cascade for a ledger. Deleting the
 * student must fail, not silently take their statement with it.
 *
 * Orphans that predate this migration are nulled first. A student_id on a
 * journal row where the student no longer exists carries no usable meaning —
 * the entry itself stays, and the reconciliation checks in
 * ops/verify-ledger.sql are unaffected. Nulling rather than failing keeps a
 * bad row from turning into a failed migrate.latest() on boot, which would take
 * the whole application down over data hygiene.
 */
export async function up(knex: Knex): Promise<void> {
  const counts = await knex.raw(`
    SELECT
      (SELECT COUNT(*) FROM [dbo].[journal_entries] [e]
        WHERE [e].[student_id] IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM [dbo].[students] [s] WHERE [s].[id] = [e].[student_id])) AS [entries],
      (SELECT COUNT(*) FROM [dbo].[journal_lines] [l]
        WHERE [l].[student_id] IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM [dbo].[students] [s] WHERE [s].[id] = [l].[student_id])) AS [lines];
  `);
  const stat = counts?.recordset?.[0] ?? (Array.isArray(counts) ? counts[0] : null);
  const orphanEntries = Number(stat?.entries || 0);
  const orphanLines = Number(stat?.lines || 0);

  if (orphanEntries > 0 || orphanLines > 0) {
    console.warn(
      `[ledger] ${orphanEntries} journal_entries and ${orphanLines} journal_lines point at a student that no longer exists; clearing those references so the FK can be enforced.`,
    );
    await knex.raw(`
      UPDATE [dbo].[journal_entries] SET [student_id] = NULL
      WHERE [student_id] IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM [dbo].[students] [s] WHERE [s].[id] = [dbo].[journal_entries].[student_id]);

      UPDATE [dbo].[journal_lines] SET [student_id] = NULL
      WHERE [student_id] IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM [dbo].[students] [s] WHERE [s].[id] = [dbo].[journal_lines].[student_id]);
    `);
  }

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_journal_entries_student')
      ALTER TABLE [dbo].[journal_entries] WITH CHECK
        ADD CONSTRAINT [FK_journal_entries_student]
        FOREIGN KEY ([student_id]) REFERENCES [dbo].[students]([id]);
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_journal_lines_student')
      ALTER TABLE [dbo].[journal_lines] WITH CHECK
        ADD CONSTRAINT [FK_journal_lines_student]
        FOREIGN KEY ([student_id]) REFERENCES [dbo].[students]([id]);
  `);

  console.log('Ledger: FK_journal_entries_student + FK_journal_lines_student (a student with history cannot be deleted)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_journal_lines_student')
      ALTER TABLE [dbo].[journal_lines] DROP CONSTRAINT [FK_journal_lines_student];
  `);
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_journal_entries_student')
      ALTER TABLE [dbo].[journal_entries] DROP CONSTRAINT [FK_journal_entries_student];
  `);
}
