import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { validate } from "../validation/middleware";
import { submitPaymentSchema, createPaymentMethodSchema, updatePaymentMethodSchema } from "../validation/schemas";

const router = express.Router();

// === Payment Methods ===

// List active payment methods
router.get("/methods", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const methods = await kdb('payment_methods')
      .where({ tenant_id: tenantId, is_active: 1 })
      .orderBy('created_at', 'desc');
    res.json({ success: true, data: methods });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Create payment method
router.post("/methods", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), validate(createPaymentMethodSchema), async (req, res) => {
  const { name, phone_number, type } = req.body;
  const tenantId = req.user.tenantId;
  const id = uuidv4();
  try {
    await kdb('payment_methods').insert({
      id, tenant_id: tenantId, name, phone_number, type: type || 'instapay', created_by: req.user.id
    });
    res.status(201).json({ success: true, data: { id, name } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل في إضافة وسيلة الدفع" });
  }
});

// Update payment method
router.put("/methods/:id", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), validate(updatePaymentMethodSchema), async (req, res) => {
  const { id } = req.params;
  const { name, phone_number, type, is_active } = req.body;
  const tenantId = req.user.tenantId;
  try {
    await kdb('payment_methods').where({ id, tenant_id: tenantId }).update({ name, phone_number, type, is_active: is_active !== undefined ? (is_active ? 1 : 0) : undefined });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل في تحديث وسيلة الدفع" });
  }
});

// Delete payment method
router.delete("/methods/:id", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  try {
    await kdb('payment_methods').where({ id, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// === Event Payments ===

// Student submits payment for an event
router.post("/pay", authenticate, validate(submitPaymentSchema), async (req, res) => {
  const { eventId, paymentMethodId, amount } = req.body;
  const userId = req.user.id;
  try {
    const student = await kdb('students').select('id', 'tenant_id').where({ user_id: userId }).first();
    if (!student) return res.status(403).json({ success: false, message: "ليس لديك ملف طالب" });
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!event.is_paid) return res.status(400).json({ success: false, message: "الفعالية غير مدفوعة" });
    // عزل السكنات: لا يجوز للطالب الدفع لفعالية في سكن آخر
    if (event.tenant_id && event.tenant_id !== student.tenant_id) {
      return res.status(403).json({ success: false, message: "لا يمكنك الدفع لهذه الفعالية" });
    }
    const method = await kdb('payment_methods').where({ id: paymentMethodId, is_active: 1 }).first();
    if (!method) return res.status(404).json({ success: false, message: "وسيلة الدفع غير موجودة" });
    if (method.tenant_id && method.tenant_id !== student.tenant_id) {
      return res.status(403).json({ success: false, message: "وسيلة الدفع غير متاحة في سكنك" });
    }
    const existing = await kdb('event_payments')
      .where({ event_id: eventId, student_id: student.id })
      .whereNot({ status: 'cancelled' })
      .first();
    if (existing) return res.status(400).json({ success: false, message: "تم تقديم طلب دفع مسبقاً" });
    const id = uuidv4();
    await kdb('event_payments').insert({
      id, event_id: eventId, student_id: student.id, payment_method_id: paymentMethodId,
      amount: amount || event.price, status: 'pending', paid_at: kdb.fn.now()
    });
    res.status(201).json({ success: true, data: { id }, message: "تم إرسال طلب الدفع. بانتظار تأكيد المشرف." });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل في تقديم طلب الدفع" });
  }
});

// Confirm payment (admin/supervisor)
router.patch("/:id/confirm", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_PAYMENTS), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  try {
    const payment = await kdb('event_payments as ep')
      .join('events as e', 'ep.event_id', 'e.id')
      .where('ep.id', id)
      .where('e.tenant_id', tenantId)
      .select('ep.*')
      .first();
    if (!payment) return res.status(404).json({ success: false, message: 'الدفعة غير موجودة' });
    await kdb('event_payments').where({ id }).update({
      status: 'confirmed', confirmed_by: req.user.id
    });
    // Also mark attendance as paid
    await kdb('event_attendance')
      .where({ event_id: payment.event_id, student_id: payment.student_id })
      .update({ is_paid: 1 });
    res.json({ success: true, message: "تم تأكيد الدفع" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل في تأكيد الدفع. تأكد من صحة البيانات." });
  }
});

// Cancel payment
router.patch("/:id/cancel", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_PAYMENTS), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  try {
    const payment = await kdb('event_payments as ep')
      .join('events as e', 'ep.event_id', 'e.id')
      .where('ep.id', id)
      .where('e.tenant_id', tenantId)
      .select('ep.id')
      .first();
    if (!payment) return res.status(404).json({ success: false, message: 'الدفعة غير موجودة' });
    await kdb('event_payments').where({ id }).update({ status: 'cancelled' });
    res.json({ success: true, message: "تم إلغاء الدفع" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل في إلغاء الدفع. تأكد من صحة البيانات." });
  }
});

// Get payments for an event
router.get("/event/:eventId", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_PAYMENTS), async (req, res) => {
  const { eventId } = req.params;
  const tenantId = req.user.tenantId;
  try {
    const event = await kdb('events').where({ id: eventId }).select('tenant_id').first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (event.tenant_id && event.tenant_id !== tenantId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية للاطلاع على مدفوعات هذه الفعالية" });
    }
    const payments = await kdb('event_payments as ep')
      .join('students as s', 'ep.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('payment_methods as pm', 'ep.payment_method_id', 'pm.id')
      .select('ep.*', 'u.name as student_name', 's.student_id_number', 'pm.name as method_name', 'pm.phone_number as method_phone')
      .where('ep.event_id', eventId)
      .orderBy('ep.created_at', 'desc');
    res.json({ success: true, data: payments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Get my payments (for student)
router.get("/my", authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const student = await kdb('students').select('id').where({ user_id: userId }).first();
    if (!student) return res.json({ success: true, data: [] });
    const payments = await kdb('event_payments as ep')
      .join('events as e', 'ep.event_id', 'e.id')
      .leftJoin('payment_methods as pm', 'ep.payment_method_id', 'pm.id')
      .select('ep.*', 'e.title as event_title', 'e.event_date', 'pm.name as method_name')
      .where('ep.student_id', student.id)
      .orderBy('ep.created_at', 'desc');
    res.json({ success: true, data: payments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
