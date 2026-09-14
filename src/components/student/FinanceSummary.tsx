import { motion } from 'motion/react';
import { Wallet, AlertTriangle, Scale, TrendingUp, TrendingDown, Receipt, PenLine } from 'lucide-react';

const CYCLE_LABELS: Record<string, string> = {
  daily: 'تحصيل يومي',
  monthly: 'تحصيل شهري',
  semester: 'تحصيل فصل دراسي'
};

function formatDateTime(d: string | null | undefined) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface FinanceSummaryProps {
  finance: {
    totalInvoice: number;
    totalPaid: number;
    remaining: number;
    balance?: number;
    debtStatus?: 'debt' | 'paid' | 'credit';
    creditAmount?: number;
    roomPrice?: number;
    source?: 'room' | 'agreed';
    billingCycle?: string;
    transactions?: any[];
  };
  paymentPercent: number;
}

export default function FinanceSummary({ finance, paymentPercent }: FinanceSummaryProps) {
  const cycleLabel = CYCLE_LABELS[finance.billingCycle || ''] || finance.billingCycle || '';
  const sourceAgreed = finance.source === 'agreed' && finance.totalInvoice > 0;
  const balance = finance.balance ?? (finance.totalInvoice - finance.totalPaid);
  const debtStatus = finance.debtStatus || (balance > 0 ? 'debt' : balance < 0 ? 'credit' : 'paid');
  const creditAmount = finance.creditAmount ?? Math.max(0, -balance);
  return (
    <motion.div
      initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      className="rounded-xl bg-gradient-to-bl from-ocean-600 to-ocean-700 p-6 text-white shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Wallet size={16} /></div>
          <h3 className="font-black text-sm">الملخص المالي</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {debtStatus === 'credit' && (
            <span className="text-[9px] bg-teal-400/20 text-teal-200 px-2.5 py-1 rounded-full font-black">دائن</span>
          )}
          {debtStatus === 'debt' && (
            <span className="text-[9px] bg-warm-400/20 text-warm-200 px-2.5 py-1 rounded-full font-black">مدين</span>
          )}
          {debtStatus === 'paid' && finance.totalInvoice > 0 && (
            <span className="text-[9px] bg-emerald-400/20 text-emerald-200 px-2.5 py-1 rounded-full font-black">مدفوع ✓</span>
          )}
          {cycleLabel && (
            <span className="text-[10px] bg-white/15 px-2.5 py-1 rounded-full font-bold">{cycleLabel}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/70 font-medium">
            {sourceAgreed ? 'إجمالي الاتفاق (بدون سعر غرفة)' : 'إجمالي الفاتورة'}
          </span>
          <span className="text-lg font-black">{finance.totalInvoice.toLocaleString()} ج.م</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/70 font-medium">المدفوع</span>
          <span className="font-black text-ocean-200">{finance.totalPaid.toLocaleString()} ج.م</span>
        </div>
        <div className="flex justify-between items-center border-t border-white/20 pt-2">
          <span className="text-xs text-white/70 font-medium">
            {balance < 0 ? 'رصيد دائن (لصالحك)' : 'المتبقي'}
          </span>
          <span className={`text-lg font-black ${
            balance > 0 ? 'text-warm-300' : balance < 0 ? 'text-teal-200' : 'text-ocean-200'
          }`}>
            {balance < 0 ? `${creditAmount.toLocaleString()} ج.م` : balance > 0 ? `${finance.remaining.toLocaleString()} ج.م` : 'مدفوع ✓'}
          </span>
        </div>
      </div>

      <div className="mt-3 h-2 bg-white/15 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${paymentPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-gradient-to-l from-warm-400 to-yellow-300 shadow-sm"
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-ocean-200 font-medium">نسبة السداد</span>
        <span className="text-[10px] font-black">{Math.round(paymentPercent)}%</span>
      </div>

      {balance < 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-teal-400/15 px-3 py-2 text-[10px] text-teal-200 font-black">
          <Scale size={12} className="shrink-0" />
          عندك رصيد دائن {creditAmount.toLocaleString()} ج.م — دُفعت زيادة عن الفاتورة.
        </div>
      )}

      {balance > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-warm-400/15 px-3 py-2 text-[10px] text-warm-200 font-bold">
          <AlertTriangle size={12} className="shrink-0" />
          متبقي عليك {finance.remaining.toLocaleString()} ج.م حتى استكمال قيمة الغرفة.
        </div>
      )}

      {sourceAgreed && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[10px] text-warm-200 font-bold">
          <AlertTriangle size={12} className="shrink-0" />
          سعر الغرفة غير مسجل — الفاتورة محسوبة من اتفاق الطالب، ممكن أخصائي السكن يثبت سعر الغرفة.
        </div>
      )}

      {finance.transactions && finance.transactions.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={12} className="text-white/70" />
            <p className="text-[10px] font-black text-white/80">سجل المعاملات ({finance.transactions.length})</p>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pl-1">
            {finance.transactions.map((t: any) => {
              const isEdit = t.kind === 'edit';
              const isExpense = !isEdit && t.type === 'expense';
              const positive = t.sign === 'increase';
              return (
                <div key={t.id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${isEdit ? 'bg-violet-500/20' : 'bg-white/10'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${isEdit ? 'bg-violet-400/20' : isExpense ? 'bg-red-500/20' : 'bg-emerald-400/20'}`}>
                      {isEdit ? <PenLine size={11} className="text-violet-300" /> : isExpense ? <TrendingDown size={11} className="text-red-300" /> : <TrendingUp size={11} className="text-emerald-300" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white truncate flex items-center gap-1">
                        <span className="truncate">{t.description || t.category || (isExpense ? 'خصم' : 'دفعة')}</span>
                        {isEdit && <span className="text-[7px] bg-violet-400/30 text-violet-100 px-1.5 py-0.5 rounded-full font-black shrink-0">تعديل</span>}
                      </p>
                      <p className="text-[8px] text-white/60 font-bold">{formatDateTime(t.created_at)}{isEdit && t.summary ? ' · ' + t.summary.substring(0, 40) + (t.summary.length > 40 ? '…' : '') : ''}</p>
                      {!isEdit && t.payment_method_name && (
                        <span className="inline-block mt-0.5 text-[8px] bg-white/15 text-white px-1.5 py-0.5 rounded-full font-black">{t.payment_method_name}</span>
                      )}
                    </div>
                  </div>
                  {isEdit ? (
                    t.sign ? (
                      <span className={`text-[11px] font-black shrink-0 ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
                        {positive ? '+' : '−'}{Number(t.amount).toLocaleString()} ج.م
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-violet-200 shrink-0">تعديل</span>
                    )
                  ) : (
                    <span className={`text-[11px] font-black shrink-0 ${isExpense ? 'text-red-300' : 'text-emerald-300'}`}>
                      {isExpense ? '−' : '+'}{Number(t.amount).toLocaleString()} ج.م
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}