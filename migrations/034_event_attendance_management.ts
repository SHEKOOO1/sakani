import type { Knex } from 'knex';

// Event/Session Attendance Management System.
// Extends the existing event attendance stack (event_sessions,
// event_attendance_detailed, student_warnings, student_points, finances,
// event_responsible) and adds the rule engine / penalty / excuse / policy /
// disciplinary-case tables. Every statement is guarded (idempotent) so this
// migration is safe to run on any existing production database.

const ADDITIONAL_COLUMNS = [
  // event_sessions → session lifecycle state
  ["event_sessions", "status", "NVARCHAR(20) NOT NULL CONSTRAINT DF_event_sessions_status DEFAULT 'scheduled'"],
  ['event_sessions', 'opened_by', 'NVARCHAR(128) NULL'],
  ['event_sessions', 'opened_at', 'DATETIME2 NULL'],
  ['event_sessions', 'closed_by', 'NVARCHAR(128) NULL'],
  ['event_sessions', 'closed_at', 'DATETIME2 NULL'],
  ['event_sessions', 'updated_at', 'DATETIME2 NULL'],
  // event_attendance_detailed → the attendance record (scan + penalty columns)
  ['event_attendance_detailed', 'checked_in_at', 'DATETIME2 NULL'],
  ['event_attendance_detailed', 'scheduled_at', 'DATETIME2 NULL'],
  ['event_attendance_detailed', 'late_minutes', 'INT NULL'],
  ['event_attendance_detailed', 'grace_minutes', 'INT NULL'],
  ['event_attendance_detailed', 'rule_snapshot', 'NVARCHAR(MAX) NULL'],
  ['event_attendance_detailed', 'penalty_mode', 'NVARCHAR(20) NULL'],
  ['event_attendance_detailed', 'penalty_amount', 'DECIMAL(10,2) NULL'],
  ['event_attendance_detailed', 'penalty_points', 'INT NULL'],
  ['event_attendance_detailed', 'penalty_applied', 'BIT DEFAULT 0'],
  ['event_attendance_detailed', 'penalty_status', 'NVARCHAR(20) NULL'],
  ['event_attendance_detailed', 'check_in_method', 'NVARCHAR(50) NULL'],
  ['event_attendance_detailed', 'is_required_attendance', 'BIT DEFAULT 1'],
  ['event_attendance_detailed', 'attendance_weight', 'DECIMAL(5,2) DEFAULT 1'],
  ['event_attendance_detailed', 'counts_toward_absence_limit', 'BIT DEFAULT 1'],
  ['event_attendance_detailed', 'absence_processed', 'BIT DEFAULT 0'],
  ['event_attendance_detailed', 'absence_processed_at', 'DATETIME2 NULL'],
  ['event_attendance_detailed', 'unexcused', 'BIT DEFAULT 0'],
  ['event_attendance_detailed', 'updated_at', 'DATETIME2 NULL'],
  // student_warnings → typed attendance warnings
  ['student_warnings', 'warning_type', 'NVARCHAR(30) NULL'],
  ['student_warnings', 'threshold', 'INT NULL'],
  ['student_warnings', 'unexcused_absence_count_at_time', 'INT NULL'],
  ['student_warnings', 'policy_version', 'INT NULL'],
  ['student_warnings', 'attendance_id', 'NVARCHAR(128) NULL'],
  ['student_warnings', 'is_attendance_warning', 'BIT DEFAULT 0'],
  // student_points → penalty linkage (append-only ledger stays untouched)
  ['student_points', 'event_id', 'NVARCHAR(128) NULL'],
  ['student_points', 'session_id', 'NVARCHAR(128) NULL'],
  ['student_points', 'attendance_id', 'NVARCHAR(128) NULL'],
  ['student_points', 'reference', 'NVARCHAR(255) NULL'],
  ['student_points', 'is_reversal', 'BIT DEFAULT 0'],
  ['student_points', 'reversal_of_id', 'NVARCHAR(128) NULL'],
  // finances → penalty linkage (no silent rewrites: reversals are new rows)
  ['finances', 'event_id', 'NVARCHAR(128) NULL'],
  ['finances', 'session_id', 'NVARCHAR(128) NULL'],
  ['finances', 'attendance_id', 'NVARCHAR(128) NULL'],
  ['finances', 'reference', 'NVARCHAR(255) NULL'],
  ['finances', 'is_reversal', 'BIT DEFAULT 0'],
  ['finances', 'reversal_of_id', 'NVARCHAR(128) NULL'],
  // event_responsible → operator semantics for event attendance scanning
  ['event_responsible', 'attendance_operator', 'BIT DEFAULT 1'],
  ['event_responsible', 'assigned_by', 'NVARCHAR(128) NULL'],
  ['event_responsible', 'created_at', 'DATETIME2 DEFAULT GETDATE()'],
  ['event_attendance_rules', 'base_points', 'INT NULL'],
] as const;

const ADDITIONAL_INDEXES = [
  ['IX_event_attendance_detailed_event_id', 'event_attendance_detailed', '[event_id]'],
  ['IX_event_attendance_detailed_student_id', 'event_attendance_detailed', '[student_id]'],
  ['IX_event_attendance_detailed_status', 'event_attendance_detailed', '[status]'],
  ['IX_event_sessions_event_id', 'event_sessions', '[event_id]'],
  ['IX_event_responsible_event_user', 'event_responsible', '[event_id], [user_id]'],
  ['IX_attendance_penalties_student_id', 'attendance_penalties', '[student_id]'],
  ['IX_attendance_excuses_student_id', 'attendance_excuses', '[student_id]'],
  ['IX_attendance_excuses_attendance_id', 'attendance_excuses', '[attendance_id]'],
  ['IX_disciplinary_cases_student_id', 'disciplinary_cases', '[student_id]'],
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

  // 2) New tables
  await knex.raw(`IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_attendance_rules')
  BEGIN
    CREATE TABLE event_attendance_rules (
      id NVARCHAR(128) PRIMARY KEY,
      event_id NVARCHAR(128) NOT NULL,
      session_id NVARCHAR(128) NULL,
      tenant_id NVARCHAR(128) NOT NULL,
      grace_period_minutes INT NOT NULL DEFAULT 0,
      penalty_mode NVARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (penalty_mode IN ('NONE','FINANCIAL','POINTS','BOTH')),
      base_penalty DECIMAL(10,2) NOT NULL DEFAULT 0,
      base_points INT NOT NULL DEFAULT 0,
      additional_penalty DECIMAL(10,2) NOT NULL DEFAULT 0,
      additional_penalty_unit NVARCHAR(20) NOT NULL DEFAULT 'PER_MINUTE' CHECK (additional_penalty_unit IN ('PER_MINUTE','PER_BLOCK','FIXED')),
      additional_penalty_block_minutes INT NOT NULL DEFAULT 1,
      maximum_penalty DECIMAL(10,2) NULL,
      maximum_points_deduction INT NULL,
      absent_after_minutes INT NULL,
      auto_apply_penalty BIT NOT NULL DEFAULT 1,
      enabled BIT NOT NULL DEFAULT 1,
      tiers NVARCHAR(MAX) NULL,
      required_attendance BIT NOT NULL DEFAULT 1,
      counts_toward_absence_limit BIT NOT NULL DEFAULT 1,
      attendance_weight DECIMAL(5,2) NOT NULL DEFAULT 1,
      created_by NVARCHAR(128) NULL,
      updated_by NVARCHAR(128) NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE(),
      CONSTRAINT UQ_Event_Attendance_Rule UNIQUE (event_id, session_id)
    );
  END`);

  await knex.raw(`IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance_penalties')
  BEGIN
    CREATE TABLE attendance_penalties (
      id NVARCHAR(128) PRIMARY KEY,
      attendance_id NVARCHAR(128) NOT NULL,
      student_id NVARCHAR(128) NOT NULL,
      event_id NVARCHAR(128) NOT NULL,
      session_id NVARCHAR(128) NULL,
      tenant_id NVARCHAR(128) NOT NULL,
      mode NVARCHAR(20) NOT NULL CHECK (mode IN ('FINANCIAL','POINTS','BOTH')),
      financial_amount DECIMAL(10,2) NULL,
      points_deduction INT NULL,
      status NVARCHAR(20) NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED','REVERSED','ADJUSTED')),
      reversal_of_id NVARCHAR(128) NULL,
      rule_snapshot NVARCHAR(MAX) NULL,
      policy_version INT NULL,
      reason NVARCHAR(MAX) NULL,
      finance_id NVARCHAR(128) NULL,
      points_ledger_id NVARCHAR(128) NULL,
      created_by NVARCHAR(128) NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      reversed_by NVARCHAR(128) NULL,
      reversed_at DATETIME2 NULL,
      reversal_reason NVARCHAR(MAX) NULL
    );
  END`);

  await knex.raw(`IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance_excuses')
  BEGIN
    CREATE TABLE attendance_excuses (
      id NVARCHAR(128) PRIMARY KEY,
      student_id NVARCHAR(128) NOT NULL,
      event_id NVARCHAR(128) NOT NULL,
      session_id NVARCHAR(128) NULL,
      attendance_id NVARCHAR(128) NULL,
      tenant_id NVARCHAR(128) NOT NULL,
      reason NVARCHAR(MAX) NOT NULL,
      notes NVARCHAR(MAX) NULL,
      submitted_by NVARCHAR(128) NOT NULL,
      submitted_by_role NVARCHAR(50) NULL,
      submitted_at DATETIME2 DEFAULT GETDATE(),
      status NVARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
      decided_by NVARCHAR(128) NULL,
      decided_at DATETIME2 NULL,
      decided_notes NVARCHAR(MAX) NULL
    );
  END`);

  await knex.raw(`IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance_policy')
  BEGIN
    CREATE TABLE attendance_policy (
      tenant_id NVARCHAR(128) PRIMARY KEY,
      enforce_absence_thresholds BIT NOT NULL DEFAULT 1,
      weighted_attendance_enabled BIT NOT NULL DEFAULT 0,
      warning_1_threshold INT NOT NULL DEFAULT 1,
      warning_2_threshold INT NOT NULL DEFAULT 2,
      final_warning_threshold INT NOT NULL DEFAULT 3,
      disciplinary_review_threshold INT NOT NULL DEFAULT 4,
      residence_termination_review_threshold INT NOT NULL DEFAULT 5,
      excuse_time_limit_hours INT NOT NULL DEFAULT 48,
      parent_notify_on_absence BIT NOT NULL DEFAULT 1,
      parent_notify_on_late BIT NOT NULL DEFAULT 0,
      parent_notify_on_warning BIT NOT NULL DEFAULT 1,
      version INT NOT NULL DEFAULT 1,
      created_by NVARCHAR(128) NULL,
      updated_by NVARCHAR(128) NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE()
    );
  END`);

  await knex.raw(`IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance_policy_versions')
  BEGIN
    CREATE TABLE attendance_policy_versions (
      id NVARCHAR(128) PRIMARY KEY,
      tenant_id NVARCHAR(128) NOT NULL,
      version INT NOT NULL,
      snapshot NVARCHAR(MAX) NOT NULL,
      changed_by NVARCHAR(128) NULL,
      changed_at DATETIME2 DEFAULT GETDATE(),
      note NVARCHAR(MAX) NULL,
      CONSTRAINT UQ_Attendance_Policy_Version UNIQUE (tenant_id, version)
    );
  END`);

  await knex.raw(`IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'disciplinary_cases')
  BEGIN
    CREATE TABLE disciplinary_cases (
      id NVARCHAR(128) PRIMARY KEY,
      tenant_id NVARCHAR(128) NOT NULL,
      student_id NVARCHAR(128) NOT NULL,
      case_type NVARCHAR(50) NOT NULL CHECK (case_type IN ('DISCIPLINARY_REVIEW','RESIDENCE_TERMINATION_REVIEW')),
      status NVARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','UNDER_REVIEW','APPROVED','REJECTED','CLOSED')),
      unexcused_absence_count INT NULL,
      attended_sessions INT NULL,
      total_sessions INT NULL,
      weighted_attendance_rate DECIMAL(5,2) NULL,
      summary NVARCHAR(MAX) NULL,
      policy_version INT NULL,
      related_data NVARCHAR(MAX) NULL,
      created_by NVARCHAR(128) NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      decided_by NVARCHAR(128) NULL,
      decided_at DATETIME2 NULL,
      decision NVARCHAR(MAX) NULL,
      reason NVARCHAR(MAX) NULL,
      effective_date DATE NULL,
      notes NVARCHAR(MAX) NULL,
      affected_by_correction BIT NOT NULL DEFAULT 0
    );
  END`);

  // 3) Indexes (plain + filtered unique idempotency guards)
  for (const [name, table, columns] of ADDITIONAL_INDEXES) {
    await knex.raw(
      `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = '${name}' AND object_id = OBJECT_ID('${table}'))
       CREATE INDEX [${name}] ON [dbo].[${table}] (${columns});`
    );
  }
  const filteredUnique = [
    ['UQ_attendance_penalties_active', 'attendance_penalties', 'attendance_id', "WHERE status = 'APPLIED'"],
    ['UQ_open_disciplinary_cases', 'disciplinary_cases', 'student_id, case_type', "WHERE status IN ('OPEN','UNDER_REVIEW')"],
    ['UQ_attendance_excuse_per_attendance', 'attendance_excuses', 'attendance_id', 'WHERE attendance_id IS NOT NULL'],
    ['UQ_event_attendance_rule_default', 'event_attendance_rules', 'event_id', 'WHERE session_id IS NULL'],
    ['UQ_warnings_attendance_trigger', 'student_warnings', 'student_id, warning_type, attendance_id', 'WHERE is_attendance_warning = 1 AND attendance_id IS NOT NULL'],
  ] as const;
  for (const [name, table, columns, filter] of filteredUnique) {
    await knex.raw(
      `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = '${name}' AND object_id = OBJECT_ID('${table}'))
       CREATE UNIQUE INDEX [${name}] ON [dbo].[${table}] (${columns}) ${filter};`
    );
  }

  // 4) Seed the operator permission into the standard staff roles
  for (const role of ['admin', 'priest', 'supervisor', 'assistant_supervisor']) {
    await knex.raw(`
      IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = ? AND permission = 'OPERATE_EVENT_ATTENDANCE')
      INSERT INTO role_permissions (role, permission) VALUES (?, 'OPERATE_EVENT_ATTENDANCE')
    `, [role, role]);
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of ['attendance_penalties', 'attendance_excuses', 'disciplinary_cases', 'attendance_policy_versions', 'attendance_policy', 'event_attendance_rules']) {
    await knex.raw(`IF EXISTS (SELECT * FROM sys.tables WHERE name = '${table}') DROP TABLE [dbo].[${table}]`).catch(() => undefined);
  }
}