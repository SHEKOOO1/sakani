import type { Knex } from 'knex';

/**
 * Room creation was failing for every supervisor and admin, so the housing
 * section could never be used: there are 9 apartments and 0 rooms in the
 * production database.
 *
 * `POST /api/rooms` and `PUT /api/rooms/:id` (see src/backend/api/room.routes.ts)
 * write the apartment amenity set:
 *
 *   amenities, has_kitchen, kitchen_details, has_bathroom, bathroom_details
 *
 * but migration 038 only ever added that set to `apartments`, and migration 039
 * only added the three `price_*` columns to `rooms`. The route swallowed the
 * resulting `Invalid column name 'amenities'` into a generic
 * "فشل العملية. تحقق من البيانات وحاول مرة أخرى." with HTTP 400, which looks
 * like a validation problem to the user.
 *
 * Column types and constraints mirror `apartments` (migration 038) so both
 * housing levels behave identically.
 *
 * Idempotent: safe on fresh and drifted databases, and safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'amenities')
      ALTER TABLE [dbo].[rooms] ADD [amenities] NVARCHAR(MAX) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'has_kitchen')
      ALTER TABLE [dbo].[rooms] ADD [has_kitchen] BIT NOT NULL CONSTRAINT DF_rooms_has_kitchen DEFAULT 0;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'kitchen_details')
      ALTER TABLE [dbo].[rooms] ADD [kitchen_details] NVARCHAR(MAX) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'has_bathroom')
      ALTER TABLE [dbo].[rooms] ADD [has_bathroom] BIT NOT NULL CONSTRAINT DF_rooms_has_bathroom DEFAULT 0;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rooms') AND name = 'bathroom_details')
      ALTER TABLE [dbo].[rooms] ADD [bathroom_details] NVARCHAR(MAX) NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Additive columns required by the application; no rollback.
}