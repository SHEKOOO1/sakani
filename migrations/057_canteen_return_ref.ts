import type { Knex } from 'knex';

/**
 * Idempotency key for canteen returns.
 *
 * The `forUpdate` lock on the sale row already serialises *concurrent* returns,
 * but a client that retries / double-submits the same partial return (e.g. a
 * dropped response) would book it twice and over-restock up to the sold cap.
 * A caller-supplied `return_ref` is stamped on each return stock movement and
 * guarded by a unique filtered index, so a replayed request is recognised as
 * already-processed and changes nothing.
 *
 * Additive, reversible and idempotent: only adds a nullable column + index.
 * Rows without a reference are unaffected (the index filters NULLs out), so all
 * existing movements keep working.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('canteen_stock_movements') AND name = 'return_ref')
      ALTER TABLE [dbo].[canteen_stock_movements] ADD [return_ref] NVARCHAR(100) NULL;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_canteen_return_ref' AND object_id = OBJECT_ID('canteen_stock_movements'))
      CREATE UNIQUE INDEX [UX_canteen_return_ref]
        ON [dbo].[canteen_stock_movements] ([tenant_id], [return_ref], [product_id])
        WHERE [return_ref] IS NOT NULL;
  `);

  console.log('Canteen: return_ref idempotency column + unique index added');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_canteen_return_ref' AND object_id = OBJECT_ID('canteen_stock_movements'))
      DROP INDEX [UX_canteen_return_ref] ON [dbo].[canteen_stock_movements];
  `);
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('canteen_stock_movements') AND name = 'return_ref')
      ALTER TABLE [dbo].[canteen_stock_movements] DROP COLUMN [return_ref];
  `);
}
