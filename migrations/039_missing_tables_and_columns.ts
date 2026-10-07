import type { Knex } from 'knex';

/**
 * Reconciles remaining drift between the application contract and the live DB:
 * - columns the app/UI read or write but the baseline never created
 * - tables that were never migrated (laundry sessions, inventory, complaints,
 *   standalone-competition teams/participants)
 *
 * NOTE: each await is its own SQL batch on purpose. SQL Server compiles a batch
 * before executing it, so a DML/DML statement that references a column/table
 * created earlier in the *same* batch fails with "Invalid column name" /
 * "Invalid object name". Splitting them makes the DDL visible before the
 * dependent statement is compiled.
 *
 * Idempotent: safe on fresh and drifted databases, and safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'class_name')
      ALTER TABLE [dbo].[students] ADD [class_name] NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'national_id')
      ALTER TABLE [dbo].[users] ADD [national_id] NVARCHAR(50) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'price_daily')
      ALTER TABLE [dbo].[rooms] ADD [price_daily] DECIMAL(18,2) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'price_monthly')
      ALTER TABLE [dbo].[rooms] ADD [price_monthly] DECIMAL(18,2) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'price_semester')
      ALTER TABLE [dbo].[rooms] ADD [price_semester] DECIMAL(18,2) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'requester_id')
      ALTER TABLE [dbo].[maintenance_requests] ADD [requester_id] NVARCHAR(128) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'apartment_id')
      ALTER TABLE [dbo].[maintenance_requests] ADD [apartment_id] NVARCHAR(128) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'room_id')
      ALTER TABLE [dbo].[maintenance_requests] ADD [room_id] NVARCHAR(128) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'priority')
      ALTER TABLE [dbo].[maintenance_requests] ADD [priority] NVARCHAR(20) NULL;
  `);

  await knex.raw(`
    UPDATE [dbo].[maintenance_requests] SET [requester_id] = [user_id]
      WHERE [requester_id] IS NULL AND [user_id] IS NOT NULL;
  `);

  // laundry_machines: the baseline created an int PK with no tenant scope, which
  // cannot hold the uuid string ids the API generates. Recreate when that is the case.
  await knex.raw(`
    IF OBJECT_ID('laundry_machines') IS NOT NULL
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('laundry_machines') AND name = 'id'
                   AND TYPE_NAME(user_type_id) IN ('int','bigint','smallint'))
      DROP TABLE [dbo].[laundry_machines];
  `);
  await knex.raw(`
    IF OBJECT_ID('laundry_machines') IS NULL
    BEGIN
      CREATE TABLE [dbo].[laundry_machines] (
        [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NULL,
        [name] NVARCHAR(255) NOT NULL,
        [status] NVARCHAR(20) NULL DEFAULT 'available',
        [created_at] DATETIME2 NULL DEFAULT GETDATE()
      );
    END;
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('laundry_machines') AND name = 'tenant_id')
      ALTER TABLE [dbo].[laundry_machines] ADD [tenant_id] NVARCHAR(128) NULL;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('laundry_queue') AND name = 'machine_id')
      ALTER TABLE [dbo].[laundry_queue] ADD [machine_id] NVARCHAR(128) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('laundry_queue') AND name = 'joined_at')
      ALTER TABLE [dbo].[laundry_queue] ADD [joined_at] DATETIME2 NULL DEFAULT GETDATE();
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('laundry_queue') AND name = 'called_at')
      ALTER TABLE [dbo].[laundry_queue] ADD [called_at] DATETIME2 NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('laundry_queue') AND name = 'finished_at')
      ALTER TABLE [dbo].[laundry_queue] ADD [finished_at] DATETIME2 NULL;
  `);

  await createTable(knex, 'laundry_sessions', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [operator_id] NVARCHAR(128) NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'active',
    [start_at] DATETIME2 NULL DEFAULT GETDATE(),
    [end_at] DATETIME2 NULL,
    [created_at] DATETIME2 NULL DEFAULT GETDATE()
  `);
  await createIndex(knex, 'IX_laundry_sessions_tenant', 'laundry_sessions', '[tenant_id]');

  await createTable(knex, 'inventory', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [category] NVARCHAR(100) NULL,
    [quantity] INT NULL,
    [unit] NVARCHAR(50) NULL,
    [min_quantity] INT NULL,
    [created_at] DATETIME2 NULL DEFAULT GETDATE()
  `);
  await createIndex(knex, 'IX_inventory_tenant', 'inventory', '[tenant_id]');

  await createTable(knex, 'complaints', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [tenant_id] NVARCHAR(128) NOT NULL,
    [user_id] NVARCHAR(128) NULL,
    [title] NVARCHAR(255) NULL,
    [description] NVARCHAR(MAX) NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'pending',
    [created_at] DATETIME2 NULL DEFAULT GETDATE()
  `);
  await createIndex(knex, 'IX_complaints_tenant', 'complaints', '[tenant_id]');

  await createTable(knex, 'competition_participants', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [competition_id] NVARCHAR(128) NOT NULL,
    [student_id] NVARCHAR(128) NOT NULL,
    [created_at] DATETIME2 NULL DEFAULT GETDATE()
  `);
  await createIndex(knex, 'UX_competition_participants', 'competition_participants', '[competition_id], [student_id]', true);

  await createTable(knex, 'competition_teams', `
    [id] NVARCHAR(128) NOT NULL PRIMARY KEY,
    [competition_id] NVARCHAR(128) NOT NULL,
    [tenant_id] NVARCHAR(128) NULL,
    [name] NVARCHAR(255) NULL,
    [score] INT NULL DEFAULT 0,
    [responsible_id] NVARCHAR(128) NULL,
    [created_at] DATETIME2 NULL DEFAULT GETDATE()
  `);
  await createIndex(knex, 'IX_competition_teams_competition', 'competition_teams', '[competition_id]');

  await createTable(knex, 'competition_team_members', `
    [team_id] NVARCHAR(128) NOT NULL,
    [student_id] NVARCHAR(128) NOT NULL,
    [points_earned] INT NULL DEFAULT 0
  `);
  await createIndex(knex, 'IX_competition_team_members_team', 'competition_team_members', '[team_id]');

  console.log('Reconciled missing columns/tables: students.class_name, users.national_id, rooms prices, maintenance_requests requester/apartment/room/priority, laundry_machines/queue/sessions, inventory, complaints, competition_*');
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
  // Additive reconciliation required by the application; no rollback.
}
