import type { Knex } from 'knex';

// Session-invalidation version counter on users.
// Every password change (admin reset or self-service) increments this column,
// and JWTs embed it as `tokenVersion`. `authenticate`/`resolveSocketUser`
// reject any token whose `tokenVersion` no longer matches the DB value, so
// all previously-issued sessions for the user die immediately on change.
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('users', 'token_version');
  if (!hasColumn) {
    await knex.schema.alterTable('users', (t) => {
      t.integer('token_version').notNullable().defaultTo(0);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .alterTable('users', (t) => {
      t.dropColumn('token_version');
    })
    .catch(() => undefined);
}