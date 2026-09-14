import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AppPermission } from "../../types/permissions";
import { AuthRequest } from "../api/middleware";
import { checkUserPermission } from "../infrastructure/db";
import { kdb } from "../infrastructure/db";
import { parsePagination } from "../services/radio/pagination.ts";
import * as trackService from "../services/radio/track.service";
import * as videoService from "../services/radio/video.service";
import * as chatService from "../services/radio/chat.service";
import * as broadcastService from "../services/radio/broadcast.service";
import * as playlistService from "../services/radio/playlist.service";
import * as staffService from "../services/radio/staff.service";
import * as statsService from "../services/radio/stats.service";

function handleError(res: Response, error: any, defaultMsg = "حصل خطأ فني. لو سمحت كرر المحاولة.") {
  console.error(error);
  const status = error.statusCode || 500;
  res.status(status).json({ success: false, message: error.message || defaultMsg });
}

// ─── Radiojar Proxy ───
const RADIOJAR_STATION_ID = "ps7z45v12k8uv";

export async function getRadiojarNowPlaying(_req: Request, res: Response) {
  try {
    const response = await fetch(`https://www.radiojar.com/api/stations/${RADIOJAR_STATION_ID}/now_playing/`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return res.status(response.status).json({ success: false, message: "فشل جلب بيانات الراديو من Radiojar" });
    const data = await response.json();
    const thumb = data.thumb?.trim() || "";
    res.json({
      success: true,
      data: { title: data.title || "", artist: data.artist || "", album: data.album || "", thumb, duration: data.duration || "0", guid: data.guid || "" },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ في الاتصال بخدمة Radiojar" });
  }
}

export async function getRadiojarStation(_req: Request, res: Response) {
  try {
    const response = await fetch(`https://www.radiojar.com/api/stations/${RADIOJAR_STATION_ID}/`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return res.status(response.status).json({ success: false, message: "فشل جلب معلومات المحطة" });
    const data = await response.json();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ في الاتصال بخدمة Radiojar" });
  }
}

export async function getRadiojarStatus(_req: Request, res: Response) {
  const { isRadiojarServiceEnabled, isManualOverrideActive } = await import("../services/radiojar.service");
  res.json({ success: true, data: { service_enabled: isRadiojarServiceEnabled(), manual_override_active: isManualOverrideActive() } });
}

export async function resumeRadiojar(_req: Request, res: Response) {
  const { setManualOverride } = await import("../services/radiojar.service");
  setManualOverride(false);
  res.json({ success: true, message: "تم استئناف التحديث التلقائي من Radiojar" });
}

// ─── Current Track ───
export async function getCurrentTrack(req: AuthRequest, res: Response) {
  try {
    const data = await trackService.getCurrentTrack(req.user!.id);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function putCurrentTrack(req: AuthRequest, res: Response) {
  try {
    const { title, artist, cover_url, description, stream_url } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: "اسم الترنيمة مطلوب" });
    const data = await trackService.setCurrentTrack({ title, artist, cover_url, description, stream_url });
    res.json({ success: true, message: "تم تحديث الترنيمة الحالية", data });
  } catch (error) { handleError(res, error); }
}

// ─── Song History ───
export async function getSongHistory(req: AuthRequest, res: Response) {
  try {
    const { page, limit } = parsePagination(req.query);
    const offset = (page - 1) * limit;

    const [totalResult, tracks] = await Promise.all([
      kdb("radio_tracks").count("* as total").first(),
      kdb("radio_tracks").orderBy("played_at", "desc").offset(offset).limit(limit),
    ]);

    const userLikes = await kdb("radio_likes").where({ user_id: req.user!.id }).select("track_id");
    const likedSet = new Set(userLikes.map((l: any) => l.track_id));

    const trackIds = tracks.map((t: any) => t.id);
    const likeCounts: Record<string, number> = {};
    if (trackIds.length > 0) {
      const counts = await kdb("radio_likes").whereIn("track_id", trackIds).groupBy("track_id").select("track_id").count("* as count");
      counts.forEach((r: any) => { likeCounts[r.track_id] = Number(r.count); });
    }

    const data = tracks.map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.artist || "",
      cover_url: track.cover_url || "",
      played_at: track.played_at || track.created_at,
      likes: likeCounts[track.id] || 0,
      liked_by_me: likedSet.has(track.id),
    }));

    const total = Number((totalResult as any)?.total || 0);
    res.json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) { handleError(res, error); }
}

export async function likeSong(req: AuthRequest, res: Response) {
  try {
    const data = await trackService.toggleLike(req.params.songId, req.user!.id);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

// ─── Videos ───
export async function getVideos(req: AuthRequest, res: Response) {
  try {
    // إخفاء الفيديوهات غير النشطة عن غير المشرفين على المكتبة
    let includeInactive = req.query.include_inactive === 'true';
    if (includeInactive && !(await checkUserPermission(req.user!.id, AppPermission.MANAGE_RADIO_VIDEO_LIBRARY as any))) {
      includeInactive = false;
    }
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 200));
    const result = await videoService.getVideos(includeInactive, page, limit);
    res.json({ success: true, ...result });
  } catch (error) { handleError(res, error); }
}

export async function createVideo(req: AuthRequest, res: Response) {
  try {
    const { title, youtube_url } = req.body;
    if (!title?.trim() || !youtube_url?.trim()) return res.status(400).json({ success: false, message: "العنوان ورابط الفيديو مطلوبان" });
    const data = await videoService.createVideo(req.body, req.user!.id);
    res.json({ success: true, message: "تم إضافة الفيديو", data });
  } catch (error) { handleError(res, error); }
}

export async function updateVideo(req: AuthRequest, res: Response) {
  try {
    await videoService.updateVideo(req.params.id, req.body);
    res.json({ success: true, message: "تم تحديث الفيديو" });
  } catch (error) { handleError(res, error); }
}

export async function deleteVideo(req: AuthRequest, res: Response) {
  try {
    await videoService.deleteVideo(req.params.videoId);
    res.json({ success: true, message: "تم حذف الفيديو" });
  } catch (error) { handleError(res, error); }
}

// ─── Live Video ───
export async function getLiveVideos(_req: Request, res: Response) {
  try {
    const ids = await videoService.getLiveVideoIdsAsync();
    res.json({ success: true, data: Array.from(ids) });
  } catch (error) { handleError(res, error); }
}

export async function getWasLiveVideos(_req: Request, res: Response) {
  try {
    const ids = await videoService.getWasLiveVideoIds();
    res.json({ success: true, data: Array.from(ids) });
  } catch (error) { handleError(res, error); }
}

export async function setVideoLive(req: AuthRequest, res: Response) {
  try {
    const { broadcast_id } = req.body;
    await videoService.setVideoLive(req.params.id, broadcast_id);
    res.json({ success: true, message: "تم تعيين الفيديو كبث مباشر" });
  } catch (error) { handleError(res, error); }
}

export async function unsetVideoLive(req: AuthRequest, res: Response) {
  try {
    const { broadcast_id } = req.body;
    await videoService.unsetVideoLive(req.params.id, broadcast_id);
    res.json({ success: true, message: "تم إنهاء البث المباشر للفيديو" });
  } catch (error) { handleError(res, error); }
}

// ─── Video Comments ───
export async function getVideoComments(req: AuthRequest, res: Response) {
  try {
    const data = await videoService.getVideoComments(req.params.videoId);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function createVideoComment(req: AuthRequest, res: Response) {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: "التعليق مطلوب" });
    const banned = await chatService.checkBan(req.user!.id);
    if (banned === 'mute') return res.status(403).json({ success: false, message: 'تم كتم صوتك' });
    if (banned === 'ban') return res.status(403).json({ success: false, message: 'تم حظرك من التعليق' });
    const data = await videoService.createVideoComment(req.params.videoId, message, req.user!.id);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function deleteVideoComment(req: AuthRequest, res: Response) {
  try {
    await videoService.deleteVideoComment(req.params.videoId, req.params.commentId);
    res.json({ success: true, message: "تم حذف التعليق" });
  } catch (error) { handleError(res, error); }
}

// ─── Chat ───
export async function getChatMessages(req: AuthRequest, res: Response) {
  try {
    const { page, limit } = parsePagination(req.query);
    const offset = (page - 1) * limit;

    const [totalResult, messages] = await Promise.all([
      kdb("radio_chat_messages").where("is_hidden", false).count("* as total").first(),
      kdb("radio_chat_messages as m")
        .leftJoin("users as u", "m.user_id", "u.id")
        .leftJoin("tenants as t", "u.tenant_id", "t.id")
        .where("m.is_hidden", false)
        .orderBy("m.created_at", "desc")
        .offset(offset)
        .limit(limit)
        .select("m.id", "m.user_id", "m.user_name", "m.message", "m.is_hidden", "m.created_at",
          "u.name as user_full_name", "u.role as user_role", "t.name as tenant_name"),
    ]);

    const studentIds = [...new Set(messages.filter((m: any) => m.user_role === "student").map((m: any) => m.user_id))];
    const studentGenders: Record<string, string> = {};
    if (studentIds.length > 0) {
      const students = await kdb("students as s").join("users as u", "s.user_id", "u.id").whereIn("s.user_id", studentIds).where("s.status", "active").select("u.id as user_id", "u.gender");
      students.forEach((s: any) => { studentGenders[s.user_id] = s.gender || ""; });
    }

    const data = messages.map((m: any) => {
      let userTitle = "";
      const role = (m.user_role || "").toLowerCase();
      const tenantName = m.tenant_name || "";
      const gender = studentGenders[m.user_id] || "";

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

      return { id: m.id, user_id: m.user_id, user_name: m.user_full_name || "مستخدم", user_role: m.user_role || "", user_title: userTitle, message: m.message, created_at: m.created_at };
    });

    const total = Number((totalResult as any)?.total || 0);
    res.json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) { handleError(res, error); }
}

export async function createChatMessage(req: AuthRequest, res: Response) {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: "الرسالة مطلوبة" });
    const data = await chatService.createChatMessage(message, req.user!.id);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function deleteChatMessage(req: AuthRequest, res: Response) {
  try {
    await chatService.deleteChatMessage(req.params.msgId);
    res.json({ success: true, message: "تم حذف الرسالة" });
  } catch (error) { handleError(res, error); }
}

export async function banUser(req: AuthRequest, res: Response) {
  try {
    await chatService.banUser(req.params.userId, req.user!.id);
    res.json({ success: true, message: "تم حظر المستخدم من الشات" });
  } catch (error) { handleError(res, error); }
}

export async function muteUser(req: AuthRequest, res: Response) {
  try {
    const { duration } = req.body;
    const minutes = await chatService.muteUser(req.params.userId, req.user!.id, parseInt(duration) || 15);
    res.json({ success: true, message: `تم كتم المستخدم لمدة ${minutes} دقيقة` });
  } catch (error) { handleError(res, error); }
}

export async function kickUser(req: AuthRequest, res: Response) {
  try {
    await chatService.kickUser(req.params.userId, req.user!.id);
    res.json({ success: true, message: "تم طرد المستخدم لمدة 5 دقائق" });
  } catch (error) { handleError(res, error); }
}

export async function unbanUser(req: AuthRequest, res: Response) {
  try {
    await chatService.unbanUser(req.params.userId);
    res.json({ success: true, message: "تم إلغاء الحظر واستعادة التعليقات" });
  } catch (error) { handleError(res, error); }
}

export async function getBannedUsers(req: AuthRequest, res: Response) {
  try {
    const result = await chatService.getBannedUsers(req.user!.id);
    res.json({ success: true, ...result });
  } catch (error) { handleError(res, error); }
}

export async function getBannedUserMessages(req: AuthRequest, res: Response) {
  try {
    const data = await chatService.getBannedUserMessages(req.params.userId);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

// ─── Broadcasts ───
export async function getBroadcasts(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 200));
    const result = await broadcastService.getBroadcasts(page, limit);
    res.json({ success: true, ...result });
  } catch (error) { handleError(res, error); }
}

export async function getPublicBroadcasts(_req: Request, res: Response) {
  try {
    const data = await broadcastService.getPublicBroadcasts();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function createBroadcast(req: AuthRequest, res: Response) {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: "اسم البرنامج مطلوب" });
    const data = await broadcastService.createBroadcast(req.body, req.user!.id);
    res.json({ success: true, message: "تم إضافة البرنامج", data });
  } catch (error) { handleError(res, error); }
}

export async function updateBroadcast(req: AuthRequest, res: Response) {
  try {
    await broadcastService.updateBroadcast(req.params.id, req.body);
    res.json({ success: true, message: "تم تحديث البرنامج" });
  } catch (error) { handleError(res, error); }
}

export async function deleteBroadcast(req: AuthRequest, res: Response) {
  try {
    await broadcastService.deleteBroadcast(req.params.id);
    res.json({ success: true, message: "تم حذف البرنامج" });
  } catch (error) { handleError(res, error); }
}

// ─── Reminders ───
export async function getUserReminders(req: AuthRequest, res: Response) {
  try {
    const data = await broadcastService.getUserReminders(req.user!.id);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function toggleReminder(req: AuthRequest, res: Response) {
  try {
    const data = await broadcastService.toggleReminder(req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function checkReminders(req: AuthRequest, res: Response) {
  try {
    const data = await broadcastService.checkReminders(req.user!.id);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

// ─── Live Subscriptions ───
export async function getLiveSubscription(req: AuthRequest, res: Response) {
  try {
    const sub = await kdb("radio_live_subscriptions").where({ user_id: req.user!.id }).first();
    res.json({ success: true, data: { active: !!sub } });
  } catch (error) { handleError(res, error); }
}

export async function toggleLiveSubscription(req: AuthRequest, res: Response) {
  try {
    const existing = await kdb("radio_live_subscriptions").where({ user_id: req.user!.id }).first();
    if (existing) {
      await kdb("radio_live_subscriptions").where({ user_id: req.user!.id }).del();
      res.json({ success: true, data: { active: false } });
    } else {
      await kdb("radio_live_subscriptions").insert({ id: uuidv4(), user_id: req.user!.id });
      res.json({ success: true, data: { active: true } });
    }
  } catch (error) { handleError(res, error); }
}

export async function checkLiveVideos(_req: Request, res: Response) {
  try {
    const data = await videoService.checkLiveVideos();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

// ─── Categories ───
export async function getCategories(_req: Request, res: Response) {
  try {
    const data = await playlistService.getCategories();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function createCategory(req: AuthRequest, res: Response) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "اسم التصنيف مطلوب" });
    const data = await playlistService.createCategory(req.body, req.user!.id);
    res.json({ success: true, message: "تم إنشاء التصنيف", data });
  } catch (error) { handleError(res, error); }
}

export async function updateCategory(req: AuthRequest, res: Response) {
  try {
    await playlistService.updateCategory(req.params.id, req.body);
    res.json({ success: true, message: "تم تحديث التصنيف" });
  } catch (error) { handleError(res, error); }
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  try {
    await playlistService.deleteCategory(req.params.id);
    res.json({ success: true, message: "تم حذف التصنيف" });
  } catch (error) { handleError(res, error); }
}

// ─── Playlists ───
export async function getPlaylists(req: AuthRequest, res: Response) {
  try {
    const categoryId = req.query.category_id as string | undefined;
    const data = await playlistService.getPlaylists(categoryId);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function createPlaylist(req: AuthRequest, res: Response) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "اسم القائمة مطلوب" });
    const data = await playlistService.createPlaylist(req.body, req.user!.id);
    res.json({ success: true, message: "تم إنشاء القائمة", data });
  } catch (error) { handleError(res, error); }
}

export async function updatePlaylist(req: AuthRequest, res: Response) {
  try {
    await playlistService.updatePlaylist(req.params.id, req.body);
    res.json({ success: true, message: "تم تحديث القائمة" });
  } catch (error) { handleError(res, error); }
}

export async function deletePlaylist(req: AuthRequest, res: Response) {
  try {
    await playlistService.deletePlaylist(req.params.id);
    res.json({ success: true, message: "تم حذف القائمة" });
  } catch (error) { handleError(res, error); }
}

// ─── Playlist Items ───
export async function getPlaylistItems(req: AuthRequest, res: Response) {
  try {
    const data = await playlistService.getPlaylistItems(req.params.playlistId);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function addPlaylistItem(req: AuthRequest, res: Response) {
  try {
    const { item_type, item_id } = req.body;
    if (!item_type || !item_id) return res.status(400).json({ success: false, message: "نوع العنصر والمعرف مطلوبان" });
    const data = await playlistService.addPlaylistItem(req.params.playlistId, req.body);
    res.json({ success: true, message: "تم إضافة العنصر", data });
  } catch (error) { handleError(res, error); }
}

export async function bulkAddPlaylistItems(req: AuthRequest, res: Response) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: "مطلوب مصفوفة من العناصر" });
    const count = await playlistService.bulkAddPlaylistItems(req.params.playlistId, items, req.user!.id);
    res.json({ success: true, message: `تم إضافة ${count} حلقة`, count });
  } catch (error) { handleError(res, error); }
}

export async function updatePlaylistItem(req: AuthRequest, res: Response) {
  try {
    await playlistService.updatePlaylistItem(req.params.playlistId, req.params.itemId, req.body);
    res.json({ success: true, message: "تم تحديث الحلقة" });
  } catch (error) { handleError(res, error); }
}

export async function deletePlaylistItem(req: AuthRequest, res: Response) {
  try {
    await playlistService.deletePlaylistItem(req.params.playlistId, req.params.itemId);
    res.json({ success: true, message: "تم حذف الحلقة" });
  } catch (error) { handleError(res, error); }
}

export async function reorderPlaylistItems(req: AuthRequest, res: Response) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, message: "items must be an array" });
    await playlistService.reorderPlaylistItems(req.params.playlistId, items);
    res.json({ success: true, message: "تم إعادة الترتيب" });
  } catch (error) { handleError(res, error); }
}

// ─── Staff ───
export async function getStaff(_req: Request, res: Response) {
  try {
    const data = await staffService.getStaff();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function searchStaff(req: AuthRequest, res: Response) {
  try {
    const q = (req.query.q as string || "").trim();
    const data = await staffService.searchStaff(q);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function addStaffMember(req: AuthRequest, res: Response) {
  try {
    const { user_id, role, permissions } = req.body;
    if (!user_id || !role) return res.status(400).json({ success: false, message: "المستخدم والدور مطلوبان" });
    const data = await staffService.addStaffMember(user_id, role, permissions, req.user!.id);
    res.json({ success: true, message: "تم إضافة العضو", data });
  } catch (error) { handleError(res, error); }
}

export async function updateStaffMember(req: AuthRequest, res: Response) {
  try {
    await staffService.updateStaffMember(req.params.id, req.body);
    res.json({ success: true, message: "تم تحديث الصلاحيات" });
  } catch (error) { handleError(res, error); }
}

export async function removeStaffMember(req: AuthRequest, res: Response) {
  try {
    await staffService.removeStaffMember(req.params.memberId);
    res.json({ success: true, message: "تم إزالة العضو من الطاقم" });
  } catch (error) { handleError(res, error); }
}

// ─── Stats ───
export async function getRadioStats(_req: Request, res: Response) {
  try {
    const data = await statsService.getRadioStats();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function getBroadcastStats(_req: Request, res: Response) {
  try {
    const data = await statsService.getBroadcastStats();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

export async function getChatStats(_req: Request, res: Response) {
  try {
    const data = await statsService.getChatStats();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
}

// ─── YouTube ───
function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function fetchVideoInfo(req: AuthRequest, res: Response) {
  try {
    const queryUrl = (req.query.url as string || "").trim();
    if (!queryUrl) return res.status(400).json({ success: false, message: "رابط الفيديو مطلوب" });

    if (/facebook\.com|fb\.watch|fb\.com/i.test(queryUrl)) {
      try {
        const oembedResp = await fetch(`https://www.facebook.com/plugins/video/oembed.json?url=${encodeURIComponent(queryUrl)}`);
        if (oembedResp.ok) {
          const oembed: any = await oembedResp.json();
          return res.json({ success: true, data: { source: "facebook", source_url: queryUrl, title: oembed.title || "", description: oembed.description || "", thumbnail: oembed.thumbnail_url || "", duration: "" } });
        }
        const graphResp = await fetch(`https://graph.facebook.com/v22.0/oembed_video?url=${encodeURIComponent(queryUrl)}`);
        if (graphResp.ok) {
          const graph: any = await graphResp.json();
          return res.json({ success: true, data: { source: "facebook", source_url: queryUrl, title: graph.title || "", description: graph.description || "", thumbnail: graph.thumbnail_url || "", duration: "" } });
        }
      } catch {}
      return res.json({ success: true, data: { source: "facebook", source_url: queryUrl, title: "", description: "", thumbnail: "", duration: "" } });
    }

    const videoId = extractYoutubeId(queryUrl);
    if (!videoId) return res.status(400).json({ success: false, message: "رابط فيديو غير صالح" });

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: "مفتاح YouTube API غير مضبوط" });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`);
    const data: any = await response.json();

    if (!data.items || data.items.length === 0) return res.status(404).json({ success: false, message: "الفيديو غير موجود" });

    const item = data.items[0];
    res.json({ success: true, data: { source: "youtube", youtube_id: videoId, title: item.snippet.title, description: item.snippet.description, thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "", duration: parseDuration(item.contentDetails.duration) } });
  } catch (error: any) {
    console.error("Video fetch error:", error);
    res.status(500).json({ success: false, message: "فشل جلب معلومات الفيديو" });
  }
}

export async function fetchPlaylist(req: AuthRequest, res: Response) {
  try {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ success: false, message: "رابط البلاي ليست مطلوب" });

    const playlistId = extractPlaylistId(url);
    if (!playlistId) return res.status(400).json({ success: false, message: "رابط بلاي ليست غير صالح" });

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: "مفتاح YouTube API غير مضبوط" });

    let allItems: any[] = [];
    let nextPageToken: string | undefined;

    do {
      const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${playlistId}&key=${apiKey}&part=snippet,contentDetails&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
      const response = await fetch(apiUrl);
      const data: any = await response.json();

      if (data.error) return res.status(400).json({ success: false, message: data.error.message || "خطأ في جلب البلاي ليست" });
      if (data.items) allItems = allItems.concat(data.items);
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    const items = allItems.map((item: any) => ({
      youtube_id: item.snippet.resourceId?.videoId || "", title: item.snippet.title || "",
      description: item.snippet.description || "", thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "",
    }));

    res.json({ success: true, data: items, count: items.length });
  } catch (error: any) {
    console.error("YouTube playlist fetch error:", error);
    res.status(500).json({ success: false, message: "فشل جلب البلاي ليست" });
  }
}
