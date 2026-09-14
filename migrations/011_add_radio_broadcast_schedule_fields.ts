import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('radio_broadcasts')) {
    const hasHost = await knex.schema.hasColumn('radio_broadcasts', 'host_name');
    if (!hasHost) {
      await knex.schema.alterTable('radio_broadcasts', (table) => {
        table.string('cover_image', 500).nullable();
        table.string('host_name', 255).nullable();
        table.string('guest_name', 255).nullable();
        table.boolean('recurring').defaultTo(false);
        table.string('recurring_day', 20).nullable();
        table.string('recurring_time', 10).nullable();
        table.string('type', 20).defaultTo('audio');
        table.boolean('is_pinned').defaultTo(false);
        table.string('playlist_id', 128).nullable().references('id').inTable('radio_playlists').onDelete('SET NULL');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('radio_broadcasts')) {
    await knex.schema.alterTable('radio_broadcasts', (table) => {
      table.dropColumn('cover_image');
      table.dropColumn('host_name');
      table.dropColumn('guest_name');
      table.dropColumn('recurring');
      table.dropColumn('recurring_day');
      table.dropColumn('recurring_time');
      table.dropColumn('type');
      table.dropColumn('is_pinned');
    });
  }
}
