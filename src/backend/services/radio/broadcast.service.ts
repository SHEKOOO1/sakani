import { v4 as uuidv4 } from "uuid";
import { kdb } from "../../infrastructure/db";

const DEFAULT_MAX_LIMIT = 200;

export async function getBroadcasts(page = 1, limit = DEFAULT_MAX_LIMIT) {
  const safeLimit = Math.min(limit, DEFAULT_MAX_LIMIT);
  const total = Number(((await kdb("radio_broadcasts").count("* as total").first()) as any)?.total || 0);
  const broadcasts = await kdb("radio_broadcasts").orderBy("created_at", "desc").offset((page - 1) * safeLimit).limit(safeLimit);
  return {
    data: broadcasts.map((b: any) => ({
      id: b.id, title: b.title, description: b.description || "",
      cover_image: b.cover_image || "", host_name: b.host_name || "",
      guest_name: b.guest_name || "", stream_url: b.stream_url || "",
      type: b.type || "audio", is_active: !!b.is_active, is_pinned: !!b.is_pinned,
      scheduled_at: b.scheduled_at || "", recurring: !!b.recurring,
      recurring_day: b.recurring_day || "", recurring_time: b.recurring_time || "",
      playlist_id: b.playlist_id || "", created_at: b.created_at,
    })),
    total, page, limit: safeLimit, totalPages: Math.ceil(total / safeLimit),
  };
}

export async function getPublicBroadcasts() {
  const broadcasts = await kdb("radio_broadcasts").where("is_active", true).orderBy("created_at", "desc");
  return broadcasts.map((b: any) => ({
    id: b.id, title: b.title, description: b.description || "",
    cover_image: b.cover_image || "", host_name: b.host_name || "",
    guest_name: b.guest_name || "", type: b.type || "audio",
    scheduled_at: b.scheduled_at || "", recurring: !!b.recurring,
    recurring_day: b.recurring_day || "", recurring_time: b.recurring_time || "",
    playlist_id: b.playlist_id || "",
  }));
}

export async function createBroadcast(data: any, userId: string) {
  const { title, cover_image, host_name, guest_name, type, scheduled_at, recurring, recurring_day, recurring_time, playlist_id } = data;
  const id = uuidv4();
  await kdb("radio_broadcasts").insert({
    id, title: title.trim(), stream_url: "", cover_image: cover_image?.trim() || null,
    host_name: host_name?.trim() || null, guest_name: guest_name?.trim() || null,
    type: type || "audio", scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
    recurring: !!recurring, recurring_day: recurring_day?.trim() || null,
    recurring_time: recurring_time?.trim() || null, playlist_id: playlist_id || null,
    created_by: userId,
  });
  return { id };
}

export async function updateBroadcast(broadcastId: string, data: any) {
  const broadcast = await kdb("radio_broadcasts").where({ id: broadcastId }).first();
  if (!broadcast) throw Object.assign(new Error("Broadcast not found"), { statusCode: 404 });

  const { title, cover_image, host_name, guest_name, type, scheduled_at, recurring, recurring_day, recurring_time, is_active, stream_url, playlist_id } = data;
  const update: any = { updated_at: new Date() };
  if (title !== undefined) update.title = title.trim();
  if (cover_image !== undefined) update.cover_image = cover_image?.trim() || null;
  if (host_name !== undefined) update.host_name = host_name?.trim() || null;
  if (guest_name !== undefined) update.guest_name = guest_name?.trim() || null;
  if (type !== undefined) update.type = type;
  if (scheduled_at !== undefined) update.scheduled_at = scheduled_at ? new Date(scheduled_at) : null;
  if (recurring !== undefined) update.recurring = !!recurring;
  if (recurring_day !== undefined) update.recurring_day = recurring_day?.trim() || null;
  if (recurring_time !== undefined) update.recurring_time = recurring_time?.trim() || null;
  if (is_active !== undefined) update.is_active = is_active ? 1 : 0;
  if (stream_url !== undefined) update.stream_url = stream_url?.trim() || "";
  if (playlist_id !== undefined) update.playlist_id = playlist_id || null;

  await kdb("radio_broadcasts").where({ id: broadcastId }).update(update);
}

export async function deleteBroadcast(broadcastId: string) {
  const broadcast = await kdb("radio_broadcasts").where({ id: broadcastId }).first();
  if (!broadcast) throw Object.assign(new Error("Broadcast not found"), { statusCode: 404 });
  await kdb("radio_broadcasts").where({ id: broadcastId }).del();
}

export async function getUserReminders(userId: string) {
  const reminders = await kdb("radio_broadcast_reminders").where({ user_id: userId }).select("broadcast_id");
  return reminders.map((r: any) => r.broadcast_id);
}

export async function toggleReminder(broadcastId: string, userId: string) {
  const broadcast = await kdb("radio_broadcasts").where({ id: broadcastId }).first();
  if (!broadcast) throw Object.assign(new Error("Broadcast not found"), { statusCode: 404 });

  const existing = await kdb("radio_broadcast_reminders").where({ broadcast_id: broadcastId, user_id: userId }).first();
  if (existing) {
    await kdb("radio_broadcast_reminders").where({ broadcast_id: broadcastId, user_id: userId }).del();
    return { active: false };
  } else {
    await kdb("radio_broadcast_reminders").insert({ id: uuidv4(), broadcast_id: broadcastId, user_id: userId });
    return { active: true };
  }
}

export async function checkReminders(userId: string) {
  const reminderRows = await kdb("radio_broadcast_reminders").where({ user_id: userId }).select("broadcast_id");
  if (reminderRows.length === 0) return [];

  const broadcastIds = reminderRows.map((r: any) => r.broadcast_id);
  const broadcasts = await kdb("radio_broadcasts").whereIn("id", broadcastIds).where("is_active", true).whereNotNull("scheduled_at");

  const now = Date.now();
  const upcoming: any[] = [];

  for (const b of broadcasts) {
    const bTime = new Date(b.scheduled_at).getTime();
    const diff = bTime - now;
    if (diff > 0 && diff <= 5 * 60 * 1000) {
      upcoming.push({ id: b.id, title: b.title, scheduled_at: b.scheduled_at });
    }
    if (b.recurring && b.recurring_day && b.recurring_time) {
      const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
      const targetDay = dayMap[b.recurring_day];
      if (targetDay !== undefined) {
        const [h, m] = b.recurring_time.split(":").map(Number);
        const nextDate = new Date();
        nextDate.setHours(h || 0, m || 0, 0, 0);
        const currentDay = nextDate.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil < 0) daysUntil += 7;
        if (daysUntil === 0 && nextDate.getTime() <= now) daysUntil = 7;
        nextDate.setDate(nextDate.getDate() + daysUntil);
        const rDiff = nextDate.getTime() - now;
        if (rDiff > 0 && rDiff <= 5 * 60 * 1000) {
          upcoming.push({ id: b.id, title: b.title, scheduled_at: nextDate.toISOString() });
        }
      }
    }
  }

  return upcoming;
}
