import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  Wallet, TrendingUp, TrendingDown, CheckCircle2, AlertCircle,
  Receipt, Calendar, Loader2, CornerDownLeft, Scale, PenLine, Tag, FileText, Pen
} from 'lucide-react';
import { DiscountModal, DiscountState } from './modals/DiscountModal';
import { FileViewerModal } from './FileViewerModal';

interface PaymentItem {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string | null;
  created_at: string | null;
}

interface TransactionItem {
  id: string;
  kind?: 'revenue' | 'expense' | 'edit';
  type: string;
  description: string;
  category: string;
  amount: number;
  sign?: 'increase' | 'decrease' | null;
  summary?: string | null;
  date: string | null;
  created_at: string | null;
  payment_method_name: string | null;
  editor_name?: string | null;
}

interface DiscountInfo {
  type: 'percent' | 'amount';
  value: number;
  amount: number;
  note: string | null;
  document: { id: number; doc_type: string | null; file_name: string | null; file_path: string } | null;
}

interface FinanceData {
  invoice: number;
  roomPrice: number;
  source?: 'room' | 'agreed' | 'frozen';
  grossInvoice?: number;
  hasDiscount?: boolean;
  discountType?: 'percent' | 'amount' | null;
  discountValue?: number | null;
  discountAmount?: number;
  discount?: DiscountInfo | null;
  totalPaid: number;
  remaining: number;
  balance: number;
  debtStatus?: 'debt' | 'paid' | 'credit';
  creditAmount?: number;
  paymentPercent: number;
  billingCycle?: string | null;
  payments: PaymentItem[];
  transactions: TransactionItem[];
}

interface StudentFinanceCardProps {
  studentId: string;
  role: string;
}

const VIEWER_ROLES = ['admin', 'bishop', 'priest', 'supervisor'];

function formatEGP(n: number) {
  return `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ج.م`;
}

function formatDateTime(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function cycleLabel(cycle?: string | null) {
  if (cycle === 'daily') return 'تحصيل يومي';
  if (cycle === 'monthly') return 'تحصيل شهري';
  if (cycle === 'semester') return 'تحصيل فصل دراسي';
  return cycle || '';
}

export const StudentFinanceCard: React.FC<StudentFinanceCardProps> = ({ studentId, role }) => {
  const { request } = useApi();
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discountModal, setDiscountModal] = useState(false);
  const [viewerFile, setViewerFile] = useState<DiscountState['document'] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await request(`/api/students/${studentId}/finance`);
      if (res?.success && res.data) {
        setData(res.data);
      } else {
        setError(res?.message || 'تعذر تحميل بيانات الحساب المالي');
      }
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل بيانات الحساب المالي');
    } finally {
      setLoading(false);
    }
  }, [request, studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!VIEWER_ROLES.includes(role)) return null;

  const remaining = Math.max(0, data?.remaining ?? 0);
  const balance = data?.balance ?? data?.remaining ?? 0;
  const debtStatus = data?.debtStatus || (balance > 0 ? 'debt' : balance < 0 ? 'credit' : 'paid');
  const creditAmount = data?.creditAmount ?? Math.max(0, -balance);
  const percent = data?.paymentPercent ?? 0;
  const transactions = data?.transactions || [];

  const grossInvoice = data?.grossInvoice ?? data?.invoice ?? 0;
  const discountAmount = data?.discountAmount ?? data?.discount?.amount ?? 0;
  const hasDiscount = (data?.hasDiscount ?? false) || discountAmount > 0;
  const discountType = data?.discountType ?? data?.discount?.type ?? null;
  const discountValue = data?.discountValue ?? data?.discount?.value ?? null;
  const discountNote = data?.discount?.note ?? null;
  const discountDocument = data?.discount?.document ?? null;
  const canManageDiscount = role === 'supervisor';

  const discountState: DiscountState | null = hasDiscount || discountType ? {
    type: discountType,
    value: discountValue,
    note: discountNote,
    document: discountDocument,
  } : null;

  return (
    <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 rounded-2xl"><Wallet size={20} className="text-emerald-400" /></div>
          <div>
            <h3 className="text-lg font-black tracking-tight">حساب الغرفة</h3>
            <p className="text-[10px] text-slate-400 font-bold">سعر الغرفة والمدفوع والمتبقي ومدفوعات الطالب</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {debtStatus === 'credit' && (
            <span className="text-[9px] bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-full font-black" title="الطالب دفع أكثر من الفاتورة">دائن</span>
          )}
          {debtStatus === 'debt' && (
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full font-black" title="على الطالب مبلغ متبقٍ">مدين</span>
          )}
          {debtStatus === 'paid' && data?.invoice != null && data.invoice > 0 && (
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-black" title="تم سداد كامل الفاتورة">مدفوع ✓</span>
          )}
          {data?.billingCycle && (
            <span className="text-[9px] bg-white/10 px-2.5 py-1 rounded-full font-black text-slate-300">{cycleLabel(data.billingCycle)}</span>
          )}
          {data?.source === 'agreed' && (
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full font-black" title="لا توجد غرفة مسجلة بسعر — يُستخدم السعر المتفق عليه">سعر مفقود</span>
          )}
          {hasDiscount && (
            <span
              className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-black"
              title={`خصم على سعر الغرفة: ${discountType === 'percent' ? `${discountValue}%` : formatEGP(discountValue || 0)}`}
            >
              خصم {discountType === 'percent' ? `${discountValue}%` : formatEGP(discountValue || 0)}
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="py-10 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      )}

      {!loading && error && (
        <p className="py-6 text-center text-xs font-bold text-red-400">{error}</p>
      )}

      {!loading && !error && data && (
        <div className="space-y-5">
          {/* Summary numbers */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-white/5 rounded-3xl border border-white/10">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">{data.source === 'agreed' ? 'السعر المتفق عليه' : 'سعر الغرفة'}</p>
              <p className="text-sm font-black text-white">{formatEGP(data.invoice)}</p>
              {hasDiscount && (
                <p className="text-[9px] font-black text-slate-400 mt-1">قبل الخصم: {formatEGP(grossInvoice)}</p>
              )}
            </div>
            <div className="p-4 bg-white/5 rounded-3xl border border-emerald-500/20">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">المدفوع</p>
              <p className="text-sm font-black text-emerald-400">{formatEGP(data.totalPaid)}</p>
            </div>
            <div className={`p-4 rounded-3xl border ${balance > 0 ? 'bg-amber-500/15 border-amber-500/30' : balance < 0 ? 'bg-teal-500/15 border-teal-500/30' : 'bg-emerald-500/15 border-emerald-500/30'}`}>
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                {balance < 0 ? <><CornerDownLeft size={9} /> رصيد دائن</> : 'المتبقي'}
              </p>
              <p className={`text-sm font-black ${balance > 0 ? 'text-amber-300' : balance < 0 ? 'text-teal-300' : 'text-emerald-300'}`}>
                {balance < 0 ? formatEGP(creditAmount) : formatEGP(remaining)}
              </p>
            </div>
          </div>

          {/* Discount breakdown */}
          {hasDiscount ? (
            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/25 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/20 rounded-lg"><Tag size={13} className="text-emerald-300" /></div>
                  <p className="text-[11px] font-black text-emerald-200">
                    خصم {discountType === 'percent' ? `${discountValue}%` : formatEGP(discountValue || 0)} على سعر الإقامة
                  </p>
                </div>
                {canManageDiscount && (
                  <button
                    onClick={() => setDiscountModal(true)}
                    className="flex items-center gap-1.5 text-[10px] font-black text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors shrink-0"
                  >
                    <Pen size={11} /> تعديل
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-white/5 rounded-xl">
                  <p className="text-[8px] font-black text-slate-500 mb-0.5">السعر الأصلي</p>
                  <p className="text-[11px] font-black text-slate-300 line-through">{formatEGP(grossInvoice)}</p>
                </div>
                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                  <p className="text-[8px] font-black text-emerald-400/70 mb-0.5">مبلغ الخصم</p>
                  <p className="text-[11px] font-black text-emerald-300">−{formatEGP(discountAmount)}</p>
                </div>
                <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                  <p className="text-[8px] font-black text-emerald-400/70 mb-0.5">بعد الخصم</p>
                  <p className="text-[11px] font-black text-white">{formatEGP(data.invoice)}</p>
                </div>
              </div>

              {discountNote && (
                <p className="text-[10px] font-bold text-emerald-100/80 leading-relaxed">
                  <span className="text-[9px] font-black text-emerald-400">سبب الخصم: </span>
                  {discountNote}
                </p>
              )}

              {discountDocument && (
                <button
                  onClick={() => setViewerFile(discountDocument)}
                  className="w-full flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-slate-200 hover:border-emerald-400/50 transition-colors"
                >
                  <FileText size={14} className="text-emerald-300 shrink-0" />
                  <span className="truncate">عرض جواب الخصم (الإثبات)</span>
                </button>
              )}
            </div>
          ) : canManageDiscount ? (
            <button
              onClick={() => setDiscountModal(true)}
              className="w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-white/10 hover:border-emerald-400/40 hover:bg-emerald-500/5 rounded-2xl transition-all text-[11px] font-black text-slate-400 hover:text-emerald-300"
            >
              <Tag size={14} /> إضافة خصم على سعر الإقامة
            </button>
          ) : null}

          {/* Progress */}
          <div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-l from-emerald-400 to-teal-300 transition-all duration-700"
                style={{ width: `${percent}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-slate-400 font-bold">نسبة السداد</span>
              <span className="text-[10px] font-black text-emerald-300">{percent}%</span>
            </div>
          </div>

          {/* Outstanding balance banner */}
          {balance > 0 ? (
            <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <p className="text-[11px] font-bold text-amber-200">
                الطالب <span className="font-black text-amber-300">مدين</span> بمبلغ <span className="font-black text-amber-300">{formatEGP(remaining)}</span> لم تُدفع بعد
              </p>
            </div>
          ) : balance < 0 ? (
            <div className="flex items-center gap-3 p-4 bg-teal-500/10 rounded-2xl border border-teal-500/20">
              <Scale size={18} className="text-teal-300 shrink-0" />
              <p className="text-[11px] font-bold text-teal-200">
                الطالب <span className="font-black text-teal-300">دائن</span> بمبلغ <span className="font-black text-teal-300">{formatEGP(creditAmount)}</span> (دفع زيادة عن الفاتورة)
              </p>
            </div>
          ) : data.invoice > 0 ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <p className="text-[11px] font-bold text-emerald-200">تم سداد كامل الفاتورة</p>
            </div>
          ) : null}

          {/* Transactions list (دفعات + خصومات) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Receipt size={14} className="text-slate-400" />
              <p className="text-[11px] font-black text-slate-300">سجل المعاملات ({transactions.length})</p>
            </div>
            {transactions.length === 0 ? (
              <p className="text-center py-6 text-[11px] text-slate-500 font-bold border-2 border-dashed border-white/10 rounded-3xl">
                مفيش معاملات مالية مسجلة لحد دلوقتي
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pl-1">
                {transactions.map((t) => {
                  const isEdit = t.kind === 'edit';
                  const isExpense = !isEdit && t.type === 'expense';
                  const positive = t.sign === 'increase';
                  const negative = t.sign === 'decrease';
                  return (
                    <div key={t.id} className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border ${isEdit ? 'bg-violet-500/10 border-violet-500/25' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${isEdit ? 'bg-violet-500/20' : isExpense ? 'bg-red-500/15' : 'bg-emerald-500/15'}`}>
                          {isEdit ? <PenLine size={14} className="text-violet-300" /> : isExpense ? <TrendingDown size={14} className="text-red-400" /> : <TrendingUp size={14} className="text-emerald-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{t.description || t.category || (isExpense ? 'خصم' : 'دفعة')}</span>
                            {isEdit && <span className="text-[8px] bg-violet-500/25 text-violet-200 px-1.5 py-0.5 rounded-full font-black shrink-0">تعديل</span>}
                            {isEdit && t.editor_name && <span className="text-[8px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded-full font-bold shrink-0">{t.editor_name}</span>}
                          </p>
                          <p className="text-[9px] text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                            <Calendar size={9} /> {formatDateTime(t.created_at)}{isEdit ? '' : ` · ${t.category}`}
                          </p>
                          {t.summary && (
                            <p className="text-[9px] text-violet-200/80 font-bold mt-1 leading-relaxed break-words" title={t.summary}>{t.summary}</p>
                          )}
                          {!isEdit && t.payment_method_name && (
                            <span className="inline-block mt-1 text-[8px] bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded-full font-black">
                              {t.payment_method_name}
                            </span>
                          )}
                        </div>
                      </div>
                      {isEdit ? (
                        <div className="shrink-0 text-left">
                          {t.sign ? (
                            <span className={`text-xs font-black ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {positive ? '+' : '−'}{formatEGP(t.amount)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-violet-300">تعديل</span>
                          )}
                        </div>
                      ) : (
                        <span className={`text-xs font-black shrink-0 ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isExpense ? '−' : '+'}{formatEGP(t.amount)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <DiscountModal
        isOpen={discountModal}
        onClose={() => setDiscountModal(false)}
        studentId={studentId}
        current={discountState}
        onSaved={fetchData}
      />

      <FileViewerModal
        file={viewerFile ? {
          id: String(viewerFile.id),
          file_name: viewerFile.file_name || undefined,
          doc_type: viewerFile.doc_type || undefined,
          file_path: viewerFile.file_path,
        } : null}
        onClose={() => setViewerFile(null)}
      />
    </div>
  );
};