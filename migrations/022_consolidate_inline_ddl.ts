import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_attendance_detailed')
    BEGIN
      CREATE TABLE [dbo].[event_attendance_detailed] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [event_id] NVARCHAR(128) NOT NULL,
        [session_id] NVARCHAR(128) NOT NULL,
        [student_id] NVARCHAR(128) NOT NULL,
        [status] NVARCHAR(50) DEFAULT 'present',
        [absence_reason] NVARCHAR(500) NULL,
        [notified_parent] BIT DEFAULT 0,
        [notified_priest] BIT DEFAULT 0,
        [created_by] NVARCHAR(128) NULL,
        [tenant_id] NVARCHAR(128) NULL,
        [is_paid] BIT DEFAULT 0,
        [created_at] DATETIME2 DEFAULT GETDATE()
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'laundry_operators')
    BEGIN
      CREATE TABLE [dbo].[laundry_operators] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [user_id] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 DEFAULT GETDATE()
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'laundry_settings')
    BEGIN
      CREATE TABLE [dbo].[laundry_settings] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL FOREIGN KEY REFERENCES tenants(id),
        [days] NVARCHAR(MAX) NOT NULL,
        [start_hour] NVARCHAR(50) NOT NULL,
        [end_hour] NVARCHAR(50) NOT NULL
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tenant_custom_roles')
    BEGIN
      CREATE TABLE [dbo].[tenant_custom_roles] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [permissions] NVARCHAR(MAX) NOT NULL,
        [created_by] NVARCHAR(128) FOREIGN KEY REFERENCES users(id),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'item_managers')
    BEGIN
      CREATE TABLE [dbo].[item_managers] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [user_id] NVARCHAR(128) NOT NULL,
        [item_id] NVARCHAR(128) NOT NULL,
        [item_type] NVARCHAR(50) NOT NULL,
        [assigned_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'rewards_definitions')
    BEGIN
      CREATE TABLE [dbo].[rewards_definitions] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX),
        [points_cost] INT NOT NULL,
        [category] NVARCHAR(100),
        [stock] INT DEFAULT 99,
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_points')
    BEGIN
      CREATE TABLE [dbo].[student_points] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [student_id] NVARCHAR(128) NOT NULL,
        [amount] INT NOT NULL,
        [reason] NVARCHAR(MAX),
        [category] NVARCHAR(50),
        [created_by] NVARCHAR(128),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (student_id) REFERENCES students(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_warnings')
    BEGIN
      CREATE TABLE [dbo].[student_warnings] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [student_id] NVARCHAR(128) NOT NULL,
        [level] NVARCHAR(50) NOT NULL,
        [reason] NVARCHAR(MAX) NOT NULL,
        [notify_parent] BIT DEFAULT 0,
        [notify_priest] BIT DEFAULT 0,
        [status] NVARCHAR(50) DEFAULT 'active',
        [created_by] NVARCHAR(128),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'priest_reports')
    BEGIN
      CREATE TABLE [dbo].[priest_reports] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX),
        [type] NVARCHAR(50),
        [student_ids] NVARCHAR(MAX),
        [supervisor_id] NVARCHAR(128),
        [status] NVARCHAR(50) DEFAULT 'pending',
        [created_at] DATETIME2 DEFAULT GETDATE(),
        [approved_at] DATETIME2,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (supervisor_id) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_rewards')
    BEGIN
      CREATE TABLE [dbo].[student_rewards] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [student_id] NVARCHAR(128) NOT NULL,
        [reward_id] NVARCHAR(128) NOT NULL,
        [status] NVARCHAR(50) DEFAULT 'pending',
        [created_by] NVARCHAR(128),
        [processed_by] NVARCHAR(128),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        [processed_at] DATETIME2,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (reward_id) REFERENCES rewards_definitions(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_logs')
    BEGIN
      CREATE TABLE [dbo].[audit_logs] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128),
        [user_id] NVARCHAR(128),
        [user_email] NVARCHAR(255),
        [user_role] NVARCHAR(50),
        [action] NVARCHAR(255) NOT NULL,
        [entity_type] NVARCHAR(128),
        [entity_id] NVARCHAR(128),
        [method] NVARCHAR(20) NOT NULL,
        [path] NVARCHAR(255) NOT NULL,
        [status] NVARCHAR(50),
        [details] NVARCHAR(MAX),
        [created_at] DATETIME2 DEFAULT GETDATE()
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_criteria')
    BEGIN
      CREATE TABLE [dbo].[event_criteria] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [event_id] NVARCHAR(128) NOT NULL,
        [title] NVARCHAR(255) NOT NULL,
        [max_score] INT DEFAULT 10,
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (event_id) REFERENCES events(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_responsible')
    BEGIN
      CREATE TABLE [dbo].[event_responsible] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [event_id] NVARCHAR(128) NOT NULL,
        [user_id] NVARCHAR(128) NOT NULL,
        [type] NVARCHAR(50),
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_sessions')
    BEGIN
      CREATE TABLE [dbo].[event_sessions] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [event_id] NVARCHAR(128) NOT NULL,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX),
        [start_time] DATETIME2,
        [type] NVARCHAR(50) DEFAULT 'session',
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_scores')
    BEGIN
      CREATE TABLE [dbo].[event_scores] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [event_id] NVARCHAR(128) NOT NULL,
        [team_id] NVARCHAR(128),
        [student_id] NVARCHAR(128),
        [criterion_id] NVARCHAR(128),
        [score] INT NOT NULL,
        [scored_by] NVARCHAR(128),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (event_id) REFERENCES events(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StudentDocuments')
    BEGIN
      CREATE TABLE [dbo].[StudentDocuments] (
        [id] INT PRIMARY KEY IDENTITY(1,1),
        [student_id] NVARCHAR(128) NOT NULL,
        [doc_type] NVARCHAR(100),
        [file_path] NVARCHAR(MAX) NOT NULL,
        [file_name] NVARCHAR(255),
        [upload_date] DATETIME DEFAULT GETDATE()
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StudentPhones')
    BEGIN
      CREATE TABLE [dbo].[StudentPhones] (
        [id] INT PRIMARY KEY IDENTITY(1,1),
        [student_id] NVARCHAR(128) NOT NULL,
        [phone_type] NVARCHAR(50),
        [label] NVARCHAR(100),
        [phone_number] NVARCHAR(20) NOT NULL
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_notes')
    BEGIN
      CREATE TABLE [dbo].[student_notes] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [student_id] NVARCHAR(128) NOT NULL,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [author_id] NVARCHAR(128) NOT NULL,
        [author_role] NVARCHAR(50) NOT NULL,
        [author_name] NVARCHAR(255),
        [content] NVARCHAR(MAX) NOT NULL,
        [created_at] DATETIME2 DEFAULT GETDATE(),
        [updated_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (author_id) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'supervisor_contacts')
    BEGIN
      CREATE TABLE [dbo].[supervisor_contacts] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [user_id] NVARCHAR(128) NOT NULL,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [phone_numbers] NVARCHAR(MAX) DEFAULT '[]',
        [available_from] NVARCHAR(10),
        [available_to] NVARCHAR(10),
        [available_days] NVARCHAR(100),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        [updated_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_registrations')
    BEGIN
      CREATE TABLE [dbo].[event_registrations] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [event_id] NVARCHAR(128) NOT NULL,
        [student_id] NVARCHAR(128) NOT NULL,
        [status] NVARCHAR(50) DEFAULT 'registered',
        [registered_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (student_id) REFERENCES students(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_subscriptions')
    BEGIN
      CREATE TABLE [dbo].[event_subscriptions] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [event_id] NVARCHAR(128) NOT NULL,
        [user_id] NVARCHAR(128) NOT NULL,
        [student_id] NVARCHAR(128) NULL,
        [status] NVARCHAR(50) DEFAULT 'pending',
        [payment_method_id] NVARCHAR(128) NULL,
        [payment_status] NVARCHAR(50) DEFAULT 'unpaid',
        [receipt_image] NVARCHAR(500) NULL,
        [notes] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2 DEFAULT GETDATE(),
        [updated_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'badges')
    BEGIN
      CREATE TABLE [dbo].[badges] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128),
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX),
        [icon] NVARCHAR(50) DEFAULT 'Award',
        [color] NVARCHAR(50) DEFAULT 'amber',
        [category] NVARCHAR(50) DEFAULT 'housing',
        [created_by] NVARCHAR(128),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_badges')
    BEGIN
      CREATE TABLE [dbo].[student_badges] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [student_id] NVARCHAR(128) NOT NULL,
        [badge_id] NVARCHAR(128) NOT NULL,
        [awarded_by] NVARCHAR(128),
        [awarded_at] DATETIME2 DEFAULT GETDATE(),
        [reason] NVARCHAR(MAX),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (badge_id) REFERENCES badges(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'payment_methods')
    BEGIN
      CREATE TABLE [dbo].[payment_methods] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [phone_number] NVARCHAR(50) NOT NULL,
        [type] NVARCHAR(50) DEFAULT 'instapay',
        [is_active] BIT DEFAULT 1,
        [created_by] NVARCHAR(128),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'token_blacklist')
    BEGIN
      CREATE TABLE [dbo].[token_blacklist] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [token_hash] NVARCHAR(64) NOT NULL,
        [user_id] NVARCHAR(128) NOT NULL,
        [expires_at] DATETIME2 NOT NULL,
        [created_at] DATETIME2 DEFAULT GETDATE()
      );
      CREATE INDEX IX_token_blacklist_token_hash ON [dbo].[token_blacklist]([token_hash]);
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_payments')
    BEGIN
      CREATE TABLE [dbo].[event_payments] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [event_id] NVARCHAR(128) NOT NULL,
        [student_id] NVARCHAR(128) NOT NULL,
        [payment_method_id] NVARCHAR(128) NOT NULL,
        [amount] DECIMAL(10,2) NOT NULL,
        [status] NVARCHAR(50) DEFAULT 'pending',
        [paid_at] DATETIME2,
        [confirmed_by] NVARCHAR(128),
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'role_permissions')
    BEGIN
      CREATE TABLE [dbo].[role_permissions] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [role] NVARCHAR(50) NOT NULL,
        [permission] NVARCHAR(100) NOT NULL,
        [created_at] DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_Role_Permission UNIQUE (role, permission)
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'profile_shares')
    BEGIN
      CREATE TABLE [dbo].[profile_shares] (
        [id] NVARCHAR(128) PRIMARY KEY,
        [student_id] NVARCHAR(128) NOT NULL,
        [shared_by_user_id] NVARCHAR(128) NOT NULL,
        [shared_with_user_id] NVARCHAR(128) NOT NULL,
        [tenant_id] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (shared_by_user_id) REFERENCES users(id),
        FOREIGN KEY (shared_with_user_id) REFERENCES users(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    END
  `);

  console.log("✅ Migration 022: Consolidated inline DDL from db.ts");
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'profile_shares', 'role_permissions', 'event_payments', 'token_blacklist',
    'payment_methods', 'student_badges', 'badges', 'event_subscriptions',
    'event_registrations', 'supervisor_contacts', 'student_notes',
    'StudentPhones', 'StudentDocuments', 'event_scores', 'event_sessions',
    'event_responsible', 'event_criteria', 'audit_logs', 'student_rewards',
    'priest_reports', 'student_warnings', 'student_points', 'rewards_definitions',
    'item_managers', 'tenant_custom_roles', 'laundry_settings', 'laundry_operators',
    'event_attendance_detailed',
  ];

  for (const table of tables) {
    await knex.raw(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = '${table}')
        DROP TABLE [dbo].[${table}]
    `);
  }
}
