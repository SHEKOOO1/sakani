import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
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
  `);
  console.log('Ensured students academic/identity columns (name, email, phone, whatsapp_number, gender, birth_date, college, major, university, enrollment_year, academic_year, graduation_year, national_id, id_card_number, address, student_photo, guardian_*)');
}

export async function down(knex: Knex): Promise<void> {
  // Additive columns required by the students list/dashboard APIs; no rollback.
}