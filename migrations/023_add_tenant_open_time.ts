import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'open_time')
    ALTER TABLE [dbo].[tenants] ADD [open_time] NVARCHAR(20) NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'open_time')
    ALTER TABLE [dbo].[tenants] DROP COLUMN [open_time];
  `);
}