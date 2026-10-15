import type { Knex } from 'knex';

/**
 * Make reference-based ledger idempotency database-enforced.
 *
 * Restaurant `serve`, canteen sales, and attendance charges each post money
 * with a stable `reference` (`restaurant-order:<id>`, `canteen-sale:<id>`,
 * a penalty id, `event-rule:<id>`). The read-before-write guards in those
 * callers have a small TOCTOU window under concurrency (double-click / two
 * overlapping requests can both pass the check before either commits), which
 * would post the same money twice.
 *
 * `(reference, status)` is unique where `reference` is set. Two live entries
 * can never share a reference — the second insert fails — while a reversal
 * releases the reference (the original flips to 'reversed'), so a legitimate
 * re-charge after a cancellation still succeeds. Reversals themselves carry
 * `reference = NULL` and never collide.
 *
 * Additive and idempotent: safe on fresh and drifted databases, safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'UQ_journal_entries_reference_status' AND object_id = OBJECT_ID('journal_entries'))
      CREATE UNIQUE INDEX [UQ_journal_entries_reference_status]
        ON [dbo].[journal_entries] ([reference], [status])
        WHERE [reference] IS NOT NULL;
  `);
  console.log('Ledger: unique (reference, status) — reference idempotency is now DB-enforced');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UQ_journal_entries_reference_status' AND object_id = OBJECT_ID('journal_entries'))
      DROP INDEX [UQ_journal_entries_reference_status] ON [dbo].[journal_entries];
  `);
}