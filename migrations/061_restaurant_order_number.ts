import type { Knex } from 'knex';

/**
 * Restaurant order numbering + who-placed-it + pickup tracking.
 *
 *   order_number    – per-tenant, per-day sequence (resets each day; starts at 1)
 *   order_date      – the business day the number belongs to (used to detect
 *                     late orders carried over from a previous day)
 *   ordered_by_name – snapshot of the user who physically placed the order
 *   ordered_by_role – their role at that moment
 *   collected_at    – when staff marked the order as handed over / collected
 *                     (removes it from the waiting queue)
 *
 * Idempotent: every ALTER is guarded with IF NOT EXISTS on sys.columns, and the
 * unique index is filtered (order_number IS NOT NULL) so the many pre-existing
 * rows with a NULL number do not collide. Mirrors the boot-time reconciliation
 * in src/backend/infrastructure/db.ts.
 */
export async function up(knex: Knex): Promise<void> {
  const columns: Array<{ name: string; type: string }> = [
    { name: 'order_number', type: 'INT NULL' },
    { name: 'order_date', type: 'DATE NULL' },
    { name: 'ordered_by_name', type: 'NVARCHAR(255) NULL' },
    { name: 'ordered_by_role', type: 'NVARCHAR(50) NULL' },
    { name: 'collected_at', type: 'DATETIME2 NULL' },
  ];

  for (const col of columns) {
    await knex.raw(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('restaurant_orders') AND name = '${col.name}')
        ALTER TABLE [dbo].[restaurant_orders] ADD [${col.name}] ${col.type};
    `);
  }

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_restaurant_orders_number' AND object_id = OBJECT_ID('restaurant_orders'))
      CREATE UNIQUE INDEX UX_restaurant_orders_number ON restaurant_orders (tenant_id, order_date, order_number) WHERE order_number IS NOT NULL;
  `);

  console.log('Restaurant order numbering migration applied');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_restaurant_orders_number' AND object_id = OBJECT_ID('restaurant_orders'))
      DROP INDEX UX_restaurant_orders_number ON restaurant_orders;
  `);
  const columns = ['order_number', 'order_date', 'ordered_by_name', 'ordered_by_role', 'collected_at'];
  for (const name of columns) {
    await knex.raw(`
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('restaurant_orders') AND name = '${name}')
        ALTER TABLE [dbo].[restaurant_orders] DROP COLUMN [${name}];
    `);
  }
}
