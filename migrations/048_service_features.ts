import type { Knex } from 'knex';

/**
 * Tenant-level service management + restaurant/canteen systems.
 *
 * Adds per-tenant enable/disable toggles for laundry/restaurant/canteen and
 * the tables backing the restaurant (menu + orders) and canteen (products,
 * stock movements, POS sales, sale items) modules.
 *
 * Idempotent: every DDL/INSERT is guarded, so it is safe on fresh and drifted
 * databases and safe to re-run. Mirrors the boot-time reconciliation in
 * src/backend/infrastructure/db.ts.
 *
 * NOTE: each await is its own SQL batch on purpose — SQL Server compiles a
 * batch before running it, so a statement referencing an object created in the
 * same batch would fail with "Invalid object name". Splitting keeps the DDL
 * visible before dependent statements compile.
 */
export async function up(knex: Knex): Promise<void> {
  // ─── Per-tenant service toggles ───
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'laundry_enabled')
      ALTER TABLE [dbo].[tenants] ADD [laundry_enabled] BIT NOT NULL CONSTRAINT DF_tenants_laundry_enabled DEFAULT 1;
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'restaurant_enabled')
      ALTER TABLE [dbo].[tenants] ADD [restaurant_enabled] BIT NOT NULL CONSTRAINT DF_tenants_restaurant_enabled DEFAULT 1;
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'canteen_enabled')
      ALTER TABLE [dbo].[tenants] ADD [canteen_enabled] BIT NOT NULL CONSTRAINT DF_tenants_canteen_enabled DEFAULT 1;
  `);

  // ─── Restaurant ───
  await createTable(knex, 'restaurant_categories', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [sort_order] INT NOT NULL DEFAULT 0,
    [is_active] BIT NOT NULL DEFAULT 1,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
  `);

  await createTable(knex, 'restaurant_items', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [category_id] NVARCHAR(128) NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [price] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [is_available] BIT NOT NULL DEFAULT 1,
    [is_included_meal] BIT NOT NULL DEFAULT 0,
    [sort_order] INT NOT NULL DEFAULT 0,
    [image_url] NVARCHAR(500) NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
  `);

  await createTable(knex, 'restaurant_operators', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [user_id] NVARCHAR(128) NOT NULL,
    [created_by] NVARCHAR(128) NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
  `);

  await createTable(knex, 'restaurant_orders', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [student_id] NVARCHAR(128) NULL,
    [ordered_by] NVARCHAR(128) NOT NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'pending',
    [meal_slot] NVARCHAR(50) NULL,
    [notes] NVARCHAR(MAX) NULL,
    [total] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [item_count] INT NOT NULL DEFAULT 0,
    [ledger_entry_id] NVARCHAR(128) NULL,
    [processed_by] NVARCHAR(128) NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [cancelled_at] DATETIME2 NULL,
    [cancelled_by] NVARCHAR(128) NULL,
    [cancel_reason] NVARCHAR(MAX) NULL
  `);

  await createTable(knex, 'restaurant_order_items', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [order_id] NVARCHAR(128) NOT NULL,
    [item_id] NVARCHAR(128) NULL,
    [item_name] NVARCHAR(200) NOT NULL,
    [unit_price] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [quantity] INT NOT NULL DEFAULT 1,
    [line_total] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [is_included_meal] BIT NOT NULL DEFAULT 0
  `);

  // ─── Canteen ───
  await createTable(knex, 'canteen_categories', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [sort_order] INT NOT NULL DEFAULT 0,
    [is_active] BIT NOT NULL DEFAULT 1,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
  `);

  await createTable(knex, 'canteen_products', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [category_id] NVARCHAR(128) NULL,
    [name] NVARCHAR(200) NOT NULL,
    [unit] NVARCHAR(20) NOT NULL DEFAULT N'قطعة',
    [barcode] NVARCHAR(128) NULL,
    [cost_price] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [sell_price] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [quantity_on_hand] DECIMAL(12,3) NOT NULL DEFAULT 0,
    [min_quantity] DECIMAL(12,3) NOT NULL DEFAULT 0,
    [is_active] BIT NOT NULL DEFAULT 1,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
  `);

  await createTable(knex, 'canteen_operators', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [user_id] NVARCHAR(128) NOT NULL,
    [created_by] NVARCHAR(128) NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
  `);

  await createTable(knex, 'canteen_stock_movements', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [product_id] NVARCHAR(128) NOT NULL,
    [movement_type] NVARCHAR(20) NOT NULL,
    [quantity] DECIMAL(12,3) NOT NULL,
    [unit_cost] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [note] NVARCHAR(MAX) NULL,
    [actor_id] NVARCHAR(128) NULL,
    [student_id] NVARCHAR(128) NULL,
    [sale_id] NVARCHAR(128) NULL,
    [sale_item_id] NVARCHAR(128) NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
  `);

  await createTable(knex, 'canteen_sales', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [sale_ref] NVARCHAR(64) NOT NULL,
    [operator_id] NVARCHAR(128) NULL,
    [student_id] NVARCHAR(128) NULL,
    [total] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [payment_method] NVARCHAR(20) NOT NULL DEFAULT 'cash',
    [status] NVARCHAR(20) NOT NULL DEFAULT 'completed',
    [ledger_entry_id] NVARCHAR(128) NULL,
    [note] NVARCHAR(MAX) NULL,
    [sold_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
  `);

  await createTable(knex, 'canteen_sale_items', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [sale_id] NVARCHAR(128) NOT NULL,
    [product_id] NVARCHAR(128) NULL,
    [product_name] NVARCHAR(200) NOT NULL,
    [quantity] DECIMAL(12,3) NOT NULL,
    [unit_price] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [line_total] DECIMAL(10,2) NOT NULL DEFAULT 0
  `);

  // ─── Indexes ───
  await createIndex(knex, 'IX_restaurant_categories_tenant', 'restaurant_categories', '[tenant_id]');
  await createIndex(knex, 'IX_restaurant_items_tenant', 'restaurant_items', '[tenant_id]');
  await createIndex(knex, 'IX_restaurant_orders_tenant_status', 'restaurant_orders', '[tenant_id], [status]');
  await createIndex(knex, 'IX_restaurant_order_items_order', 'restaurant_order_items', '[order_id]');
  await createIndex(knex, 'UX_restaurant_operators_tenant_user', 'restaurant_operators', '[tenant_id], [user_id]', true);
  await createIndex(knex, 'IX_canteen_categories_tenant', 'canteen_categories', '[tenant_id]');
  await createIndex(knex, 'IX_canteen_products_tenant', 'canteen_products', '[tenant_id]');
  await createIndex(knex, 'IX_canteen_stock_movements_tenant_product', 'canteen_stock_movements', '[tenant_id], [product_id]');
  await createIndex(knex, 'UX_canteen_operators_tenant_user', 'canteen_operators', '[tenant_id], [user_id]', true);
  await createIndex(knex, 'UX_canteen_sales_tenant_ref', 'canteen_sales', '[tenant_id], [sale_ref]', true);
  await createIndex(knex, 'IX_canteen_sale_items_sale', 'canteen_sale_items', '[sale_id]');

  // ─── Role permission grants (idempotent) ───
  const grants: Array<[string, string]> = [
    ['priest', 'VIEW_RESTAURANT'], ['priest', 'ORDER_RESTAURANT'], ['priest', 'MANAGE_RESTAURANT'], ['priest', 'MANAGE_RESTAURANT_OPERATORS'],
    ['priest', 'VIEW_CANTEEN'], ['priest', 'ORDER_CANTEEN'], ['priest', 'MANAGE_CANTEEN'], ['priest', 'MANAGE_CANTEEN_OPERATORS'],
    ['supervisor', 'VIEW_RESTAURANT'], ['supervisor', 'ORDER_RESTAURANT'], ['supervisor', 'MANAGE_RESTAURANT'], ['supervisor', 'MANAGE_RESTAURANT_OPERATORS'],
    ['supervisor', 'VIEW_CANTEEN'], ['supervisor', 'ORDER_CANTEEN'], ['supervisor', 'MANAGE_CANTEEN'], ['supervisor', 'MANAGE_CANTEEN_OPERATORS'],
    ['assistant_supervisor', 'VIEW_RESTAURANT'], ['assistant_supervisor', 'VIEW_CANTEEN'],
    ['employee', 'VIEW_RESTAURANT'], ['employee', 'VIEW_CANTEEN'],
    ['student', 'VIEW_RESTAURANT'], ['student', 'ORDER_RESTAURANT'], ['student', 'VIEW_CANTEEN'], ['student', 'ORDER_CANTEEN'],
  ];
  for (const [role, permission] of grants) {
    await knex.raw(
      `IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = ? AND permission = ?)
         INSERT INTO role_permissions (role, permission) VALUES (?, ?)`,
      [role, permission, role, permission],
    );
  }

  console.log('Service features migration applied: tenant toggles + restaurant/canteen tables + role permissions');
}

async function createTable(knex: Knex, table: string, columnsSql: string): Promise<void> {
  await knex.raw(`
    IF OBJECT_ID('${table}') IS NULL
    BEGIN
      CREATE TABLE [dbo].[${table}] (${columnsSql});
    END;
  `);
}

async function createIndex(knex: Knex, index: string, table: string, columnsSql: string, unique = false): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${index}' AND object_id = OBJECT_ID('${table}'))
      CREATE ${unique ? 'UNIQUE ' : ''}INDEX [${index}] ON [dbo].[${table}] (${columnsSql});
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF OBJECT_ID('canteen_sale_items') IS NOT NULL DROP TABLE [dbo].[canteen_sale_items];
    IF OBJECT_ID('canteen_sales') IS NOT NULL DROP TABLE [dbo].[canteen_sales];
    IF OBJECT_ID('canteen_stock_movements') IS NOT NULL DROP TABLE [dbo].[canteen_stock_movements];
    IF OBJECT_ID('canteen_operators') IS NOT NULL DROP TABLE [dbo].[canteen_operators];
    IF OBJECT_ID('canteen_products') IS NOT NULL DROP TABLE [dbo].[canteen_products];
    IF OBJECT_ID('canteen_categories') IS NOT NULL DROP TABLE [dbo].[canteen_categories];
    IF OBJECT_ID('restaurant_order_items') IS NOT NULL DROP TABLE [dbo].[restaurant_order_items];
    IF OBJECT_ID('restaurant_orders') IS NOT NULL DROP TABLE [dbo].[restaurant_orders];
    IF OBJECT_ID('restaurant_operators') IS NOT NULL DROP TABLE [dbo].[restaurant_operators];
    IF OBJECT_ID('restaurant_items') IS NOT NULL DROP TABLE [dbo].[restaurant_items];
    IF OBJECT_ID('restaurant_categories') IS NOT NULL DROP TABLE [dbo].[restaurant_categories];
  `);

  const grants: Array<[string, string]> = [
    ['priest', 'VIEW_RESTAURANT'], ['priest', 'ORDER_RESTAURANT'], ['priest', 'MANAGE_RESTAURANT'], ['priest', 'MANAGE_RESTAURANT_OPERATORS'],
    ['priest', 'VIEW_CANTEEN'], ['priest', 'ORDER_CANTEEN'], ['priest', 'MANAGE_CANTEEN'], ['priest', 'MANAGE_CANTEEN_OPERATORS'],
    ['supervisor', 'VIEW_RESTAURANT'], ['supervisor', 'ORDER_RESTAURANT'], ['supervisor', 'MANAGE_RESTAURANT'], ['supervisor', 'MANAGE_RESTAURANT_OPERATORS'],
    ['supervisor', 'VIEW_CANTEEN'], ['supervisor', 'ORDER_CANTEEN'], ['supervisor', 'MANAGE_CANTEEN'], ['supervisor', 'MANAGE_CANTEEN_OPERATORS'],
    ['assistant_supervisor', 'VIEW_RESTAURANT'], ['assistant_supervisor', 'VIEW_CANTEEN'],
    ['employee', 'VIEW_RESTAURANT'], ['employee', 'VIEW_CANTEEN'],
    ['student', 'VIEW_RESTAURANT'], ['student', 'ORDER_RESTAURANT'], ['student', 'VIEW_CANTEEN'], ['student', 'ORDER_CANTEEN'],
  ];
  for (const [role, permission] of grants) {
    await knex('role_permissions').where({ role, permission }).delete();
  }

  // Tenant toggle columns are additive and may hold live state; left in place.
}