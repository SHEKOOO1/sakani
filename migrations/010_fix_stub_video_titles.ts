import type { Knex } from 'knex';

/** 
 * This migration previously set title = youtube_id for stub videos.
 * That was reverted — use scripts/fix-video-titles.ts instead to
 * fetch real titles from YouTube oEmbed.
 */
export async function up(knex: Knex): Promise<void> {
  // no-op: fix-video-titles.ts handles this via YouTube oEmbed
}

export async function down(knex: Knex): Promise<void> {
  // no-op
}
