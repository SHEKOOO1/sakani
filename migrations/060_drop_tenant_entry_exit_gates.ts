import type { Knex } from 'knex';

/**
 * Drop the obsolete per-door geofence columns on `tenants`.
 *
 * The app is now centre-only: both check-in and check-out validate against the
 * single dorm circle (`location_lat` / `location_lng` / `location_radius`). The
 * legacy `entry_*` / `exit_*` columns are no longer read or written anywhere, so
 * they are removed here to stop the schema from implying behaviour that no
 * longer exists.
 *
 * Reversible: `down` restores the six nullable/defaulted columns.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DECLARE @col NVARCHAR(50), @dc NVARCHAR(200), @sql NVARCHAR(MAX);
    DECLARE cols CURSOR FOR
      SELECT name FROM sys.columns
      WHERE object_id = OBJECT_ID('tenants')
        AND name IN ('entry_lat','entry_lng','entry_radius','exit_lat','exit_lng','exit_radius');
    OPEN cols;
    FETCH NEXT FROM cols INTO @col;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      SET @dc = NULL;
      SELECT @dc = dc.name FROM sys.default_constraints dc
        WHERE dc.parent_object_id = OBJECT_ID('tenants')
          AND dc.parent_column_id = COLUMNPROPERTY(OBJECT_ID('tenants'), @col, 'ColumnId');
      IF @dc IS NOT NULL EXEC('ALTER TABLE [dbo].[tenants] DROP CONSTRAINT [' + @dc + ']');
      SET @sql = 'ALTER TABLE [dbo].[tenants] DROP COLUMN [' + @col + ']';
      EXEC(@sql);
      FETCH NEXT FROM cols INTO @col;
    END
    CLOSE cols;
    DEALLOCATE cols;
  `);

  console.log('Tenants: dropped legacy entry_*/exit_* geofence columns (centre-only geofence)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'entry_lat')
      ALTER TABLE [dbo].[tenants] ADD [entry_lat] DECIMAL(10,7) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'entry_lng')
      ALTER TABLE [dbo].[tenants] ADD [entry_lng] DECIMAL(10,7) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'entry_radius')
      ALTER TABLE [dbo].[tenants] ADD [entry_radius] INT DEFAULT 50;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'exit_lat')
      ALTER TABLE [dbo].[tenants] ADD [exit_lat] DECIMAL(10,7) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'exit_lng')
      ALTER TABLE [dbo].[tenants] ADD [exit_lng] DECIMAL(10,7) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'exit_radius')
      ALTER TABLE [dbo].[tenants] ADD [exit_radius] INT DEFAULT 50;
  `);
}
