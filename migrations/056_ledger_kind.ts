import type { Knex } from 'knex';

/**
 * Separate the three activities on the journal: dorm (residence), restaurant
 * and canteen. Each `journal_entries` row is tagged with the activity it
 * belongs to (`ledger_kind`), so housing reports/dashboards can never count
 * restaurant or canteen sales as residence income, while a combined rollup
 * can still read all three from the one database.
 *
 * Additive, reversible and idempotent:
 *   - adds a NOT NULL column defaulting to 'dorm' (existing rows keep working),
 *   - backfills only the unambiguous restaurant/canteen rows (by their reserved
 *     account on `journal_lines`, with the category as a fallback),
 *   - changes no amount, no line, and never deletes or reverses anything.
 *
 * Reversals inherit the kind of the entry they mirror (handled in
 * reverseEntry), so a refunded canteen sale stays in the canteen book.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('journal_entries') AND name = 'ledger_kind')
      ALTER TABLE [dbo].[journal_entries] ADD [ledger_kind] NVARCHAR(20) NOT NULL
        CONSTRAINT [DF_journal_entries_ledger_kind] DEFAULT 'dorm';
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_journal_entries_ledger_kind')
      ALTER TABLE [dbo].[journal_entries] ADD CONSTRAINT [CK_journal_entries_ledger_kind]
        CHECK ([ledger_kind] IN ('dorm', 'restaurant', 'canteen'));
  `);

  // Classify existing rows by their reserved revenue account (authoritative) or
  // the reserved category (fallback). Idempotent: only touches still-'dorm' rows.
  await knex.raw(`
    UPDATE e SET e.ledger_kind = 'restaurant'
      FROM [dbo].[journal_entries] e
     WHERE e.ledger_kind = 'dorm'
       AND (
         e.category = N'مطعم'
         OR EXISTS (SELECT 1 FROM [dbo].[journal_lines] l WHERE l.entry_id = e.id AND l.account = 'RESTAURANT_REVENUE')
       );
  `);

  await knex.raw(`
    UPDATE e SET e.ledger_kind = 'canteen'
      FROM [dbo].[journal_entries] e
     WHERE e.ledger_kind = 'dorm'
       AND (
         e.category = N'كانتين'
         OR EXISTS (SELECT 1 FROM [dbo].[journal_lines] l WHERE l.entry_id = e.id AND l.account = 'CANTEEN_REVENUE')
       );
  `);

  console.log("Journal: ledger_kind added ('dorm' default; restaurant/canteen backfilled)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_journal_entries_ledger_kind')
      ALTER TABLE [dbo].[journal_entries] DROP CONSTRAINT [CK_journal_entries_ledger_kind];
  `);
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_journal_entries_ledger_kind')
      ALTER TABLE [dbo].[journal_entries] DROP CONSTRAINT [DF_journal_entries_ledger_kind];
  `);
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('journal_entries') AND name = 'ledger_kind')
      ALTER TABLE [dbo].[journal_entries] DROP COLUMN [ledger_kind];
  `);
}
