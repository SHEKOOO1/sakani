import type { Knex } from 'knex';

/**
 * Trusted-device binding for students.
 *
 * A web app / PWA cannot read a device's real MAC address (browsers do not
 * expose it, and on iOS/Android it is random or unavailable). Faking a MAC is
 * therefore not an option; instead the server issues a random, opaque device
 * token at registration, stores only its SHA-256 hash, and requires an
 * administrator to *approve* the device before it is trusted. This ref is an
 * additional signal only — it is never a substitute for the geofence and can
 * never authorise a check-in by itself.
 *
 * Additive and reversible: creates one new table.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF OBJECT_ID('student_devices') IS NULL
    BEGIN
      CREATE TABLE [dbo].[student_devices] (
        [id]                NVARCHAR(128) NOT NULL PRIMARY KEY,
        [tenant_id]         NVARCHAR(128) NOT NULL,
        [student_id]        NVARCHAR(128) NOT NULL,
        [device_token_hash] NVARCHAR(128) NOT NULL,
        [label]             NVARCHAR(100) NULL,
        [platform]          NVARCHAR(40)  NULL,
        [user_agent]        NVARCHAR(400) NULL,
        [status]            NVARCHAR(20)  NOT NULL DEFAULT 'pending',
        [approved_by]       NVARCHAR(128) NULL,
        [approved_at]       DATETIME2     NULL,
        [last_seen_at]      DATETIME2     NULL,
        [revoked_at]        DATETIME2     NULL,
        [created_at]        DATETIME2     NOT NULL DEFAULT GETDATE()
      );
    END;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_student_devices_token' AND object_id = OBJECT_ID('student_devices'))
      CREATE UNIQUE INDEX [UX_student_devices_token] ON [dbo].[student_devices] ([device_token_hash]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_student_devices_tenant_student' AND object_id = OBJECT_ID('student_devices'))
      CREATE INDEX [IX_student_devices_tenant_student] ON [dbo].[student_devices] ([tenant_id], [student_id]);
  `);

  console.log('Devices: student_devices table added (server-issued tokens, admin approval)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_student_devices_tenant_student' AND object_id = OBJECT_ID('student_devices'))
      DROP INDEX [IX_student_devices_tenant_student] ON [dbo].[student_devices];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_student_devices_token' AND object_id = OBJECT_ID('student_devices'))
      DROP INDEX [UX_student_devices_token] ON [dbo].[student_devices];
    IF OBJECT_ID('student_devices') IS NOT NULL
      DROP TABLE [dbo].[student_devices];
  `);
}
