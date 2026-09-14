import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasAdminCol = await knex.schema.hasColumn('finances', 'is_admin_only');
  if (!hasAdminCol) {
    await knex.schema.alterTable('finances', (table) => {
      table.boolean('is_admin_only').defaultTo(false);
    });
  }

  // Make tenant_id nullable so admin records can omit it
  await knex.raw('ALTER TABLE finances ALTER COLUMN tenant_id NVARCHAR(128) NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('finances', (table) => {
    table.dropColumn('is_admin_only');
  });
  await knex.raw('ALTER TABLE finances ALTER COLUMN tenant_id NVARCHAR(128) NOT NULL');
}
