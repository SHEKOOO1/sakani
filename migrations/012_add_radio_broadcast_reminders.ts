import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('radio_broadcast_reminders'))) {
    await knex.schema.createTable('radio_broadcast_reminders', (table) => {
      table.string('id', 128).primary();
      table.string('broadcast_id', 128).notNullable().references('id').inTable('radio_broadcasts').onDelete('CASCADE');
      table.string('user_id', 128).notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['broadcast_id', 'user_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('radio_broadcast_reminders')) {
    await knex.schema.dropTable('radio_broadcast_reminders');
  }
}
