import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { lockDateString } from "./absenceLock.service";
import { getTenantPresenceBoard } from "./presence.service";
import { isValidCoordinate, calculateDistance, evaluateGeofence, parseAccuracy } from "./geo";
import { createNotification } from "../api/notifications.routes";

/**
 * Supervisor roll-call (المناداة).
 *
 * A supervisor opens a roll-call for a night; the sheet is seeded with every
 * active resident and a *suggested* mark derived from the last GPS reading
 * (inside → present, outside → absent, otherwise unmarked). The supervisor then
 * confirms/corrects the sheet and submits it. Only residents left unmarked or
 * explicitly absent produce an absence case, and the roll-call never notifies
 * anyone by itself — a human must still record a decision on the case.
 */

export type RollCallMark = "present" | "absent" | "unmarked";

export interface RollCallCounts {
  present: number;
  absent: number;
  unmarked: number;
  excluded: number;
}

/** Tally a set of entries into the roll-call summary. */
export function summarizeRollCall(entries: Array<{ mark: string; is_traveling: boolean | number | null }>): RollCallCounts {
  const counts: RollCallCounts = { present: 0, absent: 0, unmarked: 0, excluded: 0 };
  for (const e of entries) {
    if (e.is_traveling) { counts.excluded += 1; continue; }
    if (e.mark === "present") counts.present += 1;
    else if (e.mark === "absent") counts.absent += 1;
    else counts.unmarked += 1;
  }
  return counts;
}

/**
 * The absence state a mark produces on submit:
 *   · present / traveling → null (no case);
 *   · absent             → "open"         (human-confirmed);
 *   · unmarked           → "unconfirmed"  (needs review).
 */
export function classifyRollCallOutcome(mark: string, isTraveling: boolean): "open" | "unconfirmed" | null {
  if (isTraveling) return null;
  if (mark === "present") return null;
  if (mark === "absent") return "open";
  return "unconfirmed";
}

function countColumns(c: RollCallCounts) {
  return {
    present_count: c.present,
    absent_count: c.absent,
    unmarked_count: c.unmarked,
    excluded_count: c.excluded,
  };
}

async function entriesFor(rollCallId: string): Promise<any[]> {
  return kdb("roll_call_entries").where({ roll_call_id: rollCallId }).orderBy("student_name", "asc");
}

/** Fetch a single roll-call (by id) or the one for a date (default: today). */
export async function getRollCall(tenantId: string, opts: { id?: string; date?: string; now?: Date } = {}): Promise<any | null> {
  const q = kdb("roll_calls").where({ tenant_id: tenantId });
  if (opts.id) q.andWhere({ id: opts.id });
  else q.andWhere({ lock_date: opts.date ?? lockDateString(opts.now ?? new Date()) });
  const rollCall = await q.first();
  if (!rollCall) return null;
  return { ...rollCall, entries: await entriesFor(rollCall.id) };
}

/**
 * Open (or resume) the roll-call sheet for a night. Idempotent per
 * (tenant, lock_date): calling again returns the existing session unchanged.
 */
export async function startRollCall(input: {
  tenantId: string;
  lockDate?: string;
  notes?: string | null;
  userId: string;
  now?: Date;
}): Promise<Record<string, any>> {
  const now = input.now ?? new Date();
  const lockDate = input.lockDate ?? lockDateString(now);

  const existing = await kdb("roll_calls").where({ tenant_id: input.tenantId, lock_date: lockDate }).first();
  if (existing) {
    return { ...existing, entries: await entriesFor(existing.id), created: false };
  }

  const tenant = await kdb("tenants").where({ id: input.tenantId }).first();
  const board = await getTenantPresenceBoard(input.tenantId, now);

  const rollCallId = uuidv4();
  const entryRows = (board as any[]).map((s) => {
    const isTraveling = !!s.is_traveling;
    let mark: RollCallMark = "unmarked";
    if (!isTraveling && s.status === "inside") mark = "present";
    else if (!isTraveling && s.status === "outside") mark = "absent";
    return {
      id: uuidv4(),
      roll_call_id: rollCallId,
      tenant_id: input.tenantId,
      student_id: s.student_id,
      student_name: s.student_name,
      mark,
      presence_status: isTraveling ? null : s.status,
      is_traveling: isTraveling ? 1 : 0,
      evidence_lat: s.lat ?? null,
      evidence_lng: s.lng ?? null,
      evidence_accuracy: s.accuracy ?? null,
      evidence_at: s.updated_at ?? null,
      created_at: now,
    };
  });

  const counts = countColumns(summarizeRollCall(entryRows));
  const rollCallRow = {
    id: rollCallId,
    tenant_id: input.tenantId,
    lock_date: lockDate,
    lock_time: tenant?.curfew_time ?? null,
    state: "open",
    notes: typeof input.notes === "string" ? input.notes.slice(0, 2000) : null,
    started_by: input.userId,
    started_at: now,
    created_at: now,
    ...counts,
  };

  try {
    await kdb.transaction(async (trx) => {
      await trx("roll_calls").insert(rollCallRow);
      if (entryRows.length) await trx("roll_call_entries").insert(entryRows);
    });
  } catch (e: any) {
    // Lost an idempotency race: another supervisor opened the same night.
    if (e?.number === 2601 || e?.number === 2627) {
      const raced = await kdb("roll_calls").where({ tenant_id: input.tenantId, lock_date: lockDate }).first();
      return { ...raced, entries: await entriesFor(raced.id), created: false };
    }
    throw e;
  }

  return { ...rollCallRow, entries: entryRows, created: true };
}

const VALID_MARKS = new Set<RollCallMark>(["present", "absent", "unmarked"]);

/** Save draft marks. Only allowed while the roll-call is still open. */
export async function updateRollCallEntries(input: {
  tenantId: string;
  rollCallId: string;
  entries: Array<{ studentId: string; mark: string; note?: string | null }>;
  userId: string;
  now?: Date;
}): Promise<Record<string, any>> {
  const now = input.now ?? new Date();
  const rollCall = await kdb("roll_calls").where({ id: input.rollCallId, tenant_id: input.tenantId }).first();
  if (!rollCall) throw new Error("ROLL_CALL_NOT_FOUND");
  if (rollCall.state !== "open") throw new Error("ROLL_CALL_LOCKED");

  const wanted = new Map<string, { mark: string; note?: string | null }>();
  for (const e of input.entries) {
    if (!e || typeof e.studentId !== "string") continue;
    wanted.set(e.studentId, { mark: e.mark, note: e.note });
  }

  const ids = [...wanted.keys()];
  const existing = ids.length
    ? await kdb("roll_call_entries").where({ roll_call_id: rollCall.id }).whereIn("student_id", ids)
    : [];
  const byStudent = new Map((existing as any[]).map((row) => [row.student_id, row]));

  await kdb.transaction(async (trx) => {
    for (const [studentId, change] of wanted) {
      const row = byStudent.get(studentId);
      if (!row) continue; // not part of this sheet — ignore defensively
      const mark = VALID_MARKS.has(change.mark as RollCallMark) ? change.mark : "unmarked";
      const patch: Record<string, any> = { mark, updated_at: now };
      if (change.note !== undefined) patch.note = typeof change.note === "string" ? change.note.slice(0, 2000) : null;
      await trx("roll_call_entries").where({ id: row.id }).update(patch);
    }
    const all = await trx("roll_call_entries").where({ roll_call_id: rollCall.id });
    await trx("roll_calls").where({ id: rollCall.id }).update({ ...countColumns(summarizeRollCall(all as any[])), updated_at: now });
  });

  return { ...(await kdb("roll_calls").where({ id: rollCall.id }).first()), entries: await entriesFor(rollCall.id) };
}

/**
 * Finalise the sheet: create absence cases for every unmarked/absent resident
 * and close the session. Sent no notifications — a human decision on each case
 * is what triggers warnings/fines. Idempotent: re-submitting links the existing
 * cases instead of duplicating them.
 */
export async function submitRollCall(input: {
  tenantId: string;
  rollCallId: string;
  userId: string;
  now?: Date;
}): Promise<Record<string, any>> {
  const now = input.now ?? new Date();
  const rollCall = await kdb("roll_calls").where({ id: input.rollCallId, tenant_id: input.tenantId }).first();
  if (!rollCall) throw new Error("ROLL_CALL_NOT_FOUND");

  const entries = (await kdb("roll_call_entries").where({ roll_call_id: rollCall.id })) as any[];
  const counts = summarizeRollCall(entries);

  let createdCases = 0;
  await kdb.transaction(async (trx) => {
    for (const e of entries) {
      const outcome = classifyRollCallOutcome(e.mark, !!e.is_traveling);
      if (!outcome) continue;
      if (e.absence_case_id) continue;

      const existing = await trx("student_absence_cases")
        .where({ tenant_id: input.tenantId, student_id: e.student_id, lock_date: rollCall.lock_date })
        .first();

      let caseId: string;
      if (existing) {
        caseId = existing.id;
      } else {
        caseId = uuidv4();
        await trx("student_absence_cases").insert({
          id: caseId,
          tenant_id: input.tenantId,
          student_id: e.student_id,
          lock_date: rollCall.lock_date,
          lock_time: rollCall.lock_time,
          state: outcome,
          evidence_lat: e.evidence_lat,
          evidence_lng: e.evidence_lng,
          evidence_accuracy: e.evidence_accuracy,
          evidence_at: e.evidence_at,
          escalation_count: 0,
          escalated_to_priest: 0,
          source: "roll_call",
          roll_call_id: rollCall.id,
          created_at: now,
        });
        createdCases += 1;
      }
      await trx("roll_call_entries").where({ id: e.id }).update({ absence_case_id: caseId, updated_at: now });
    }

    await trx("roll_calls").where({ id: rollCall.id }).update({
      ...countColumns(counts),
      state: "submitted",
      submitted_by: input.userId,
      submitted_at: now,
      updated_at: now,
    });
  });

  await kdb("decisions_log").insert({
    id: uuidv4(),
    tenant_id: input.tenantId,
    action_type: "ROLL_CALL_SUBMIT",
    target_id: rollCall.id,
    target_table: "roll_calls",
    details: JSON.stringify({ lockDate: rollCall.lock_date, ...counts, createdCases }),
    status: "active",
    previous_state: rollCall.state,
    created_by: input.userId,
    created_at: now,
  });

  const full = await getRollCall(input.tenantId, { id: rollCall.id });
  return { ...full, createdCases };
}

// ────────────────────────────────────────────────────────────────────────────
// Student self-response (the mandatory night popup)
// ────────────────────────────────────────────────────────────────────────────

/** Map a logged-in user to their student row (students.user_id → users.id). */
export async function resolveStudentForUser(userId: string, tenantId: string): Promise<{ id: string; user_id: string; is_traveling: any } | null> {
  const row = await kdb("students").where({ user_id: userId, tenant_id: tenantId }).first();
  return row || null;
}

/**
 * The card the student's device should show: today's roll-call (if any) plus
 * this student's entry. `null` when there is no sheet or the student is not on
 * it (e.g. opened after the sheet was built).
 */
export async function getStudentRollCall(tenantId: string, studentId: string, now?: Date): Promise<{ rollCall: any; entry: any } | null> {
  const date = lockDateString(now ?? new Date());
  const rollCall = await kdb("roll_calls").where({ tenant_id: tenantId, lock_date: date }).first();
  if (!rollCall) return null;
  const entry = await kdb("roll_call_entries").where({ roll_call_id: rollCall.id, student_id: studentId }).first();
  if (!entry) return null;
  return {
    rollCall: {
      id: rollCall.id,
      lock_date: rollCall.lock_date,
      lock_time: rollCall.lock_time,
      state: rollCall.state,
      notes: rollCall.notes,
    },
    entry: {
      id: entry.id,
      mark: entry.mark,
      presence_status: entry.presence_status,
      is_traveling: !!entry.is_traveling,
      answer_at: entry.answer_at,
      answer_mark: entry.answer_mark,
      answer_inside: entry.answer_inside,
    },
  };
}

/**
 * Record the student's own answer ("present" / "absent"). The server decides the
 * geofence verdict from the coordinates sent with the answer. Stores the claim
 * on answer_* (kept apart from the supervisor's draft `mark`, which it also
 * mirrors) and refreshes the tallies. Only allowed while the sheet is open and
 * the student is not exempt (traveling).
 */
export async function respondToRollCall(input: {
  tenantId: string;
  rollCallId: string;
  studentId: string;
  answer: "present" | "absent";
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  now?: Date;
}): Promise<any> {
  const now = input.now ?? new Date();
  if (input.answer !== "present" && input.answer !== "absent") throw new Error("ROLL_CALL_INVALID_ANSWER");

  const rollCall = await kdb("roll_calls").where({ id: input.rollCallId, tenant_id: input.tenantId }).first();
  if (!rollCall) throw new Error("ROLL_CALL_NOT_FOUND");
  if (rollCall.state !== "open") throw new Error("ROLL_CALL_LOCKED");

  const entry = await kdb("roll_call_entries").where({ roll_call_id: rollCall.id, student_id: input.studentId }).first();
  if (!entry) throw new Error("ROLL_CALL_NOT_FOUND");
  if (entry.is_traveling) throw new Error("ROLL_CALL_EXEMPT");

  const tenant = await kdb("tenants").where({ id: input.tenantId }).first();
  let inside: number | null = null;
  if (isValidCoordinate(input.lat, input.lng) && isValidCoordinate(tenant?.location_lat, tenant?.location_lng)) {
    const distance = calculateDistance(Number(input.lat), Number(input.lng), Number(tenant.location_lat), Number(tenant.location_lng));
    const verdict = evaluateGeofence(distance, Number(tenant.location_radius) || 50, parseAccuracy(input.accuracy));
    inside = verdict === "inside" ? 1 : verdict === "outside" ? 0 : null;
  }

  await kdb("roll_call_entries").where({ id: entry.id }).update({
    mark: input.answer,
    answer_mark: input.answer,
    answer_at: now,
    answer_inside: inside,
    updated_at: now,
  });

  const all = await kdb("roll_call_entries").where({ roll_call_id: rollCall.id });
  await kdb("roll_calls").where({ id: rollCall.id }).update({ ...countColumns(summarizeRollCall(all as any[])), updated_at: now });

  // Best-effort live refresh for supervisors watching the sheet.
  try {
    const io = (global as any).__io;
    if (io) io.to(`tenant-${input.tenantId}`).emit("roll-call-entry-updated", { rollCallId: rollCall.id, studentId: input.studentId, answer: input.answer });
  } catch { /* realtime is best-effort */ }

  return kdb("roll_call_entries").where({ id: entry.id }).first();
}

/**
 * Push the freshly-opened sheet to every non-traveling resident: a real-time
 * `roll-call-required` event (for the open app's blocking popup) plus a persisted
 * notification (bell + web push, so a closed app is still woken). Stamps
 * `published_at` so the scheduler pushes a given night only once.
 */
export async function broadcastRollCallOpened(input: { tenantId: string; rollCall: any }): Promise<number> {
  const { tenantId, rollCall } = input;
  const io = (global as any).__io;

  const students = await kdb("students")
    .where({ tenant_id: tenantId })
    .whereNot("is_traveling", 1)
    .whereNotNull("user_id")
    .select("user_id");

  const title = "نداء الليلة 🔔";
  const message = "مطلوب تأكيد وجودك في السكن الآن. افتح التطبيق وأجب على النداء.";

  let sent = 0;
  for (const s of students as any[]) {
    try {
      if (io) io.to(`user-${s.user_id}`).emit("roll-call-required", {
        rollCallId: rollCall.id,
        lockDate: rollCall.lock_date,
        lockTime: rollCall.lock_time,
      });
    } catch { /* best-effort */ }
    try {
      await createNotification({
        userId: s.user_id,
        tenantId,
        title,
        message,
        type: "warning",
        metadata: JSON.stringify({ kind: "roll_call", rollCallId: rollCall.id }),
        url: "/dashboard",
      });
    } catch { /* best-effort */ }
    sent += 1;
  }

  await kdb("roll_calls").where({ id: rollCall.id }).update({ published_at: new Date(), updated_at: new Date() });
  return sent;
}
