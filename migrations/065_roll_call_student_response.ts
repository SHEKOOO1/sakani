import type { Knex } from 'knex';

/**
 * Student self-response for the night roll-call (المناداة).
 *
 * The roll-call is now also pushed to each student's device as a mandatory
 * popup: "are you inside the dorm?". The student's own answer is recorded on
 * their roll-call entry, kept separate from the supervisor's draft mark so the
 * supervisor can always see BOTH (what the student claimed vs. the GPS hint and
 * the final decision):
 *
 *   · roll_calls.published_at          — when the sheet was pushed to students
 *                                        (so the auto-scheduler pushes only once).
 *   · roll_call_entries.answer_at      — when the student answered.
 *   · roll_call_entries.answer_mark    — the student's claim: present | absent.
 *   · roll_call_entries.answer_inside  — the server's geofence verdict at answer
 *                                        time (1 inside, 0 outside, NULL unknown).
 *
 * Additive and reversible: four nullable columns.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('roll_calls') AND name = 'published_at')
      ALTER TABLE [dbo].[roll_calls] ADD [published_at] DATETIME2 NULL;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('roll_call_entries') AND name = 'answer_at')
      ALTER TABLE [dbo].[roll_call_entries] ADD [answer_at] DATETIME2 NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('roll_call_entries') AND name = 'answer_mark')
      ALTER TABLE [dbo].[roll_call_entries] ADD [answer_mark] NVARCHAR(20) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('roll_call_entries') AND name = 'answer_inside')
      ALTER TABLE [dbo].[roll_call_entries] ADD [answer_inside] BIT NULL;
  `);

  console.log('Roll-call: student self-response columns added (published_at + answer_*)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('roll_call_entries') AND name = 'answer_inside')
      ALTER TABLE [dbo].[roll_call_entries] DROP COLUMN [answer_inside];
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('roll_call_entries') AND name = 'answer_mark')
      ALTER TABLE [dbo].[roll_call_entries] DROP COLUMN [answer_mark];
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('roll_call_entries') AND name = 'answer_at')
      ALTER TABLE [dbo].[roll_call_entries] DROP COLUMN [answer_at];
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('roll_calls') AND name = 'published_at')
      ALTER TABLE [dbo].[roll_calls] DROP COLUMN [published_at];
  `);
}
