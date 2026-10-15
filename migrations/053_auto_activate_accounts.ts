import type { Knex } from 'knex';

/**
 * Remove the email-verification lifecycle: every account is active immediately.
 *
 * Product decision (2026-10): accounts are no longer created "pending"; the
 * email confirmation step is removed entirely. This migration:
 *
 *   1. Backfills `activated_at` for any account still pending (uses the account
 *      creation time, falling back to now) so no existing user is left locked
 *      out by the login gate we remove alongside this change.
 *   2. Clears the single-use activation-token columns for all rows — leftover
 *      activation links in the wild must become inert immediately.
 *   3. Drops the lookup index that only the activation flow used.
 *
 * Additive and idempotent: safe on fresh and drifted databases, safe to re-run.
 * Nothing here destroys ledger/inventory/financial history.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE [dbo].[users]
       SET [activated_at] = ISNULL([created_at], GETDATE())
     WHERE [activated_at] IS NULL;
  `);

  await knex.raw(`
    UPDATE [dbo].[users]
       SET [activation_token_hash] = NULL,
           [activation_expires_at] = NULL,
           [activation_sent_at] = NULL;
  `);

  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_users_activation_token_hash' AND object_id = OBJECT_ID('users'))
      DROP INDEX [IX_users_activation_token_hash] ON [dbo].[users];
  `);

  console.log('Accounts auto-activated; activation token columns cleared (email verification removed)');
}

export async function down(knex: Knex): Promise<void> {
  // Re-enabling the email-verification flow would need the original pending
  // state, which is intentionally gone. We re-create the old lookup index so
  // the pre-change code can run again against a DB migrated forward, and we
  // do NOT reintroduce pending accounts — that is an irreversible product
  // decision and must be decided by an operator, not a rollback script.
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'IX_users_activation_token_hash' AND object_id = OBJECT_ID('users'))
      CREATE NONCLUSTERED INDEX [IX_users_activation_token_hash] ON [dbo].[users] ([activation_token_hash]);
  `);
}