import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('radio_video_comments'))) {
    await knex.schema.createTable('radio_video_comments', (table) => {
      table.string('id', 128).primary();
      table.string('video_id', 128).notNullable().references('id').inTable('radio_videos').onDelete('CASCADE');
      table.string('user_id', 128).notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('user_name', 255).notNullable();
      table.string('user_role', 50).nullable();
      table.text('message').notNullable();
      table.boolean('is_hidden').defaultTo(false);
      table.dateTime('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('radio_video_comments');
}
