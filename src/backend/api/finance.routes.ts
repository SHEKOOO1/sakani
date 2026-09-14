import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { getFilteredFinances, getReportSummary, generateExcel, generatePDF, getStudentAccounts, generateStudentAccountsExcel, generateStudentAccountsPDF } from "../services/finance-report.service";
import { validate } from "../validation/middleware";
import { createFinanceSchema, updateFinanceSchema } from "../validation/schemas";
import { parsePagination } from "../services/radio/pagination.ts";
import { getStudentAccount, notifyStudentFinance, financePaymentMessage, logFinanceEdit, financeEditSummary } from "../services/student-account.service";

const router = express.Router();

// لو المستخدم كتب اسم وسيلة دفع جديدة — نلقى عليها أو نضيفها في قاعدة البيانات
// بحيث تظهر بعد كده في قائمة طرق الدفع لكل المدفوعات الجاية
async function resolvePaymentMethodId(opts: {
  tenantId?: string | null;
  methodId?: string | null;
  methodName?: string | null;
  createdBy?: string;
}): Promise<string | null> {
  if (opts.methodId) {
    try {
      const found = await kdb('payment_methods').where({ id: opts.methodId }).first();
      if (!found) return null;
      const foundTenant = found.tenant_id ?? null;
      const reqTenant = opts.tenantId ?? null;
      if (foundTenant !== reqTenant) return null;
      return found.id;
    } catch (e) {
      console.error('[resolvePaymentMethodId]', (e as any)?.message || e);
      return null;
    }
  }
  const name = (opts.methodName || '').trim();
  if (!name || !opts.tenantId) return null;
  try {
    const existing = await kdb('payment_methods')
      .where('tenant_id', opts.tenantId)
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first();
    if (existing) return existing.id;
    const id = uuidv4();
    await kdb('payment_methods').insert({
      id,
      tenant_id: opts.tenantId,
      name,
      phone_number: '',
      type: 'other',
      created_by: opts.createdBy || null,
    });
    return id;
  } catch (e) {
    console.error('[resolvePaymentMethodId]', (e as any)?.message || e);
    return null;
  }
}

// Get financial records — admins see only admin finance, others see housing finance
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_FINANCE), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  const { type, category, startDate, endDate, studentId, search } = req.query;
  const { page, limit } = parsePagination(req.query);

  try {
      const baseQuery = kdb('finances as f')
        .leftJoin('students as s', 'f.student_id', 's.id')
        .leftJoin('users as u', 's.user_id', 'u.id');

    if (isAdmin) {
      baseQuery.where('f.is_admin_only', 1);
    } else {
      if (!tenantId) {
        return res.json({ success: true, data: [], total: 0, page, limit, totalPages: 0 });
      }
      baseQuery.where(function () {
        this.where('f.is_admin_only', 0).orWhereNull('f.is_admin_only');
      });
      baseQuery.where('f.tenant_id', tenantId);
    }

    if (type) baseQuery.where('f.type', type);
    if (category) baseQuery.where('f.category', category);
    if (studentId) baseQuery.where('f.student_id', studentId);
    if (startDate && endDate) baseQuery.whereBetween('f.date', [startDate as string, endDate as string]);
    if (search) {
      baseQuery.andWhere(function () {
        this.where('f.description', 'like', `%${search}%`)
          .orWhere('u.name', 'like', `%${search}%`)
          .orWhereRaw('CAST(f.amount AS NVARCHAR(30)) LIKE ?', [`%${search}%`]);
      });
    }

    const countQuery = baseQuery.clone();
    const [totalResult, records] = await Promise.all([
      countQuery.count("* as total").first(),
      baseQuery.clone().orderBy('f.date', 'desc').select('f.*', 'u.name as student_name').offset((page - 1) * limit).limit(limit),
    ]);

    const total = Number((totalResult as any)?.total || 0);
    res.json({ success: true, data: records, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "تعذر تحميل البيانات. من فضلك حاول مرة أخرى." });
  }
});

// Summary reports — admins see only admin finance, others see housing finance
router.get("/summary", authenticate, authorizePermission(AppPermission.VIEW_FINANCE_REPORTS), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  
  try {
    let summaryQuery = kdb('finances').select('type').sum({ total: 'amount' }).groupBy('type');

    if (isAdmin) {
      summaryQuery = summaryQuery.where('is_admin_only', 1);
    } else if (tenantId) {
      summaryQuery = summaryQuery.where(function () {
        this.where('is_admin_only', 0).orWhereNull('is_admin_only');
      });
      summaryQuery = summaryQuery.where('tenant_id', tenantId);
    } else {
      // لدى أسقف بلا سكن أساسي: يقتصر على سكناته المُدارة فقط
      const allowedIds = req.user.tenantIds && req.user.tenantIds.length ? req.user.tenantIds : [];
      if (allowedIds.length === 0) return res.json({ success: true, data: [] });
      summaryQuery = summaryQuery.where(function () {
        this.where('is_admin_only', 0).orWhereNull('is_admin_only');
      });
      summaryQuery = summaryQuery.whereIn('tenant_id', allowedIds);
    }

    const summary = await summaryQuery;

    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "تعذر تحميل التقرير. من فضلك حاول مرة أخرى." });
  }
});

// Add a financial record — admins create admin-only records, others create housing records
router.post("/", authenticate, validate(createFinanceSchema), (req, res, next) => {
  const { type } = req.body;
  const permission = type === 'expense' ? AppPermission.ADD_EXPENSE : AppPermission.ADD_REVENUE;
  (authorizePermission(permission) as any)(req, res, next);
}, async (req, res) => {
  const { type, category, amount, description, date, studentId, paymentMethodId, paymentMethodName } = req.body;
  const isAdmin = req.user.role === 'admin';
  const tenantId = isAdmin ? null : req.user.tenantId;
  const userId = req.user.id;
  const id = uuidv4();

  try {
    // منع ربط معاملة مالية بطالب من سكن آخر (عزل البيانات بين السكنات)
    if (studentId && !isAdmin) {
      const student = await kdb('students').where({ id: studentId }).first();
      if (!student || student.tenant_id !== tenantId) {
        return res.status(403).json({ success: false, message: "الطالب غير موجود في سكنك" });
      }
    }

    const resolvedMethodId = await resolvePaymentMethodId({ tenantId, methodId: paymentMethodId, methodName: paymentMethodName, createdBy: userId });

    await kdb('finances').insert({
        id,
        tenant_id: tenantId,
        student_id: studentId || null,
        type,
        category,
        amount,
        description,
        date: date || new Date().toISOString(),
        payment_method_id: resolvedMethodId,
        created_by: userId,
        is_admin_only: isAdmin ? 1 : 0
    });

    if (type === 'revenue' && studentId) {
      const account = await getStudentAccount(studentId, { visibility: 'all' });
      await notifyStudentFinance(studentId, financePaymentMessage(Number(amount || 0), account, 'added'), 'تم إضافة دفعة جديدة');
    }

    res.status(201).json({ success: true, data: { id, type, category, amount, studentId } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل الحفظ. تأكد من إدخال جميع البيانات بشكل صحيح." });
  }
});

// Delete a financial record — respects admin isolation
router.delete("/:id", authenticate, async (req, res, next) => {
  const tenantId = req.user.tenantId;
  const record = await kdb('finances').where({ id: req.params.id, ...(tenantId ? { tenant_id: tenantId } : {}) }).first();
  if (!record) return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });
  const perm = record.type === 'expense' ? AppPermission.ADD_EXPENSE : AppPermission.ADD_REVENUE;
  (authorizePermission(perm) as any)(req, res, next);
}, async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;

  try {
    let query = kdb('finances').where({ id });

    if (isAdmin) {
      query = query.where('is_admin_only', 1);
    } else {
      query = query.where(function () {
        this.where('is_admin_only', 0).orWhereNull('is_admin_only');
      });
      if (!tenantId) throw new Error("لا يوجد سكن مرتبط");
      query = query.where('tenant_id', tenantId);
    }

    await query.del();
    res.json({ success: true, message: "تم حذف المعاملة بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل الحذف. تأكد من صحة البيانات وحاول مرة أخرى." });
  }
});

// Edit a financial record — respects admin isolation and per-type permission
router.put("/:id", authenticate, async (req, res, next) => {
  const tenantId = req.user.tenantId;
  let recordQuery = kdb('finances').where({ id: req.params.id });
  if (tenantId) recordQuery = recordQuery.where('tenant_id', tenantId);
  if (req.user.role === 'admin') recordQuery = recordQuery.where('is_admin_only', 1);
  else recordQuery = recordQuery.where(function () { this.where('is_admin_only', 0).orWhereNull('is_admin_only'); });
  const record = await recordQuery.first();
  if (!record) return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });
  const perm = (req.body.type || record.type) === 'expense' ? AppPermission.ADD_EXPENSE : AppPermission.ADD_REVENUE;
  (authorizePermission(perm) as any)(req, res, next);
}, validate(updateFinanceSchema), async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  const { type, category, amount, description, date, studentId, paymentMethodId, paymentMethodName } = req.body;

  try {
    // منع ربط معاملة مالية بطالب من سكن آخر (عزل البيانات بين السكنات)
    if (studentId !== undefined && studentId !== null && !isAdmin) {
      const student = await kdb('students').where({ id: studentId }).first();
      if (!student || student.tenant_id !== tenantId) {
        return res.status(403).json({ success: false, message: "الطالب غير موجود في سكنك" });
      }
    }

    let query = kdb('finances').where({ id });

    if (isAdmin) {
      query = query.where('is_admin_only', 1);
    } else {
      query = query.where(function () {
        this.where('is_admin_only', 0).orWhereNull('is_admin_only');
      });
      if (!tenantId) throw new Error("لا يوجد سكن مرتبط");
      query = query.where('tenant_id', tenantId);
    }

    const oldRow = await query.clone().first();

    const update: any = {};
    if (type !== undefined) update.type = type;
    if (category !== undefined) update.category = category;
    if (amount !== undefined) update.amount = amount;
    if (description !== undefined) update.description = description;
    if (date !== undefined) update.date = date;
    if (studentId !== undefined) update.student_id = studentId || null;
    if (paymentMethodId !== undefined || paymentMethodName !== undefined) {
      update.payment_method_id = await resolvePaymentMethodId({ tenantId, methodId: paymentMethodId, methodName: paymentMethodName, createdBy: req.user.id });
    }

    await query.update(update);
    const updated = await kdb('finances')
      .leftJoin('students as s', 'finances.student_id', 's.id')
      .leftJoin('users as u', 's.user_id', 'u.id')
      .select('finances.*', 'u.name as student_name')
      .where('finances.id', id)
      .first();

    // سجل تعديل المعاملة — بتاريخ التعديل الفعلي في السيرفر
    const mergedNew = { ...(oldRow || {}), ...update };
    const finalRecordStudentId = (oldRow?.student_id || mergedNew.student_id || null) as string | null;
    const editInfo = oldRow ? financeEditSummary(oldRow, mergedNew) : null;
    if (oldRow && finalRecordStudentId && editInfo?.changed) {
      await logFinanceEdit({
        tenantId: oldRow.tenant_id ?? null,
        studentId: finalRecordStudentId,
        financeId: id,
        editType: 'edit',
        direction: editInfo.direction,
        delta: editInfo.delta,
        summary: editInfo.summary,
        createdBy: req.user.id,
        isAdminOnly: isAdmin,
      });
    }

    const finalType = updated?.type || type;
    const finalStudentId = updated?.student_id || studentId;
    if (finalType === 'revenue' && finalStudentId) {
      const account = await getStudentAccount(finalStudentId, { visibility: 'all' });
      let msg = financePaymentMessage(Number(updated?.amount || amount || 0), account, 'updated');
      if (editInfo?.changed) {
        msg += `\n📝 التعديل: ${editInfo.summary}`;
      }
      await notifyStudentFinance(finalStudentId, msg, 'تم تعديل إحدى الدفعات');
    }

    res.json({ success: true, data: updated, message: "تم تعديل المعاملة بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل التعديل. تأكد من صحة البيانات وحاول مرة أخرى." });
  }
});

// Export financial records as Excel or PDF — respects admin isolation
router.get("/export", authenticate, authorizePermission(AppPermission.VIEW_FINANCE_REPORTS), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const q = req.query;
  const filters = { tenantId, type: q.type as string | undefined, category: q.category as string | undefined, startDate: q.startDate as string | undefined, endDate: q.endDate as string | undefined, isAdmin };

  try {
    const rows = await getFilteredFinances(filters);

    if (q.format === 'pdf') {
      const buf = await generatePDF(rows, filters);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="financial-report-${q.startDate || 'all'}-${q.endDate || 'all'}.pdf"`);
      return res.send(buf);
    }

    const buf = await generateExcel(rows, filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="financial-report-${q.startDate || 'all'}-${q.endDate || 'all'}.xlsx"`);
    res.send(buf);
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Detailed report summary — respects admin isolation
router.get("/report", authenticate, authorizePermission(AppPermission.VIEW_FINANCE_REPORTS), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const q = req.query;
  const filters = { tenantId, type: q.type as string | undefined, category: q.category as string | undefined, startDate: q.startDate as string | undefined, endDate: q.endDate as string | undefined, isAdmin };

  try {
    const report = await getReportSummary(filters);
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Student accounts report — one row per student aggregating all their receipts into a single total
router.get("/student-accounts", authenticate, authorizePermission(AppPermission.VIEW_FINANCE_REPORTS), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  if (!tenantId && !isAdmin) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const q = req.query;
  const filters = { tenantId, type: 'revenue' as string | undefined, category: q.category as string | undefined, startDate: q.startDate as string | undefined, endDate: q.endDate as string | undefined, isAdmin };

  try {
    const result = await getStudentAccounts(filters);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Export student accounts report as Excel or PDF — one row per student with totals
router.get("/student-accounts/export", authenticate, authorizePermission(AppPermission.VIEW_FINANCE_REPORTS), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  if (!tenantId && !isAdmin) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const q = req.query;
  const filters = { tenantId, type: 'revenue' as string | undefined, category: q.category as string | undefined, startDate: q.startDate as string | undefined, endDate: q.endDate as string | undefined, isAdmin };

  try {
    const result = await getStudentAccounts(filters);

    if (q.format === 'pdf') {
      const buf = await generateStudentAccountsPDF(result, filters);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="students-accounts-report.pdf"`);
      return res.send(buf);
    }

    const buf = await generateStudentAccountsExcel(result, filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students-accounts-report.xlsx"`);
    res.send(buf);
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

export default router;
