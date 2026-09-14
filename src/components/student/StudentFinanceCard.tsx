import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  Wallet, TrendingUp, TrendingDown, CheckCircle2, AlertCircle,
  Pencil, X, Save, Receipt, Calendar, Loader2, CornerDownLeft, Scale, PenLine
} from 'lucide-react';

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

interface FinanceData {
  invoice: number;
  roomPrice: number;
  source?: 'room' | 'agreed';
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

const currencyInput = (v: number) => (v ? String(v) : '');

export const StudentFinanceCard: React.FC<StudentFinanceCardProps> = ({ studentId, role }) => {
  const { request } = useApi();
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [invoice, setInvoice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEdit = role === 'supervisor';

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

  const openEdit = () => {
    setInvoice(currencyInput(data?.invoice || 0));
    setSaveMsg(null);
    setEditing(true);
  };

  const handleSaveInvoice = async () => {
    const amount = Number(invoice);
    if (Number.isNaN(amount) || amount < 0) {
      setSaveMsg({ type: 'error', text: 'سعر الغرفة غير صحيح' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await request(`/api/students/${studentId}/finance`, {
        method: 'PATCH',
        body: JSON.stringify({ value: amount })
      });
      if (res?.success) {
        setSaveMsg({ type: 'success', text: 'تم تعديل سعر الغرفة وإخطار الطالب وولي الأمر' });
        setEditing(false);
        fetchData();
      } else {
        setSaveMsg({ type: 'error', text: res?.message || 'فشل تعديل سعر الغرفة' });
      }
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'فشل تعديل سعر الغرفة' });
    } finally {
      setSaving(false);
    }
  };

  const remaining = Math.max(0, data?.remaining ?? 0);
  const balance = data?.balance ?? data?.remaining ?? 0;
  const debtStatus = data?.debtStatus || (balance > 0 ? 'debt' : balance < 0 ? 'credit' : 'paid');
  const creditAmount = data?.creditAmount ?? Math.max(0, -balance);
  const percent = data?.paymentPercent ?? 0;
  const transactions = data?.transactions || [];

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
          {canEdit && (
            <button onClick={openEdit}
              className="p-2 bg-white/5 rounded-xl text-slate-300 hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              title="تعديل سعر الغرفة">
              <Pencil size={15} />
            </button>
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
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">سعر الغرفة</p>
              <p className="text-sm font-black text-white">{formatEGP(data.invoice)}</p>
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
                            <p className="text-[9px] text-violet-200/80 font-bold mt-0.5 truncate max-w-[240px]" title={t.summary}>{t.summary}</p>
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

      {/* Edit invoice modal */}
      {editing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-card-dark rounded-[2.5rem] p-8 shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Wallet size={18} className="text-emerald-500" /> تعديل سعر الغرفة
              </h3>
              <button onClick={() => setEditing(false)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 font-bold mb-4 leading-relaxed">
              سعر الغرفة المسجل ({data?.billingCycle ? cycleLabel(data.billingCycle) : 'حسب دورة التحصيل'}). عند الحفظ يصل إشعار للطالب وولي الأمر والمدفوعات والمتبقي يتحدثان تلقائياً.
            </p>
            <label className="text-[10px] text-slate-400 dark:text-slate-300 font-black uppercase tracking-widest block mb-2">
              سعر الغرفة (ج.م)
            </label>
            <input
              type="number" min={0} value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder="0"
              className="w-full p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all mb-4"
            />
            {saveMsg && (
              <p className={`text-[11px] font-bold mb-4 flex items-center gap-1 ${saveMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {saveMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {saveMsg.text}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button onClick={handleSaveInvoice} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 p-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-sm font-black transition-all">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                حفظ سعر الغرفة
              </button>
              <button onClick={() => setEditing(false)} disabled={saving}
                className="px-6 p-4 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200 rounded-2xl text-sm font-black transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};