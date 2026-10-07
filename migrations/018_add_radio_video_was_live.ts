import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF COL_LENGTH('radio_videos', 'was_live') IS NULL
      ALTER TABLE [dbo].[radio_videos] ADD [was_live] BIT NOT NULL DEFAULT 0;
  `);
  console.log("✅ Added was_live column to radio_videos");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF COL_LENGTH('radio_videos', 'was_live') IS NOT NULL
      ALTER TABLE [dbo].[radio_videos] DROP COLUMN [was_live];
  `);
}
