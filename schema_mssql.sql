-- ============================================================
-- DormMaster Schema - Full Database Schema
-- All tables with IF NOT EXISTS for safe re-execution
-- ============================================================

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
    created_at DATETIME2 DEFAULT GETDATE(),
    is_active BIT DEFAULT 1,
    location_lat DECIMAL(10,7),
    location_lng DECIMAL(10,7),
    location_radius INT DEFAULT 50,
    entry_lat DECIMAL(10,7),
    entry_lng DECIMAL(10,7),
    entry_radius INT DEFAULT 50,
    exit_lat DECIMAL(10,7),
    exit_lng DECIMAL(10,7),
    exit_radius INT DEFAULT 50,
    curfew_time NVARCHAR(20),
    open_time NVARCHAR(20)
);
END

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
    created_at DATETIME2 DEFAULT GETDATE()
);
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
    travel_start_time DATETIME2,
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

-- =================== PAYMENTS ===================

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