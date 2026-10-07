import type { Knex } from 'knex';

/**
 * Account activation state for `users`.
 *
 * Every account created by an authorised user (admin-created staff, students,
 * auto-created guardians, tenant import) starts pending: `activated_at IS NULL`
 * and a single-use digest in `activation_token_hash`. `POST /api/auth/login`
 * refuses a pending account until the emailed link is opened.
 *
 * The backfill is deliberately INSIDE the `IF NOT EXISTS` branch: it only runs
 * on the very statement that creates the column, so accounts created *after*
 * the upgrade are not silently grandfathered on a later boot or re-run.
 *
 * Only the SHA-256 digest of the token is stored — never the plaintext.
 *
 * Idempotent: safe on fresh and drifted databases, and safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  // Batch 1: create the column and grandfather every pre-existing row.
  // The backfill MUST run through sp_executesql: SQL Server compiles the whole
  // batch first, so an UPDATE naming `activated_at` in the same batch as the
  // ALTER that creates it fails with "Invalid column name" before anything runs.
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'activated_at')
    BEGIN
      ALTER TABLE [dbo].[users] ADD [activated_at] DATETIME2 NULL;
      EXEC sp_executesql N'UPDATE [dbo].[users] SET [activated_at] = ISNULL([created_at], GETDATE()) WHERE [activated_at] IS NULL;';
    END;
  `);

  // Batch 2+3: the remaining columns are separate batches so a failure to add
  // one (e.g. a pre-existing column of an unexpected type) cannot abort the
  // others and leave the table half-migrated.
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'activation_token_hash')
      ALTER TABLE [dbo].[users] ADD [activation_token_hash] NVARCHAR(64) NULL;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'activation_expires_at')
      ALTER TABLE [dbo].[users] ADD [activation_expires_at] DATETIME2 NULL;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'activation_sent_at')
      ALTER TABLE [dbo].[users] ADD [activation_sent_at] DATETIME2 NULL;
  `);

  // Token lookup is by exact digest, so it needs an index.
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_users_activation_token_hash' AND object_id = OBJECT_ID('users'))
      CREATE NONCLUSTERED INDEX [IX_users_activation_token_hash] ON [dbo].[users] ([activation_token_hash]);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Activation state is required by the application; no rollback.
}
