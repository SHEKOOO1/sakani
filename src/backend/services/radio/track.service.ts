import { v4 as uuidv4 } from "uuid";
import { kdb } from "../../infrastructure/db";
import { setManualOverride } from "../radiojar.service";

export async function getCurrentTrack(userId: string) {
  const track = await kdb("radio_tracks").where({ is_current: true }).orderBy("created_at", "desc").first();
  if (!track) return null;

  const [countResult] = await kdb("radio_likes").where({ track_id: track.id }).count("* as count");
  const likedByMe = await kdb("radio_likes").where({ track_id: track.id, user_id: userId }).first();

  return {
    id: track.id,
    title: track.title,
    artist: track.artist || "",
    cover_url: track.cover_url || "",
    description: track.description || "",
    stream_url: track.stream_url || "",
    started_at: track.played_at || track.created_at,
    listeners: 0,
    likes: Number(countResult?.count || 0),
    liked_by_me: !!likedByMe,
  };
}

export async function setCurrentTrack(data: { title: string; artist?: string; cover_url?: string; description?: string; stream_url?: string }) {
  await kdb("radio_tracks").where({ is_current: true }).update({ is_current: false });

  const id = uuidv4();
  await kdb("radio_tracks").insert({
    id,
    title: data.title.trim(),
    artist: data.artist?.trim() || null,
    cover_url: data.cover_url?.trim() || null,
    description: data.description?.trim() || null,
    stream_url: data.stream_url?.trim() || null,
    is_current: true,
    played_at: new Date(),
    created_at: new Date(),
  });

  setManualOverride(true);
  return { id };
}

export async function getSongHistory(userId: string) {
  const tracks = await kdb("radio_tracks").orderBy("played_at", "desc").limit(50);
  const userLikes = await kdb("radio_likes").where({ user_id: userId }).select("track_id");
  const likedSet = new Set(userLikes.map((l: any) => l.track_id));

  const trackIds = tracks.map((t: any) => t.id);
  const likeCounts: Record<string, number> = {};
  if (trackIds.length > 0) {
    const counts = await kdb("radio_likes").whereIn("track_id", trackIds).groupBy("track_id").select("track_id").count("* as count");
    counts.forEach((r: any) => { likeCounts[r.track_id] = Number(r.count); });
  }

  return tracks.map((track: any) => ({
    id: track.id,
    title: track.title,
    artist: track.artist || "",
    cover_url: track.cover_url || "",
    played_at: track.played_at || track.created_at,
    likes: likeCounts[track.id] || 0,
    liked_by_me: likedSet.has(track.id),
  }));
}

export async function toggleLike(songId: string, userId: string) {
  const track = await kdb("radio_tracks").where({ id: songId }).first();
  if (!track) throw Object.assign(new Error("Track not found"), { statusCode: 404 });

  const existing = await kdb("radio_likes").where({ track_id: songId, user_id: userId }).first();
  if (existing) {
    const [countRow] = await kdb("radio_likes").where({ track_id: songId }).count("* as count");
    return { liked: true, likes: Number((countRow as any)?.count || 0) };
  }

  await kdb("radio_likes").insert({ id: uuidv4(), track_id: songId, user_id: userId, created_at: new Date() });
  const [countResult] = await kdb("radio_likes").where({ track_id: songId }).count("* as count");
  return { liked: true, likes: Number(countResult?.count || 0) };
}
