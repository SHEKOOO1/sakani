import { v4 as uuidv4 } from "uuid";
import { kdb } from "../../infrastructure/db";
import { AppPermission } from "../../../types/permissions";

const STAFF_PERMISSION_MAP: Record<string, string> = {
  can_manage_audio_broadcast: AppPermission.MANAGE_RADIO_BROADCAST,
  can_manage_video_broadcast: AppPermission.MANAGE_RADIO_BROADCAST,
  can_manage_video_library: AppPermission.MANAGE_RADIO_VIDEO_LIBRARY,
  can_manage_playlists: AppPermission.MANAGE_RADIO_PLAYLISTS,
  can_manage_tickers: AppPermission.MANAGE_RADIO_TICKERS,
  can_view_analytics: AppPermission.VIEW_RADIO_ANALYTICS,
  can_moderate_comments_chat: AppPermission.MODERATE_RADIO_CHAT,
  can_view_radio: AppPermission.VIEW_RADIO,
};

async function syncStaffPermissions(userId: string, permissions: Record<string, boolean> | null | undefined) {
  const target = await kdb("users").where({ id: userId }).first();
  if (!target) return;

  const existing: string[] = target.custom_permissions ? JSON.parse(target.custom_permissions) : [];
  const desired = new Set<string>();

  if (permissions) {
    for (const [staffKey, appPerm] of Object.entries(STAFF_PERMISSION_MAP)) {
      if ((permissions as any)[staffKey]) desired.add(appPerm);
    }
  }

  const radioPerms = new Set(Object.values(STAFF_PERMISSION_MAP));
  const filtered = existing.filter((p: string) => !radioPerms.has(p) || desired.has(p));
  const changed = filtered.length !== existing.length;

  for (const p of desired) {
    if (!filtered.includes(p)) { filtered.push(p); }
  }

  if (changed || filtered.length !== existing.length) {
    await kdb("users").where({ id: userId }).update({ custom_permissions: JSON.stringify(filtered) });
  }
}

export async function getStaff() {
  const staff = await kdb("radio_staff as rs")
    .join("users as u", "rs.user_id", "u.id")
    .select("rs.*", "u.name as user_name", "u.email as user_email")
    .orderBy("rs.created_at", "desc");

  return staff.map((s: any) => {
    let perms: any = {};
    try { perms = s.permissions ? JSON.parse(s.permissions) : {}; } catch { perms = {}; }
    return {
      id: s.id, user_id: s.user_id, user_name: s.user_name, user_email: s.user_email,
      role: s.role,
      permissions: {
        can_manage_audio_broadcast: !!perms.can_manage_audio_broadcast,
        can_manage_video_broadcast: !!perms.can_manage_video_broadcast,
        can_manage_video_library: !!perms.can_manage_video_library,
        can_manage_playlists: !!perms.can_manage_playlists,
        can_manage_tickers: !!perms.can_manage_tickers,
        can_view_analytics: !!perms.can_view_analytics,
        can_moderate_comments_chat: !!perms.can_moderate_comments_chat,
        can_view_radio: !!perms.can_view_radio,
      },
      created_at: s.created_at,
    };
  });
}

export async function searchStaff(query: string) {
  if (query.length < 2) return [];

  const users = await kdb("users")
    .where(function () {
      this.where("name", "like", `%${query}%`)
        .orWhere("email", "like", `%${query}%`)
        .orWhere("national_id", "like", `%${query}%`);
    })
    .whereNotExists(function () {
      this.select("*").from("radio_staff").whereRaw("radio_staff.user_id = users.id");
    })
    .limit(10)
    .select("id", "name", "email", "role", "national_id");

  return users.map((u: any) => ({
    id: u.id, name: u.name || "", email: u.email || "", role: u.role || "",
    national_id: u.national_id || undefined,
  }));
}

export async function addStaffMember(userId: string, role: string, permissions: any, addedBy: string) {
  const existing = await kdb("radio_staff").where({ user_id: userId }).first();
  if (existing) throw Object.assign(new Error("User already in staff"), { statusCode: 409 });

  const id = uuidv4();
  await kdb("radio_staff").insert({
    id, user_id: userId, role,
    permissions: permissions ? JSON.stringify(permissions) : null,
    created_by: addedBy, created_at: new Date(), updated_at: new Date(),
  });

  await syncStaffPermissions(userId, permissions);
  return { id };
}

export async function updateStaffMember(staffId: string, data: any) {
  const member = await kdb("radio_staff").where({ id: staffId }).first();
  if (!member) throw Object.assign(new Error("Staff member not found"), { statusCode: 404 });

  const { role, permissions } = data;
  const update: any = { updated_at: new Date() };
  if (role !== undefined) update.role = role;
  if (permissions !== undefined) update.permissions = JSON.stringify(permissions);

  await kdb("radio_staff").where({ id: staffId }).update(update);
  await syncStaffPermissions(member.user_id, permissions ?? null);
}

export async function removeStaffMember(staffMemberId: string) {
  const member = await kdb("radio_staff").where({ id: staffMemberId }).first();
  if (!member) throw Object.assign(new Error("Staff member not found"), { statusCode: 404 });

  await kdb("radio_staff").where({ id: staffMemberId }).del();
  await syncStaffPermissions(member.user_id, null);
}
