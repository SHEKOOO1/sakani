import type { Knex } from 'knex';

/**
 * Supervisor roll-call (المناداة) — the human-confirmed replacement for the
 * GPS-only lock-time absence check.
 *
 * Instead of trusting a phone's background location, a supervisor opens a
 * roll-call for the night and marks each resident present/absent. Only the
 * residents that stay unmarked or are explicitly marked absent become absence
 * cases — and even then NO guardian/supervisor notification is sent from the
 * roll-call itself; a human must still record a decision (warning/fine/...) on
 * the case before anyone is notified or penalised.
 *
 * 1. `roll_calls` — one session per (tenant, lock_date). Stores who started and
 *    submitted it, the snapshot of the curfew time, and the tallies.
 *
 * 2. `roll_call_entries` — one row per student in the session. `mark` is
 *    present | absent | unmarked; `presence_status` is the (optional) GPS hint
 *    captured at snapshot time; `absence_case_id` links the created case.
 *
 * 3. `student_absence_cases.source` + `.roll_call_id` — record that a case came
 *    from a roll-call rather than the legacy scheduler.
 *
 * Additive and reversible: two new tables + two nullable columns + one index.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF OBJECT_ID('roll_calls') IS NULL
    BEGIN
      CREATE TABLE [dbo].[roll_calls] (
        [id]             NVARCHAR(128) NOT NULL PRIMARY KEY,
        [tenant_id]      NVARCHAR(128) NOT NULL,
        [lock_date]      DATE          NOT NULL,
        [lock_time]      NVARCHAR(10)  NULL,
        [state]          NVARCHAR(20)  NOT NULL DEFAULT 'open',
        [present_count]  INT           NOT NULL DEFAULT 0,
        [absent_count]   INT           NOT NULL DEFAULT 0,
        [unmarked_count] INT           NOT NULL DEFAULT 0,
        [excluded_count] INT           NOT NULL DEFAULT 0,
        [notes]          NVARCHAR(MAX) NULL,
        [started_by]     NVARCHAR(128) NULL,
        [started_at]     DATETIME2     NOT NULL DEFAULT GETDATE(),
        [submitted_by]   NVARCHAR(128) NULL,
        [submitted_at]   DATETIME2     NULL,
        [created_at]     DATETIME2     NOT NULL DEFAULT GETDATE(),
        [updated_at]     DATETIME2     NULL
      );
    END;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_roll_calls_per_day' AND object_id = OBJECT_ID('roll_calls'))
      CREATE UNIQUE INDEX [UX_roll_calls_per_day] ON [dbo].[roll_calls] ([tenant_id], [lock_date]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_roll_calls_tenant_state' AND object_id = OBJECT_ID('roll_calls'))
      CREATE INDEX [IX_roll_calls_tenant_state] ON [dbo].[roll_calls] ([tenant_id], [state], [lock_date]);
  `);

  await knex.raw(`
    IF OBJECT_ID('roll_call_entries') IS NULL
    BEGIN
      CREATE TABLE [dbo].[roll_call_entries] (
        [id]                NVARCHAR(128) NOT NULL PRIMARY KEY,
        [roll_call_id]      NVARCHAR(128) NOT NULL,
        [tenant_id]         NVARCHAR(128) NOT NULL,
        [student_id]        NVARCHAR(128) NOT NULL,
        [student_name]      NVARCHAR(255) NULL,
        [mark]              NVARCHAR(20)  NOT NULL DEFAULT 'unmarked',
        [presence_status]   NVARCHAR(20)  NULL,
        [is_traveling]      BIT           NOT NULL DEFAULT 0,
        [evidence_lat]      DECIMAL(10,7) NULL,
        [evidence_lng]      DECIMAL(10,7) NULL,
        [evidence_accuracy] INT           NULL,
        [evidence_at]       DATETIME2     NULL,
        [note]              NVARCHAR(MAX) NULL,
        [absence_case_id]   NVARCHAR(128) NULL,
        [created_at]        DATETIME2     NOT NULL DEFAULT GETDATE(),
        [updated_at]        DATETIME2     NULL
      );
    END;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_roll_call_entries_student' AND object_id = OBJECT_ID('roll_call_entries'))
      CREATE UNIQUE INDEX [UX_roll_call_entries_student] ON [dbo].[roll_call_entries] ([roll_call_id], [student_id]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_roll_call_entries_tenant' AND object_id = OBJECT_ID('roll_call_entries'))
      CREATE INDEX [IX_roll_call_entries_tenant] ON [dbo].[roll_call_entries] ([tenant_id], [roll_call_id]);
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('student_absence_cases') AND name = 'source')
      ALTER TABLE [dbo].[student_absence_cases] ADD [source] NVARCHAR(20) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('student_absence_cases') AND name = 'roll_call_id')
      ALTER TABLE [dbo].[student_absence_cases] ADD [roll_call_id] NVARCHAR(128) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_absence_cases_roll_call' AND object_id = OBJECT_ID('student_absence_cases'))
      CREATE INDEX [IX_absence_cases_roll_call] ON [dbo].[student_absence_cases] ([roll_call_id]);
  `);

  console.log('Roll-call: roll_calls + roll_call_entries added; absence cases linked to roll-call');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_absence_cases_roll_call' AND object_id = OBJECT_ID('student_absence_cases'))
      DROP INDEX [IX_absence_cases_roll_call] ON [dbo].[student_absence_cases];
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('student_absence_cases') AND name = 'roll_call_id')
      ALTER TABLE [dbo].[student_absence_cases] DROP COLUMN [roll_call_id];
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('student_absence_cases') AND name = 'source')
      ALTER TABLE [dbo].[student_absence_cases] DROP COLUMN [source];
  `);

  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_roll_call_entries_tenant' AND object_id = OBJECT_ID('roll_call_entries'))
      DROP INDEX [IX_roll_call_entries_tenant] ON [dbo].[roll_call_entries];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_roll_call_entries_student' AND object_id = OBJECT_ID('roll_call_entries'))
      DROP INDEX [UX_roll_call_entries_student] ON [dbo].[roll_call_entries];
    IF OBJECT_ID('roll_call_entries') IS NOT NULL
      DROP TABLE [dbo].[roll_call_entries];

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_roll_calls_tenant_state' AND object_id = OBJECT_ID('roll_calls'))
      DROP INDEX [IX_roll_calls_tenant_state] ON [dbo].[roll_calls];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_roll_calls_per_day' AND object_id = OBJECT_ID('roll_calls'))
      DROP INDEX [UX_roll_calls_per_day] ON [dbo].[roll_calls];
    IF OBJECT_ID('roll_calls') IS NOT NULL
      DROP TABLE [dbo].[roll_calls];
  `);
}
