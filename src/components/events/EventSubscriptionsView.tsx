import { motion } from 'motion/react';
import { Check, Clock, X, UserPlus, Eye, RotateCcw, Trash2 } from 'lucide-react';

interface EventSubscriptionsViewProps {
  subscriptions: any[];
  subscriptionsLoading: boolean;
  selectedEvent: any;
  fetchSubscriptions: (eventId: string) => void;
  request: (url: string, options?: any) => Promise<any>;
  showSnackbar: (message: string, type?: any) => void;
  confirm: (options: any) => Promise<boolean>;
}

export function EventSubscriptionsView({
  subscriptions, subscriptionsLoading, selectedEvent, fetchSubscriptions,
  request, showSnackbar, confirm,
}: EventSubscriptionsViewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="subscriptions" className="space-y-8">
      <div className="flex justify-between items-center pb-6 border-b border-slate-100 dark:border-white/5">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">طلبات الاشتراك</h3>
          <p className="text-xs text-slate-500 font-bold mt-1">إدارة طلبات الاشتراك في هذه الفعالية</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-xl text-xs font-bold">{subscriptions.filter((s: any) => s.status === 'pending').length} قيد المراجعة</span>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs font-bold">{subscriptions.filter((s: any) => s.status === 'approved').length} مقبول</span>
        </div>
      </div>

      {subscriptionsLoading ? (
        <div className="text-center py-20 text-slate-400 font-bold">جاري التحميل...</div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold">
          <UserPlus className="mx-auto mb-4 opacity-30" size={48} />
          لا توجد طلبات اشتراك بعد
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub: any) => (
            <div key={sub.id} className={`p-6 rounded-card border transition-all ${
              sub.status === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20' :
              sub.status === 'rejected' ? 'bg-red-500/5 border-red-500/20' :
              'bg-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black ${
                    sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                    sub.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                    'bg-amber-500/10 text-amber-500'
                  }`}>
                    {sub.status === 'approved' ? <Check size={20} /> :
                     sub.status === 'rejected' ? <X size={20} /> :
                     <Clock size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{sub.user_name}</p>
                    <div className="flex gap-3 mt-1">
                      {sub.student_name && (
                        <span className="text-[10px] text-slate-500 font-bold">الطالب: {sub.student_name}</span>
                      )}
                      {sub.student_id_number && (
                        <span className="text-[10px] text-slate-400 font-bold">كود: {sub.student_id_number}</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                      <span>{new Date(sub.created_at).toLocaleDateString('ar-EG')}</span>
                      {sub.payment_method_name && (
                        <span>• الدفع: {sub.payment_method_name} ({sub.payment_method_phone})</span>
                      )}
                      <span>• حالة الدفع: {
                        sub.payment_status === 'paid' ? <span className="text-emerald-500">تم الدفع</span> :
                        sub.payment_status === 'pending' ? <span className="text-amber-500">قيد المراجعة</span> :
                        <span className="text-slate-500">لم يدفع</span>
                      }</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sub.receipt_image && (
                    <div className="flex items-center gap-2">
                      <img src={sub.receipt_image} alt="Receipt"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(sub.receipt_image, '_blank')}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <button onClick={() => window.open(sub.receipt_image, '_blank')}
                        className="px-3 py-2 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold hover:border-blue-500/30 transition-all">
                        <Eye size={14} className="inline ml-1" />عرض الإيصال
                      </button>
                    </div>
                  )}
                  {sub.status === 'pending' && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            await request(`/api/events/${selectedEvent.id}/subscriptions/${sub.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'approved' })
                            });
                            showSnackbar('تمت الموافقة على الاشتراك', 'success');
                            fetchSubscriptions(selectedEvent.id);
                          } catch (err: any) { showSnackbar(err.message, 'error'); }
                        }}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all">
                        موافقة
                      </button>
                      <button
                        onClick={async () => {
                          if (!await confirm({ message: 'هل أنت متأكد من رفض هذا الاشتراك؟', type: 'danger' })) return;
                          try {
                            await request(`/api/events/${selectedEvent.id}/subscriptions/${sub.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'rejected' })
                            });
                            showSnackbar('تم رفض الاشتراك', 'warning');
                            fetchSubscriptions(selectedEvent.id);
                          } catch (err: any) { showSnackbar(err.message, 'error'); }
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all">
                        رفض
                      </button>
                    </>
                  )}
                  {sub.status === 'approved' && sub.payment_status === 'pending' && (
                    <button
                      onClick={async () => {
                        try {
                          await request(`/api/events/${selectedEvent.id}/subscriptions/${sub.id}/confirm-payment`, {
                            method: 'PATCH'
                          });
                          showSnackbar('تم تأكيد الدفع', 'success');
                          fetchSubscriptions(selectedEvent.id);
                        } catch (err: any) { showSnackbar(err.message, 'error'); }
                      }}
                      className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all">
                      تأكيد الدفع
                    </button>
                  )}
                  {sub.status === 'approved' && (
                    <div className="flex gap-1">
                      <button
                        onClick={async () => {
                          if (!await confirm({ message: 'هل أنت متأكد من إعادة فتح طلب الاشتراك للمراجعة؟', type: 'warning' })) return;
                          try {
                            await request(`/api/events/${selectedEvent.id}/subscriptions/${sub.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'pending' })
                            });
                            showSnackbar('تم إعادة فتح طلب الاشتراك', 'info');
                            fetchSubscriptions(selectedEvent.id);
                          } catch (err: any) { showSnackbar(err.message, 'error'); }
                        }}
                        className="px-2 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500 hover:text-white transition-all"
                        title="إعادة فتح للمراجعة">
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!await confirm({ message: 'هل أنت متأكد من حذف هذا المشترك من الفعالية؟', type: 'danger' })) return;
                          try {
                            await request(`/api/events/${selectedEvent.id}/subscriptions/${sub.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'removed' })
                            });
                            showSnackbar('تم حذف المشترك من الفعالية', 'warning');
                            fetchSubscriptions(selectedEvent.id);
                          } catch (err: any) { showSnackbar(err.message, 'error'); }
                        }}
                        className="px-2 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                        title="حذف من الفعالية">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {sub.status === 'rejected' && (
                    <button
                      onClick={async () => {
                        if (!await confirm({ message: 'هل أنت متأكد من إعادة فتح طلب الاشتراك للمراجعة؟', type: 'warning' })) return;
                        try {
                          await request(`/api/events/${selectedEvent.id}/subscriptions/${sub.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'pending' })
                          });
                          showSnackbar('تم إعادة فتح طلب الاشتراك', 'info');
                          fetchSubscriptions(selectedEvent.id);
                        } catch (err: any) { showSnackbar(err.message, 'error'); }
                      }}
                      className="px-3 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500 hover:text-white transition-all">
                      <RotateCcw size={14} className="inline ml-1" />إعادة فتح
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
