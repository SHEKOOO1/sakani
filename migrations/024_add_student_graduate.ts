import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'is_graduate')
    ALTER TABLE [dbo].[students] ADD [is_graduate] BIT NOT NULL DEFAULT 0;
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'graduation_date')
    ALTER TABLE [dbo].[students] ADD [graduation_date] DATETIME2 NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'graduation_date')
    ALTER TABLE [dbo].[students] DROP COLUMN [graduation_date];
  `);
  await knex.raw(`
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'is_graduate')
    ALTER TABLE [dbo].[students] DROP COLUMN [is_graduate];
  `);
}