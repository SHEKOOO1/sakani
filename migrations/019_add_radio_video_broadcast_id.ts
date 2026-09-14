import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF COL_LENGTH('radio_videos', 'broadcast_id') IS NULL
      ALTER TABLE [dbo].[radio_videos] ADD [broadcast_id] NVARCHAR(128) NULL;
  `);
  console.log("✅ Added broadcast_id column to radio_videos");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF COL_LENGTH('radio_videos', 'broadcast_id') IS NOT NULL
      ALTER TABLE [dbo].[radio_videos] DROP COLUMN [broadcast_id];
  `);
}
