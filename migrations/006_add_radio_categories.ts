import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('radio_categories'))) {
    await knex.schema.createTable('radio_categories', (table) => {
      table.string('id', 128).primary();
      table.string('name', 255).notNullable();
      table.text('description').nullable();
      table.string('cover_image', 500).nullable();
      table.integer('sort_order').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.string('created_by', 128).nullable().references('id').inTable('users').onDelete('SET NULL');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.dateTime('updated_at').defaultTo(knex.fn.now());
    });
  }

  const hasCatId = await knex.schema.hasColumn('radio_playlists', 'category_id');
  if (!hasCatId) {
    await knex.schema.alterTable('radio_playlists', (table) => {
      table.string('category_id', 128).nullable().references('id').inTable('radio_categories').onDelete('SET NULL');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('radio_playlists', 'category_id')) {
    await knex.schema.alterTable('radio_playlists', (table) => {
      table.dropColumn('category_id');
    });
  }
  if (await knex.schema.hasTable('radio_categories')) {
    await knex.schema.dropTable('radio_categories');
  }
}
