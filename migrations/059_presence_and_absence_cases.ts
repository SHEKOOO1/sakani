import type { Knex } from 'knex';

/**
 * Residence absence / late-return system.
 *
 * 1. `student_presence` — the last known position of each student, one row per
 *    student (upserted by the PWA presence ping). `inside` is tri-state:
 *    1 = confirmed inside the dorm circle, 0 = confirmed outside, NULL = unknown
 *    (never reported or the reading is too old to trust). Absence is only ever
 *    *confirmed* from a fresh explicit 0, everything else is "unconfirmed".
 *
 * 2. `student_absence_cases` — one case per (tenant, student, lock-date). The
 *    nightly lock-time check opens a case when a student is confirmed outside or
 *    when presence could not be confirmed. A supervisor reviews it and records a
 *    decision (warning / points / fine / terminate / review-only). Financial
 *    effects are linked back through `ledger_entry_id`; termination reuses the
 *    existing archive path, so nothing here deletes records.
 *
 * 3. `students.travel_end_time` — OPTIONAL expected-return time. Travel is open
 *    ended by default (an active trip exempts the student from the lock check
 *    until they register their return); this column only supports monitoring
 *    when the student chooses to provide it.
 *
 * 4. `tenants.notify_guardian_on_exit` — opt-in setting: notify guardians on a
 *    normal check-out (off by default so ordinary movement stays quiet).
 *
 * Additive and reversible: two new tables + two nullable/defaulted columns.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF OBJECT_ID('student_presence') IS NULL
    BEGIN
      CREATE TABLE [dbo].[student_presence] (
        [id]         NVARCHAR(128) NOT NULL PRIMARY KEY,
        [tenant_id]  NVARCHAR(128) NOT NULL,
        [student_id] NVARCHAR(128) NOT NULL,
        [last_lat]   DECIMAL(10,7) NULL,
        [last_lng]   DECIMAL(10,7) NULL,
        [accuracy]   INT           NULL,
        [inside]     BIT           NULL,
        [source]     NVARCHAR(20)  NULL,
        [updated_at] DATETIME2     NOT NULL DEFAULT GETDATE()
      );
    END;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_student_presence_student' AND object_id = OBJECT_ID('student_presence'))
      CREATE UNIQUE INDEX [UX_student_presence_student] ON [dbo].[student_presence] ([student_id]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_student_presence_tenant' AND object_id = OBJECT_ID('student_presence'))
      CREATE INDEX [IX_student_presence_tenant] ON [dbo].[student_presence] ([tenant_id], [updated_at]);
  `);

  await knex.raw(`
    IF OBJECT_ID('student_absence_cases') IS NULL
    BEGIN
      CREATE TABLE [dbo].[student_absence_cases] (
        [id]                    NVARCHAR(128) NOT NULL PRIMARY KEY,
        [tenant_id]             NVARCHAR(128) NOT NULL,
        [student_id]            NVARCHAR(128) NOT NULL,
        [lock_date]             DATE          NOT NULL,
        [lock_time]             NVARCHAR(10)  NULL,
        [state]                 NVARCHAR(20)  NOT NULL DEFAULT 'unconfirmed',
        [evidence_lat]          DECIMAL(10,7) NULL,
        [evidence_lng]          DECIMAL(10,7) NULL,
        [evidence_accuracy]     INT           NULL,
        [evidence_at]           DATETIME2     NULL,
        [notified_supervisor_at] DATETIME2    NULL,
        [notified_guardian_at]  DATETIME2     NULL,
        [last_notified_at]      DATETIME2     NULL,
        [escalation_count]      INT           NOT NULL DEFAULT 0,
        [ack_by]                NVARCHAR(128) NULL,
        [ack_at]                DATETIME2     NULL,
        [decision_action]       NVARCHAR(30)  NULL,
        [decision_notes]        NVARCHAR(MAX) NULL,
        [decided_by]            NVARCHAR(128) NULL,
        [decided_at]            DATETIME2     NULL,
        [escalated_to_priest]   BIT           NOT NULL DEFAULT 0,
        [priest_note]           NVARCHAR(MAX) NULL,
        [fine_amount]           DECIMAL(10,2) NULL,
        [financial_state]       NVARCHAR(20)  NULL,
        [ledger_entry_id]       NVARCHAR(128) NULL,
        [warning_id]            NVARCHAR(128) NULL,
        [created_at]            DATETIME2     NOT NULL DEFAULT GETDATE(),
        [updated_at]            DATETIME2     NULL
      );
    END;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_absence_cases_per_day' AND object_id = OBJECT_ID('student_absence_cases'))
      CREATE UNIQUE INDEX [UX_absence_cases_per_day] ON [dbo].[student_absence_cases] ([tenant_id], [student_id], [lock_date]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_absence_cases_tenant_state' AND object_id = OBJECT_ID('student_absence_cases'))
      CREATE INDEX [IX_absence_cases_tenant_state] ON [dbo].[student_absence_cases] ([tenant_id], [state], [lock_date]);
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'travel_end_time')
      ALTER TABLE [dbo].[students] ADD [travel_end_time] DATETIME2 NULL;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'notify_guardian_on_exit')
      ALTER TABLE [dbo].[tenants] ADD [notify_guardian_on_exit] BIT NOT NULL DEFAULT 0;
  `);

  console.log('Absence: student_presence + student_absence_cases added (tri-state presence, per-day cases)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_absence_cases_tenant_state' AND object_id = OBJECT_ID('student_absence_cases'))
      DROP INDEX [IX_absence_cases_tenant_state] ON [dbo].[student_absence_cases];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_absence_cases_per_day' AND object_id = OBJECT_ID('student_absence_cases'))
      DROP INDEX [UX_absence_cases_per_day] ON [dbo].[student_absence_cases];
    IF OBJECT_ID('student_absence_cases') IS NOT NULL
      DROP TABLE [dbo].[student_absence_cases];

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_student_presence_tenant' AND object_id = OBJECT_ID('student_presence'))
      DROP INDEX [IX_student_presence_tenant] ON [dbo].[student_presence];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_student_presence_student' AND object_id = OBJECT_ID('student_presence'))
      DROP INDEX [UX_student_presence_student] ON [dbo].[student_presence];
    IF OBJECT_ID('student_presence') IS NOT NULL
      DROP TABLE [dbo].[student_presence];

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'travel_end_time')
      ALTER TABLE [dbo].[students] DROP COLUMN [travel_end_time];
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'notify_guardian_on_exit')
      ALTER TABLE [dbo].[tenants] DROP COLUMN [notify_guardian_on_exit];
  `);
}
