import type { Knex } from 'knex';

/**
 * Records who placed each order / canteen sale: the customer's name, phone,
 * apartment and room. This is captured at creation time from the student
 * record (or the placing user) so the receipt still shows the right person even
 * if the student later moves rooms or is archived.
 *
 * Adds the same four nullable columns to restaurant_orders and canteen_sales.
 *
 * Idempotent: every ALTER is guarded with IF NOT EXISTS on sys.columns, so it is
 * safe on fresh and drifted databases and safe to re-run. Mirrors the boot-time
 * reconciliation in src/backend/infrastructure/db.ts.
 */
export async function up(knex: Knex): Promise<void> {
  const tables = ['restaurant_orders', 'canteen_sales'];
  const columns: Array<{ name: string; type: string }> = [
    { name: 'customer_name', type: 'NVARCHAR(255) NULL' },
    { name: 'customer_phone', type: 'NVARCHAR(50) NULL' },
    { name: 'apartment_name', type: 'NVARCHAR(255) NULL' },
    { name: 'room_name', type: 'NVARCHAR(50) NULL' },
  ];

  for (const table of tables) {
    for (const col of columns) {
      await knex.raw(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${col.name}')
          ALTER TABLE [dbo].[${table}] ADD [${col.name}] ${col.type};
      `);
    }
  }

  console.log('Service order customer identity migration applied');
}

export async function down(knex: Knex): Promise<void> {
  const tables = ['restaurant_orders', 'canteen_sales'];
  const columns = ['customer_name', 'customer_phone', 'apartment_name', 'room_name'];

  for (const table of tables) {
    for (const name of columns) {
      await knex.raw(`
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${name}')
          ALTER TABLE [dbo].[${table}] DROP COLUMN [${name}];
      `);
    }
  }
}
