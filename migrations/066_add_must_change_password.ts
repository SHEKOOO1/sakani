import type { Knex } from 'knex';

/**
 * Force-change-default-password flag.
 *
 * Accounts created with the shared DEFAULT_USER_PASSWORD (students, imported
 * tenants, auto-created parents, staff created without an explicit password)
 * must set their own password before using the app. `must_change_password` is
 * set to 1 at creation when the default password was used, returned by
 * /auth/login and /auth/me, and cleared to 0 by the change-password flow.
 *
 * Additive and reversible: one non-null BIT column defaulting to 0 (existing
 * accounts keep working unchanged).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'must_change_password')
      ALTER TABLE [dbo].[users] ADD [must_change_password] BIT NOT NULL DEFAULT 0;
  `);

  console.log('Users: must_change_password column added');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'must_change_password')
      ALTER TABLE [dbo].[users] DROP COLUMN [must_change_password];
  `);
}
