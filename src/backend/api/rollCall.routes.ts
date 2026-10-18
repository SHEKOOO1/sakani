import express from "express";
import { authenticate } from "./middleware";
import { canAccessTenant, requirePermOrAdmin } from "./attendancePolicy.routes";
import { AppPermission } from "../../types/permissions";
import { getRollCall, startRollCall, updateRollCallEntries, submitRollCall, resolveStudentForUser, getStudentRollCall, respondToRollCall, broadcastRollCallOpened } from "../services/rollCall.service";

const router = express.Router();

/**
 * Supervisor roll-call (المناداة).
 *
 * The human-confirmed replacement for the GPS-only lock-time absence check.
 * A supervisor opens the night's sheet, confirms who is present, and only then
 * are absence cases created — and even those stay silent until a human decision.
 * These endpoints are intentionally NOT gated by ABSENCE_SCHEDULER_DISABLED so
 * the roll-call keeps working while the legacy auto-check is paused.
 */

function errorResponse(res: express.Response, e: any) {
  const code = e?.message;
  if (code === "ROLL_CALL_NOT_FOUND") return res.status(404).json({ success: false, message: "جلسة المناداة غير موجودة" });
  if (code === "ROLL_CALL_LOCKED") return res.status(400).json({ success: false, message: "تم تثبيت المناداة بالفعل ولا يمكن تعديلها" });
  if (code === "ROLL_CALL_INVALID_ANSWER") return res.status(400).json({ success: false, message: "إجابة غير صحيحة" });
  if (code === "ROLL_CALL_EXEMPT") return res.status(409).json({ success: false, message: "أنت مسجّل كمسافر ومُعفى من النداء" });
  console.error("Roll-call error:", code || e);
  return res.status(500).json({ success: false, message: "تعذر تنفيذ العملية. حاول مرة أخرى." });
}

// GET /api/tenants/:tenantId/roll-call?date=YYYY-MM-DD → the sheet (or null)
router.get("/tenants/:tenantId/roll-call", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.VIEW_ATTENDANCE)) return;
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json({ success: true, data: await getRollCall(tenantId, { date }) });
  } catch (e: any) {
    errorResponse(res, e);
  }
});

// POST /api/tenants/:tenantId/roll-call → start (or resume) tonight's sheet
router.post("/tenants/:tenantId/roll-call", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.MANAGE_ATTENDANCE)) return;
    const body = req.body || {};
    const lockDate = typeof body.lockDate === "string" ? body.lockDate : undefined;
    const notes = typeof body.notes === "string" ? body.notes : null;
    const data = await startRollCall({ tenantId, lockDate, notes, userId: req.user.id });
    if (data.created && !data.published_at) {
      await broadcastRollCallOpened({ tenantId, rollCall: data }).catch(() => {});
    }
    res.json({ success: true, message: data.created ? "تم بدء المناداة" : "تم فتح المناداة الحالية", data });
  } catch (e: any) {
    errorResponse(res, e);
  }
});

// PUT /api/tenants/:tenantId/roll-call/:id/entries → save draft marks
router.put("/tenants/:tenantId/roll-call/:id/entries", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.MANAGE_ATTENDANCE)) return;
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const data = await updateRollCallEntries({ tenantId, rollCallId: req.params.id, entries, userId: req.user.id });
    res.json({ success: true, data });
  } catch (e: any) {
    errorResponse(res, e);
  }
});

// POST /api/tenants/:tenantId/roll-call/:id/submit → finalise + create cases
router.post("/tenants/:tenantId/roll-call/:id/submit", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول للسكن" });
    if (!await requirePermOrAdmin(req, res, AppPermission.MANAGE_ATTENDANCE)) return;
    const data = await submitRollCall({ tenantId, rollCallId: req.params.id, userId: req.user.id });
    res.json({
      success: true,
      message: data.createdCases > 0 ? `تم تثبيت المناداة وفتح ${data.createdCases} حالة غياب` : "تم تثبيت المناداة — لا حالات جديدة",
      data,
    });
  } catch (e: any) {
    errorResponse(res, e);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Student self-response — the mandatory night popup card
// ────────────────────────────────────────────────────────────────────────────

// GET /api/students/roll-call/pending → today's card for the logged-in student
router.get("/students/roll-call/pending", authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId as string | undefined;
    if (!tenantId) return res.status(403).json({ success: false, message: "لا يوجد سكن مرتبط بهذا الحساب" });
    const student = await resolveStudentForUser(req.user.id, tenantId);
    if (!student) return res.status(403).json({ success: false, message: "هذا الحساب ليس حساب طالب" });
    res.json({ success: true, data: await getStudentRollCall(tenantId, student.id) });
  } catch (e: any) {
    errorResponse(res, e);
  }
});

// POST /api/students/roll-call/:id/respond → the student answers present/absent
router.post("/students/roll-call/:id/respond", authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId as string | undefined;
    if (!tenantId) return res.status(403).json({ success: false, message: "لا يوجد سكن مرتبط بهذا الحساب" });
    const student = await resolveStudentForUser(req.user.id, tenantId);
    if (!student) return res.status(403).json({ success: false, message: "هذا الحساب ليس حساب طالب" });
    const body = req.body || {};
    const answer = body.answer === "present" || body.answer === "absent" ? body.answer : undefined;
    if (!answer) return res.status(400).json({ success: false, message: "الإجابة مطلوبة: present أو absent" });
    const entry = await respondToRollCall({
      tenantId,
      rollCallId: req.params.id,
      studentId: student.id,
      answer,
      lat: body.lat,
      lng: body.lng,
      accuracy: body.accuracy,
    });
    res.json({ success: true, message: answer === "present" ? "تم تأكيد وجودك" : "تم تسجيل عدم وجودك", data: entry });
  } catch (e: any) {
    errorResponse(res, e);
  }
});

export default router;
