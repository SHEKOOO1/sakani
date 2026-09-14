import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('radio_live_subscriptions'))) {
    await knex.schema.createTable('radio_live_subscriptions', (table) => {
      table.string('id', 128).primary();
      table.string('user_id', 128).notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['user_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('radio_live_subscriptions')) {
    await knex.schema.dropTable('radio_live_subscriptions');
  }
}
