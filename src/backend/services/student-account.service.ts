import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";

export interface StudentAccount {
  studentId: string;
  billingCycle: string | null;
  roomPrice: number;
  invoice: number;
  source: 'room' | 'agreed';
  totalPaid: number;
  remaining: number;
  balance: number;
  debtStatus: 'debt' | 'paid' | 'credit';
  creditAmount: number;
  paymentPercent: number;
  payments: { id: string; description: string; category: string; amount: number; date: string | null; created_at: string | null }[];
  transactions: {
    id: string;
    kind: 'revenue' | 'expense' | 'edit';
    type: string;
    description: string;
    category: string;
    amount: number;
    sign: 'increase' | 'decrease' | null;
    summary: string | null;
    date: string | null;
    created_at: string | null;
    payment_method_name: string | null;
    payment_method_type: string | null;
    editor_name: string | null;
  }[];
}

export function roomPriceFor(room: any, cycle?: string | null): number {
  if (!room) return 0;
  const c = cycle || 'semester';
  if (c === 'daily') return Number(room.price_daily || 0);
  if (c === 'monthly') return Number(room.price_monthly || 0);
  return Number(room.price_semester || 0);
}

export async function getStudentAccount(studentId: string, opts: { visibility?: 'all' | 'tenant' } = {}): Promise<StudentAccount | null> {
  const student = await kdb('students as s')
    .leftJoin('rooms as r', 's.room_id', 'r.id')
    .select('s.*', 'r.price_daily', 'r.price_monthly', 'r.price_semester')
    .where('s.id', studentId)
    .first();
  if (!student) return null;

  const billingCycle = student.billing_cycle || 'semester';
  const roomPrice = roomPriceFor(student, billingCycle);
  const invoice = roomPrice > 0 ? roomPrice : Number(student.agreed_price || 0);
  const source: 'room' | 'agreed' = roomPrice > 0 ? 'room' : 'agreed';

  const paymentsQuery = kdb('finances').where({ student_id: studentId, type: 'revenue' });
  if (opts.visibility === 'tenant') {
    paymentsQuery.where(function () { this.whereNull('is_admin_only').orWhere('is_admin_only', 0); });
  }
  const payments = await paymentsQuery.select('id', 'description', 'category', 'amount', 'date', 'created_at')
    .orderBy('created_at', 'desc')
    .orderBy('date', 'desc');

  const transactionsQuery = kdb('finances as f')
    .leftJoin('payment_methods as pm', 'f.payment_method_id', 'pm.id')
    .where('f.student_id', studentId);
  if (opts.visibility === 'tenant') {
    transactionsQuery.where(function () { this.whereNull('f.is_admin_only').orWhere('f.is_admin_only', 0); });
  }
  const transactions = await transactionsQuery
    .select('f.id', 'f.type', 'f.description', 'f.category', 'f.amount', 'f.date', 'f.created_at', 'f.payment_method_id', 'pm.name as payment_method_name', 'pm.type as payment_method_type')
    .orderBy('f.created_at', 'desc')
    .orderBy('f.date', 'desc');

  // سجل تعديلات المعاملات وسعر الغرفة — كل تعديل بتاريخه ووقته الفعلي في السيرفر
  const editLogsQuery = kdb('finance_edit_logs as e')
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .where('e.student_id', studentId);
  if (opts.visibility === 'tenant') {
    editLogsQuery.where(function () { this.whereNull('e.is_admin_only').orWhere('e.is_admin_only', 0); });
  }
  const editLogs = await editLogsQuery
    .select('e.id', 'e.edit_type', 'e.direction', 'e.delta', 'e.summary', 'e.created_at', 'e.finance_id', 'u.name as editor_name')
    .orderBy('e.created_at', 'desc');

  const accountTransactions: StudentAccount['transactions'] = [
    ...transactions.map(t => ({
      id: t.id,
      kind: (t.type === 'expense' ? 'expense' : 'revenue') as 'revenue' | 'expense',
      type: t.type === 'expense' ? 'expense' : 'revenue',
      description: t.description || '',
      category: t.category || 'رسوم',
      amount: Number(t.amount || 0),
      sign: null as 'increase' | 'decrease' | null,
      summary: null as string | null,
      date: t.date || null,
      created_at: t.created_at || null,
      payment_method_name: t.payment_method_name || null,
      payment_method_type: t.payment_method_type || null,
      editor_name: null as string | null,
    })),
    ...editLogs.map(e => ({
      id: e.id,
      kind: 'edit' as const,
      type: 'edit' as const,
      description: e.edit_type === 'room_price' ? 'تعديل سعر الغرفة' : 'تعديل معاملة مالية',
      category: '',
      amount: Math.abs(Number(e.delta || 0)),
      sign: (e.direction === 'increase' || e.direction === 'decrease' ? e.direction : null) as 'increase' | 'decrease' | null,
      summary: e.summary || null,
      date: null,
      created_at: e.created_at || null,
      payment_method_name: null,
      payment_method_type: null,
      editor_name: e.editor_name || null,
    })),
  ].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = invoice - totalPaid;
  const remaining = Math.max(0, balance);
  const debtStatus: 'debt' | 'paid' | 'credit' = balance > 0 ? 'debt' : balance < 0 ? 'credit' : 'paid';
  const creditAmount = Math.max(0, -balance);
  const paymentPercent = invoice > 0 ? Math.min(100, Math.round((totalPaid / invoice) * 100)) : 0;

  return {
    studentId,
    billingCycle,
    roomPrice,
    invoice,
    source,
    totalPaid,
    remaining,
    balance,
    debtStatus,
    creditAmount,
    paymentPercent,
    payments: payments.map(p => ({
      id: p.id,
      description: p.description || '',
      category: p.category || 'رسوم',
      amount: Number(p.amount || 0),
      date: p.date || null,
      created_at: p.created_at || null,
    })),
    transactions: accountTransactions,
  };
}

export function formatMoney(n: number): string {
  return `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ج.م`;
}

function todayLabel(): string {
  try { return new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return new Date().toISOString().slice(0, 10); }
}

// يبعت إشعار مالي للطالب ولأولياء أموره بتاريخ اليوم الفعلي (مش التاريخ المكتوب في الفلوس)
export async function notifyStudentFinance(studentId: string, message: string, title?: string): Promise<void> {
  try {
    const student = await kdb('students as s')
      .leftJoin('users as u', 's.user_id', 'u.id')
      .select('s.id', 's.tenant_id', 's.user_id', 'u.name as student_name')
      .where('s.id', studentId)
      .first();
    if (!student) return;

    const recipients: string[] = [];
    if (student.user_id) recipients.push(student.user_id);

    const parents = await kdb('student_guardians as sg')
      .join('parents as p', 'p.id', 'sg.guardian_id')
      .where('sg.student_id', studentId)
      .whereNotNull('p.user_id')
      .select('p.user_id');
    for (const p of parents) {
      if (p.user_id) recipients.push(p.user_id);
    }

    const effectiveTitle = title || `حساب الغرفة - ${student.student_name || 'الطالب'}`;
    const now = new Date();
    for (const userId of recipients) {
      await kdb('notifications').insert({
        id: uuidv4(),
        user_id: userId,
        tenant_id: student.tenant_id || null,
        title: effectiveTitle,
        message,
        type: 'finance',
        metadata: JSON.stringify({ studentId }),
        created_at: now,
      });
    }
  } catch (e) {
    console.error('[notifyStudentFinance]', (e as any)?.message || e);
  }
}

export function financePaymentMessage(amount: number, account: StudentAccount | null, action: 'added' | 'updated'): string {
  const dateLabel = todayLabel();
  const added = action === 'added' ? `تم إضافة مبلغ ${formatMoney(amount)} إلى الحساب` : `تم تحديث إحدى الدفعات`;
  const room = account ? formatMoney(account.roomPrice) : '0 ج.م';
  const paid = account ? formatMoney(account.totalPaid) : '0 ج.م';
  const status = !account ? '' :
    account.debtStatus === 'credit' ? `رصيد دائن (لصالحك): ${formatMoney(account.creditAmount)} — دُفعت زيادة عن الفاتورة` :
    account.debtStatus === 'debt' ? `الرصيد المتبقي: ${formatMoney(account.remaining)}` :
    'تم سداد كامل الفاتورة';
  return `${added} (بتاريخ ${dateLabel}).
سعر الغرفة: ${room}
إجمالي المدفوع: ${paid}
${status}`;
}

// سجل تعديلات المعاملات المالية وسعر الغرفة — بتاريخ التعديل الفعلي في السيرفر (مش تاريخ المشرف المكتوب)
export async function logFinanceEdit(opts: {
  tenantId?: string | null;
  studentId?: string | null;
  financeId?: string | null;
  editType: 'edit' | 'room_price';
  direction?: 'increase' | 'decrease' | null;
  delta?: number | null;
  summary: string;
  createdBy?: string | null;
  isAdminOnly?: boolean;
}): Promise<void> {
  try {
    await kdb('finance_edit_logs').insert({
      id: uuidv4(),
      tenant_id: opts.tenantId ?? null,
      student_id: opts.studentId ?? null,
      finance_id: opts.financeId ?? null,
      edit_type: opts.editType,
      direction: opts.direction ?? null,
      delta: opts.delta ?? null,
      summary: opts.summary,
      created_by: opts.createdBy ?? null,
      is_admin_only: opts.isAdminOnly ? 1 : 0,
    });
  } catch (e) {
    console.error('[logFinanceEdit]', (e as any)?.message || e);
  }
}

function arabicType(value: string | null | undefined): string {
  if (value === 'expense') return 'خصم';
  if (value === 'revenue') return 'دفعة';
  return '—';
}

export function financeEditSummary(oldRow: any, newRow: any): { summary: string; direction: 'increase' | 'decrease' | null; delta: number | null; changed: boolean } {
  const changes: string[] = [];
  let delta: number | null = null;
  let direction: 'increase' | 'decrease' | null = null;

  const oldAmount = Number(oldRow?.amount || 0);
  const newAmount = Number(newRow?.amount || 0);
  const amountChanged = newAmount !== oldAmount;

  if (newRow?.type && oldRow?.type !== newRow.type) {
    changes.push(`النوع: ${arabicType(oldRow?.type)} → ${arabicType(newRow.type)}`);
  }
  if (amountChanged) {
    const change = newAmount - oldAmount;
    // للدفعة: زيادة المبلغ = زيادة؛ نقصه = خصم. للخصم: زيادة المبلغ = خصم؛ نقصه = زيادة.
    const isRevenue = (newRow?.type ?? oldRow?.type) === 'revenue';
    const positive = isRevenue ? change > 0 : change < 0;
    direction = positive ? 'increase' : 'decrease';
    delta = Math.abs(change);
    changes.push(`المبلغ: ${formatMoney(oldAmount)} → ${formatMoney(newAmount)}`);
  }
  if (newRow?.category !== undefined && oldRow?.category !== newRow.category) {
    changes.push(`التصنيف: ${oldRow?.category || '—'} → ${newRow.category || '—'}`);
  }
  if (newRow?.description !== undefined && (oldRow?.description || '') !== (newRow.description || '')) {
    changes.push(`الوصف: ${oldRow?.description || '—'} → ${newRow.description || '—'}`);
  }
  if (newRow?.date !== undefined && (oldRow?.date || '') !== (newRow.date || '')) {
    const oldD = oldRow?.date ? String(oldRow.date).slice(0, 10) : '—';
    const newD = newRow.date ? String(newRow.date).slice(0, 10) : '—';
    changes.push(`التاريخ: ${oldD} → ${newD}`);
  }
  if (newRow?.payment_method_id !== undefined && (oldRow?.payment_method_id || null) !== (newRow.payment_method_id || null)) {
    changes.push('طريقة الدفع: تم التغيير');
  }

  return {
    summary: changes.length > 0 ? changes.join('، ') : 'تعديل بيانات المعاملة',
    direction,
    delta,
    changed: changes.length > 0,
  };
}