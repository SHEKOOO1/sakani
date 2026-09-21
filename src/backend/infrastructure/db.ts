import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { MemoryCache, permissionCache, userCache, tenantCache } from "./cache.ts";
import { parseStoredPermissionsArray, safeParseStoredPermissionValue } from "./permission-parser";


// Load env from project root explicitly
// NOTE: dotenv only works if the .env file exists. If it's missing, env vars will remain undefined.
// Use a portable path instead of a hard-coded absolute path.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { kdb } from "./knex.ts";

export { kdb };

const dbClient = process.env.DB_CLIENT || "mssql";
if (dbClient !== "mssql") {
throw new Error("Only MSSQL is supported. Ensure DB_CLIENT=mssql is set in your .env file.");}

// Placeholder for legacy SQLite schema block. MSSQL-only mode is enforced.
const db: any = {};

// Initialize Schema
export async function initializeDb() {
  console.log(`Initializing database schema for client: ${dbClient}...`);

  if (process.env.NODE_ENV !== 'production') {
    console.log('DB runtime:', { DB_CLIENT: process.env.DB_CLIENT, DB_NAME: process.env.DB_NAME });
  }

  // P1-DB-5: cross-process advisory lock. Multiple instances or a restart can
  // otherwise run the raw DDL concurrently and deadlock each other. The lock is
  // owned by this transaction (a connection is held) and released on
  // commit/rollback.
  const schemaLock = await kdb.transaction();
  try {
    await schemaLock.raw(`
      DECLARE @lockResult int;
      EXEC @lockResult = sp_getapplock
        @Resource = 'sakani_schema_init',
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 120000;
      IF @lockResult < 0
        THROW 50000, 'Could not acquire sakani_schema_init lock', 1;
    `);

    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    // db.ts -> infrastructure -> backend -> src, so ../../.. brings to project root
    const schemaPath = path.resolve(process.cwd(), 'schema_mssql.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('MSSQL detected. Applying schema_mssql.sql...');
    await kdb.raw(schemaSql);
    console.log('MSSQL schema applied successfully.');

    // قيود الحماية
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_Users_Email' AND type = 'UQ')
      ALTER TABLE [dbo].[users] ADD CONSTRAINT UQ_Users_Email UNIQUE (email);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'PK_user_tenant_assignments' AND object_id = OBJECT_ID('user_tenant_assignments'))
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('user_tenant_assignments'))
        ALTER TABLE [dbo].[user_tenant_assignments] ADD CONSTRAINT PK_user_tenant_assignments PRIMARY KEY (user_id, tenant_id);
      END

      IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_Event_Attendance' AND type = 'UQ')
      ALTER TABLE [dbo].[event_attendance] ADD CONSTRAINT UQ_Event_Attendance UNIQUE (event_id, student_id);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_tenant_assignments') AND name = 'assigned_at')
      ALTER TABLE [dbo].[user_tenant_assignments] ADD [assigned_at] DATETIME2 DEFAULT GETDATE();

      IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_Event_Attendance_Detailed' AND type = 'UQ')
      ALTER TABLE [dbo].[event_attendance_detailed] ADD CONSTRAINT UQ_Event_Attendance_Detailed UNIQUE (session_id, student_id);

      IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_Laundry_Operators' AND type = 'UQ')
      ALTER TABLE [dbo].[laundry_operators] ADD CONSTRAINT UQ_Laundry_Operators UNIQUE (tenant_id, user_id);

      IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_Student_UserId' AND type = 'UQ')
      ALTER TABLE [dbo].[students] ADD CONSTRAINT UQ_Student_UserId UNIQUE (user_id);

      -- Event attendance parent unique
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_Event_Attendance_Parent' AND type = 'UQ')
      ALTER TABLE [dbo].[event_attendance] ADD CONSTRAINT UQ_Event_Attendance_Parent UNIQUE (event_id, parent_user_id);
    `);

    // أعمدة مفقودة لجدول المستخدمين
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'custom_permissions')
      ALTER TABLE [dbo].[users] ADD [custom_permissions] NVARCHAR(MAX), [custom_role_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'phone')
      ALTER TABLE [dbo].[users] ADD [phone] NVARCHAR(50);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'photo_url')
      ALTER TABLE [dbo].[users] ADD [photo_url] NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'token_version')
      ALTER TABLE [dbo].[users] ADD [token_version] INT NOT NULL DEFAULT 0;
    `);

    // أعمدة الصيانة
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'photo_url')
      ALTER TABLE [dbo].[maintenance_requests] ADD [photo_url] NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'completed_at')
      ALTER TABLE [dbo].[maintenance_requests] ADD [completed_at] DATETIME2;
    `);

    // أعمدة الإعلانات
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('broadcasts') AND name = 'visible_in_ticker')
      ALTER TABLE [dbo].[broadcasts] ADD [visible_in_ticker] BIT DEFAULT 1;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('broadcasts') AND name = 'visible_in_messages')
      ALTER TABLE [dbo].[broadcasts] ADD [visible_in_messages] BIT DEFAULT 1;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('broadcasts') AND name = 'sender_role')
      ALTER TABLE [dbo].[broadcasts] ADD [sender_role] NVARCHAR(50);
    `);

    // أعمدة الطلاب الإضافية
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'governorate') ALTER TABLE [dbo].[students] ADD [governorate] NVARCHAR(100);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'village') ALTER TABLE [dbo].[students] ADD [village] NVARCHAR(100);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'church_name') ALTER TABLE [dbo].[students] ADD [church_name] NVARCHAR(200);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'confession_father_name') ALTER TABLE [dbo].[students] ADD [confession_father_name] NVARCHAR(200);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'confession_father_phone') ALTER TABLE [dbo].[students] ADD [confession_father_phone] NVARCHAR(50);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'confession_father_whatsapp') ALTER TABLE [dbo].[students] ADD [confession_father_whatsapp] NVARCHAR(50);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'confession_father_service') ALTER TABLE [dbo].[students] ADD [confession_father_service] NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'is_servant') ALTER TABLE [dbo].[students] ADD [is_servant] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'servant_services') ALTER TABLE [dbo].[students] ADD [servant_services] NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'is_deacon') ALTER TABLE [dbo].[students] ADD [is_deacon] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'deacon_rank') ALTER TABLE [dbo].[students] ADD [deacon_rank] NVARCHAR(100);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'deacon_details') ALTER TABLE [dbo].[students] ADD [deacon_details] NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'deacon_ordination_date') ALTER TABLE [dbo].[students] ADD [deacon_ordination_date] DATE;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'service_training_certificate') ALTER TABLE [dbo].[students] ADD [service_training_certificate] NVARCHAR(MAX);
    `);

    // أعمدة الفعاليات
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'parent_can_enroll') ALTER TABLE [dbo].[events] ADD [parent_can_enroll] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'is_competition') ALTER TABLE [dbo].[events] ADD [is_competition] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'competition_active') ALTER TABLE [dbo].[events] ADD [competition_active] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'winning_threshold') ALTER TABLE [dbo].[events] ADD [winning_threshold] INT DEFAULT 100;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'max_score') ALTER TABLE [dbo].[events] ADD [max_score] INT DEFAULT 200;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'targeting') ALTER TABLE [dbo].[events] ADD [targeting] NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'type') ALTER TABLE [dbo].[events] ADD [type] NVARCHAR(50) DEFAULT 'event';
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'registration_deadline') ALTER TABLE [dbo].[events] ADD [registration_deadline] DATETIME2;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'is_paid') ALTER TABLE [dbo].[events] ADD [is_paid] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'price') ALTER TABLE [dbo].[events] ADD [price] DECIMAL(10,2) DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'max_participants') ALTER TABLE [dbo].[events] ADD [max_participants] INT NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'created_by') ALTER TABLE [dbo].[events] ADD [created_by] NVARCHAR(128);
    `);

    // أعمدة المسابقات
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'prize_points') ALTER TABLE [dbo].[competitions] ADD [prize_points] INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'questions_count') ALTER TABLE [dbo].[competitions] ADD [questions_count] INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'responsible_id') ALTER TABLE [dbo].[competitions] ADD [responsible_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'status') ALTER TABLE [dbo].[competitions] ADD [status] NVARCHAR(50);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('competitions') AND name = 'created_by') ALTER TABLE [dbo].[competitions] ADD [created_by] NVARCHAR(128);
    `);

    // أعمدة السكن
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'is_active') ALTER TABLE [dbo].[tenants] ADD [is_active] BIT DEFAULT 1;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'location_lat') ALTER TABLE [dbo].[tenants] ADD [location_lat] DECIMAL(10,7) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'location_lng') ALTER TABLE [dbo].[tenants] ADD [location_lng] DECIMAL(10,7) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'location_radius') ALTER TABLE [dbo].[tenants] ADD [location_radius] INT DEFAULT 50;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'entry_lat') ALTER TABLE [dbo].[tenants] ADD [entry_lat] DECIMAL(10,7) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'entry_lng') ALTER TABLE [dbo].[tenants] ADD [entry_lng] DECIMAL(10,7) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'entry_radius') ALTER TABLE [dbo].[tenants] ADD [entry_radius] INT DEFAULT 50;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'exit_lat') ALTER TABLE [dbo].[tenants] ADD [exit_lat] DECIMAL(10,7) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'exit_lng') ALTER TABLE [dbo].[tenants] ADD [exit_lng] DECIMAL(10,7) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'exit_radius') ALTER TABLE [dbo].[tenants] ADD [exit_radius] INT DEFAULT 50;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'curfew_time') ALTER TABLE [dbo].[tenants] ADD [curfew_time] NVARCHAR(20) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'open_time') ALTER TABLE [dbo].[tenants] ADD [open_time] NVARCHAR(20) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'semester1_start') ALTER TABLE [dbo].[tenants] ADD [semester1_start] DATE NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'semester1_end') ALTER TABLE [dbo].[tenants] ADD [semester1_end] DATE NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'semester2_start') ALTER TABLE [dbo].[tenants] ADD [semester2_start] DATE NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'semester2_end') ALTER TABLE [dbo].[tenants] ADD [semester2_end] DATE NULL;
    `);

    // أعمدة إضافية للحضور، الغياب، الإشعارات
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('attendance') AND name = 'location_lat') ALTER TABLE [dbo].[attendance] ADD [location_lat] DECIMAL(10,7) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('attendance') AND name = 'location_lng') ALTER TABLE [dbo].[attendance] ADD [location_lng] DECIMAL(10,7) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_delays') AND name = 'curfew_time') ALTER TABLE [dbo].[student_delays] ADD [curfew_time] NVARCHAR(20) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_delays') AND name = 'status') ALTER TABLE [dbo].[student_delays] ADD [status] NVARCHAR(50) DEFAULT 'pending';
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_delays') AND name = 'delay_minutes') ALTER TABLE [dbo].[student_delays] ADD [delay_minutes] INT NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('notifications') AND name = 'tenant_id') ALTER TABLE [dbo].[notifications] ADD [tenant_id] NVARCHAR(128) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('notifications') AND name = 'metadata') ALTER TABLE [dbo].[notifications] ADD [metadata] NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('laundry_queue') AND name = 'created_at') ALTER TABLE [dbo].[laundry_queue] ADD [created_at] DATETIME2 DEFAULT GETDATE();
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenant_custom_roles') AND name = 'created_by') ALTER TABLE [dbo].[tenant_custom_roles] ADD [created_by] NVARCHAR(128) FOREIGN KEY REFERENCES users(id);
    `);

    // أعمدة الحضور التفصيلي
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'is_paid') ALTER TABLE [dbo].[event_attendance_detailed] ADD [is_paid] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'absence_reason') ALTER TABLE [dbo].[event_attendance_detailed] ADD [absence_reason] NVARCHAR(500) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'notified_parent') ALTER TABLE [dbo].[event_attendance_detailed] ADD [notified_parent] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'notified_priest') ALTER TABLE [dbo].[event_attendance_detailed] ADD [notified_priest] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'created_by') ALTER TABLE [dbo].[event_attendance_detailed] ADD [created_by] NVARCHAR(128) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'tenant_id') ALTER TABLE [dbo].[event_attendance_detailed] ADD [tenant_id] NVARCHAR(128) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance') AND name = 'is_paid') ALTER TABLE [dbo].[event_attendance] ADD [is_paid] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance') AND name = 'parent_user_id') ALTER TABLE [dbo].[event_attendance] ADD [parent_user_id] NVARCHAR(128) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance') AND name = 'check_in_method') ALTER TABLE [dbo].[event_attendance] ADD [check_in_method] NVARCHAR(50) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance') AND name = 'excuse_reason') ALTER TABLE [dbo].[event_attendance] ADD [excuse_reason] NVARCHAR(MAX) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance') AND name = 'attended_at') ALTER TABLE [dbo].[event_attendance] ADD [attended_at] DATETIME2 NULL;
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance') AND name = 'student_id' AND is_nullable = 0) ALTER TABLE [dbo].[event_attendance] ALTER COLUMN [student_id] NVARCHAR(128) NULL;
    `);

    // أعمدة الاشتراكات و student_archive
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_subscriptions') AND name = 'receipt_image') ALTER TABLE [dbo].[event_subscriptions] ADD [receipt_image] NVARCHAR(500) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_subscriptions') AND name = 'notes') ALTER TABLE [dbo].[event_subscriptions] ADD [notes] NVARCHAR(MAX) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_subscriptions') AND name = 'updated_at') ALTER TABLE [dbo].[event_subscriptions] ADD [updated_at] DATETIME2 DEFAULT GETDATE();
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_archive') AND name = 'student_id') ALTER TABLE [dbo].[student_archive] ADD [student_id] NVARCHAR(128);
    `);

    // أعمدة إضافية للإنذارات والنقاط
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'notify_parent') ALTER TABLE [dbo].[student_warnings] ADD [notify_parent] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'notify_priest') ALTER TABLE [dbo].[student_warnings] ADD [notify_priest] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'created_by') ALTER TABLE [dbo].[student_warnings] ADD [created_by] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_points') AND name = 'category') ALTER TABLE [dbo].[student_points] ADD [category] NVARCHAR(50);
    `);

    // عمود تاريخ استلام المدفوعات الفعلي — بيتسجل تلقائياً لحظة تسجيل المعاملة ولا بيتغير بالتعديل
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('finances') AND name = 'created_at')
      ALTER TABLE [dbo].[finances] ADD [created_at] DATETIME2 DEFAULT GETDATE();
    `);
    await kdb.raw(`
      UPDATE [dbo].[finances] SET created_at = [date] WHERE created_at IS NULL;
    `);

    // عمود طريقة الدفع في المعاملات المالية
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('finances') AND name = 'payment_method_id')
      ALTER TABLE [dbo].[finances] ADD [payment_method_id] NVARCHAR(128) NULL;
    `);

    // ─── Event/Session Attendance Management (boot-time column guards) ───
    // Mirrors migrations/034 (runtime reconciliation for already-running DBs).
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_sessions') AND name = 'status') ALTER TABLE [dbo].[event_sessions] ADD [status] NVARCHAR(20) NOT NULL CONSTRAINT DF_event_sessions_status DEFAULT 'scheduled';
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_sessions') AND name = 'opened_by') ALTER TABLE [dbo].[event_sessions] ADD [opened_by] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_sessions') AND name = 'opened_at') ALTER TABLE [dbo].[event_sessions] ADD [opened_at] DATETIME2;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_sessions') AND name = 'closed_by') ALTER TABLE [dbo].[event_sessions] ADD [closed_by] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_sessions') AND name = 'closed_at') ALTER TABLE [dbo].[event_sessions] ADD [closed_at] DATETIME2;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_sessions') AND name = 'updated_at') ALTER TABLE [dbo].[event_sessions] ADD [updated_at] DATETIME2;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'checked_in_at') ALTER TABLE [dbo].[event_attendance_detailed] ADD [checked_in_at] DATETIME2;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'scheduled_at') ALTER TABLE [dbo].[event_attendance_detailed] ADD [scheduled_at] DATETIME2;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'late_minutes') ALTER TABLE [dbo].[event_attendance_detailed] ADD [late_minutes] INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'grace_minutes') ALTER TABLE [dbo].[event_attendance_detailed] ADD [grace_minutes] INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'rule_snapshot') ALTER TABLE [dbo].[event_attendance_detailed] ADD [rule_snapshot] NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'penalty_mode') ALTER TABLE [dbo].[event_attendance_detailed] ADD [penalty_mode] NVARCHAR(20);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'penalty_amount') ALTER TABLE [dbo].[event_attendance_detailed] ADD [penalty_amount] DECIMAL(10,2);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'penalty_points') ALTER TABLE [dbo].[event_attendance_detailed] ADD [penalty_points] INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'penalty_applied') ALTER TABLE [dbo].[event_attendance_detailed] ADD [penalty_applied] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'penalty_status') ALTER TABLE [dbo].[event_attendance_detailed] ADD [penalty_status] NVARCHAR(20);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'check_in_method') ALTER TABLE [dbo].[event_attendance_detailed] ADD [check_in_method] NVARCHAR(50);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'is_required_attendance') ALTER TABLE [dbo].[event_attendance_detailed] ADD [is_required_attendance] BIT DEFAULT 1;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'attendance_weight') ALTER TABLE [dbo].[event_attendance_detailed] ADD [attendance_weight] DECIMAL(5,2) DEFAULT 1;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'counts_toward_absence_limit') ALTER TABLE [dbo].[event_attendance_detailed] ADD [counts_toward_absence_limit] BIT DEFAULT 1;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'absence_processed') ALTER TABLE [dbo].[event_attendance_detailed] ADD [absence_processed] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'absence_processed_at') ALTER TABLE [dbo].[event_attendance_detailed] ADD [absence_processed_at] DATETIME2;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'unexcused') ALTER TABLE [dbo].[event_attendance_detailed] ADD [unexcused] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'updated_at') ALTER TABLE [dbo].[event_attendance_detailed] ADD [updated_at] DATETIME2;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'warning_type') ALTER TABLE [dbo].[student_warnings] ADD [warning_type] NVARCHAR(30);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'threshold') ALTER TABLE [dbo].[student_warnings] ADD [threshold] INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'unexcused_absence_count_at_time') ALTER TABLE [dbo].[student_warnings] ADD [unexcused_absence_count_at_time] INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'policy_version') ALTER TABLE [dbo].[student_warnings] ADD [policy_version] INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'attendance_id') ALTER TABLE [dbo].[student_warnings] ADD [attendance_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'is_attendance_warning') ALTER TABLE [dbo].[student_warnings] ADD [is_attendance_warning] BIT DEFAULT 0;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_points') AND name = 'event_id') ALTER TABLE [dbo].[student_points] ADD [event_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_points') AND name = 'session_id') ALTER TABLE [dbo].[student_points] ADD [session_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_points') AND name = 'attendance_id') ALTER TABLE [dbo].[student_points] ADD [attendance_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_points') AND name = 'reference') ALTER TABLE [dbo].[student_points] ADD [reference] NVARCHAR(255);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_points') AND name = 'is_reversal') ALTER TABLE [dbo].[student_points] ADD [is_reversal] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_points') AND name = 'reversal_of_id') ALTER TABLE [dbo].[student_points] ADD [reversal_of_id] NVARCHAR(128);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('finances') AND name = 'event_id') ALTER TABLE [dbo].[finances] ADD [event_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('finances') AND name = 'session_id') ALTER TABLE [dbo].[finances] ADD [session_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('finances') AND name = 'attendance_id') ALTER TABLE [dbo].[finances] ADD [attendance_id] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('finances') AND name = 'reference') ALTER TABLE [dbo].[finances] ADD [reference] NVARCHAR(255);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('finances') AND name = 'is_reversal') ALTER TABLE [dbo].[finances] ADD [is_reversal] BIT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('finances') AND name = 'reversal_of_id') ALTER TABLE [dbo].[finances] ADD [reversal_of_id] NVARCHAR(128);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_responsible') AND name = 'attendance_operator') ALTER TABLE [dbo].[event_responsible] ADD [attendance_operator] BIT DEFAULT 1;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_responsible') AND name = 'assigned_by') ALTER TABLE [dbo].[event_responsible] ADD [assigned_by] NVARCHAR(128);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_responsible') AND name = 'created_at') ALTER TABLE [dbo].[event_responsible] ADD [created_at] DATETIME2 DEFAULT GETDATE();
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_rules') AND name = 'base_points') ALTER TABLE [dbo].[event_attendance_rules] ADD [base_points] INT NULL;
    `);

    // Attendance-management indexes (idempotent)
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_attendance_detailed_event_id' AND object_id = OBJECT_ID('event_attendance_detailed')) CREATE INDEX IX_event_attendance_detailed_event_id ON event_attendance_detailed (event_id);
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_attendance_detailed_student_id' AND object_id = OBJECT_ID('event_attendance_detailed')) CREATE INDEX IX_event_attendance_detailed_student_id ON event_attendance_detailed (student_id);
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_sessions_event_id' AND object_id = OBJECT_ID('event_sessions')) CREATE INDEX IX_event_sessions_event_id ON event_sessions (event_id);
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_responsible_event_user' AND object_id = OBJECT_ID('event_responsible')) CREATE INDEX IX_event_responsible_event_user ON event_responsible (event_id, user_id);
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_warnings_attendance_trigger' AND object_id = OBJECT_ID('student_warnings')) CREATE UNIQUE INDEX UQ_warnings_attendance_trigger ON student_warnings (student_id, warning_type, attendance_id) WHERE is_attendance_warning = 1 AND attendance_id IS NOT NULL;
    `);

    // ─── Event rules + absence review workflow (mirrors migrations/035) ───
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'rule_evaluation_mode') ALTER TABLE [dbo].[events] ADD [rule_evaluation_mode] NVARCHAR(30) NOT NULL CONSTRAINT DF_events_rule_eval_mode DEFAULT 'ALL_APPLICABLE' CONSTRAINT CK_events_rule_eval_mode CHECK (rule_evaluation_mode IN ('FIRST_APPLICABLE','ALL_APPLICABLE'));
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'excuse_deadline_minutes') ALTER TABLE [dbo].[events] ADD [excuse_deadline_minutes] INT NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'start_time') ALTER TABLE [dbo].[events] ADD [start_time] DATETIME2 NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'end_time') ALTER TABLE [dbo].[events] ADD [end_time] DATETIME2 NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'duration_minutes') ALTER TABLE [dbo].[events] ADD [duration_minutes] INT NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'is_required_attendance') ALTER TABLE [dbo].[events] ADD [is_required_attendance] BIT NOT NULL CONSTRAINT DF_events_is_required_attendance DEFAULT 1;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'final_status') ALTER TABLE [dbo].[event_attendance_detailed] ADD [final_status] NVARCHAR(30) NULL CONSTRAINT CK_eatd_final_status CHECK (final_status IN ('PENDING_REVIEW','UNEXCUSED','EXCUSED','TRAVEL'));
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'reviewed_by') ALTER TABLE [dbo].[event_attendance_detailed] ADD [reviewed_by] NVARCHAR(128) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'reviewed_at') ALTER TABLE [dbo].[event_attendance_detailed] ADD [reviewed_at] DATETIME2 NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'applied_rules_snapshot') ALTER TABLE [dbo].[event_attendance_detailed] ADD [applied_rules_snapshot] NVARCHAR(MAX) NULL;
    `);
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_rules')
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
        CREATE INDEX IX_event_rules_event_enabled ON event_rules (event_id, enabled);
      END
    `);
    await kdb.raw(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_rules_event_enabled' AND object_id = OBJECT_ID('event_rules')) CREATE INDEX IX_event_rules_event_enabled ON event_rules (event_id, enabled);
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_attendance_detailed_final_status' AND object_id = OBJECT_ID('event_attendance_detailed')) CREATE INDEX IX_event_attendance_detailed_final_status ON event_attendance_detailed (event_id, final_status);
    `);

    // تنظيف الرموز منتهية الصلاحية
    await kdb.raw("DELETE FROM [dbo].[token_blacklist] WHERE expires_at < GETDATE()");

    await seedPermissions();
    await schemaLock.commit();
    return;
  } catch (e) {
    try { await schemaLock.rollback(); } catch { /* transaction already closed */ }
    console.error('Failed applying MSSQL schema or seeding permissions:', e);
    throw e;
  }

}

async function seedPermissions() {
  const roles = {
    admin: [
      'VIEW_DASHBOARD', 'VIEW_REPORTS', 'VIEW_STUDENT',
      'VIEW_ATTENDANCE', 'VIEW_POINTS', 'VIEW_DECISION_LOG',
      'MANAGE_BISHOPS', 'MANAGE_GLOBAL_TENANTS', 'ASSIGN_GLOBAL_STAFF', 'MANAGE_SUPERVISORS', 'VIEW_SYSTEM_LOGS',
      'MANAGE_EMPLOYEES',
      'MANAGE_USERS', 'VIEW_USERS',
      'ASSIGN_ROLES', 'SEND_NOTIFICATIONS', 'VIEW_NOTIFICATIONS', 'VIEW_SETTINGS', 'MANAGE_SETTINGS',
      'VIEW_EVENTS', 'ATTEND_EVENT', 'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS', 'OPERATE_EVENT_ATTENDANCE',
      'MANAGE_COMPETITIONS', 'VIEW_COMPETITIONS', 'JOIN_COMPETITIONS',
      'SEND_BROADCAST', 'VIEW_BROADCASTS',
      'VIEW_RADIO', 'MANAGE_RADIO_BROADCAST', 'MANAGE_RADIO_VIDEO_LIBRARY',
      'MANAGE_RADIO_PLAYLISTS', 'MANAGE_RADIO_TICKERS', 'MODERATE_RADIO_CHAT',
      'VIEW_RADIO_ANALYTICS'
    ],
    bishop: [
      'VIEW_DASHBOARD', 'VIEW_REPORTS', 'VIEW_GLOBAL_REPORTS', 'VIEW_STUDENT',
      'VIEW_ATTENDANCE', 'VIEW_FINANCE_REPORTS',
      'MANAGE_GLOBAL_TENANTS', 'ASSIGN_GLOBAL_STAFF', 'MANAGE_EMPLOYEES',
      'VIEW_USERS', 'MANAGE_USERS',
      'SEND_BROADCAST', 'VIEW_BROADCASTS',
      'VIEW_RADIO'
    ],
    priest: [
      'VIEW_USERS', 'MANAGE_USERS', 'MANAGE_EMPLOYEES', 'ASSIGN_ROLES',
      'VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT',
      'ASSIGN_ROOM', 'MOVE_STUDENT', 'VIEW_HOUSING', 'MANAGE_HOUSING',
      'VIEW_ROOMS', 'ADD_ROOM', 'EDIT_ROOM', 'DELETE_ROOM',
      'VIEW_ATTENDANCE', 'CHECKIN_ATTENDANCE', 'MANAGE_ATTENDANCE',
      'VIEW_MAINTENANCE', 'REQUEST_MAINTENANCE', 'HANDLE_MAINTENANCE',
      'JOIN_LAUNDRY', 'VIEW_LAUNDRY_QUEUE', 'MANAGE_LAUNDRY',
      'MANAGE_LAUNDRY_OPERATORS', 'START_LAUNDRY_SESSION', 'CLOSE_LAUNDRY_SESSION',
      'VIEW_EVENTS', 'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT',
      'ATTEND_EVENT', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS', 'OPERATE_EVENT_ATTENDANCE',
      'MANAGE_POINTS', 'VIEW_POINTS', 'MANAGE_PENALTIES',
      'MANAGE_COMPETITIONS', 'VIEW_COMPETITIONS', 'JOIN_COMPETITIONS',
      'VIEW_DECISION_LOG', 'UNDO_DECISION',
      'VIEW_DASHBOARD', 'VIEW_PRIEST_DASHBOARD', 'VIEW_REPORTS',
      'VIEW_FINANCE_REPORTS',
      'SEND_BROADCAST', 'VIEW_BROADCASTS',
      'VIEW_INVENTORY', 'MANAGE_INVENTORY',
      'VIEW_NOTIFICATIONS', 'SEND_NOTIFICATIONS',
      'VIEW_SETTINGS', 'MANAGE_SETTINGS',
      'VIEW_RADIO'
    ],
    supervisor: [
      'VIEW_USERS', 'MANAGE_USERS', 'MANAGE_EMPLOYEES', 'ASSIGN_ROLES',
      'VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT',
      'ASSIGN_ROOM', 'MOVE_STUDENT', 'VIEW_HOUSING', 'MANAGE_HOUSING',
      'VIEW_ROOMS', 'ADD_ROOM', 'EDIT_ROOM', 'DELETE_ROOM',
      'VIEW_ATTENDANCE', 'CHECKIN_ATTENDANCE', 'MANAGE_ATTENDANCE', 'VIEW_MAINTENANCE', 'REQUEST_MAINTENANCE', 'HANDLE_MAINTENANCE',
      'JOIN_LAUNDRY', 'VIEW_LAUNDRY_QUEUE', 'MANAGE_LAUNDRY', 'MANAGE_LAUNDRY_OPERATORS', 'START_LAUNDRY_SESSION', 'CLOSE_LAUNDRY_SESSION',
      'VIEW_EVENTS', 'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT', 'ATTEND_EVENT', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS', 'OPERATE_EVENT_ATTENDANCE',
      'MANAGE_POINTS', 'VIEW_POINTS', 'MANAGE_REWARDS', 'MANAGE_PENALTIES',
      'MANAGE_COMPETITIONS', 'VIEW_COMPETITIONS', 'JOIN_COMPETITIONS', 'VIEW_DECISION_LOG', 'UNDO_DECISION',
      'VIEW_DASHBOARD', 'VIEW_REPORTS', 'VIEW_FINANCE', 'VIEW_FINANCE_REPORTS', 'ADD_EXPENSE', 'ADD_REVENUE',
      'SEND_BROADCAST', 'VIEW_BROADCASTS',
      'VIEW_INVENTORY', 'MANAGE_INVENTORY', 'VIEW_NOTIFICATIONS', 'SEND_NOTIFICATIONS',
      'VIEW_SETTINGS', 'MANAGE_SETTINGS',
      'VIEW_RADIO'
    ],
    employee: [
      'VIEW_DASHBOARD',
      'VIEW_RADIO'
    ],
    assistant_supervisor: [
      'VIEW_STUDENT', 'VIEW_ROOMS', 'VIEW_ATTENDANCE',
      'VIEW_MAINTENANCE', 'HANDLE_MAINTENANCE',
      'VIEW_LAUNDRY_QUEUE', 'VIEW_DASHBOARD', 'VIEW_REPORTS',
      'VIEW_POINTS', 'VIEW_COMPETITIONS', 'VIEW_EVENTS',
      'MANAGE_EVENT_ATTENDANCE', 'OPERATE_EVENT_ATTENDANCE'
    ],
    student: [
      'VIEW_STUDENT',
      'CHECKIN_ATTENDANCE',
      'JOIN_LAUNDRY',
      'VIEW_LAUNDRY_QUEUE',
      'REQUEST_MAINTENANCE',
      'VIEW_EVENTS',
      'VIEW_NOTIFICATIONS',
      'VIEW_POINTS',
      'VIEW_COMPETITIONS',
      'VIEW_DASHBOARD',
      'ATTEND_EVENT',
      'JOIN_COMPETITIONS',
      'VIEW_BROADCASTS',
      'VIEW_RADIO'
    ],
    parent: [
      'VIEW_STUDENT', 'VIEW_ATTENDANCE', 'VIEW_NOTIFICATIONS', 'VIEW_POINTS',
      'VIEW_BROADCASTS',
      'VIEW_REPORTS',
      'VIEW_DASHBOARD', 'VIEW_COMPETITIONS', 'VIEW_EVENTS',
      'ATTEND_EVENT'
    ]
  };

  const existingCount = await kdb('role_permissions').count('* as count').first();
  if (Number(existingCount?.count || 0) > 0) {
    console.log("RBAC Permissions already seeded, skipping.");
    return;
  }

  await kdb.transaction(async (trx) => {
    for (const [role, permissions] of Object.entries(roles)) {
      for (const perm of permissions) {
        await trx('role_permissions').insert({ role, permission: perm });
      }
    }
  });

  console.log("RBAC Permissions seeded.");
}

export function logAuditEvent(params: {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  method: string;
  path: string;
  status?: string;
  details?: any;
}) {
  kdb('audit_logs').insert({
    id: uuidv4(),
    tenant_id: params.tenantId || null,
    user_id: params.userId || null,
    user_email: params.userEmail || null,
    user_role: params.userRole || null,
    action: params.action,
    entity_type: params.entityType || null,
    entity_id: params.entityId || null,
    method: params.method,
    path: params.path,
    status: params.status || null,
    details: params.details ? JSON.stringify(params.details) : null,
    created_at: new Date()
  }).catch((error) => {
    console.error('Failed to write audit log:', error);
  });
}

/**
 * تحويل قيمة JSON مخزّنة (custom_permissions / role.permissions) إلى
 * قيمتها الأصلية بمعالجة آمنة (FAIL-CLOSED) — تُنفَّذ في
 * safeParseStoredPermissionValue (permission-parser.ts) للتوحيد مع منح
 * الصلاحيات (permission-grants.ts). أي محاولة لتخزين `"ALL"` كنص مفرد
 * لا تُقرأ أبدًا كصلاحية.
 */

/**
 * تحقق متقدم من صلاحيات المستخدم يشمل:
 * 1. الصلاحيات المباشرة الممنوحة له (custom_permissions)
 * 2. الصلاحيات داخل الدور المخصص (custom_role_id)
 * 3. الصلاحيات الافتراضية لدوره الأساسي
 *
 * مع caching لتجنب ضرب قاعدة البيانات في كل request
 */
export async function checkUserPermission(userId: string, permission: string): Promise<boolean> {
  const cacheKey = `perm:${userId}:${permission}`;
  const cached = permissionCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const user = await kdb('users').where({ id: userId }).first();
  if (!user) return false;

  // Admin bypass — مدير التطبيق له السلطة العليا على كل الصلاحيات
  if (user.role === 'admin') {
    permissionCache.set(cacheKey, true);
    return true;
  }

  let result = false;

  // 1. الصلاحيات المباشرة المخزّنة — FAIL-CLOSED: لا تُقرأ إلا إذا كانت قيمتها
  //    مصفوفة JSON (parseStoredPermissionsArray ترفض السلسلة المفردة/الكائن/الرقم/null).
  //    كما أن `ALL` لا تُكرم من البيانات المخزّنة إطلاقًا لغير Admin (تُدار فقط عبر
  //    canGrantSubset)، فأي عنصر ALL قديم/مسرّب داخل مصفوفة لا يُمنح شيئًا.
  if (user.custom_permissions) {
    const direct = parseStoredPermissionsArray(safeParseStoredPermissionValue(user.custom_permissions));
    if (direct.perms.includes(permission)) {
      result = true;
    }
  }

  // 2. فحص الصلاحيات داخل الدور المخصص الذي أنشأه المشرف
  // ملاحظة أمنية: نبحث بالـ tenant_id كذلك لضمان أن الدور المخصص يخص نفس سكن المستخدم
  // (منع التصعيد بعرضي عبر custom_role_id من سكن آخر)
  if (!result && user.custom_role_id) {
    const customRole = await kdb('tenant_custom_roles')
      .where({ id: user.custom_role_id })
      .andWhere(function () {
        if (user.tenant_id) this.where({ tenant_id: user.tenant_id });
        else this.whereNotNull('tenant_id');
      })
      .first();
    if (customRole) {
      const roleParsed = parseStoredPermissionsArray(safeParseStoredPermissionValue(customRole.permissions));
      if (roleParsed.perms.includes(permission)) {
        result = true;
      }
    }
  }

  // 3. فحص الصلاحيات الافتراضية للدور (admin, student, etc.)
  if (!result) {
    result = await hasPermission(user.role, permission);
  }

  permissionCache.set(cacheKey, result);
  return result;
}

const rolePermCache = new MemoryCache<boolean>(120_000);

export async function hasPermission(role: string, permission: string): Promise<boolean> {
  const cacheKey = `role:${role}:${permission}`;
  const cached = rolePermCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = await kdb('role_permissions')
    .where({ role })
    .andWhere(function() {
      this.where({ permission }).orWhere({ permission: 'ALL' });
    })
    .first();

  const has = !!result;
  rolePermCache.set(cacheKey, has);
  return has;
}

export { MemoryCache } from "./cache.ts";

export default kdb;
