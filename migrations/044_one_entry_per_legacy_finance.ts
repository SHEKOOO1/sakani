import type { Knex } from 'knex';

/**
 * Phase 2b guard for the legacy `finances` backfill.
 *
 * scripts/backfill-ledger.ts turns every `finances` row into one balanced
 * journal entry and records the link in journal_entries.finance_id. This index
 * makes that mapping an invariant the database enforces: re-running the
 * backfill (or running it twice concurrently) can no longer import the same
 * money movement twice.
 *
 * Filtered index because a plain UNIQUE on finance_id would reject entries
 * that carry no legacy row at all — at this point finance_id was NULL for
 * everything written through postEntry().
 * IX_journal_entries_finance (non-unique, added by 043) stays: it serves the
 * read path, this one serves the invariant.
 *
 * Superseded by migration 045. Phase 3 makes live writes carry finance_id, so
 * an edit (reverse the old entry, issue a new one) legitimately leaves two
 * rows on the same finance_id. 045 drops this index and narrows uniqueness to
 * source = 'legacy' — the only place one-entry-per-finance still holds.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'UQ_journal_entries_finance_id' AND object_id = OBJECT_ID('journal_entries'))
      CREATE UNIQUE INDEX [UQ_journal_entries_finance_id]
        ON [dbo].[journal_entries] ([finance_id])
        WHERE [finance_id] IS NOT NULL;
  `);

  console.log('Ledger guard: UQ_journal_entries_finance_id (one entry per legacy finances row)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UQ_journal_entries_finance_id' AND object_id = OBJECT_ID('journal_entries'))
      DROP INDEX [UQ_journal_entries_finance_id] ON [dbo].[journal_entries];
  `);
}
