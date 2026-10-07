import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, MapPin, Users, DollarSign, Smartphone, Upload,
  Check, Info, X, Clock
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface EventDetailModalProps {
  open: boolean;
  detailEvent: any;
  onClose: () => void;
}

export function EventDetailModal({ open, detailEvent, onClose }: EventDetailModalProps) {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();

  const [mySubscription, setMySubscription] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [subscribePaymentMethods, setSubscribePaymentMethods] = useState<any[]>([]);

  useEffect(() => {
    if (detailEvent) {
      setMySubscription(detailEvent._user_subscription || null);
      setSelectedPaymentMethod('');
      setReceiptFile(null);
      setReceiptPreview('');

      const availMethods = detailEvent.available_payment_methods
        ? (typeof detailEvent.available_payment_methods === 'string' ? JSON.parse(detailEvent.available_payment_methods) : detailEvent.available_payment_methods)
        : [];
      if (availMethods.length > 0 || detailEvent.is_paid) {
        request('/api/payments/methods').then(res => {
          const allMethods = res.data || [];
          setSubscribePaymentMethods(allMethods.filter((m: any) => availMethods.length === 0 || availMethods.includes(m.id)));
        }).catch(() => {});
      }
    }
  }, [detailEvent]);

  const handleSubscribe = async () => {
    setSubscriptionLoading(true);
    try {
      let receiptUrl = '';
      if (receiptFile) {
        setReceiptUploading(true);
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        const uploadRes = await request('/api/events/upload-receipt', {
          method: 'POST', body: formData, headers: {},
        });
        receiptUrl = uploadRes.data?.url || '';
        setReceiptUploading(false);
      }
      await request(`/api/events/${detailEvent.id}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({
          payment_method_id: selectedPaymentMethod || undefined,
          receipt_image: receiptUrl || undefined,
        })
      });
      showSnackbar('تم إرسال طلب الاشتراك بنجاح وسيتم إشعار المسؤولين', 'success');
      const res = await request(`/api/events/${detailEvent.id}/my-subscription`);
      if (res.data) setMySubscription(res.data);
      setSelectedPaymentMethod('');
      setReceiptFile(null);
      setReceiptPreview('');
    } catch (err: any) {
      showSnackbar(err.message || 'فشل إرسال طلب الاشتراك', 'error');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && detailEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-card-dark rounded-card border border-slate-100 dark:border-white/[0.05] w-full max-w-2xl shadow-2xl overflow-hidden relative my-8"
          >
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-l from-neon-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-neon-primary/10 rounded-2xl flex items-center justify-center">
                  <Info className="text-neon-primary" size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">{detailEvent.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تفاصيل الفعالية والاشتراك</p>
                </div>
              </div>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <Calendar size={18} className="text-neon-primary mb-2" />
                  <p className="text-[10px] text-slate-500 font-bold">التاريخ</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{new Date(detailEvent.event_date || Date.now()).toLocaleDateString('ar-EG', { dateStyle: 'full' })}</p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <MapPin size={18} className="text-neon-secondary mb-2" />
                  <p className="text-[10px] text-slate-500 font-bold">المكان</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{detailEvent.location || 'غير محدد'}</p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <Users size={18} className="text-neon-accent mb-2" />
                  <p className="text-[10px] text-slate-500 font-bold">عدد المشتركين</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {detailEvent._subscription_count || 0}{detailEvent.max_participants ? ` / ${detailEvent.max_participants}` : ''}
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <DollarSign size={18} className={detailEvent.is_paid ? 'text-amber-400' : 'text-emerald-400'} />
                  <p className="text-[10px] text-slate-500 font-bold">الرسوم</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{detailEvent.is_paid ? `${detailEvent.price} ج.م` : 'مجاني'}</p>
                </div>
              </div>

              {detailEvent.description && (
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <p className="text-[10px] text-slate-500 font-bold mb-2">الوصف</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{detailEvent.description}</p>
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-white/5 pt-6">
                {subscriptionLoading ? (
                  <div className="text-center py-4 text-slate-400">جاري التحميل...</div>
                ) : !mySubscription ? (
                  <div className="space-y-4">
                    {detailEvent.is_paid && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">وسيلة الدفع</label>
                        <div className="grid grid-cols-1 gap-2">
                          {subscribePaymentMethods.filter(m => {
                            const availMethods = detailEvent.available_payment_methods
                              ? (typeof detailEvent.available_payment_methods === 'string' ? JSON.parse(detailEvent.available_payment_methods) : detailEvent.available_payment_methods)
                              : [];
                            return availMethods.length === 0 || availMethods.includes(m.id);
                          }).map(pm => (
                            <div key={pm.id} onClick={() => setSelectedPaymentMethod(pm.id)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                                selectedPaymentMethod === pm.id ? 'border-neon-primary bg-neon-primary/10' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5'
                              }`}>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                selectedPaymentMethod === pm.id ? 'bg-neon-primary/20 text-neon-primary' : 'bg-slate-100 dark:bg-white/10 text-slate-400'
                              }`}>
                                <Smartphone size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{pm.name}</p>
                                <p className="text-xs text-slate-400" dir="ltr">{pm.phone_number}</p>
                              </div>
                              {selectedPaymentMethod === pm.id && <Check size={16} className="text-neon-primary shrink-0" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detailEvent.is_paid && selectedPaymentMethod && (
                      <>
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                            <Smartphone size={18} className="text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold">أرسل المبلغ على</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              {subscribePaymentMethods.find(m => m.id === selectedPaymentMethod)?.name}
                            </p>
                            <p className="text-xs text-slate-500 font-bold" dir="ltr">
                              {subscribePaymentMethods.find(m => m.id === selectedPaymentMethod)?.phone_number}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">صورة الإيصال</label>
                          <div className="flex items-center gap-3">
                            <label className="flex-1 flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/20 rounded-xl cursor-pointer hover:border-neon-primary/50 transition-colors">
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setReceiptFile(file);
                                setReceiptPreview(URL.createObjectURL(file));
                              }} />
                              <Upload size={18} className="text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-500">{receiptFile ? receiptFile.name : 'اختر صورة الإيصال'}</span>
                            </label>
                            {receiptPreview && (
                              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 cursor-pointer"
                                onClick={() => window.open(receiptPreview, '_blank')}>
                                <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {detailEvent.is_paid && detailEvent.max_participants && (detailEvent._subscription_count || 0) >= detailEvent.max_participants && (
                      <div className="p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-center text-xs font-bold">
                        لقد اكتمل العدد الأقصى للمشتركين في هذه الفعالية
                      </div>
                    )}

                    <button
                      onClick={handleSubscribe}
                      disabled={subscriptionLoading || (detailEvent.is_paid && !selectedPaymentMethod)}
                      className="w-full py-4 bg-neon-primary text-black font-bold rounded-xl hover:bg-neon-primary/90 transition-all text-sm disabled:opacity-50"
                    >
                      {receiptUploading ? 'جاري رفع الصورة...' : subscriptionLoading ? 'جاري الإرسال...' : detailEvent.is_paid ? 'تأكيد الحجز ورفع الإيصال' : 'تأكيد الحجز'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border text-center ${
                      mySubscription.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20' :
                      mySubscription.status === 'rejected' ? 'bg-red-500/10 border-red-500/20' :
                      'bg-amber-500/10 border-amber-500/20'
                    }`}>
                      {mySubscription.status === 'approved' ? (
                        <div>
                          <div className="flex items-center justify-center gap-2 text-emerald-500 font-black">
                            <Check size={20} /> تمت الموافقة على اشتراكك
                          </div>
                          <div className="mt-2 flex items-center justify-center gap-2">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                              mySubscription.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
                              mySubscription.payment_status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-slate-500/10 text-slate-500'
                            }`}>
                              {mySubscription.payment_status === 'paid' ? '✓ تم الدفع' :
                               mySubscription.payment_status === 'pending' ? '⏳ الدفع قيد المراجعة' :
                               'لم يدفع بعد'}
                            </span>
                          </div>
                        </div>
                      ) : mySubscription.status === 'rejected' ? (
                        <div className="flex items-center justify-center gap-2 text-red-500 font-black">
                          <X size={20} /> تم رفض اشتراكك
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-amber-500 font-black">
                          <Clock size={20} /> طلب الاشتراك قيد المراجعة
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
