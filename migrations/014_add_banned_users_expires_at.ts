import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('radio_banned_users')) {
    const hasExpiresAt = await knex.schema.hasColumn('radio_banned_users', 'expires_at');
    if (!hasExpiresAt) {
      await knex.schema.alterTable('radio_banned_users', (table) => {
        table.timestamp('expires_at').nullable();
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('radio_banned_users')) {
    const hasExpiresAt = await knex.schema.hasColumn('radio_banned_users', 'expires_at');
    if (hasExpiresAt) {
      await knex.schema.alterTable('radio_banned_users', (table) => {
        table.dropColumn('expires_at');
      });
    }
  }
}
