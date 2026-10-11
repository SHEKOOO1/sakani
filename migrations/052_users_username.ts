import type { Knex } from 'knex';

/**
 * اسم المستخدم (username) كمعرّف دخول بديل عن البريد الإلكتروني.
 *
 * - يضيف عمود `username` الفريد عالمياً (فهرس مفلتر يتجاهل NULL) حتى يكون
 *   الدخول بلا سياق سكن قابلاً للتمييز.
 * - يجعل البريد الإلكتروني اختيارياً: قيد UNIQUE العادي في SQL Server يعامل كل
 *   قيم NULL كمتساوية (يسمح بـ NULL واحد فقط)، لذا نستبدله بفهرس فريد مفلتر
 *   يسمح بكل الحسابات التي تدخل باسم المستخدم فقط دون بريد.
 *
 * Idempotent: كل خطوة محروسة، وآمنة على قواعد بيانات جديدة أو منحرفة.
 * يطابق التوفيق الجاري عند الإقلاع في src/backend/infrastructure/db.ts.
 */
export async function up(knex: Knex): Promise<void> {
  // لا يمكن إنشاء فهرس على عمود جديد داخل نفس الدفعة التي تضيفه (SQL Server
  // يترجم الدفعة كاملة قبل التنفيذ) — لذا نضيف العمود أولاً في دفعة مستقلة.
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'username')
      ALTER TABLE [dbo].[users] ADD [username] NVARCHAR(100) NULL;
  `);

  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'email' AND is_nullable = 0)
      ALTER TABLE [dbo].[users] ALTER COLUMN [email] NVARCHAR(255) NULL;

    IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_Users_Email' AND type = 'UQ' AND parent_object_id = OBJECT_ID('users'))
      ALTER TABLE [dbo].[users] DROP CONSTRAINT [UQ_Users_Email];

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_email' AND object_id = OBJECT_ID('users'))
      CREATE UNIQUE INDEX [UX_users_email] ON [dbo].[users] ([email]) WHERE [email] IS NOT NULL;
  `);

  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_username' AND object_id = OBJECT_ID('users'))
      CREATE UNIQUE INDEX [UX_users_username] ON [dbo].[users] ([username]) WHERE [username] IS NOT NULL;
  `);

  console.log('Users username migration applied');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_username' AND object_id = OBJECT_ID('users'))
      DROP INDEX [UX_users_username] ON [dbo].[users];

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_email' AND object_id = OBJECT_ID('users'))
      DROP INDEX [UX_users_email] ON [dbo].[users];

    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_Users_Email' AND type = 'UQ' AND parent_object_id = OBJECT_ID('users'))
      ALTER TABLE [dbo].[users] ADD CONSTRAINT [UQ_Users_Email] UNIQUE ([email]);

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'username')
      ALTER TABLE [dbo].[users] DROP COLUMN [username];
  `);
}
