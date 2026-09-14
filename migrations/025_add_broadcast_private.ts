import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('broadcasts') AND name = 'private_recipient_id')
    ALTER TABLE [dbo].[broadcasts] ADD [private_recipient_id] NVARCHAR(128) NULL;
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('broadcasts') AND name = 'parent_message_id')
    ALTER TABLE [dbo].[broadcasts] ADD [parent_message_id] NVARCHAR(128) NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('broadcasts') AND name = 'parent_message_id')
    ALTER TABLE [dbo].[broadcasts] DROP COLUMN [parent_message_id];
  `);
  await knex.raw(`
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('broadcasts') AND name = 'private_recipient_id')
    ALTER TABLE [dbo].[broadcasts] DROP COLUMN [private_recipient_id];
  `);
}