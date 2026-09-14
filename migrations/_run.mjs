import { kdb } from './src/backend/infrastructure/db.ts';
try {
  const hasHost = await kdb.schema.hasColumn('radio_broadcasts', 'host_name');
  if (!hasHost) {
    await kdb.schema.alterTable('radio_broadcasts', (t) => {
      t.string('cover_image', 500).nullable();
      t.string('host_name', 255).nullable();
      t.string('guest_name', 255).nullable();
      t.boolean('recurring').defaultTo(false);
      t.string('recurring_day', 20).nullable();
      t.string('recurring_time', 10).nullable();
      t.string('type', 20).defaultTo('audio');
      t.boolean('is_pinned').defaultTo(false);
      t.string('playlist_id', 128).nullable().references('id').inTable('radio_playlists').onDelete('SET NULL');
    });
    console.log('Migration applied');
  } else {
    console.log('Already applied');
  }
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
