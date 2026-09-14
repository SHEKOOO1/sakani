import type { Knex } from 'knex';

// rooms and students are updated by the backend (e.g. room-price edits) but
// lacked an updated_at column, causing "Invalid column name 'updated_at'".
export async function up(knex: Knex): Promise<void> {
  const hasRoomsUpdatedAt = await knex.schema.hasColumn('rooms', 'updated_at');
  if (!hasRoomsUpdatedAt) {
    await knex.schema.alterTable('rooms', (t) => {
      t.timestamp('updated_at').nullable();
    });
  }

  const hasStudentsUpdatedAt = await knex.schema.hasColumn('students', 'updated_at');
  if (!hasStudentsUpdatedAt) {
    await knex.schema.alterTable('students', (t) => {
      t.timestamp('updated_at').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rooms', (t) => { t.dropColumn('updated_at'); }).catch(() => undefined);
  await knex.schema.alterTable('students', (t) => { t.dropColumn('updated_at'); }).catch(() => undefined);
}