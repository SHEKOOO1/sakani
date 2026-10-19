-- ============================================================
-- DormMaster Schema - Full Database Schema
-- All tables with IF NOT EXISTS for safe re-execution
-- ============================================================

-- Required SET options for the filtered indexes further down
-- (e.g. UQ_event_attendance_rule_default). SQL Server rejects a filtered
-- index unless every one of these is ON when it is created, and the
-- connection that runs this file does not always provide them
-- (sqlcmd defaults QUOTED_IDENTIFIER to OFF, for example).
SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET QUOTED_IDENTIFIER ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

-- =================== CORE TABLES ===================

-- Tenants (housing facilities / dormitories)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tenants')
BEGIN
CREATE TABLE tenants (
    id NVARCHAR(128) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    bishop_id NVARCHAR(128),
    address NVARCHAR(500),
    phone NVARCHAR(50),
    daily_readings_enabled BIT DEFAULT 1,
    radio_514_enabled BIT DEFAULT 1,
    laundry_enabled BIT DEFAULT 1,
    restaurant_enabled BIT DEFAULT 1,
    canteen_enabled BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    is_active BIT DEFAULT 1,
    location_lat DECIMAL(10,7),
    location_lng DECIMAL(10,7),
    location_radius INT DEFAULT 50,
    curfew_time NVARCHAR(20),
    open_time NVARCHAR(20),
    notify_guardian_on_exit BIT NOT NULL DEFAULT 0
);
END
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'location')
ALTER TABLE [dbo].[tenants] ADD [location] NVARCHAR(500) NULL;

-- Users (all system users: admin, supervisor, employee, student, parent, bishop, priest)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
CREATE TABLE users (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128),
    email NVARCHAR(255) NOT NULL,
    password NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    gender NVARCHAR(10) DEFAULT 'male',
    daily_readings_enabled BIT DEFAULT 1,
    token_version INT NOT NULL DEFAULT 0,
    -- 1 = the account still uses the shared DEFAULT_USER_PASSWORD and must be
    -- changed before the app is usable (set at creation, cleared on change).
    must_change_password BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    -- Account activation: NULL = pending (login refused until the emailed link is opened).
    activated_at DATETIME2,
    activation_token_hash NVARCHAR(64),
    activation_expires_at DATETIME2,
    activation_sent_at DATETIME2
);
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_users_activation_token_hash' AND object_id = OBJECT_ID('users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_users_activation_token_hash ON users (activation_token_hash);
END

-- Apartments (buildings within a tenant)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'apartments')
BEGIN
CREATE TABLE apartments (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    supervisor_id NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- Apartment facility/activation columns used by apartment.routes.ts and the
-- housing UI. Missing from the original baseline, which broke the student list
-- and housing screens with "Invalid column name 'building'".
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('apartments') AND name = 'building')
ALTER TABLE [dbo].[apartments] ADD [building] NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('apartments') AND name = 'is_active')
ALTER TABLE [dbo].[apartments] ADD [is_active] BIT NOT NULL CONSTRAINT DF_apartments_is_active DEFAULT 1;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('apartments') AND name = 'amenities')
ALTER TABLE [dbo].[apartments] ADD [amenities] NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('apartments') AND name = 'has_kitchen')
ALTER TABLE [dbo].[apartments] ADD [has_kitchen] BIT NOT NULL CONSTRAINT DF_apartments_has_kitchen DEFAULT 0;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('apartments') AND name = 'kitchen_details')
ALTER TABLE [dbo].[apartments] ADD [kitchen_details] NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('apartments') AND name = 'has_bathroom')
ALTER TABLE [dbo].[apartments] ADD [has_bathroom] BIT NOT NULL CONSTRAINT DF_apartments_has_bathroom DEFAULT 0;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('apartments') AND name = 'bathroom_details')
ALTER TABLE [dbo].[apartments] ADD [bathroom_details] NVARCHAR(MAX) NULL;

-- Rooms
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'rooms')
BEGIN
CREATE TABLE rooms (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    apartment_id NVARCHAR(128),
    room_number NVARCHAR(50) NOT NULL,
    capacity INT DEFAULT 2,
    current_occupancy INT DEFAULT 0,
    gender NVARCHAR(10) DEFAULT 'male',
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2
);
END

-- Room pricing (migration 039) and the amenity set written by
-- POST/PUT /api/rooms (migration 042). Mirrors the apartments column set.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'price_daily')
ALTER TABLE [dbo].[rooms] ADD [price_daily] DECIMAL(18,2) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'price_monthly')
ALTER TABLE [dbo].[rooms] ADD [price_monthly] DECIMAL(18,2) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'price_semester')
ALTER TABLE [dbo].[rooms] ADD [price_semester] DECIMAL(18,2) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'amenities')
ALTER TABLE [dbo].[rooms] ADD [amenities] NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'has_kitchen')
ALTER TABLE [dbo].[rooms] ADD [has_kitchen] BIT NOT NULL CONSTRAINT DF_rooms_has_kitchen DEFAULT 0;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'kitchen_details')
ALTER TABLE [dbo].[rooms] ADD [kitchen_details] NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'has_bathroom')
ALTER TABLE [dbo].[rooms] ADD [has_bathroom] BIT NOT NULL CONSTRAINT DF_rooms_has_bathroom DEFAULT 0;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'bathroom_details')
ALTER TABLE [dbo].[rooms] ADD [bathroom_details] NVARCHAR(MAX) NULL;

-- Students
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'students')
BEGIN
CREATE TABLE students (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    user_id NVARCHAR(128) NOT NULL,
    room_id NVARCHAR(128),
    student_id_number NVARCHAR(50),
    agreed_price DECIMAL(10,2) DEFAULT 0,
    billing_cycle NVARCHAR(50) DEFAULT 'monthly',
    status NVARCHAR(50) DEFAULT 'active',
    is_traveling BIT DEFAULT 0,
    travel_destination NVARCHAR(255),
    travel_reason NVARCHAR(500),
    travel_start_time DATETIME2,
    travel_end_time DATETIME2,
    curfew_time NVARCHAR(20),
    is_graduate BIT DEFAULT 0,
    graduation_date DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'is_graduate')
ALTER TABLE [dbo].[students] ADD [is_graduate] BIT NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'graduation_date')
ALTER TABLE [dbo].[students] ADD [graduation_date] DATETIME2 NULL;

-- Optional expected-return time. Travel is open ended by default; this only
-- supports monitoring when the student chooses to provide a return time.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'travel_end_time')
ALTER TABLE [dbo].[students] ADD [travel_end_time] DATETIME2 NULL;

-- Opt-in: notify guardians on a normal check-out (off by default).
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'notify_guardian_on_exit')
ALTER TABLE [dbo].[tenants] ADD [notify_guardian_on_exit] BIT NOT NULL DEFAULT 0;

-- Frozen residence price marker. When set, the student's invoice is the price
-- agreed at enrollment (students.agreed_price) and never tracks the shared
-- room price again. NULL means a legacy record that still follows the room
-- price until it is frozen by an explicit decision.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'price_frozen_at')
ALTER TABLE [dbo].[students] ADD [price_frozen_at] DATETIME2 NULL;

-- Academic / identity profile columns. Required by the application and by the
-- student list filters (college, major, university, gender, graduation_year...).
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'name')
ALTER TABLE [dbo].[students] ADD [name] NVARCHAR(255) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'email')
ALTER TABLE [dbo].[students] ADD [email] NVARCHAR(255) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'phone')
ALTER TABLE [dbo].[students] ADD [phone] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'whatsapp_number')
ALTER TABLE [dbo].[students] ADD [whatsapp_number] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'gender')
ALTER TABLE [dbo].[students] ADD [gender] NVARCHAR(10) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'birth_date')
ALTER TABLE [dbo].[students] ADD [birth_date] DATE NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'college')
ALTER TABLE [dbo].[students] ADD [college] NVARCHAR(255) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'major')
ALTER TABLE [dbo].[students] ADD [major] NVARCHAR(255) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'university')
ALTER TABLE [dbo].[students] ADD [university] NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'enrollment_year')
ALTER TABLE [dbo].[students] ADD [enrollment_year] INT NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'academic_year')
ALTER TABLE [dbo].[students] ADD [academic_year] NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'graduation_year')
ALTER TABLE [dbo].[students] ADD [graduation_year] INT NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'national_id')
ALTER TABLE [dbo].[students] ADD [national_id] NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'id_card_number')
ALTER TABLE [dbo].[students] ADD [id_card_number] NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'address')
ALTER TABLE [dbo].[students] ADD [address] NVARCHAR(255) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'student_photo')
ALTER TABLE [dbo].[students] ADD [student_photo] NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'guardian_name')
ALTER TABLE [dbo].[students] ADD [guardian_name] NVARCHAR(255) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'guardian_phone')
ALTER TABLE [dbo].[students] ADD [guardian_phone] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'guardian_relation')
ALTER TABLE [dbo].[students] ADD [guardian_relation] NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'guardian_whatsapp')
ALTER TABLE [dbo].[students] ADD [guardian_whatsapp] NVARCHAR(20) NULL;

-- Parents / Guardians
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'parents')
BEGIN
CREATE TABLE parents (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    user_id NVARCHAR(128) NOT NULL,
    phone NVARCHAR(50),
    whatsapp NVARCHAR(50),
    occupation NVARCHAR(255),
    photo NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
END

-- Student-Guardian relationship (many-to-many)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_guardians')
BEGIN
CREATE TABLE student_guardians (
    id NVARCHAR(128) PRIMARY KEY,
    student_id NVARCHAR(128) NOT NULL,
    guardian_id NVARCHAR(128) NOT NULL,
    relation_type NVARCHAR(50) DEFAULT 'father',
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (guardian_id) REFERENCES parents(id)
);
END

-- =================== FEATURE TABLES ===================

-- Attendance
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance')
BEGIN
CREATE TABLE attendance (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128),
    user_id NVARCHAR(128),
    type NVARCHAR(50) NOT NULL CHECK (type IN ('check-in', 'check-out')),
    status NVARCHAR(50) DEFAULT 'normal',
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- Finances
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'finances')
BEGIN
CREATE TABLE finances (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128),
    student_id NVARCHAR(128),
    type NVARCHAR(50) NOT NULL CHECK (type IN ('revenue', 'expense')),
    category NVARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    description NVARCHAR(MAX),
    date DATE DEFAULT GETDATE(),
    created_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    payment_method_id NVARCHAR(128),
    is_admin_only BIT DEFAULT 0
);
END

-- Finance Edit Logs — سجل تعديلات المعاملات المالية وسعر الغرفة (بتاريخ التعديل الفعلي في السيرفر)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'finance_edit_logs')
BEGIN
CREATE TABLE finance_edit_logs (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128),
    student_id NVARCHAR(128),
    finance_id NVARCHAR(128),
    edit_type NVARCHAR(20) NOT NULL,
    direction NVARCHAR(20),
    delta DECIMAL(18,2),
    summary NVARCHAR(800),
    created_at DATETIME2 DEFAULT GETDATE(),
    created_by NVARCHAR(128),
    is_admin_only BIT DEFAULT 0
);
END

-- Student Points (Behavior - positive)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_points')
BEGIN
CREATE TABLE student_points (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    amount INT NOT NULL,
    reason NVARCHAR(MAX),
    created_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (student_id) REFERENCES students(id)
);
END

-- Student Warnings (Behavior - negative)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_warnings')
BEGIN
CREATE TABLE student_warnings (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    level NVARCHAR(50) DEFAULT 'first',
    reason NVARCHAR(MAX),
    status NVARCHAR(50) DEFAULT 'active',
    created_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (student_id) REFERENCES students(id)
);
END

-- Student Delays
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_delays')
BEGIN
CREATE TABLE student_delays (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    actual_entry_time DATETIME2,
    delay_minutes INT,
    reason NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (student_id) REFERENCES students(id)
);
END

-- Maintenance Requests
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'maintenance_requests')
BEGIN
CREATE TABLE maintenance_requests (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128),
    user_id NVARCHAR(128),
    description NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(50) DEFAULT 'pending',
    assigned_to NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- Events
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'events')
BEGIN
CREATE TABLE events (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    event_date DATETIME2,
    location NVARCHAR(255),
    points_award INT DEFAULT 0,
    type NVARCHAR(50) DEFAULT 'event',
    is_paid BIT DEFAULT 0,
    price DECIMAL(10,2) DEFAULT 0,
    is_competition BIT DEFAULT 0,
    winning_threshold INT DEFAULT 100,
    max_score INT DEFAULT 200,
    location_lat DECIMAL(10,7),
    location_lng DECIMAL(10,7),
    location_radius INT DEFAULT 50,
    qr_code NVARCHAR(255),
    registration_deadline DATETIME2,
    parent_can_enroll BIT DEFAULT 0,
    competition_active BIT DEFAULT 0,
    targeting NVARCHAR(MAX),
    available_payment_methods NVARCHAR(MAX),
    created_by NVARCHAR(128),
    start_time DATETIME2 NULL,
    end_time DATETIME2 NULL,
    duration_minutes INT NULL,
    is_required_attendance BIT NOT NULL DEFAULT 1,
    rule_evaluation_mode NVARCHAR(30) NOT NULL DEFAULT 'ALL_APPLICABLE' CHECK (rule_evaluation_mode IN ('FIRST_APPLICABLE','ALL_APPLICABLE')),
    excuse_deadline_minutes INT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- Event Attendance
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_attendance')
BEGIN
CREATE TABLE event_attendance (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    -- Set when a parent checks a student in (see event.routes.ts); the
    -- UQ_Event_Attendance_Parent constraint below is UNIQUE on (event_id, parent_user_id).
    parent_user_id NVARCHAR(128) NULL,
    status NVARCHAR(50) DEFAULT 'present',
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- Competitions
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'competitions')
BEGIN
CREATE TABLE competitions (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    start_date DATETIME2,
    end_date DATETIME2,
    prize_points INT,
    questions_count INT,
    responsible_id NVARCHAR(128),
    status NVARCHAR(50) DEFAULT 'draft',
    created_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- Laundry Queue
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'laundry_queue')
BEGIN
CREATE TABLE laundry_queue (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    status NVARCHAR(50) DEFAULT 'waiting',
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- Notifications
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
BEGIN
CREATE TABLE notifications (
    id NVARCHAR(128) PRIMARY KEY,
    user_id NVARCHAR(128) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    message NVARCHAR(MAX),
    type NVARCHAR(50) DEFAULT 'info',
    is_read BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE()
);
END
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('notifications') AND name = 'tenant_id')
ALTER TABLE [dbo].[notifications] ADD [tenant_id] NVARCHAR(128) NULL;

-- Rewards Definitions
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'rewards_definitions')
BEGIN
CREATE TABLE rewards_definitions (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    points_cost INT NOT NULL,
    category NVARCHAR(100),
    stock INT DEFAULT 99,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
END

-- Student Rewards (claimed)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_rewards')
BEGIN
CREATE TABLE student_rewards (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    reward_id NVARCHAR(128) NOT NULL,
    status NVARCHAR(50) DEFAULT 'pending',
    created_by NVARCHAR(128),
    processed_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    processed_at DATETIME2,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (reward_id) REFERENCES rewards_definitions(id)
);
END

-- Decisions Log
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'decisions_log')
BEGIN
CREATE TABLE decisions_log (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128),
    action_type NVARCHAR(100),
    target_id NVARCHAR(128),
    target_table NVARCHAR(100),
    details NVARCHAR(MAX),
    status NVARCHAR(50) DEFAULT 'active',
    previous_state NVARCHAR(MAX),
    reversed_by NVARCHAR(128),
    reversed_at DATETIME2,
    created_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- User Tenant Assignments (multi-tenant bridging)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_tenant_assignments')
BEGIN
CREATE TABLE user_tenant_assignments (
    user_id NVARCHAR(128) NOT NULL,
    tenant_id NVARCHAR(128) NOT NULL,
    assigned_at DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY (user_id, tenant_id)
);
END

-- =================== NEWER TABLES (safe addition) ===================

-- Student Phones
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StudentPhones')
BEGIN
CREATE TABLE StudentPhones (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id NVARCHAR(128) NOT NULL,
    phone_type NVARCHAR(50),
    label NVARCHAR(100),
    phone_number NVARCHAR(20) NOT NULL,
    CONSTRAINT FK_StudentPhones_Students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
END

-- Web-Push subscriptions (used by POST /api/notifications/subscribe)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_push_subscriptions')
BEGIN
CREATE TABLE user_push_subscriptions (
    id NVARCHAR(128) PRIMARY KEY,
    user_id NVARCHAR(128) NOT NULL,
    endpoint NVARCHAR(1000) NOT NULL,
    subscription_json NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
);
-- NOTE: endpoint is NVARCHAR(1000) = 2000 bytes, which exceeds SQL Server's
-- 1700-byte nonclustered index key limit, so creating this index emits a
-- "maximum key length" warning. It is harmless in practice (Web Push endpoints
-- are ~200 characters) and is left as-is deliberately: SQL Server's CREATE
-- INDEX does not support prefix keys the way MySQL/SQLite do, and neither
-- narrowing the column nor adding a computed column would still be usable by
-- the app's `WHERE endpoint = ?` lookups.
CREATE INDEX idx_user_push_subscriptions_endpoint ON user_push_subscriptions (endpoint);
END

-- Student Documents
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StudentDocuments')
BEGIN
CREATE TABLE StudentDocuments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id NVARCHAR(128) NOT NULL,
    doc_type NVARCHAR(100),
    file_path NVARCHAR(MAX) NOT NULL,
    file_name NVARCHAR(255),
    upload_date DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_StudentDocuments_Students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
END

-- Item Managers (per-item permissions)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'item_managers')
BEGIN
CREATE TABLE item_managers (
    id NVARCHAR(128) PRIMARY KEY,
    user_id NVARCHAR(128) NOT NULL,
    item_id NVARCHAR(128) NOT NULL,
    item_type NVARCHAR(50) NOT NULL CHECK (item_type IN ('activity', 'competition', 'event', 'laundry', 'team')),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UQ_item_manager UNIQUE (user_id, item_id, item_type),
    CONSTRAINT FK_item_manager_user FOREIGN KEY (user_id) REFERENCES users(id)
);
END

-- Tenant Custom Roles
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tenant_custom_roles')
BEGIN
CREATE TABLE tenant_custom_roles (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    permissions NVARCHAR(MAX) NOT NULL,
    created_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
END

-- Student Archive
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_archive')
BEGIN
CREATE TABLE student_archive (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_name NVARCHAR(255),
    exit_reason NVARCHAR(255),
    exit_date DATETIME2,
    notes NVARCHAR(MAX),
    data_snapshot NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
);
END

-- Profile Shares (shared profiles for bishop/priest)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'profile_shares')
BEGIN
CREATE TABLE profile_shares (
    id NVARCHAR(128) PRIMARY KEY,
    student_id NVARCHAR(128) NOT NULL,
    shared_by_user_id NVARCHAR(128) NOT NULL,
    shared_with_user_id NVARCHAR(128) NOT NULL,
    tenant_id NVARCHAR(128) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (shared_by_user_id) REFERENCES users(id),
    FOREIGN KEY (shared_with_user_id) REFERENCES users(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
END

-- =================== COLUMN MIGRATIONS ===================

-- Add gender column to users if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'gender')
BEGIN
    ALTER TABLE users ADD gender NVARCHAR(10) DEFAULT 'male';
END

-- Account activation columns for users.
-- The grandfathering UPDATE runs only on the batch that CREATES activated_at,
-- so accounts created after the upgrade stay pending (login refused until the
-- emailed link is opened) instead of being silently marked active on a re-run.
-- sp_executesql is required: SQL Server compiles the whole batch before running
-- it, so naming `activated_at` in the same batch as the ALTER that creates it
-- fails with "Invalid column name" before anything executes.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'activated_at')
BEGIN
    ALTER TABLE users ADD activated_at DATETIME2 NULL;
    EXEC sp_executesql N'UPDATE users SET activated_at = ISNULL(created_at, GETDATE()) WHERE activated_at IS NULL;';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'activation_token_hash')
BEGIN
    ALTER TABLE users ADD activation_token_hash NVARCHAR(64) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'activation_expires_at')
BEGIN
    ALTER TABLE users ADD activation_expires_at DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'activation_sent_at')
BEGIN
    ALTER TABLE users ADD activation_sent_at DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_users_activation_token_hash' AND object_id = OBJECT_ID('users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_users_activation_token_hash ON users (activation_token_hash);
END

-- Add available_payment_methods to events if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('events') AND name = 'available_payment_methods')
BEGIN
    ALTER TABLE events ADD available_payment_methods NVARCHAR(MAX);
END

-- =================== COMPOSITE COLUMNS CHECKS ===================

-- Add student_id column to attendance if not exists (flexibility)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('attendance') AND name = 'student_id')
BEGIN
    ALTER TABLE attendance ADD student_id NVARCHAR(128);
END

-- Add tenant_id to student_warnings if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_warnings') AND name = 'tenant_id')
BEGIN
    ALTER TABLE student_warnings ADD tenant_id NVARCHAR(128);
END

-- Add tenant_id to student_points if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_points') AND name = 'tenant_id')
BEGIN
    ALTER TABLE student_points ADD tenant_id NVARCHAR(128);
END

-- =================== BROADCAST / NEWS SYSTEM ===================

-- Broadcasts (news ticker + daily messages)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'broadcasts')
BEGIN
CREATE TABLE broadcasts (
    id NVARCHAR(128) PRIMARY KEY,
    sender_id NVARCHAR(128) NOT NULL,
    sender_role NVARCHAR(50) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    content NVARCHAR(MAX),
    display_type NVARCHAR(20) DEFAULT 'both' CHECK (display_type IN ('news', 'messages', 'both')),
    priority NVARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    status NVARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired')),
    targeting NVARCHAR(MAX) DEFAULT '{}',
    visible_in_ticker INT DEFAULT 1,
    visible_in_messages INT DEFAULT 1,
    link_action NVARCHAR(MAX),
    private_recipient_id NVARCHAR(128),
    parent_message_id NVARCHAR(128),
    start_at DATETIME2,
    end_at DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
END

-- Broadcast attachments (images, voice, video, files, links)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'broadcast_attachments')
BEGIN
CREATE TABLE broadcast_attachments (
    id NVARCHAR(128) PRIMARY KEY,
    broadcast_id NVARCHAR(128) NOT NULL,
    type NVARCHAR(20) NOT NULL CHECK (type IN ('image', 'voice', 'video', 'file', 'link')),
    url NVARCHAR(MAX) NOT NULL,
    name NVARCHAR(255),
    size INT DEFAULT 0,
    mime_type NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE
);
END

-- Broadcast read tracking
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'broadcast_reads')
BEGIN
CREATE TABLE broadcast_reads (
    id NVARCHAR(128) PRIMARY KEY,
    broadcast_id NVARCHAR(128) NOT NULL,
    user_id NVARCHAR(128) NOT NULL,
    read_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE
);
END

-- =================== EVENTS & ATTENDANCE ===================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_attendance_detailed')
BEGIN
CREATE TABLE event_attendance_detailed (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    session_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    status NVARCHAR(50) DEFAULT 'present',
    absence_reason NVARCHAR(500) NULL,
    notified_parent BIT DEFAULT 0,
    notified_priest BIT DEFAULT 0,
    created_by NVARCHAR(128) NULL,
    tenant_id NVARCHAR(128) NULL,
    is_paid BIT DEFAULT 0,
    final_status NVARCHAR(30) NULL CHECK (final_status IN ('PENDING_REVIEW','UNEXCUSED','EXCUSED','TRAVEL')),
    reviewed_by NVARCHAR(128) NULL,
    reviewed_at DATETIME2 NULL,
    applied_rules_snapshot NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_criteria')
BEGIN
CREATE TABLE event_criteria (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    max_score INT DEFAULT 10,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (event_id) REFERENCES events(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_responsible')
BEGIN
CREATE TABLE event_responsible (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    user_id NVARCHAR(128) NOT NULL,
    type NVARCHAR(50),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_sessions')
BEGIN
CREATE TABLE event_sessions (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    tenant_id NVARCHAR(128) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    start_time DATETIME2,
    type NVARCHAR(50) DEFAULT 'session',
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_teams')
BEGIN
CREATE TABLE event_teams (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    tenant_id NVARCHAR(128) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    score INT DEFAULT 0,
    responsible_id NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX idx_event_teams_event_id ON event_teams (event_id);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_team_members')
BEGIN
CREATE TABLE event_team_members (
    event_team_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    points_earned INT DEFAULT 0,
    FOREIGN KEY (event_team_id) REFERENCES event_teams(id)
);
CREATE INDEX idx_event_team_members_team ON event_team_members (event_team_id);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_scores')
BEGIN
CREATE TABLE event_scores (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    team_id NVARCHAR(128),
    student_id NVARCHAR(128),
    criterion_id NVARCHAR(128),
    score INT NOT NULL,
    scored_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (event_id) REFERENCES events(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_registrations')
BEGIN
CREATE TABLE event_registrations (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    status NVARCHAR(50) DEFAULT 'registered',
    registered_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'payment_methods')
BEGIN
CREATE TABLE payment_methods (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    phone_number NVARCHAR(50) NULL,
    type NVARCHAR(50) DEFAULT 'instapay',
    is_active BIT DEFAULT 1,
    created_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_subscriptions')
BEGIN
CREATE TABLE event_subscriptions (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    user_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NULL,
    status NVARCHAR(50) DEFAULT 'pending',
    payment_method_id NVARCHAR(128) NULL,
    payment_status NVARCHAR(50) DEFAULT 'unpaid',
    receipt_image NVARCHAR(500) NULL,
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_payments')
BEGIN
CREATE TABLE event_payments (
    id NVARCHAR(128) PRIMARY KEY,
    event_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    payment_method_id NVARCHAR(128) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status NVARCHAR(50) DEFAULT 'pending',
    paid_at DATETIME2,
    confirmed_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);
END

-- =================== LAUNDRY ===================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'laundry_operators')
BEGIN
CREATE TABLE laundry_operators (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    user_id NVARCHAR(128) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'laundry_settings')
BEGIN
CREATE TABLE laundry_settings (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL FOREIGN KEY REFERENCES tenants(id),
    days NVARCHAR(MAX) NOT NULL,
    start_hour NVARCHAR(50) NOT NULL,
    end_hour NVARCHAR(50) NOT NULL
);
END

-- =================== PRIEST & SUPERVISOR ===================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'priest_reports')
BEGIN
CREATE TABLE priest_reports (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    type NVARCHAR(50),
    student_ids NVARCHAR(MAX),
    supervisor_id NVARCHAR(128),
    status NVARCHAR(50) DEFAULT 'pending',
    created_at DATETIME2 DEFAULT GETDATE(),
    approved_at DATETIME2,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (supervisor_id) REFERENCES users(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'supervisor_contacts')
BEGIN
CREATE TABLE supervisor_contacts (
    id NVARCHAR(128) PRIMARY KEY,
    user_id NVARCHAR(128) NOT NULL,
    tenant_id NVARCHAR(128) NOT NULL,
    phone_numbers NVARCHAR(MAX) DEFAULT '[]',
    available_from NVARCHAR(10),
    available_to NVARCHAR(10),
    available_days NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
END

-- =================== NOTES & BADGES ===================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_notes')
BEGIN
CREATE TABLE student_notes (
    id NVARCHAR(128) PRIMARY KEY,
    student_id NVARCHAR(128) NOT NULL,
    tenant_id NVARCHAR(128) NOT NULL,
    author_id NVARCHAR(128) NOT NULL,
    author_role NVARCHAR(50) NOT NULL,
    author_name NVARCHAR(255),
    content NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'badges')
BEGIN
CREATE TABLE badges (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128),
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    icon NVARCHAR(50) DEFAULT 'Award',
    color NVARCHAR(50) DEFAULT 'amber',
    category NVARCHAR(50) DEFAULT 'housing',
    created_by NVARCHAR(128),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_badges')
BEGIN
CREATE TABLE student_badges (
    id NVARCHAR(128) PRIMARY KEY,
    student_id NVARCHAR(128) NOT NULL,
    badge_id NVARCHAR(128) NOT NULL,
    awarded_by NVARCHAR(128),
    awarded_at DATETIME2 DEFAULT GETDATE(),
    reason NVARCHAR(MAX),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (badge_id) REFERENCES badges(id)
);
END

-- =================== AUDIT & SECURITY ===================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_logs')
BEGIN
CREATE TABLE audit_logs (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128),
    user_id NVARCHAR(128),
    user_email NVARCHAR(255),
    user_role NVARCHAR(50),
    action NVARCHAR(255) NOT NULL,
    entity_type NVARCHAR(128),
    entity_id NVARCHAR(128),
    method NVARCHAR(20) NOT NULL,
    path NVARCHAR(255) NOT NULL,
    status NVARCHAR(50),
    details NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'token_blacklist')
BEGIN
CREATE TABLE token_blacklist (
    id NVARCHAR(128) PRIMARY KEY,
    token_hash NVARCHAR(64) NOT NULL,
    user_id NVARCHAR(128) NOT NULL,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);
CREATE INDEX IX_token_blacklist_token_hash ON token_blacklist(token_hash);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'role_permissions')
BEGIN
CREATE TABLE role_permissions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    role NVARCHAR(50) NOT NULL,
    permission NVARCHAR(100) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UQ_Role_Permission UNIQUE (role, permission)
);
END

-- =================== EVENT / SESSION ATTENDANCE MANAGEMENT ===================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_attendance_rules')
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
CREATE UNIQUE INDEX UQ_event_attendance_rule_default ON event_attendance_rules (event_id) WHERE session_id IS NULL;
END

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

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_attendance_detailed_final_status' AND object_id = OBJECT_ID('event_attendance_detailed'))
  AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_attendance_detailed') AND name = 'final_status')
CREATE INDEX IX_event_attendance_detailed_final_status ON event_attendance_detailed (event_id, final_status);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance_penalties')
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
CREATE UNIQUE INDEX UQ_attendance_penalties_active ON attendance_penalties (attendance_id) WHERE status = 'APPLIED';
CREATE INDEX IX_attendance_penalties_student_id ON attendance_penalties (student_id);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance_excuses')
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
CREATE UNIQUE INDEX UQ_attendance_excuse_per_attendance ON attendance_excuses (attendance_id) WHERE attendance_id IS NOT NULL;
CREATE INDEX IX_attendance_excuses_student_id ON attendance_excuses (student_id);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance_policy')
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
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance_policy_versions')
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
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'disciplinary_cases')
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
CREATE UNIQUE INDEX UQ_open_disciplinary_cases ON disciplinary_cases (student_id, case_type) WHERE status IN ('OPEN','UNDER_REVIEW');
CREATE INDEX IX_disciplinary_cases_student_id ON disciplinary_cases (student_id);
END

-- Residence absence system: last known presence (one row per student).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_presence')
BEGIN
CREATE TABLE student_presence (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    last_lat DECIMAL(10,7) NULL,
    last_lng DECIMAL(10,7) NULL,
    accuracy INT NULL,
    inside BIT NULL,
    source NVARCHAR(20) NULL,
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
CREATE UNIQUE INDEX UX_student_presence_student ON student_presence (student_id);
CREATE INDEX IX_student_presence_tenant ON student_presence (tenant_id, updated_at);
END

-- Residence absence cases: one per (tenant, student, lock-date).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_absence_cases')
BEGIN
CREATE TABLE student_absence_cases (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    lock_date DATE NOT NULL,
    lock_time NVARCHAR(10) NULL,
    state NVARCHAR(20) NOT NULL DEFAULT 'unconfirmed',
    evidence_lat DECIMAL(10,7) NULL,
    evidence_lng DECIMAL(10,7) NULL,
    evidence_accuracy INT NULL,
    evidence_at DATETIME2 NULL,
    notified_supervisor_at DATETIME2 NULL,
    notified_guardian_at DATETIME2 NULL,
    last_notified_at DATETIME2 NULL,
    escalation_count INT NOT NULL DEFAULT 0,
    ack_by NVARCHAR(128) NULL,
    ack_at DATETIME2 NULL,
    decision_action NVARCHAR(30) NULL,
    decision_notes NVARCHAR(MAX) NULL,
    decided_by NVARCHAR(128) NULL,
    decided_at DATETIME2 NULL,
    escalated_to_priest BIT NOT NULL DEFAULT 0,
    priest_note NVARCHAR(MAX) NULL,
    fine_amount DECIMAL(10,2) NULL,
    financial_state NVARCHAR(20) NULL,
    ledger_entry_id NVARCHAR(128) NULL,
    warning_id NVARCHAR(128) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NULL
);
CREATE UNIQUE INDEX UX_absence_cases_per_day ON student_absence_cases (tenant_id, student_id, lock_date);
CREATE INDEX IX_absence_cases_tenant_state ON student_absence_cases (tenant_id, state, lock_date);
END

-- Supervisor roll-call (المناداة): human-confirmed night check.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'roll_calls')
BEGIN
CREATE TABLE roll_calls (
    id NVARCHAR(128) PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    lock_date DATE NOT NULL,
    lock_time NVARCHAR(10) NULL,
    state NVARCHAR(20) NOT NULL DEFAULT 'open',
    present_count INT NOT NULL DEFAULT 0,
    absent_count INT NOT NULL DEFAULT 0,
    unmarked_count INT NOT NULL DEFAULT 0,
    excluded_count INT NOT NULL DEFAULT 0,
    notes NVARCHAR(MAX) NULL,
    started_by NVARCHAR(128) NULL,
    started_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    submitted_by NVARCHAR(128) NULL,
    submitted_at DATETIME2 NULL,
    published_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NULL
);
CREATE UNIQUE INDEX UX_roll_calls_per_day ON roll_calls (tenant_id, lock_date);
CREATE INDEX IX_roll_calls_tenant_state ON roll_calls (tenant_id, state, lock_date);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'roll_call_entries')
BEGIN
CREATE TABLE roll_call_entries (
    id NVARCHAR(128) PRIMARY KEY,
    roll_call_id NVARCHAR(128) NOT NULL,
    tenant_id NVARCHAR(128) NOT NULL,
    student_id NVARCHAR(128) NOT NULL,
    student_name NVARCHAR(255) NULL,
    mark NVARCHAR(20) NOT NULL DEFAULT 'unmarked',
    presence_status NVARCHAR(20) NULL,
    is_traveling BIT NOT NULL DEFAULT 0,
    evidence_lat DECIMAL(10,7) NULL,
    evidence_lng DECIMAL(10,7) NULL,
    evidence_accuracy INT NULL,
    evidence_at DATETIME2 NULL,
    note NVARCHAR(MAX) NULL,
    absence_case_id NVARCHAR(128) NULL,
    answer_at DATETIME2 NULL,
    answer_mark NVARCHAR(20) NULL,
    answer_inside BIT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NULL
);
CREATE UNIQUE INDEX UX_roll_call_entries_student ON roll_call_entries (roll_call_id, student_id);
CREATE INDEX IX_roll_call_entries_tenant ON roll_call_entries (tenant_id, roll_call_id);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_absence_cases') AND name = 'source')
ALTER TABLE [dbo].[student_absence_cases] ADD [source] NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('student_absence_cases') AND name = 'roll_call_id')
ALTER TABLE [dbo].[student_absence_cases] ADD [roll_call_id] NVARCHAR(128) NULL;
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_absence_cases_roll_call' AND object_id = OBJECT_ID('student_absence_cases'))
CREATE INDEX IX_absence_cases_roll_call ON student_absence_cases (roll_call_id);
