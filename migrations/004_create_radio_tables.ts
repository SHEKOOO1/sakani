import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = (t: string) => knex.schema.hasTable(t);

  if (!(await hasTable('radio_tracks'))) {
    await knex.schema.createTable('radio_tracks', (table) => {
      table.string('id', 128).primary();
      table.string('title', 255).notNullable();
      table.string('artist', 255).nullable();
      table.string('cover_url', 500).nullable();
      table.string('album', 255).nullable();
      table.integer('duration').nullable();
      table.boolean('is_current').defaultTo(false);
      table.integer('likes_count').defaultTo(0);
      table.dateTime('played_at').nullable();
      table.dateTime('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('radio_likes'))) {
    await knex.schema.createTable('radio_likes', (table) => {
      table.string('id', 128).primary();
      table.string('track_id', 128).notNullable().references('id').inTable('radio_tracks').onDelete('CASCADE');
      table.string('user_id', 128).notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.unique(['track_id', 'user_id']);
    });
  }

  if (!(await hasTable('radio_videos'))) {
    await knex.schema.createTable('radio_videos', (table) => {
      table.string('id', 128).primary();
      table.string('title', 255).notNullable();
      table.text('description').nullable();
      table.string('youtube_url', 500).notNullable();
      table.string('youtube_id', 50).notNullable();
      table.string('category', 50).nullable();
      table.string('program', 50).nullable();
      table.string('tags', 500).nullable();
      table.string('thumbnail', 500).nullable();
      table.string('duration', 20).nullable();
      table.integer('views').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.string('uploaded_by', 128).nullable().references('id').inTable('users').onDelete('SET NULL');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.dateTime('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('radio_broadcasts'))) {
    await knex.schema.createTable('radio_broadcasts', (table) => {
      table.string('id', 128).primary();
      table.string('title', 255).notNullable();
      table.text('description').nullable();
      table.string('stream_url', 500).notNullable();
      table.boolean('is_active').defaultTo(true);
      table.dateTime('scheduled_at').nullable();
      table.string('created_by', 128).nullable().references('id').inTable('users').onDelete('SET NULL');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.dateTime('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('radio_playlists'))) {
    await knex.schema.createTable('radio_playlists', (table) => {
      table.string('id', 128).primary();
      table.string('name', 255).notNullable();
      table.text('description').nullable();
      table.string('cover_image', 500).nullable();
      table.boolean('is_active').defaultTo(true);
      table.string('created_by', 128).nullable().references('id').inTable('users').onDelete('SET NULL');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.dateTime('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('radio_playlist_items'))) {
    await knex.schema.createTable('radio_playlist_items', (table) => {
      table.string('id', 128).primary();
      table.string('playlist_id', 128).notNullable().references('id').inTable('radio_playlists').onDelete('CASCADE');
      table.string('item_type', 20).notNullable().defaultTo('song');
      table.string('item_id', 128).nullable();
      table.string('item_title', 255).nullable();
      table.string('item_thumbnail', 500).nullable();
      table.integer('sort_order').defaultTo(0);
      table.dateTime('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('radio_chat_messages'))) {
    await knex.schema.createTable('radio_chat_messages', (table) => {
      table.string('id', 128).primary();
      table.string('user_id', 128).notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('user_name', 255).nullable();
      table.string('user_role', 50).nullable();
      table.text('message').notNullable();
      table.boolean('is_hidden').defaultTo(false);
      table.dateTime('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('radio_banned_users'))) {
    await knex.schema.createTable('radio_banned_users', (table) => {
      table.string('id', 128).primary();
      table.string('user_id', 128).notNullable().references('id').inTable('users').onDelete('NO ACTION');
      table.string('banned_by', 128).nullable().references('id').inTable('users').onDelete('NO ACTION');
      table.text('reason').nullable();
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.unique(['user_id']);
    });
  }

  if (!(await hasTable('radio_staff'))) {
    await knex.schema.createTable('radio_staff', (table) => {
      table.string('id', 128).primary();
      table.string('user_id', 128).notNullable().references('id').inTable('users').onDelete('NO ACTION');
      table.string('role', 50).notNullable();
      table.text('permissions').nullable();
      table.string('created_by', 128).nullable().references('id').inTable('users').onDelete('NO ACTION');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.dateTime('updated_at').defaultTo(knex.fn.now());
      table.unique(['user_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'radio_staff',
    'radio_banned_users',
    'radio_chat_messages',
    'radio_playlist_items',
    'radio_playlists',
    'radio_broadcasts',
    'radio_videos',
    'radio_likes',
    'radio_tracks',
  ];
  for (const t of tables) {
    if (await knex.schema.hasTable(t)) {
      await knex.schema.dropTable(t);
    }
  }
}
