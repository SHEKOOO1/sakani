import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate } from "./middleware";
import { canAccessTenant, requirePermOrAdmin } from "./attendancePolicy.routes";
import { AppPermission } from "../../types/permissions";
import { recordPresence, getTenantPresenceBoard, resolveDormGate } from "../services/presence.service";
import { runLockCheck, reEscalateUnacked } from "../services/absenceLock.service";
import { penaltyLines, postEntry } from "../services/ledger.service";
import { BehaviorService } from "../services/behavior.service";
import { isValidCoordinate } from "../services/geo";

const router = express.Router();
const behavior = new BehaviorService();

const DECISION_ACTIONS = ["warning", "points", "fine", "terminate", "review_only"] as const;

/**
 * Presence ping — the student PWA reports its position; the SERVER decides
 * inside/outside and stores one tri-state row per student. This never notifies
 * anyone by itself (ordinary movement stays quiet); the lock-time check is what
 * raises an alert. A dorm with no configured circle records NULL (no absence).
 */
router.post("/attendance/presence", authenticate, async (req, res) => {
  try {
    const student = await kdb("students").where({ user_id: req.user.id }).first();
    if (!student) return res.status(403).json({ success: false, message: "غير مسموح بتسجيل الموقع لهذا الحساب" });

    const { lat, lng } = req.body || {};
    if (!isValidCoordinate(lat, lng)) {
      return res.status(400).json({ success: false, message: "إحداثيات الموقع غير صالحة" });
    }

    const result = await recordPresence({
      studentId: student.id,
      tenantId: student.tenant_id,
      lat: Number(lat),
      lng: Number(lng),
      accuracy: req.body?.accuracy,
      source: "ping",
    });
    if (result.verdict === "no-gate") {
      return res.status(400).json({ success: false, message: "لم يتم ضبط موقع السكن بعد. برجاء مراجعة الإدارة." });
    }
    res.json({ success: true, data: { inside: result.inside, distance: result.distance === null ? null : Math.round(result.distance) } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر تسجيل الموقع. حاول مرة أخرى." });
  }
});

// Presence board — supervisors see who is inside / outside / unknown right now.
router.get("/tenants/:tenantId/presence/board", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.VIEW_ATTENDANCE)) return;

    const tenant = await kdb("tenants").where({ id: tenantId }).first();
    const board = await getTenantPresenceBoard(tenantId);
    res.json({ success: true, data: { gate: resolveDormGate(tenant), students: board } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر تحميل لوحة الوجود" });
  }
});

// Absence cases for a dorm, newest first. Optional ?state= and ?date= filters.
router.get("/tenants/:tenantId/absence-cases", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.VIEW_ATTENDANCE)) return;

    const q = kdb("student_absence_cases as c")
      .join("students as s", "c.student_id", "s.id")
      .join("users as u", "s.user_id", "u.id")
      .where("c.tenant_id", tenantId)
      .select("c.*", "u.name as student_name");
    if (req.query.state) q.where("c.state", String(req.query.state));
    if (req.query.date) q.where("c.lock_date", String(req.query.date));
    const rows = await q.orderByRaw("CASE WHEN c.state IN ('open','unconfirmed') THEN 0 ELSE 1 END, c.lock_date DESC, c.created_at DESC");
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر تحميل حالات الغياب" });
  }
});

// Acknowledge a case (supervisor saw it). Stops re-escalation.
router.post("/tenants/:tenantId/absence-cases/:id/ack", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.MANAGE_ATTENDANCE)) return;

    const caseRow = await kdb("student_absence_cases").where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!caseRow) return res.status(404).json({ success: false, message: "الحالة غير موجودة" });
    await kdb("student_absence_cases").where({ id: caseRow.id }).update({ ack_by: req.user.id, ack_at: new Date(), updated_at: new Date() });
    res.json({ success: true, message: "تم تأكيد الاستلام" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر تأكيد الاستلام" });
  }
});

/**
 * Record a decision on an absence case. Every action is audited.
 *   warning      → student_warnings row
 *   points       → negative student_points
 *   fine         → penalty journal entry (idempotent by reference)
 *   terminate    → archives the student (reuses the leave/archive path) — the
 *                  supervisor executes this himself, behind an explicit confirm.
 *   review_only  → closes with a note, no side effect
 */
router.post("/tenants/:tenantId/absence-cases/:id/decision", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.MANAGE_ATTENDANCE)) return;

    const body = req.body || {};
    const action = body.action;
    if (!DECISION_ACTIONS.includes(action)) {
      return res.status(400).json({ success: false, message: "نوع القرار غير صالح" });
    }

    const caseRow = await kdb("student_absence_cases").where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!caseRow) return res.status(404).json({ success: false, message: "الحالة غير موجودة" });
    if (caseRow.state === "closed") return res.status(400).json({ success: false, message: "تم البت في هذه الحالة مسبقاً" });

    const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;
    const escalateToPriest = !!body.escalateToPriest;
    const update: Record<string, any> = {
      state: "closed",
      decision_action: action,
      decision_notes: notes,
      decided_by: req.user.id,
      decided_at: new Date(),
      escalated_to_priest: escalateToPriest ? 1 : 0,
      priest_note: typeof body.priestNote === "string" ? body.priestNote.slice(0, 2000) : null,
      updated_at: new Date(),
    };

    const audit = async (extra: Record<string, any> = {}) => {
      await kdb("decisions_log").insert({
        id: uuidv4(),
        tenant_id: tenantId,
        action_type: "ABSENCE_CASE_DECISION",
        target_id: caseRow.id,
        target_table: "student_absence_cases",
        details: JSON.stringify({ action, notes, ...extra }),
        status: "active",
        previous_state: caseRow.state,
        created_by: req.user.id,
        created_at: new Date(),
      });
    };

    if (action === "warning") {
      const reasonText = notes || `غياب عن السكن بعد موعد الإغلاق بتاريخ ${caseRow.lock_date}`;

      // عقوبة اختيارية تُقرَن بالإنذار: إما غرامة مالية أو خصم نقاط.
      const penalty = body.penalty && typeof body.penalty === "object" ? body.penalty : null;
      const penaltyType = penalty?.type;
      const penaltyAmount = penalty ? Math.abs(Number(penalty.amount)) : 0;
      let penaltyLine = "";

      if (penaltyType === "points") {
        if (!Number.isFinite(penaltyAmount) || penaltyAmount <= 0) {
          return res.status(400).json({ success: false, message: "عدد النقاط المخصومة غير صالح" });
        }
        await behavior.addPoints(
          { studentId: caseRow.student_id, amount: -penaltyAmount, reason: reasonText, category: "penalty", createdBy: req.user.id },
          tenantId,
        );
        penaltyLine = ` كما تم خصم ${penaltyAmount} نقطة.`;
      } else if (penaltyType === "fine") {
        if (!Number.isFinite(penaltyAmount) || penaltyAmount <= 0) {
          return res.status(400).json({ success: false, message: "قيمة الغرامة غير صالحة" });
        }
        const entry = await postEntry(kdb, {
          entryType: "penalty",
          amount: penaltyAmount,
          lines: penaltyLines(penaltyAmount),
          tenantId,
          studentId: caseRow.student_id,
          category: "غرامة غياب",
          description: reasonText,
          reference: `absence-case:${caseRow.id}`,
          source: "system",
          createdBy: req.user.id,
        });
        update.fine_amount = penaltyAmount;
        update.financial_state = "charged";
        update.ledger_entry_id = entry.id;
        penaltyLine = ` كما تم توقيع غرامة مالية بقيمة ${penaltyAmount}.`;
      }

      const warningId = uuidv4();
      await kdb("student_warnings").insert({
        id: warningId,
        tenant_id: tenantId,
        student_id: caseRow.student_id,
        level: "high",
        reason: reasonText,
        notify_parent: 1,
        status: "active",
        warning_type: "RESIDENCE_ABSENCE",
        is_attendance_warning: 1,
        created_by: req.user.id,
        created_at: new Date(),
      });
      update.warning_id = warningId;
      await kdb("student_absence_cases").where({ id: caseRow.id }).update(update);
      await audit({ warningId, penalty: penaltyType || "none", penaltyAmount: penaltyAmount || 0 });

      // إخطار الطالب وأولياء الأمر بسبب الإنذار والعقوبة المقرونة به.
      const student = await kdb("students as s")
        .join("users as u", "s.user_id", "u.id")
        .select("s.user_id", "u.name as student_name")
        .where("s.id", caseRow.student_id)
        .first();
      const caseMessage = `تم توقيع إنذار بشأن الطالب بسبب: ${reasonText}.${penaltyLine}`.trim();

      if (student?.user_id) {
        await kdb("notifications").insert({
          id: uuidv4(),
          user_id: student.user_id,
          tenant_id: tenantId,
          title: "إنذار رسمي بشأن غيابك عن السكن",
          message: caseMessage,
          type: "warning",
        });
      }
      const guardians = await kdb("student_guardians as sg")
        .join("parents as p", "sg.guardian_id", "p.id")
        .join("users as u", "p.user_id", "u.id")
        .where("sg.student_id", caseRow.student_id)
        .select("u.id");
      for (const g of guardians) {
        await kdb("notifications").insert({
          id: uuidv4(),
          user_id: g.id,
          tenant_id: tenantId,
          title: `إنذار بشأن ${student?.student_name || "ابنكم"}`,
          message: caseMessage,
          type: "warning",
        });
      }

      return res.json({ success: true, message: "تم تسجيل الإنذار وإخطار الطالب وأولياء الأمر" });
    }

    if (action === "points") {
      const amount = Math.abs(Number(body.points) || 0);
      if (amount <= 0) return res.status(400).json({ success: false, message: "عدد النقاط غير صالح" });
      await behavior.addPoints(
        { studentId: caseRow.student_id, amount: -amount, reason: notes || "خصم نقاط: غياب عن السكن", category: "penalty", createdBy: req.user.id },
        tenantId,
      );
      await kdb("student_absence_cases").where({ id: caseRow.id }).update(update);
      await audit({ points: amount });
      return res.json({ success: true, message: "تم خصم النقاط" });
    }

    if (action === "fine") {
      const fineAmount = Number(body.fineAmount);
      if (!Number.isFinite(fineAmount) || fineAmount <= 0) {
        return res.status(400).json({ success: false, message: "قيمة الغرامة غير صالحة" });
      }
      const entry = await postEntry(kdb, {
        entryType: "penalty",
        amount: fineAmount,
        lines: penaltyLines(fineAmount),
        tenantId,
        studentId: caseRow.student_id,
        category: "غرامة غياب",
        description: notes || `غرامة غياب عن السكن بتاريخ ${caseRow.lock_date}`,
        reference: `absence-case:${caseRow.id}`,
        source: "system",
        createdBy: req.user.id,
      });
      update.fine_amount = fineAmount;
      update.financial_state = "charged";
      update.ledger_entry_id = entry.id;
      await kdb("student_absence_cases").where({ id: caseRow.id }).update(update);
      await audit({ fineAmount, ledgerEntryId: entry.id });
      return res.json({ success: true, message: "تم تسجيل الغرامة" });
    }

    if (action === "terminate") {
      if (body.confirm !== true) {
        return res.status(400).json({ success: false, message: "يتطلب تأكيد الإنهاء" });
      }
      await kdb.transaction(async (trx) => {
        const student = await trx("students as s")
          .join("users as u", "s.user_id", "u.id")
          .select("s.*", "u.name as student_real_name")
          .where("s.id", caseRow.student_id)
          .where("s.tenant_id", tenantId)
          .first();
        if (!student) throw new Error("Student not found");

        const guardians = await trx("student_guardians as sg")
          .join("parents as p", "sg.guardian_id", "p.id")
          .join("users as u", "p.user_id", "u.id")
          .select("p.*", "sg.relation_type", "u.name as guardian_name", "u.email as guardian_email")
          .where("sg.student_id", caseRow.student_id);
        const snapshot = JSON.stringify({ student, guardians });

        await trx("student_archive").insert({
          id: uuidv4(),
          tenant_id: tenantId,
          student_id: caseRow.student_id,
          student_name: `${student.student_real_name} (${student.student_id_number})`,
          data_snapshot: snapshot,
          exit_reason: notes || "إنهاء الإقامة: غياب عن السكن",
          exit_date: new Date(),
          notes,
        });
        if (student.room_id) {
          await trx("rooms").where({ id: student.room_id }).decrement("current_occupancy", 1);
        }
        await trx("students").where({ id: caseRow.student_id }).update({ status: "archived", room_id: null, is_graduate: 0 });
        await trx("student_absence_cases").where({ id: caseRow.id }).update({ ...update, financial_state: "terminated" });
      });
      await audit({ terminated: true });
      return res.json({ success: true, message: "تم إنهاء الإقامة وأرشفة الطالب" });
    }

    // review_only
    await kdb("student_absence_cases").where({ id: caseRow.id }).update(update);
    await audit();
    res.json({ success: true, message: "تم تسجيل القرار" });
  } catch (e: any) {
    console.error("Absence decision error:", e?.message || e);
    res.status(500).json({ success: false, message: "تعذر حفظ القرار" });
  }
});

// Manual trigger (supervisor/admin) so a check can run without waiting for the
// scheduler — also the hook tests use.
router.post("/tenants/:tenantId/absence-cases/run-check", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.MANAGE_ATTENDANCE)) return;
    const result = await runLockCheck({ tenantId });
    const escalated = await reEscalateUnacked({ tenantId });
    res.json({ success: true, data: { ...result, escalated } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر تنفيذ فحص الإغلاق" });
  }
});

export default router;
