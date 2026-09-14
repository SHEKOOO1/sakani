import { motion, AnimatePresence } from 'motion/react';
import { X, Info, Calendar, MapPin, Users, DollarSign, Check, Clock, Smartphone, Upload, Send } from 'lucide-react';

interface EventDetailModalProps {
  isOpen: boolean;
  event: any;
  onClose: () => void;
  subscriptionLoading: boolean;
  mySubscription: any;
  subscribePaymentMethods: any[];
  selectedPaymentMethod: string;
  onPaymentMethodChange: (id: string) => void;
  receiptFile: File | null;
  receiptPreview: string;
  onReceiptChange: (file: File | null, preview: string) => void;
  user: any;
  parentChildren: any[];
  selectedChildId: string;
  onChildChange: (id: string) => void;
  onSubscribe: () => void;
  onCancelSubscription: () => void;
  onUploadPayment: () => void;
  receiptUploading: boolean;
  onRefresh: () => void;
}

export function EventDetailModal({
  isOpen,
  event,
  onClose,
  subscriptionLoading,
  mySubscription,
  subscribePaymentMethods,
  selectedPaymentMethod,
  onPaymentMethodChange,
  receiptFile,
  receiptPreview,
  onReceiptChange,
  user,
  parentChildren,
  selectedChildId,
  onChildChange,
  onSubscribe,
  onCancelSubscription,
  onUploadPayment,
  receiptUploading,
  onRefresh,
}: EventDetailModalProps) {
  return (
    <AnimatePresence>
      {isOpen && event && (
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
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">{event.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تفاصيل الفعالية والاشتراك</p>
                </div>
              </div>
              <button onClick={() => { onClose(); onRefresh(); }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
              {/* Event info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <Calendar size={18} className="text-neon-primary mb-2" />
                  <p className="text-[10px] text-slate-500 font-bold">التاريخ</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{new Date(event.event_date || Date.now()).toLocaleDateString('ar-EG', { dateStyle: 'full' })}</p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <MapPin size={18} className="text-neon-secondary mb-2" />
                  <p className="text-[10px] text-slate-500 font-bold">المكان</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{event.location || 'غير محدد'}</p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <Users size={18} className="text-neon-accent mb-2" />
                  <p className="text-[10px] text-slate-500 font-bold">عدد المشتركين</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {event._subscription_count || 0}{event.max_participants ? ` / ${event.max_participants}` : ''}
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <DollarSign size={18} className={event.is_paid ? 'text-amber-400' : 'text-emerald-400'} />
                  <p className="text-[10px] text-slate-500 font-bold">الرسوم</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{event.is_paid ? `${event.price} ج.م` : 'مجاني'}</p>
                </div>
              </div>

              {event.description && (
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <p className="text-[10px] text-slate-500 font-bold mb-2">الوصف</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{event.description}</p>
                </div>
              )}

              {/* Subscription section */}
              <div className="border-t border-slate-100 dark:border-white/5 pt-6">
                {subscriptionLoading ? (
                  <div className="text-center py-4 text-slate-400">جاري التحميل...</div>
                ) : !mySubscription ? (
                  <div className="space-y-4">
                    {/* Payment method selection for paid events */}
                    {event.is_paid && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">وسيلة الدفع</label>
                        <div className="grid grid-cols-1 gap-2">
                          {subscribePaymentMethods.filter(m => {
                            const availMethods = event.available_payment_methods
                              ? (typeof event.available_payment_methods === 'string' ? JSON.parse(event.available_payment_methods) : event.available_payment_methods)
                              : [];
                            return availMethods.length === 0 || availMethods.includes(m.id);
                          }).map(pm => (
                            <div key={pm.id} onClick={() => onPaymentMethodChange(pm.id)}
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
                          {subscribePaymentMethods.filter(m => {
                            const availMethods = event.available_payment_methods
                              ? (typeof event.available_payment_methods === 'string' ? JSON.parse(event.available_payment_methods) : event.available_payment_methods)
                              : [];
                            return availMethods.length === 0 || availMethods.includes(m.id);
                          }).length === 0 && (
                            <p className="text-xs text-slate-400 col-span-full text-center py-2">لا توجد وسائل دفع متاحة</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Receipt upload for paid events */}
                    {event.is_paid && selectedPaymentMethod && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">صورة الإيصال</label>
                        <div className="flex items-center gap-3">
                          <label className="flex-1 flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/20 rounded-xl cursor-pointer hover:border-neon-primary/50 transition-colors">
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              onReceiptChange(file, URL.createObjectURL(file));
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
                    )}

                    {/* Show payment details when method selected */}
                    {event.is_paid && selectedPaymentMethod && (
                      <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                          <Smartphone size={18} className="text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold">أرسل المبلغ على</p>
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {subscribePaymentMethods.find(m => m.id === selectedPaymentMethod)?.name || 'InstaPay'}
                          </p>
                          <p className="text-xs text-slate-500 font-bold" dir="ltr">
                            {subscribePaymentMethods.find(m => m.id === selectedPaymentMethod)?.phone_number || ''}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Child selector for parents */}
                    {user?.role === 'parent' && parentChildren.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">التسجيل لصالح</label>
                        <select value={selectedChildId} onChange={e => onChildChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white">
                          <option value="">نفسي (ولي الأمر)</option>
                          {parentChildren.map((c: any) => (
                            <option key={c.student_id} value={c.student_id}>{c.student_name || c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Parent permission check */}
                    {user?.role === 'parent' && !event.parent_can_enroll && (
                      <div className="p-4 bg-slate-500/10 text-slate-500 rounded-xl border border-slate-500/20 text-center text-xs font-bold">
                        التسجيل في هذه الفعالية غير متاح لأولياء الأمور حالياً
                      </div>
                    )}

                    {/* Max participants check */}
                    {event.max_participants && (event._subscription_count || 0) >= event.max_participants && !mySubscription && (
                      <div className="p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-center text-xs font-bold">
                        لقد اكتمل العدد الأقصى للمشتركين في هذه الفعالية
                      </div>
                    )}

                    {/* Subscribe button */}
                    {!mySubscription && (
                      <button
                        onClick={onSubscribe}
                        disabled={subscriptionLoading || (event.is_paid && !selectedPaymentMethod)}
                        className="w-full py-4 bg-neon-primary text-black font-bold rounded-xl hover:bg-neon-primary/90 transition-all text-sm disabled:opacity-50"
                      >
                        {receiptUploading ? 'جاري رفع الصورة...' : subscriptionLoading ? 'جاري الإرسال...' : event.is_paid ? 'تأكيد الحجز ورفع الإيصال' : 'تأكيد الحجز'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Current subscription status */}
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
                        <div>
                          <div className="flex items-center justify-center gap-2 text-red-500 font-black">
                            <X size={20} /> تم رفض اشتراكك
                          </div>
                        </div>
                      ) : mySubscription.status === 'cancelled' ? (
                        <div>
                          <div className="flex items-center justify-center gap-2 text-slate-500 font-black">
                            <X size={20} /> تم إلغاء اشتراكك
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-center gap-2 text-amber-500 font-black">
                            <Clock size={20} /> طلب الاشتراك قيد المراجعة
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cancel subscription button */}
                    {mySubscription.status !== 'cancelled' && (
                      <button
                        onClick={onCancelSubscription}
                        className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                      >
                        إلغاء الاشتراك
                      </button>
                    )}

                    {/* Payment info for approved subscriptions */}
                    {mySubscription.status === 'approved' && event.is_paid && (
                      <div className="space-y-3">
                        {mySubscription.payment_status === 'paid' ? (
                          <div className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 font-bold text-sm">
                            <Check size={16} /> تم الدفع
                          </div>
                        ) : mySubscription.payment_status === 'pending' ? (
                          <div className="flex items-center justify-center gap-2 py-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 font-bold text-sm">
                            <Clock size={16} /> الدفع قيد المراجعة
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-500 text-center">لم يتم الدفع بعد. يرجى تحويل المبلغ عبر InstaPay ورفع الإيصال</p>
                            <div className="grid grid-cols-1 gap-2">
                              {subscribePaymentMethods.filter(m => {
                                const availMethods = event.available_payment_methods
                                  ? (typeof event.available_payment_methods === 'string' ? JSON.parse(event.available_payment_methods) : event.available_payment_methods)
                                  : [];
                                return availMethods.length === 0 || availMethods.includes(m.id);
                              }).map(pm => (
                                <div key={pm.id} onClick={() => onPaymentMethodChange(pm.id)}
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

                            {/* Show payment details when method selected */}
                            {selectedPaymentMethod && (
                              <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                                  <Send size={18} className="text-emerald-500" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 font-bold">حول المبلغ على</p>
                                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                    {subscribePaymentMethods.find(m => m.id === selectedPaymentMethod)?.name}
                                  </p>
                                  <p className="text-xs text-slate-500 font-bold" dir="ltr">
                                    {subscribePaymentMethods.find(m => m.id === selectedPaymentMethod)?.phone_number}
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              <label className="flex-1 flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/20 rounded-xl cursor-pointer hover:border-neon-primary/50 transition-colors">
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  onReceiptChange(file, URL.createObjectURL(file));
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
                            <button
                              onClick={onUploadPayment}
                              disabled={!selectedPaymentMethod}
                              className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all text-sm disabled:opacity-50"
                            >
                              تأكيد الدفع وإرسال الإيصال
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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
