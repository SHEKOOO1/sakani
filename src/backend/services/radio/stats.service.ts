import { kdb } from "../../infrastructure/db";

export async function getRadioStats() {
  const [
    broadcastCount, videoCount, playlistCount, chatMsgCount, chatTodayCount,
    reminderCount, liveSubCount, videoCommentCount, trackCount, bannedCount,
  ] = await Promise.all([
    kdb("radio_broadcasts").where("is_active", true).count("* as count").first() as any,
    kdb("radio_videos").where("is_active", true).count("* as count").first() as any,
    kdb("radio_playlists").where("is_active", true).count("* as count").first() as any,
    kdb("radio_chat_messages").count("* as count").first() as any,
    kdb("radio_chat_messages").whereRaw("CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)").count("* as count").first() as any,
    kdb("radio_broadcast_reminders").count("* as count").first() as any,
    kdb("radio_live_subscriptions").count("* as count").first() as any,
    kdb("radio_video_comments").count("* as count").first() as any,
    kdb("radio_tracks").count("* as count").first() as any,
    kdb("radio_banned_users").count("* as count").first() as any,
  ]);

  return {
    broadcasts: Number(broadcastCount?.count || 0),
    videos: Number(videoCount?.count || 0),
    playlists: Number(playlistCount?.count || 0),
    chatMessages: Number(chatMsgCount?.count || 0),
    chatMessagesToday: Number(chatTodayCount?.count || 0),
    reminders: Number(reminderCount?.count || 0),
    liveSubscriptions: Number(liveSubCount?.count || 0),
    videoComments: Number(videoCommentCount?.count || 0),
    tracks: Number(trackCount?.count || 0),
    bannedUsers: Number(bannedCount?.count || 0),
  };
}

export async function getBroadcastStats() {
  const broadcasts = await kdb("radio_broadcasts")
    .select("id", "title", "type", "is_active", "scheduled_at", "created_at")
    .orderBy("created_at", "desc");

  const total = broadcasts.length;
  const active = broadcasts.filter(b => b.is_active).length;
  const audio = broadcasts.filter(b => b.type === 'audio' || !b.type).length;
  const video = broadcasts.filter(b => b.type === 'video').length;
  const both = broadcasts.filter(b => b.type === 'both').length;

  return { total, active, audio, video, both, all: broadcasts };
}

export async function getChatStats() {
  const total = (await kdb("radio_chat_messages").count("* as count").first()) as any;
  const today = (await kdb("radio_chat_messages").whereRaw("CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)").count("* as count").first()) as any;
  const uniqueUsers = (await kdb("radio_chat_messages").countDistinct("user_id as count").first()) as any;
  const messages = await kdb("radio_chat_messages").select("id", "user_name", "message", "created_at").orderBy("created_at", "desc").limit(50);
  const hidden = (await kdb("radio_chat_messages").where("is_hidden", true).count("* as count").first()) as any;

  return {
    total: Number(total?.count || 0),
    today: Number(today?.count || 0),
    uniqueUsers: Number(uniqueUsers?.count || 0),
    hidden: Number(hidden?.count || 0),
    recent: messages,
  };
}
