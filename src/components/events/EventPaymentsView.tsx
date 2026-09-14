import { motion } from 'motion/react';
import { Check, Clock, X, Users, BellRing } from 'lucide-react';

interface EventPaymentsViewProps {
  eventPayments: any[];
  paymentsLoading: boolean;
  handleSendPaymentReminder: (subId: string) => void;
}

export function EventPaymentsView({ eventPayments, paymentsLoading, handleSendPaymentReminder }: EventPaymentsViewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="payments" className="space-y-8">
      <div className="flex justify-between items-center pb-6 border-b border-slate-100 dark:border-white/5">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">إدارة المدفوعات</h3>
          <p className="text-xs text-slate-500 font-bold mt-1">حالة دفع المشتركين في هذه الفعالية</p>
        </div>
      </div>

      {paymentsLoading ? (
        <div className="text-center py-20 text-slate-400 font-bold">جاري التحميل...</div>
      ) : eventPayments.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold">
          <Users className="mx-auto mb-4 opacity-30" size={48} />
          لا يوجد مشتركين في هذه الفعالية حتى الآن
        </div>
      ) : (
        <div className="space-y-3">
          {eventPayments.map((reg: any, idx: number) => {
            const isPaid = reg.payment_status === 'paid';
            const isPending = reg.payment_status === 'pending';
            return (
              <div key={reg.student_id ? `${reg.student_id}-${idx}` : `reg-${idx}`} className={`p-6 rounded-card border transition-all flex items-center justify-between ${
                isPaid ? 'bg-emerald-500/5 border-emerald-500/20' : isPending ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black ${
                    isPaid ? 'bg-emerald-500/10 text-emerald-500' : isPending ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-100 dark:bg-white/10 text-slate-400'
                  }`}>
                    {isPaid ? <Check size={20} /> : isPending ? <Clock size={20} /> : <X size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{reg.student_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-2 mt-0.5">
                      {isPaid ? (
                        <span className="text-emerald-500">تم الدفع ✓</span>
                      ) : isPending ? (
                        <span className="text-amber-500">في انتظار التأكيد</span>
                      ) : (
                        <span className="text-red-400">لم يدفع بعد</span>
                      )}
                      {reg.paid_at && <span>• {new Date(reg.paid_at).toLocaleDateString('ar-EG')}</span>}
                    </p>
                  </div>
                </div>
                {!isPaid && (
                  <button
                    onClick={() => handleSendPaymentReminder(reg.student_id)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl hover:bg-amber-500 hover:text-black transition-all text-xs font-black"
                    title="إرسال تذكير"
                  >
                    <BellRing size={14} />
                    تذكير
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
