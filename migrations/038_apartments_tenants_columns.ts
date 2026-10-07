import type { Knex } from 'knex';

// Reconciles the legacy schema_mssql.sql baseline with the columns the
// application actually reads/writes. `apartments` was created with only the
// core identity columns, so the student list (which joins
// `a.building as apartment_building`) and the housing screens failed with
// "Invalid column name 'building'". `tenants.location` is selected as
// `tenant_governorate` in several student queries.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
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

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'location')
    ALTER TABLE [dbo].[tenants] ADD [location] NVARCHAR(500) NULL;
  `);
  console.log('Ensured apartments (building, is_active, amenities, has_kitchen, kitchen_details, has_bathroom, bathroom_details) and tenants (location) columns');
}

export async function down(knex: Knex): Promise<void> {
  // Additive columns required by the housing/student APIs; no rollback.
}