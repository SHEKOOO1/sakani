import type { Knex } from 'knex';

/**
 * Phase 3 makes an edit a reversal + a new entry (the user-visible rule: a
 * modified record is never overwritten, it is undone and re-issued). Both the
 * entry that was reversed and the entry that replaced it describe the SAME
 * `finances` row, so both carry finance_id — and the unfiltered unique index
 * from migration 044 would reject the write.
 *
 * The invariant 044 actually wanted is narrower: the *backfill* may import a
 * legacy row at most once. Filtering on source says exactly that. Live entries
 * (api/attendance/system) stay free to multiply per row, which is what the
 * reversal + re-issue model requires.
 *
 * scripts/backfill-ledger.ts keeps its own "already linked?" pre-check, so
 * idempotency does not depend on this index alone; the index is the
 * database-level backstop against a double import.
 *
 * Also widens journal_entries.description to NVARCHAR(MAX) to match
 * finances.description: dual-writing a row whose legacy description exceeds
 * 500 characters would otherwise fail the whole save with a truncation error,
 * which is a regression the pre-ledger code did not have.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UQ_journal_entries_finance_id' AND object_id = OBJECT_ID('journal_entries'))
      DROP INDEX [UQ_journal_entries_finance_id] ON [dbo].[journal_entries];
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'UQ_journal_entries_legacy_finance' AND object_id = OBJECT_ID('journal_entries'))
      CREATE UNIQUE INDEX [UQ_journal_entries_legacy_finance]
        ON [dbo].[journal_entries] ([finance_id])
        WHERE [finance_id] IS NOT NULL AND [source] = 'legacy';
  `);

  // max_length is -1 only for the MAX types.
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('journal_entries') AND name = 'description' AND max_length <> -1)
      ALTER TABLE [dbo].[journal_entries] ALTER COLUMN [description] NVARCHAR(MAX) NULL;
  `);

  console.log('Ledger: finance_id unique per legacy import only (UQ_journal_entries_legacy_finance)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UQ_journal_entries_legacy_finance' AND object_id = OBJECT_ID('journal_entries'))
      DROP INDEX [UQ_journal_entries_legacy_finance] ON [dbo].[journal_entries];
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'UQ_journal_entries_finance_id' AND object_id = OBJECT_ID('journal_entries'))
      CREATE UNIQUE INDEX [UQ_journal_entries_finance_id]
        ON [dbo].[journal_entries] ([finance_id])
        WHERE [finance_id] IS NOT NULL;
  `);
}
