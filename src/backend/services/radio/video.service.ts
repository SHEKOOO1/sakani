import { v4 as uuidv4 } from "uuid";
import { kdb } from "../../infrastructure/db";

const liveVideoIds: Set<string> = new Set();
let liveInitDone = false;

async function ensureLiveInit() {
  if (liveInitDone) return;
  liveInitDone = true;
  try {
    const live = await kdb("radio_videos").where({ is_live: true }).select("id");
    live.forEach((v: any) => liveVideoIds.add(v.id));
    if (live.length > 0) console.log(`[radio] Restored ${live.length} live video(s) from DB`);
  } catch { /* table may not exist yet on first run */ }
}

export function getLiveVideoIds(): Set<string> {
  ensureLiveInit().catch(() => {});
  return liveVideoIds;
}

export async function getLiveVideoIdsAsync(): Promise<Set<string>> {
  await ensureLiveInit();
  return liveVideoIds;
}

const DEFAULT_MAX_LIMIT = 50000;

export async function getVideos(includeInactive: boolean, page = 1, limit = DEFAULT_MAX_LIMIT) {
  let query = kdb("radio_videos");
  if (!includeInactive) query = query.where({ is_active: true });
  const safeLimit = Math.min(limit, DEFAULT_MAX_LIMIT);
  const total = Number(((await query.clone().count("* as total").first()) as any)?.total || 0);
  const videos = await query.orderBy("created_at", "desc").offset((page - 1) * safeLimit).limit(safeLimit);

  const programIds = [...new Set(videos.map((v: any) => v.program).filter(Boolean))];
  const programs: Record<string, string> = {};
  if (programIds.length > 0) {
    const rows = await kdb("radio_playlists").whereIn("id", programIds).select("id", "name");
    rows.forEach((r: any) => { programs[r.id] = r.name; });
  }

  const items = videos.map((v: any) => {
    const url = v.youtube_url || "";
    const platform = /facebook\.com|fb\.watch|fb\.com/i.test(url) ? "facebook" : "youtube";
    const isLiveFromDb = !!v.is_live;
    const isLiveFromSet = liveVideoIds.has(v.id);
    return {
      id: v.id, title: v.title, description: v.description || "",
      youtube_url: url, youtube_id: v.youtube_id, platform,
      category: v.category || "", program: v.program || "",
      program_name: programs[v.program] || "",
      tags: v.tags ? v.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      thumbnail: v.thumbnail || "", duration: v.duration || "",
      views: v.views || 0, is_active: !!v.is_active,
      is_featured: !!v.is_featured, is_pinned: !!v.is_pinned,
      broadcast_id: v.broadcast_id || null,
      is_live: isLiveFromDb || isLiveFromSet,
      was_live: !!v.was_live,
      created_at: v.created_at,
    };
  });
  return { data: items, total, page, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
}

export async function createVideo(data: any, userId: string) {
  const { title, description, youtube_url, youtube_id, category, program, tags, thumbnail, duration } = data;
  let finalTags = Array.isArray(tags) ? tags : [];
  if (program) {
    const pl = await kdb("radio_playlists").where({ id: program }).select("category_id").first();
    if (pl?.category_id && !finalTags.includes(pl.category_id)) finalTags.push(pl.category_id);
  }

  const id = uuidv4();
  await kdb("radio_videos").insert({
    id, title: title.trim(), description: description?.trim() || null,
    youtube_url: youtube_url.trim(), youtube_id: youtube_id || "",
    category: category || null, program: program || null,
    tags: finalTags.length > 0 ? finalTags.join(",") : null,
    thumbnail: thumbnail || null, duration: duration || null,
    uploaded_by: userId, created_at: new Date(), updated_at: new Date(),
  });
  return { id };
}

export async function updateVideo(videoId: string, data: any) {
  const video = await kdb("radio_videos").where({ id: videoId }).first();
  if (!video) throw Object.assign(new Error("Video not found"), { statusCode: 404 });

  const { title, description, youtube_url, youtube_id, category, program, tags, thumbnail, duration, is_active, is_featured, is_pinned, broadcast_id } = data;
  const update: any = { updated_at: new Date() };
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (youtube_url !== undefined) update.youtube_url = youtube_url.trim();
  if (youtube_id !== undefined) update.youtube_id = youtube_id;
  if (category !== undefined) update.category = category || null;
  if (thumbnail !== undefined) update.thumbnail = thumbnail || null;
  if (duration !== undefined) update.duration = duration || null;
  if (is_active !== undefined) update.is_active = is_active ? 1 : 0;
  if (is_featured !== undefined) update.is_featured = is_featured ? 1 : 0;
  if (is_pinned !== undefined) update.is_pinned = is_pinned ? 1 : 0;
  if (broadcast_id !== undefined) update.broadcast_id = broadcast_id || null;

  if (program !== undefined) {
    update.program = program || null;
    const newProgram = program ? await kdb("radio_playlists").where({ id: program }).select("category_id").first() : null;
    let finalTags = tags !== undefined ? (Array.isArray(tags) ? [...tags] : []) : (video.tags ? video.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : []);
    if (newProgram?.category_id && !finalTags.includes(newProgram.category_id)) finalTags.push(newProgram.category_id);
    update.tags = finalTags.length > 0 ? finalTags.join(",") : null;
  } else if (tags !== undefined) {
    update.tags = Array.isArray(tags) ? tags.join(",") : (tags || null);
  }

  await kdb("radio_videos").where({ id: videoId }).update(update);
}

export async function deleteVideo(videoId: string) {
  const video = await kdb("radio_videos").where({ id: videoId }).first();
  if (!video) throw Object.assign(new Error("Video not found"), { statusCode: 404 });
  await kdb("radio_videos").where({ id: videoId }).del();
}

export async function setVideoLive(videoId: string, broadcastId?: string) {
  const video = await kdb("radio_videos").where({ id: videoId }).first();
  if (!video) throw Object.assign(new Error("Video not found"), { statusCode: 404 });
  const updateData: any = { is_live: true, was_live: true, updated_at: new Date() };
  if (broadcastId !== undefined) updateData.broadcast_id = broadcastId;
  await kdb("radio_videos").where({ id: videoId }).update(updateData);
  liveVideoIds.add(videoId);
}

export async function unsetVideoLive(videoId: string, broadcastId?: string) {
  const video = await kdb("radio_videos").where({ id: videoId }).first();
  if (!video) throw Object.assign(new Error("Video not found"), { statusCode: 404 });

  // Use stored broadcast_id, or fallback to provided broadcastId
  const linkedBroadcastId = video.broadcast_id || broadcastId || null;

  if (linkedBroadcastId) {
    try {
      await kdb("broadcasts").where({ id: linkedBroadcastId }).del();
      await kdb("broadcast_attachments").where({ broadcast_id: linkedBroadcastId }).del();
      // Notify connected clients that the broadcast was removed
      try {
        const io = (global as any).__io;
        if (io) {
          io.emit('broadcast-visibility-changed', {
            id: linkedBroadcastId,
            visible_in_ticker: 0,
            visible_in_messages: 0,
            deleted: true,
          });
        }
      } catch { /* socket may not be ready */ }
    } catch { /* broadcast may already be deleted */ }
  }

  await kdb("radio_videos").where({ id: videoId }).update({
    is_live: false,
    broadcast_id: null,
    updated_at: new Date(),
  });
  liveVideoIds.delete(videoId);
}

export async function resolveVideo(videoId: string) {
  const byId = await kdb("radio_videos").where({ id: videoId }).first();
  if (byId) return byId;
  return await kdb("radio_videos").where({ youtube_id: videoId }).first();
}

export async function getVideoComments(videoId: string) {
  const video = await resolveVideo(videoId);
  const dbVideoId = video?.id || videoId;

  const comments = await kdb("radio_video_comments as vc")
    .leftJoin("users as u", "vc.user_id", "u.id")
    .leftJoin("tenants as t", "u.tenant_id", "t.id")
    .where("vc.video_id", dbVideoId)
    .where("vc.is_hidden", false)
    .orderBy("vc.created_at", "asc")
    .select("vc.id", "vc.video_id", "vc.user_id", "vc.user_name", "vc.message",
      "vc.is_hidden", "vc.created_at", "u.name as user_full_name", "u.role as user_role", "t.name as tenant_name");

  const studentIds = [...new Set(comments.filter(c => c.user_role === "student").map(c => c.user_id))];
  const studentGenders: Record<string, string> = {};
  if (studentIds.length > 0) {
    const students = await kdb("students as s").join("users as u", "s.user_id", "u.id").whereIn("s.user_id", studentIds).where("s.status", "active").select("u.id as user_id", "u.gender");
    students.forEach((s: any) => { studentGenders[s.user_id] = s.gender || ""; });
  }

  return comments.map((c: any) => {
    let userTitle = "";
    const role = (c.user_role || "").toLowerCase();
    const tenantName = c.tenant_name || "";
    const gender = studentGenders[c.user_id] || "";

    if (role === "admin") userTitle = "مدير التطبيق";
    else if (role === "bishop") userTitle = tenantName ? `أسقف إيبارشية ${tenantName}` : "أسقف";
    else if (role === "priest") userTitle = tenantName ? `كاهن في ${tenantName}` : "كاهن";
    else if (role === "supervisor") userTitle = tenantName ? `مشرف ${tenantName}` : "مشرف";
    else if (role === "employee") userTitle = tenantName ? `موظف في ${tenantName}` : "موظف";
    else if (role === "student") {
      const prefix = gender === "female" ? "طالبة" : "طالب";
      userTitle = tenantName ? `${prefix} في ${tenantName}` : prefix;
    } else if (role === "parent") userTitle = "ولي أمر";
    else userTitle = role;

    return { id: c.id, video_id: c.video_id, user_id: c.user_id, user_name: c.user_full_name || "مستخدم", user_role: c.user_role || "", user_title: userTitle, message: c.message, created_at: c.created_at };
  });
}

export async function createVideoComment(videoId: string, message: string, userId: string) {
  let video = await resolveVideo(videoId);
  if (!video) {
    const newId = uuidv4();
    const resp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const realTitle = resp.ok ? (await resp.json()).title || null : null;
    await kdb("radio_videos").insert({
      id: newId, title: realTitle || videoId,
      youtube_url: `https://www.youtube.com/watch?v=${videoId}`, youtube_id: videoId,
      uploaded_by: userId, created_at: new Date(), updated_at: new Date(),
    });
    video = { id: newId };
  }

  const userRow = await kdb("users").where({ id: userId }).select("name", "role").first();
  const userName = userRow?.name || "";
  const userRole = userRow?.role || "";

  const id = uuidv4();
  await kdb("radio_video_comments").insert({
    id, video_id: video.id, user_id: userId, user_name: userName, user_role: userRole, message: message.trim(), created_at: new Date(),
  });
  return { id, user_name: userName, user_role: userRole, user_id: userId };
}

export async function deleteVideoComment(videoId: string, commentId: string) {
  const video = await resolveVideo(videoId);
  const dbVideoId = video?.id || videoId;
  const comment = await kdb("radio_video_comments").where({ id: commentId, video_id: dbVideoId }).first();
  if (!comment) throw Object.assign(new Error("Comment not found"), { statusCode: 404 });
  await kdb("radio_video_comments").where({ id: commentId }).del();
}

export async function getWasLiveVideoIds(): Promise<Set<string>> {
  const rows = await kdb("radio_videos").where({ was_live: true }).select("id");
  return new Set(rows.map((r: any) => r.id));
}

export async function checkLiveVideos() {
  const nowish = new Date(Date.now() - 120000).toISOString();
  const recentLive = await kdb("radio_videos")
    .where("is_live", true).where("created_at", ">", nowish)
    .orderBy("created_at", "desc").limit(5);
  return recentLive.map((v: any) => ({ id: v.id, title: v.title }));
}
