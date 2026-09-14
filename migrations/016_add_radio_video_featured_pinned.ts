import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('radio_videos', 'is_featured'))) {
    await knex.schema.alterTable('radio_videos', (table) => {
      table.boolean('is_featured').defaultTo(false);
    });
  }
  if (!(await knex.schema.hasColumn('radio_videos', 'is_pinned'))) {
    await knex.schema.alterTable('radio_videos', (table) => {
      table.boolean('is_pinned').defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('radio_videos', 'is_featured')) {
    await knex.schema.alterTable('radio_videos', (table) => {
      table.dropColumn('is_featured');
    });
  }
  if (await knex.schema.hasColumn('radio_videos', 'is_pinned')) {
    await knex.schema.alterTable('radio_videos', (table) => {
      table.dropColumn('is_pinned');
    });
  }
}
