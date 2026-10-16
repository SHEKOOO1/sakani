import type { Knex } from 'knex';

/**
 * Apartment/room ordering + room enable/disable.
 *
 *   apartments.sort_order – manual display order (drag & drop)
 *   rooms.sort_order      – manual display order inside its apartment
 *   rooms.is_active       – 1 = enabled, 0 = locked/closed ("مقفولة")
 *
 * Idempotent: every ALTER is guarded with IF NOT EXISTS on sys.columns.
 * Mirrors the boot-time reconciliation in src/backend/infrastructure/db.ts.
 */
export async function up(knex: Knex): Promise<void> {
  const addColumn = async (table: string, name: string, type: string) => {
    await knex.raw(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${name}')
        ALTER TABLE [dbo].[${table}] ADD [${name}] ${type};
    `);
  };

  await addColumn('apartments', 'sort_order', 'INT NULL');
  await addColumn('rooms', 'sort_order', 'INT NULL');
  await addColumn('rooms', 'is_active', 'BIT NOT NULL CONSTRAINT DF_rooms_is_active DEFAULT (1)');

  // Backfill existing rooms as active (belt & braces for rows created before the default).
  await knex.raw(`UPDATE [dbo].[rooms] SET [is_active] = 1 WHERE [is_active] IS NULL;`);

  console.log('Apartment/room ordering + status migration applied');
}

export async function down(knex: Knex): Promise<void> {
  const dropColumn = async (table: string, name: string) => {
    await knex.raw(`
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${name}')
        ALTER TABLE [dbo].[${table}] DROP COLUMN [${name}];
    `);
  };

  await dropColumn('rooms', 'is_active');
  await dropColumn('rooms', 'sort_order');
  await dropColumn('apartments', 'sort_order');
}
