import type { Knex } from 'knex';

// Event rules engine + absence review workflow + event scheduling fields.
// Adds:
//  - events: rule_evaluation_mode (FIRST_APPLICABLE | ALL_APPLICABLE),
//    start_time / end_time / duration_minutes (event-level timetable),
//    is_required_attendance (per-event "هل الحضور إجباري؟" default that seeds
//    the rule; the rule remains the effective source of truth).
//  - event_attendance_detailed: final_status (PENDING_REVIEW / UNEXCUSED /
//    EXCUSED / TRAVEL) + reviewed_by / reviewed_at (supervisor absence review),
//    applied_rules_snapshot (the event-rules that fired for this record).
//  - new table event_rules: independent condition+action rules (شرط + فعل)
//    evaluated per record with FIRST_APPLICABLE or ALL_APPLICABLE semantics.
// Every statement is guarded (idempotent) so this migration is safe on any
// existing production database. Mirrors the boot-time guards in db.ts and the
// fresh-DDL contract in schema_mssql.sql (the two must stay in sync).

const ADDITIONAL_COLUMNS = [
  ['events', 'rule_evaluation_mode', "NVARCHAR(30) NOT NULL CONSTRAINT DF_events_rule_eval_mode DEFAULT 'ALL_APPLICABLE' CONSTRAINT CK_events_rule_eval_mode CHECK (rule_evaluation_mode IN ('FIRST_APPLICABLE','ALL_APPLICABLE'))"],
  ['events', 'start_time', 'DATETIME2 NULL'],
  ['events', 'end_time', 'DATETIME2 NULL'],
  ['events', 'duration_minutes', 'INT NULL'],
  ['events', 'is_required_attendance', 'BIT NOT NULL CONSTRAINT DF_events_is_required_attendance DEFAULT 1'],
  ['event_attendance_detailed', 'final_status', "NVARCHAR(30) NULL CONSTRAINT CK_eatd_final_status CHECK (final_status IN ('PENDING_REVIEW','UNEXCUSED','EXCUSED','TRAVEL'))"],
  ['event_attendance_detailed', 'reviewed_by', 'NVARCHAR(128) NULL'],
  ['event_attendance_detailed', 'reviewed_at', 'DATETIME2 NULL'],
  ['event_attendance_detailed', 'applied_rules_snapshot', 'NVARCHAR(MAX) NULL'],
] as const;

export async function up(knex: Knex): Promise<void> {
  // 1) Guarded column additions on existing tables
  const alterStatements = ADDITIONAL_COLUMNS.map(
    ([table, column, definition]) =>
      `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
       ALTER TABLE [dbo].[${table}] ADD [${column}] ${definition};`
  ).join('\n');
  if (alterStatements.trim()) {
    await knex.raw(alterStatements);
  }

  // 2) New table: event_rules (independent condition + action rules)
  await knex.raw(`IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_rules')
  BEGIN
    CREATE TABLE event_rules (
      id NVARCHAR(128) PRIMARY KEY,
      event_id NVARCHAR(128) NOT NULL,
      session_id NVARCHAR(128) NULL,
      tenant_id NVARCHAR(128) NOT NULL,
      condition_status NVARCHAR(30) NOT NULL CHECK (condition_status IN ('late','absent','unexcused')),
      condition_min_late_minutes INT NULL,
      condition_max_late_minutes INT NULL,
      action_type NVARCHAR(40) NOT NULL CHECK (action_type IN ('NONE','DEDUCT_POINTS','FINANCIAL_FEE','SEND_NOTIFICATION','EXCLUDE_FROM_RESIDENCE')),
      points_amount INT NULL,
      fee_amount DECIMAL(10,2) NULL,
      notification_message NVARCHAR(MAX) NULL,
      enabled BIT NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_by NVARCHAR(128) NULL,
      updated_by NVARCHAR(128) NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
  END`);

  // 3) Indexes
  await knex.raw(
    `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_rules_event_enabled' AND object_id = OBJECT_ID('event_rules'))
     CREATE INDEX IX_event_rules_event_enabled ON [dbo].[event_rules] (event_id, enabled);`
  );
  await knex.raw(
    `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_attendance_detailed_final_status' AND object_id = OBJECT_ID('event_attendance_detailed'))
     CREATE INDEX IX_event_attendance_detailed_final_status ON [dbo].[event_attendance_detailed] (event_id, final_status);`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`IF EXISTS (SELECT * FROM sys.tables WHERE name = 'event_rules') DROP TABLE [dbo].[event_rules]`).catch(() => undefined);
}