import { v4 as uuidv4 } from "uuid";
import { kdb } from "../../infrastructure/db";

export async function getChatMessages() {
  const messages = await kdb("radio_chat_messages as m")
    .leftJoin("users as u", "m.user_id", "u.id")
    .leftJoin("tenants as t", "u.tenant_id", "t.id")
    .where("m.is_hidden", false)
    .orderBy("m.created_at", "asc")
    .limit(100)
    .select("m.id", "m.user_id", "m.user_name", "m.message", "m.is_hidden", "m.created_at",
      "u.name as user_full_name", "u.role as user_role", "t.name as tenant_name");

  const studentIds = [...new Set(messages.filter(m => m.user_role === "student").map(m => m.user_id))];
  const studentGenders: Record<string, string> = {};
  if (studentIds.length > 0) {
    const students = await kdb("students as s").join("users as u", "s.user_id", "u.id").whereIn("s.user_id", studentIds).where("s.status", "active").select("u.id as user_id", "u.gender");
    students.forEach((s: any) => { studentGenders[s.user_id] = s.gender || ""; });
  }

  return messages.map((m: any) => {
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
}

export async function checkBan(userId: string): Promise<string | null> {
  const banned = await kdb("radio_banned_users").where({ user_id: userId }).first();
  if (!banned) return null;
  if (banned.expires_at && new Date(banned.expires_at) < new Date()) {
    await kdb("radio_banned_users").where({ user_id: userId }).del();
    return null;
  }
  return banned.reason === 'mute' ? 'mute' : 'ban';
}

export async function createChatMessage(message: string, userId: string) {
  const banStatus = await checkBan(userId);
  if (banStatus === 'mute') throw Object.assign(new Error('تم كتم صوتك'), { statusCode: 403 });
  if (banStatus === 'ban') throw Object.assign(new Error('تم حظرك من الشات'), { statusCode: 403 });

  const userRow = await kdb("users").where({ id: userId }).select("name", "role").first();
  const userName = userRow?.name || "";
  const userRole = userRow?.role || "";

  const id = uuidv4();
  await kdb("radio_chat_messages").insert({
    id, user_id: userId, user_name: userName, user_role: userRole, message: message.trim(), created_at: new Date(),
  });
  return { id, user_name: userName, user_role: userRole, user_id: userId };
}

export async function deleteChatMessage(msgId: string) {
  const msg = await kdb("radio_chat_messages").where({ id: msgId }).first();
  if (!msg) throw Object.assign(new Error("Message not found"), { statusCode: 404 });
  await kdb("radio_chat_messages").where({ id: msgId }).del();
}

export async function banUser(targetUserId: string, moderatorId: string) {
  const existing = await kdb("radio_banned_users").where({ user_id: targetUserId }).first();
  if (existing) return;

  await kdb("radio_banned_users").insert({ id: uuidv4(), user_id: targetUserId, banned_by: moderatorId, created_at: new Date() });
  await kdb("radio_chat_messages").where({ user_id: targetUserId, is_hidden: false }).update({ is_hidden: true });
}

export async function muteUser(targetUserId: string, moderatorId: string, durationMinutes: number) {
  const minutes = durationMinutes || 15;
  const existing = await kdb("radio_banned_users").where({ user_id: targetUserId }).first();
  if (existing) {
    await kdb("radio_banned_users").where({ user_id: targetUserId }).update({
      expires_at: new Date(Date.now() + minutes * 60000), reason: 'mute', banned_by: moderatorId,
    });
  } else {
    await kdb("radio_banned_users").insert({
      id: uuidv4(), user_id: targetUserId, banned_by: moderatorId, reason: 'mute',
      expires_at: new Date(Date.now() + minutes * 60000), created_at: new Date(),
    });
  }
  await kdb("radio_chat_messages").where({ user_id: targetUserId, is_hidden: false }).update({ is_hidden: true });
  return minutes;
}

export async function kickUser(targetUserId: string, moderatorId: string) {
  const existing = await kdb("radio_banned_users").where({ user_id: targetUserId }).first();
  if (existing) {
    await kdb("radio_banned_users").where({ user_id: targetUserId }).update({
      expires_at: new Date(Date.now() + 5 * 60000), reason: 'kick', banned_by: moderatorId,
    });
  } else {
    await kdb("radio_banned_users").insert({
      id: uuidv4(), user_id: targetUserId, banned_by: moderatorId, reason: 'kick',
      expires_at: new Date(Date.now() + 5 * 60000), created_at: new Date(),
    });
  }
  await kdb("radio_chat_messages").where({ user_id: targetUserId, is_hidden: false }).update({ is_hidden: true });
}

export async function unbanUser(targetUserId: string) {
  const banned = await kdb("radio_banned_users").where({ user_id: targetUserId }).first();
  if (!banned) throw Object.assign(new Error("User not banned"), { statusCode: 404 });
  await kdb("radio_chat_messages").where({ user_id: targetUserId, is_hidden: true }).update({ is_hidden: false });
  await kdb("radio_banned_users").where({ user_id: targetUserId }).del();
}

export async function getBannedUsers(userId: string) {
  const bannedUsers = await kdb("radio_banned_users as b")
    .leftJoin("users as u", "b.user_id", "u.id")
    .select("b.*", "u.name as user_name", "u.email as user_email", "u.role as user_role")
    .orderBy("b.created_at", "desc");

  const canUnban = userId ? true : false;

  const userIds = bannedUsers.map((b: any) => b.user_id);
  const hiddenCounts: Record<string, number> = {};
  if (userIds.length > 0) {
    const counts = await kdb("radio_chat_messages").whereIn("user_id", userIds).where("is_hidden", true).groupBy("user_id").select("user_id").count("* as count");
    counts.forEach((r: any) => { hiddenCounts[r.user_id] = Number(r.count); });
  }

  const data = bannedUsers.map((b: any) => ({
    id: b.id, user_id: b.user_id, user_name: b.user_name || "مستخدم",
    user_email: b.user_email || "", user_role: b.user_role || "",
    banned_by: b.banned_by, created_at: b.created_at,
    hidden_messages_count: hiddenCounts[b.user_id] || 0,
  }));

  return { data, canUnban };
}

export async function getBannedUserMessages(targetUserId: string) {
  const messages = await kdb("radio_chat_messages as m")
    .leftJoin("users as u", "m.user_id", "u.id")
    .leftJoin("tenants as t", "u.tenant_id", "t.id")
    .where("m.user_id", targetUserId).where("m.is_hidden", true)
    .orderBy("m.created_at", "asc")
    .select("m.id", "m.user_id", "m.user_name", "m.message", "m.is_hidden", "m.created_at",
      "u.name as user_full_name", "u.role as user_role", "t.name as tenant_name");

  return messages.map((m: any) => ({
    id: m.id, user_id: m.user_id, user_name: m.user_full_name || m.user_name || "مستخدم",
    user_role: m.user_role || "", message: m.message, is_hidden: !!m.is_hidden, created_at: m.created_at,
  }));
}
