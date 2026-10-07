import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('radio_tracks', (table) => {
    table.string('stream_url', 500).nullable();
    table.text('description').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('radio_tracks', (table) => {
    table.dropColumn('stream_url');
    table.dropColumn('description');
  });
}
