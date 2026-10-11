import type { Knex } from 'knex';

/**
 * Restaurant/canteen pricing enrichments: per-item discounts and product images.
 *
 * Adds to restaurant_items and canteen_products a discount (either a percentage
 * or a fixed amount) and, for canteen products, an image URL. The order/sale
 * line tables gain the original price and the discount amount so receipts can
 * show "before / discount / after".
 *
 * Idempotent: every ALTER is guarded with IF NOT EXISTS on sys.columns, so it is
 * safe on fresh and drifted databases and safe to re-run. Mirrors the boot-time
 * reconciliation in src/backend/infrastructure/db.ts.
 */
export async function up(knex: Knex): Promise<void> {
  const columns: Array<{ table: string; name: string; sql: string }> = [
    // restaurant menu items: discount
    { table: 'restaurant_items', name: 'discount_type', sql: `ALTER TABLE [dbo].[restaurant_items] ADD [discount_type] NVARCHAR(10) NULL;` },
    { table: 'restaurant_items', name: 'discount_value', sql: `ALTER TABLE [dbo].[restaurant_items] ADD [discount_value] DECIMAL(10,2) NOT NULL CONSTRAINT DF_restaurant_items_discount_value DEFAULT 0;` },
    // restaurant order lines: original price + discount amount
    { table: 'restaurant_order_items', name: 'original_unit_price', sql: `ALTER TABLE [dbo].[restaurant_order_items] ADD [original_unit_price] DECIMAL(10,2) NOT NULL CONSTRAINT DF_restaurant_order_items_orig DEFAULT 0;` },
    { table: 'restaurant_order_items', name: 'discount_amount', sql: `ALTER TABLE [dbo].[restaurant_order_items] ADD [discount_amount] DECIMAL(10,2) NOT NULL CONSTRAINT DF_restaurant_order_items_disc DEFAULT 0;` },
    // canteen products: image + discount
    { table: 'canteen_products', name: 'image_url', sql: `ALTER TABLE [dbo].[canteen_products] ADD [image_url] NVARCHAR(500) NULL;` },
    { table: 'canteen_products', name: 'discount_type', sql: `ALTER TABLE [dbo].[canteen_products] ADD [discount_type] NVARCHAR(10) NULL;` },
    { table: 'canteen_products', name: 'discount_value', sql: `ALTER TABLE [dbo].[canteen_products] ADD [discount_value] DECIMAL(10,2) NOT NULL CONSTRAINT DF_canteen_products_discount_value DEFAULT 0;` },
    // canteen sale lines: original price + discount amount
    { table: 'canteen_sale_items', name: 'original_unit_price', sql: `ALTER TABLE [dbo].[canteen_sale_items] ADD [original_unit_price] DECIMAL(10,2) NOT NULL CONSTRAINT DF_canteen_sale_items_orig DEFAULT 0;` },
    { table: 'canteen_sale_items', name: 'discount_amount', sql: `ALTER TABLE [dbo].[canteen_sale_items] ADD [discount_amount] DECIMAL(10,2) NOT NULL CONSTRAINT DF_canteen_sale_items_disc DEFAULT 0;` },
  ];

  for (const col of columns) {
    await knex.raw(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${col.table}') AND name = '${col.name}')
        ${col.sql}
    `);
  }

  console.log('Restaurant/canteen discounts + images migration applied');
}

export async function down(knex: Knex): Promise<void> {
  const drops: Array<{ table: string; name: string; constraint?: string }> = [
    { table: 'restaurant_items', name: 'discount_type' },
    { table: 'restaurant_items', name: 'discount_value', constraint: 'DF_restaurant_items_discount_value' },
    { table: 'restaurant_order_items', name: 'original_unit_price', constraint: 'DF_restaurant_order_items_orig' },
    { table: 'restaurant_order_items', name: 'discount_amount', constraint: 'DF_restaurant_order_items_disc' },
    { table: 'canteen_products', name: 'image_url' },
    { table: 'canteen_products', name: 'discount_type' },
    { table: 'canteen_products', name: 'discount_value', constraint: 'DF_canteen_products_discount_value' },
    { table: 'canteen_sale_items', name: 'original_unit_price', constraint: 'DF_canteen_sale_items_orig' },
    { table: 'canteen_sale_items', name: 'discount_amount', constraint: 'DF_canteen_sale_items_disc' },
  ];
  for (const col of drops) {
    await knex.raw(`
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${col.table}') AND name = '${col.name}')
      BEGIN
        ${col.constraint ? `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = '${col.constraint}') ALTER TABLE [dbo].[${col.table}] DROP CONSTRAINT [${col.constraint}];` : ''}
        ALTER TABLE [dbo].[${col.table}] DROP COLUMN [${col.name}];
      END
    `);
  }
}
