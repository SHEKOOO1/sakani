import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { getPresence, presenceStatus, PresenceRecord } from "./presence.service";

/**
 * Lock-time (curfew) absence check.
 *
 * For every active, non-traveling student in a dorm we look at the last known
 * presence and open at most one case per (student, lock-date):
 *   · confirmed outside  → `open`        → urgent alert to supervisors + guardians;
 *   · unknown / stale    → `unconfirmed` → "could not confirm presence" alert to supervisors.
 * Inside students and traveling students produce nothing.
 *
 * The unique index UX_absence_cases_per_day makes the check idempotent across
 * restarts and overlapping scheduler ticks; notifications only fire when the
 * case is created, and a separate pass re-escalates unacknowledged cases.
 */

/** Minutes a confirmed case may stay unacknowledged before we alert again. */
export const RE_ESCALATE_MINUTES = 20;

const SUPERVISOR_ROLES = ["supervisor", "assistant_supervisor"];

function lockDateString(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export { lockDateString };

async function supervisorIds(tenantId: string): Promise<string[]> {
  const rows = await kdb("user_tenant_assignments as uta")
    .join("users as u", "uta.user_id", "u.id")
    .where("uta.tenant_id", tenantId)
    .whereIn("u.role", SUPERVISOR_ROLES)
    .select("u.id");
  return rows.map((r: any) => r.id);
}

async function guardianIds(studentId: string): Promise<string[]> {
  const rows = await kdb("student_guardians as sg")
    .join("parents as p", "sg.guardian_id", "p.id")
    .where("sg.student_id", studentId)
    .select("p.user_id");
  return rows.map((r: any) => r.user_id).filter(Boolean);
}

async function notify(userIds: string[], payload: {
  tenantId: string;
  title: string;
  message: string;
  type: string;
  caseId: string;
}, now: Date): Promise<number> {
  let sent = 0;
  for (const userId of userIds) {
    await kdb("notifications").insert({
      id: uuidv4(),
      user_id: userId,
      tenant_id: payload.tenantId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      metadata: JSON.stringify({ page: "absence", caseId: payload.caseId }),
      is_read: 0,
      created_at: now,
    });
    sent += 1;
  }
  return sent;
}

/** Runs the lock-time check for one dorm on one date. Idempotent. */
export async function runLockCheck(input: { tenantId: string; lockDate?: string; now?: Date }): Promise<{
  open: number;
  unconfirmed: number;
  skipped: number;
}> {
  const now = input.now ?? new Date();
  const lockDate = input.lockDate ?? lockDateString(now);

  const tenant = await kdb("tenants").where({ id: input.tenantId }).first();
  if (!tenant || !tenant.curfew_time) return { open: 0, unconfirmed: 0, skipped: 0 };

  const studentRows = await kdb("students as s")
    .join("users as u", "s.user_id", "u.id")
    .where("s.tenant_id", input.tenantId)
    .where((qb) => qb.whereNull("s.status").orWhereNot("s.status", "archived"))
    .select("s.id as id", "s.is_traveling", "u.name as name");

  let open = 0;
  let unconfirmed = 0;
  let skipped = 0;

  for (const student of studentRows as any[]) {
    if (student.is_traveling) { skipped += 1; continue; }

    const existing = await kdb("student_absence_cases")
      .where({ tenant_id: input.tenantId, student_id: student.id, lock_date: lockDate })
      .first();
    if (existing) { skipped += 1; continue; }

    const record: PresenceRecord | null = await getPresence(student.id);
    const status = presenceStatus(record, now);
    if (status === "inside") { skipped += 1; continue; }

    const confirmed = status === "outside";
    const state = confirmed ? "open" : "unconfirmed";
    const caseId = uuidv4();
    const sups = await supervisorIds(input.tenantId);
    const guardians = confirmed ? await guardianIds(student.id) : [];

    const evidence = record
      ? {
          evidence_lat: record.lat,
          evidence_lng: record.lng,
          evidence_accuracy: record.accuracy,
          evidence_at: record.updatedAt,
        }
      : { evidence_lat: null, evidence_lng: null, evidence_accuracy: null, evidence_at: null };

    try {
      await kdb("student_absence_cases").insert({
        id: caseId,
        tenant_id: input.tenantId,
        student_id: student.id,
        lock_date: lockDate,
        lock_time: tenant.curfew_time || null,
        state,
        ...evidence,
        notified_supervisor_at: sups.length ? now : null,
        notified_guardian_at: guardians.length ? now : null,
        last_notified_at: now,
        escalation_count: 0,
        escalated_to_priest: 0,
        created_at: now,
      });
    } catch (e: any) {
      // Lost an idempotency race → another tick already created the case.
      if (e?.number === 2601 || e?.number === 2627) { skipped += 1; continue; }
      throw e;
    }

    if (confirmed) {
      open += 1;
      await notify(sups, {
        tenantId: input.tenantId,
        title: `غياب مُؤكَّد: ${student.name} ⛠️`,
        message: `لم يسجّل الطالب ${student.name} وجوده داخل ${tenant.name || "السكن"} بعد موعد الإغلاق (${tenant.curfew_time}). آخر موقع معروف خارج النطاق. برجاء المتابعة فوراً.`,
        type: "error",
        caseId,
      }, now);
      await notify(guardians, {
        tenantId: input.tenantId,
        title: `تنبيه غياب: ${student.name}`,
        message: `لم يتأكد وجود ابنكم ${student.name} داخل السكن بعد موعد الإغلاق. برجاء التواصل مع إدارة السكن فوراً.`,
        type: "error",
        caseId,
      }, now);
    } else {
      unconfirmed += 1;
      await notify(sups, {
        tenantId: input.tenantId,
        title: `تعذّر تأكيد وجود الطالب: ${student.name}`,
        message: `تعذّر تأكيد وجود الطالب ${student.name} داخل ${tenant.name || "السكن"} بعد موعد الإغلاق (لا يوجد تسجيل موقع حديث). برجاء التحقق المباشر.`,
        type: "warning",
        caseId,
      }, now);
    }
  }

  return { open, unconfirmed, skipped };
}

/** Re-alert on cases that are still unacknowledged after RE_ESCALATE_MINUTES. */
export async function reEscalateUnacked(input: { tenantId: string; now?: Date }): Promise<number> {
  const now = input.now ?? new Date();
  const threshold = new Date(now.getTime() - RE_ESCALATE_MINUTES * 60000);

  const cases = await kdb("student_absence_cases")
    .where({ tenant_id: input.tenantId })
    .whereIn("state", ["open", "unconfirmed"])
    .whereNull("ack_at")
    .where("lock_date", lockDateString(now))
    .where("last_notified_at", "<", threshold)
    .select("id", "student_id", "state", "lock_time", "escalation_count");

  let count = 0;
  for (const c of cases as any[]) {
    const student = await kdb("students as s")
      .join("users as u", "s.user_id", "u.id")
      .where("s.id", c.student_id)
      .select("u.name as name")
      .first();
    const sups = await supervisorIds(input.tenantId);
    const confirmed = c.state === "open";
    await notify(sups, {
      tenantId: input.tenantId,
      title: `متابعة عاجلة: ${student?.name || "طالب"} لم يُعالَج بعد`,
      message: confirmed
        ? `لا يزال غياب الطالب ${student?.name || ""} بعد موعد الإغلاق بدون إجراء. برجاء البتّ في الحالة.`
        : `لا يزال تعذّر تأكيد وجود الطالب ${student?.name || ""} بدون إجراء. برجاء التحقق المباشر.`,
      type: confirmed ? "error" : "warning",
      caseId: c.id,
    }, now);
    if (confirmed) {
      await notify(await guardianIds(c.student_id), {
        tenantId: input.tenantId,
        title: "تذكير: غياب غير معالج",
        message: `لم يتم بعد معالجة تنبيه غياب ابنكم. برجاء التواصل مع إدارة السكن.`,
        type: "error",
        caseId: c.id,
      }, now);
    }
    await kdb("student_absence_cases").where({ id: c.id }).update({
      last_notified_at: now,
      escalation_count: (c.escalation_count || 0) + 1,
    });
    count += 1;
  }
  return count;
}
