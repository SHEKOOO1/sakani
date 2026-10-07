import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'created_by')
    ALTER TABLE [dbo].[competitions] ADD [created_by] NVARCHAR(128);

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'prize_points')
    ALTER TABLE [dbo].[competitions] ADD [prize_points] INT;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'questions_count')
    ALTER TABLE [dbo].[competitions] ADD [questions_count] INT;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'responsible_id')
    ALTER TABLE [dbo].[competitions] ADD [responsible_id] NVARCHAR(128);

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'status')
    ALTER TABLE [dbo].[competitions] ADD [status] NVARCHAR(50);
  `);
  console.log('Ensured competitions columns (created_by, prize_points, questions_count, responsible_id, status)');
}

export async function down(knex: Knex): Promise<void> {
  // Additive columns used by the competitions API; no rollback.
}