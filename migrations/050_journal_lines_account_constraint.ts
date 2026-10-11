import type { Knex } from 'knex';

/**
 * Extend the journal_lines.account CHECK constraint to include the revenue
 * accounts introduced by the restaurant/canteen modules.
 *
 * Migration 043 created CK_journal_lines_account with a fixed list that omits
 * RESTAURANT_REVENUE and CANTEEN_REVENUE, so posted revenue lines were rejected
 * by the database even though ledger.service.ts already declares them. This
 * drops and recreates the constraint with the full account set.
 *
 * Idempotent: recreates the constraint only when the table exists (043 owns the
 * CREATE for fresh databases). Mirrored at boot in
 * src/backend/infrastructure/db.ts.
 */

const ALLOWED_ACCOUNTS = [
  'CASH',
  'STUDENT_PAYMENT',
  'ROOM_REVENUE',
  'RESTAURANT_REVENUE',
  'CANTEEN_REVENUE',
  'PENALTY',
  'DISCOUNT',
  'EXPENSE',
];

const checkClause = (): string => `CHECK ([account] IN (${ALLOWED_ACCOUNTS.map((a) => `'${a}'`).join(',')}))`;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF OBJECT_ID('journal_lines') IS NOT NULL
    BEGIN
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_journal_lines_account' AND parent_object_id = OBJECT_ID('journal_lines'))
        ALTER TABLE [dbo].[journal_lines] DROP CONSTRAINT [CK_journal_lines_account];
      ALTER TABLE [dbo].[journal_lines] ADD CONSTRAINT [CK_journal_lines_account] ${checkClause()};
    END
  `);
  console.log('Journal line account constraint extended (restaurant/canteen revenue)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF OBJECT_ID('journal_lines') IS NOT NULL
    BEGIN
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_journal_lines_account' AND parent_object_id = OBJECT_ID('journal_lines'))
        ALTER TABLE [dbo].[journal_lines] DROP CONSTRAINT [CK_journal_lines_account];
      ALTER TABLE [dbo].[journal_lines] ADD CONSTRAINT [CK_journal_lines_account]
        CHECK ([account] IN ('CASH','STUDENT_PAYMENT','ROOM_REVENUE','PENALTY','DISCOUNT','EXPENSE'));
    END
  `);
}
