import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { sameId } from "../infrastructure/id-match";
import { AppPermission } from "../../types/permissions";
import { getFilteredFinances, getReportSummary, generateExcel, generatePDF, getStudentAccounts, generateStudentAccountsExcel, generateStudentAccountsPDF } from "../services/finance-report.service";
import { validate } from "../validation/middleware";
import { createFinanceSchema, updateFinanceSchema } from "../validation/schemas";
import { parsePagination } from "../services/radio/pagination.ts";
import { getStudentAccount, notifyStudentFinance, financePaymentMessage } from "../services/student-account.service";
import {
  postEntry,
  reverseEntry,
  entryForFinanceRow,
  getLedgerMovements,
  countLedgerMovements,
  getLedgerClassTotals,
  LedgerError,
} from "../services/ledger.service";

/**
 * Finance is now ledger-native (Phase 5 cutover). Every read and every write
 * goes through `journal_entries`; `finances` is frozen historical data, kept
 * only so the Phase 2b import can be re-verified, and is never read or written
 * by this router again.
 *
 * The list exposes journal entry ids. An edit is never an UPDATE of history:
 * the entry that represented the row is reversed and a fresh entry is issued in
 * its place, so an edited record shows as a reversal + its replacement. A
 * delete reverses the entry instead of erasing it. `finance_id` is left NULL on
 * everything written here — only the legacy import carries it — which keeps the
 * import reconciliation (finance_id joins) meaningful after cutover.
 *
 * resolvePaymentMethodId() deliberately runs outside the transaction: it is an
 * idempotent lookup-or-create keyed by a unique (tenant, name) index, and an
 * orphan payment method left behind by a rolled back save is harmless while a
 * poisoned transaction is not.
 */

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

/**
 * Scope check for a single journal entry, mirroring the tenant/admin isolation
 * the finance list applies: admins only touch admin-only books, everyone else
 * is confined to their own housing (or the housings they manage, for a bishop
 * with no home tenant).
 */
function entryInScope(entry: any, user: any): boolean {
  const isAdminOnly = Number(entry?.is_admin_only || 0) === 1;
  if (user.role === 'admin') return isAdminOnly;
  if (isAdminOnly) return false;
  const tenantId = user.tenantId;
  if (tenantId) return sameId(entry.tenant_id, tenantId);
  return (user.tenantIds || []).some((t: string) => sameId(t, entry.tenant_id));
}

// Get financial records — admins see only admin finance, others see housing finance
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_FINANCE), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  const { type, category, startDate, endDate, studentId, search } = req.query;
  const { page, limit } = parsePagination(req.query);

  try {
    if (!isAdmin && !tenantId && !(req.user.tenantIds && req.user.tenantIds.length)) {
      return res.json({ success: true, data: [], total: 0, page, limit, totalPages: 0 });
    }

    const filters = {
      isAdmin,
      tenantId: isAdmin ? null : tenantId,
      tenantIds: !isAdmin && !tenantId ? (req.user.tenantIds || []) : null,
      studentId: (studentId as string) || null,
      category: (category as string) || null,
      startDate: (startDate as string) || null,
      endDate: (endDate as string) || null,
      movementType: (type as 'revenue' | 'expense') || null,
      search: (search as string) || null,
    };

    const [total, records] = await Promise.all([
      countLedgerMovements(filters),
      getLedgerMovements({ ...filters, limit, offset: (page - 1) * limit }),
    ]);

    res.json({ success: true, data: records, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "تعذر تحميل البيانات. من فضلك حاول مرة أخرى." });
  }
});

// Summary reports — admins see only admin finance, others see housing finance
router.get("/summary", authenticate, authorizePermission(AppPermission.VIEW_FINANCE_REPORTS), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  const { category, startDate, endDate, studentId } = req.query;

  try {
    if (!isAdmin && !tenantId && !(req.user.tenantIds && req.user.tenantIds.length)) {
      return res.json({ success: true, data: [] });
    }

    const totals = await getLedgerClassTotals({
      isAdmin,
      tenantId: isAdmin ? null : tenantId,
      tenantIds: !isAdmin && !tenantId ? (req.user.tenantIds || []) : null,
      category: (category as string) || null,
      startDate: (startDate as string) || null,
      endDate: (endDate as string) || null,
      studentId: (studentId as string) || null,
    });

    const data = [
      { type: 'revenue', total: totals.income },
      { type: 'expense', total: totals.expense + totals.penalty + totals.discount },
    ];

    res.json({ success: true, data });
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
      if (!student || !sameId(student.tenant_id, tenantId)) {
        return res.status(403).json({ success: false, message: "الطالب غير موجود في سكنك" });
      }
    }

    const resolvedMethodId = await resolvePaymentMethodId({ tenantId, methodId: paymentMethodId, methodName: paymentMethodName, createdBy: userId });

    const movementDate = date || new Date().toISOString();
    const plan = entryForFinanceRow({ type, category, amount });

    const posted = await kdb.transaction(async (trx) => {
      return postEntry(trx, {
        entryType: plan.entryType,
        amount: Number(amount),
        lines: plan.lines,
        entryDate: new Date(movementDate),
        tenantId,
        studentId: studentId || null,
        category,
        description,
        paymentMethodId: resolvedMethodId,
        financeId: null,
        source: 'api',
        isAdminOnly: isAdmin,
        createdBy: userId,
      });
    });

    if (type === 'revenue' && studentId) {
      const account = await getStudentAccount(studentId, { visibility: 'all' });
      await notifyStudentFinance(studentId, financePaymentMessage(Number(amount || 0), account, 'added'), 'تم إضافة دفعة جديدة');
    }

    res.status(201).json({ success: true, data: { id: posted.id, type, category, amount, studentId } });
  } catch (error: any) {
    if (error instanceof LedgerError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(400).json({ success: false, message: "فشل الحفظ. تأكد من إدخال جميع البيانات بشكل صحيح." });
  }
});

// Delete a financial record — respects admin isolation
router.delete("/:id", authenticate, async (req, res, next) => {
  const tenantId = req.user.tenantId;
  const isAdmin = req.user.role === 'admin';
  // FAIL-CLOSED: مستخدم غير مدير بلا سكن أساسي لا يجوز له فحص معاملة خارج نطاق سكن
  if (!isAdmin && !tenantId && !(req.user.tenantIds && req.user.tenantIds.length)) {
    return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });
  }
  const entry = await kdb('journal_entries').where({ id: req.params.id }).first();
  if (!entry || !entryInScope(entry, req.user)) {
    return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });
  }
  if (entry.entry_type === 'reversal') {
    return res.status(409).json({ success: false, message: "لا يمكن حذف قيد عكسي — أنشئ حركة جديدة بدلًا من ذلك." });
  }
  const perm = entry.entry_type === 'payment' ? AppPermission.ADD_REVENUE : AppPermission.ADD_EXPENSE;
  (authorizePermission(perm) as any)(req, res, next);
}, async (req, res) => {
  const { id } = req.params;

  try {
    await kdb.transaction(async (trx) => {
      const entry = await trx('journal_entries').where({ id }).first();
      if (!entry) return;
      if (entry.status !== 'posted') {
        throw new LedgerError('ALREADY_REVERSED', 'هذه الحركة مُلغاة في الدفتر، ولا يمكن تعديلها أو حذفها. أنشئ حركة جديدة بدلًا من ذلك.');
      }
      // Removing a record from the list must not remove it from the books:
      // the entry that represented it is reversed, not erased.
      await reverseEntry(trx, {
        entryId: id,
        reason: 'حذف المعاملة المالية',
        createdBy: req.user.id,
      });
    });

    res.json({ success: true, message: "تم حذف المعاملة بنجاح" });
  } catch (error: any) {
    if (error instanceof LedgerError) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(400).json({ success: false, message: "فشل الحذف. تأكد من صحة البيانات وحاول مرة أخرى." });
  }
});

// Edit a financial record — respects admin isolation and per-type permission
router.put("/:id", authenticate, async (req, res, next) => {
  const tenantId = req.user.tenantId;
  const isAdmin = req.user.role === 'admin';
  // FAIL-CLOSED: مستخدم غير مدير بلا سكن أساسي لا يجوز له فحص معاملة خارج نطاق سكن
  if (!isAdmin && !tenantId && !(req.user.tenantIds && req.user.tenantIds.length)) {
    return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });
  }
  const entry = await kdb('journal_entries').where({ id: req.params.id }).first();
  if (!entry || !entryInScope(entry, req.user)) {
    return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });
  }
  if (entry.entry_type === 'reversal') {
    return res.status(409).json({ success: false, message: "لا يمكن تعديل قيد عكسي — أنشئ حركة جديدة بدلًا من ذلك." });
  }
  const currentType = entry.entry_type === 'payment' ? 'revenue' : 'expense';
  const perm = (req.body.type || currentType) === 'expense' ? AppPermission.ADD_EXPENSE : AppPermission.ADD_REVENUE;
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
      if (!student || !sameId(student.tenant_id, tenantId)) {
        return res.status(403).json({ success: false, message: "الطالب غير موجود في سكنك" });
      }
    }

    let resolvedMethodId: string | null | undefined;
    if (paymentMethodId !== undefined || paymentMethodName !== undefined) {
      resolvedMethodId = await resolvePaymentMethodId({ tenantId, methodId: paymentMethodId, methodName: paymentMethodName, createdBy: req.user.id });
    }

    let newEntryId: string | null = null;
    let merged: any = null;

    await kdb.transaction(async (trx) => {
      const oldEntry = await trx('journal_entries').where({ id }).first();
      if (!oldEntry || !entryInScope(oldEntry, req.user)) return;
      if (oldEntry.status !== 'posted') {
        throw new LedgerError('ALREADY_REVERSED', 'هذه الحركة مُلغاة في الدفتر، ولا يمكن تعديلها أو حذفها. أنشئ حركة جديدة بدلًا من ذلك.');
      }

      merged = {
        type: type !== undefined ? type : (oldEntry.entry_type === 'payment' ? 'revenue' : 'expense'),
        category: category !== undefined ? category : oldEntry.category,
        amount: amount !== undefined ? amount : oldEntry.amount,
        description: description !== undefined ? description : oldEntry.description,
        date: date !== undefined ? date : oldEntry.entry_date,
        student_id: studentId !== undefined ? (studentId || null) : oldEntry.student_id,
        payment_method_id: resolvedMethodId !== undefined ? resolvedMethodId : oldEntry.payment_method_id,
        tenant_id: oldEntry.tenant_id,
        is_admin_only: oldEntry.is_admin_only,
      };

      // The entry that stood for this row is undone and the edited values
      // are issued as a fresh entry: history is never rewritten in place.
      // This is what makes an edited record show as a reversal + its
      // replacement instead of a silently altered number.
      await reverseEntry(trx, {
        entryId: id,
        reason: 'تعديل المعاملة المالية',
        createdBy: req.user.id,
      });

      const plan = entryForFinanceRow(merged);
      const posted = await postEntry(trx, {
        entryType: plan.entryType,
        amount: Number(merged.amount),
        lines: plan.lines,
        entryDate: merged.date ? new Date(merged.date) : new Date(),
        tenantId: merged.tenant_id ?? null,
        studentId: merged.student_id ?? null,
        category: merged.category ?? null,
        description: merged.description ?? null,
        paymentMethodId: merged.payment_method_id ?? null,
        financeId: null,
        source: 'api',
        isAdminOnly: Number(merged.is_admin_only || 0) === 1,
        createdBy: req.user.id,
      });
      newEntryId = posted.id;
    });

    const finalType = merged?.type ?? type;
    const finalStudentId = merged?.student_id ?? studentId ?? null;
    if (finalType === 'revenue' && finalStudentId) {
      const account = await getStudentAccount(finalStudentId, { visibility: 'all' });
      const msg = financePaymentMessage(Number(merged?.amount || amount || 0), account, 'updated');
      await notifyStudentFinance(finalStudentId, msg, 'تم تعديل إحدى الدفعات');
    }

    res.json({
      success: true,
      data: { id: newEntryId, ...merged },
      message: "تم تعديل المعاملة بنجاح",
    });
  } catch (error: any) {
    if (error instanceof LedgerError) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(400).json({ success: false, message: "فشل التعديل. تأكد من صحة البيانات وحاول مرة أخرى." });
  }
});

// Export financial records as Excel or PDF — respects admin isolation
router.get("/export", authenticate, authorizePermission(AppPermission.VIEW_FINANCE_REPORTS), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const tenantId = req.user.tenantId;
  const scopedTenantIds = !isAdmin && !tenantId ? (req.user.tenantIds || []) : null;
  if (!tenantId && !isAdmin && !(scopedTenantIds && scopedTenantIds.length)) {
    return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  }
  const q = req.query;
  const filters = {
    tenantId: isAdmin ? null : tenantId,
    tenantIds: scopedTenantIds,
    type: q.type as string | undefined,
    category: q.category as string | undefined,
    startDate: q.startDate as string | undefined,
    endDate: q.endDate as string | undefined,
    isAdmin,
  };

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
  const scopedTenantIds = !isAdmin && !tenantId ? (req.user.tenantIds || []) : null;
  if (!tenantId && !isAdmin && !(scopedTenantIds && scopedTenantIds.length)) {
    return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  }
  const q = req.query;
  const filters = {
    tenantId: isAdmin ? null : tenantId,
    tenantIds: scopedTenantIds,
    type: q.type as string | undefined,
    category: q.category as string | undefined,
    startDate: q.startDate as string | undefined,
    endDate: q.endDate as string | undefined,
    isAdmin,
  };

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
  const scopedTenantIds = !isAdmin && !tenantId ? (req.user.tenantIds || []) : null;
  if (!tenantId && !isAdmin && !(scopedTenantIds && scopedTenantIds.length)) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const q = req.query;
  const filters = {
    tenantId: isAdmin ? null : tenantId,
    tenantIds: scopedTenantIds,
    type: 'revenue' as string | undefined,
    category: q.category as string | undefined,
    startDate: q.startDate as string | undefined,
    endDate: q.endDate as string | undefined,
    isAdmin,
  };

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
  const scopedTenantIds = !isAdmin && !tenantId ? (req.user.tenantIds || []) : null;
  if (!tenantId && !isAdmin && !(scopedTenantIds && scopedTenantIds.length)) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const q = req.query;
  const filters = {
    tenantId: isAdmin ? null : tenantId,
    tenantIds: scopedTenantIds,
    type: 'revenue' as string | undefined,
    category: q.category as string | undefined,
    startDate: q.startDate as string | undefined,
    endDate: q.endDate as string | undefined,
    isAdmin,
  };

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
