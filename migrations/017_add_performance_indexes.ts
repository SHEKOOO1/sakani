import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Radio tables indexes
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_tracks_is_current')
      CREATE INDEX IX_radio_tracks_is_current ON [dbo].[radio_tracks]([is_current]) WHERE is_current = 1;
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_tracks_played_at')
      CREATE INDEX IX_radio_tracks_played_at ON [dbo].[radio_tracks]([played_at] DESC);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_likes_track_id')
      CREATE INDEX IX_radio_likes_track_id ON [dbo].[radio_likes]([track_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_likes_user_id')
      CREATE INDEX IX_radio_likes_user_id ON [dbo].[radio_likes]([user_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_videos_is_active')
      CREATE INDEX IX_radio_videos_is_active ON [dbo].[radio_videos]([is_active]) WHERE is_active = 1;
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_videos_is_live')
    BEGIN
      IF COL_LENGTH('radio_videos', 'is_live') IS NULL
        ALTER TABLE [dbo].[radio_videos] ADD [is_live] BIT NOT NULL DEFAULT 0;
      EXEC('CREATE INDEX IX_radio_videos_is_live ON [dbo].[radio_videos]([is_live]) WHERE is_live = 1');
    END
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_chat_messages_created_at')
      CREATE INDEX IX_radio_chat_messages_created_at ON [dbo].[radio_chat_messages]([created_at] ASC);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_chat_messages_is_hidden')
      CREATE INDEX IX_radio_chat_messages_is_hidden ON [dbo].[radio_chat_messages]([is_hidden], [user_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_banned_users_user_id')
      CREATE INDEX IX_radio_banned_users_user_id ON [dbo].[radio_banned_users]([user_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_playlists_category_id')
      CREATE INDEX IX_radio_playlists_category_id ON [dbo].[radio_playlists]([category_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_playlist_items_playlist_id')
      CREATE INDEX IX_radio_playlist_items_playlist_id ON [dbo].[radio_playlist_items]([playlist_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_video_comments_video_id')
      CREATE INDEX IX_radio_video_comments_video_id ON [dbo].[radio_video_comments]([video_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_broadcasts_is_active')
      CREATE INDEX IX_radio_broadcasts_is_active ON [dbo].[radio_broadcasts]([is_active]) WHERE is_active = 1;
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_broadcast_reminders_user_id')
      CREATE INDEX IX_radio_broadcast_reminders_user_id ON [dbo].[radio_broadcast_reminders]([user_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_radio_staff_user_id')
      CREATE INDEX IX_radio_staff_user_id ON [dbo].[radio_staff]([user_id]);
  `);

  // Core tables indexes (frequently queried)
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_users_role')
      CREATE INDEX IX_users_role ON [dbo].[users]([role]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_users_tenant_id')
      CREATE INDEX IX_users_tenant_id ON [dbo].[users]([tenant_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_token_blacklist_expires_at')
      CREATE INDEX IX_token_blacklist_expires_at ON [dbo].[token_blacklist]([expires_at]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_role_permissions_role')
      CREATE INDEX IX_role_permissions_role ON [dbo].[role_permissions]([role]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_audit_logs_created_at')
      CREATE INDEX IX_audit_logs_created_at ON [dbo].[audit_logs]([created_at] DESC);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_students_user_id')
      CREATE INDEX IX_students_user_id ON [dbo].[students]([user_id]);
  `);
  await knex.raw(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_tenant_assignments_user_id')
      CREATE INDEX IX_user_tenant_assignments_user_id ON [dbo].[user_tenant_assignments]([user_id]);
  `);

  console.log("✅ Performance indexes created");
}

export async function down(knex: Knex): Promise<void> {
  const indexes = [
    "IX_radio_tracks_is_current", "IX_radio_tracks_played_at", "IX_radio_likes_track_id",
    "IX_radio_likes_user_id", "IX_radio_videos_is_active", "IX_radio_videos_is_live",
    "IX_radio_chat_messages_created_at", "IX_radio_chat_messages_is_hidden",
    "IX_radio_banned_users_user_id", "IX_radio_playlists_category_id",
    "IX_radio_playlist_items_playlist_id", "IX_radio_video_comments_video_id",
    "IX_radio_broadcasts_is_active", "IX_radio_broadcast_reminders_user_id",
    "IX_radio_staff_user_id", "IX_users_role", "IX_users_tenant_id",
    "IX_token_blacklist_expires_at", "IX_role_permissions_role",
    "IX_audit_logs_created_at", "IX_students_user_id", "IX_user_tenant_assignments_user_id",
  ];

  for (const name of indexes) {
    await knex.raw(`IF EXISTS (SELECT * FROM sys.indexes WHERE name = '${name}') DROP INDEX [${name}] ON [dbo].[${name.split('_').slice(1).join('_')}]`);
  }
}
