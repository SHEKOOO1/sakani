import type { Knex } from 'knex';

// rewards_definitions was created in schema_mssql.sql with category/stock,
// and the backend (POST /api/users/rewards-store) inserts both columns, but the
// live DB is missing them -> "Invalid column name 'category'/'stock'". 033
// actually 031: reconciles the live table with the code + fresh-DDL contract.
export async function up(knex: Knex): Promise<void> {
  const hasCategory = await knex.schema.hasColumn('rewards_definitions', 'category');
  if (!hasCategory) {
    await knex.schema.alterTable('rewards_definitions', (t) => {
      t.string('category', 100).nullable();
    });
  }

  const hasStock = await knex.schema.hasColumn('rewards_definitions', 'stock');
  if (!hasStock) {
    await knex.schema.alterTable('rewards_definitions', (t) => {
      t.integer('stock').defaultTo(99).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .alterTable('rewards_definitions', (t) => {
      t.dropColumn('category');
      t.dropColumn('stock');
    })
    .catch(() => undefined);
}