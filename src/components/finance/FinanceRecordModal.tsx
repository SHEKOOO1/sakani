import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, TrendingDown, User, Check, Calendar, Wallet, Plus } from 'lucide-react';

interface FinanceFormData {
  type: string;
  category: string;
  amount: string;
  description: string;
  studentId: string;
  date: string;
  paymentMethodId: string;
  paymentMethodName: string;
}

interface FinanceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: FinanceFormData;
  onChange: (data: FinanceFormData) => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  students: any[];
  paymentMethods?: any[];
  isEdit?: boolean;
}

export function FinanceRecordModal({ isOpen, onClose, formData, onChange, onSave, students, paymentMethods, isEdit }: FinanceRecordModalProps) {
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const studentSearchRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (studentSearchRef.current && !studentSearchRef.current.contains(e.target as Node)) {
        setShowStudentDropdown(false);
      }
      if (paymentRef.current && !paymentRef.current.contains(e.target as Node)) {
        setShowPaymentDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedMethod = (paymentMethods || []).find((m: any) => m.id === formData.paymentMethodId);
  const paymentText = formData.paymentMethodName || selectedMethod?.name || '';
  const isNewMethod = !!paymentText.trim() && !(paymentMethods || []).some((m: any) => m.name.toLowerCase() === paymentText.trim().toLowerCase());
  const filteredMethods = (paymentMethods || [])
    .filter((m: any) => {
      if (!paymentText.trim()) return true;
      const q = paymentText.toLowerCase();
      return m.name.toLowerCase().includes(q) || (m.phone_number || '').toLowerCase().includes(q);
    })
    .slice(0, 8);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-[2.5rem] shadow-2xl w-full max-w-xl relative text-right max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{isEdit ? 'تعديل معاملة مالية' : 'إضافة معاملة مالية'}</h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>

            <form onSubmit={onSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => onChange({ ...formData, type: 'revenue' })}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.type === 'revenue' ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400 dark:text-slate-300'}`}
                >
                  <TrendingUp size={24} />
                  <span className="font-bold text-sm">إيراد جديد</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...formData, type: 'expense' })}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400 dark:text-slate-300'}`}
                >
                  <TrendingDown size={24} />
                  <span className="font-bold text-sm">مصروف جديد</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider pr-2">التصنيف</label>
                  <select
                    value={formData.category}
                    onChange={(e) => onChange({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 dark:text-white"
                  >
                    <option>رسوم سكن</option>
                    <option>رسوم فعاليات</option>
                    <option>صيانة</option>
                    <option>كهرباء ومياه</option>
                    <option>رواتب</option>
                    <option>أدوات نظافة</option>
                    <option>أخرى</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider pr-2">المبلغ ($)</label>
                    <input
                      type="number"
                      required
                      value={formData.amount}
                      onChange={(e) => onChange({ ...formData, amount: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider pr-2">التاريخ / الشهر</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" />
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => onChange({ ...formData, date: e.target.value })}
                        className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold dark:text-white"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-300 pr-2">لو مفيش تاريخ يتحدد، هيتسجل بيوم النهارده</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider pr-2">طريقة الدفع</label>
                    <div ref={paymentRef} className="relative">
                      <Wallet size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" />
                      <input
                        type="text"
                        value={paymentText}
                        onChange={(e) => {
                          onChange({ ...formData, paymentMethodId: '', paymentMethodName: e.target.value });
                          setShowPaymentDropdown(true);
                        }}
                        onFocus={() => setShowPaymentDropdown(true)}
                        placeholder="اكتب أو اختر طريقة دفع..."
                        className="w-full pr-11 pl-10 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 dark:text-white"
                      />
                      {paymentText && (
                        <button
                          type="button"
                          onClick={() => onChange({ ...formData, paymentMethodId: '', paymentMethodName: '' })}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-slate-300 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      )}
                      {showPaymentDropdown && (
                        <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-card-dark rounded-xl shadow-xl border border-slate-100 dark:border-white/10 z-50 max-h-48 overflow-y-auto">
                          {filteredMethods.map((m: any) => (
                            <button
                              type="button"
                              key={m.id}
                              onClick={() => {
                                onChange({ ...formData, paymentMethodId: m.id, paymentMethodName: m.name });
                                setShowPaymentDropdown(false);
                              }}
                              className={`w-full text-right px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center gap-3 transition-colors text-sm ${formData.paymentMethodId === m.id ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-700 dark:text-slate-200'}`}
                            >
                              <Wallet size={14} className="text-slate-400 dark:text-slate-300 shrink-0" />
                              <span className="flex-1">{m.name}</span>
                              {m.phone_number && <span className="text-[10px] text-slate-400 dark:text-slate-300 dir-ltr">{m.phone_number}</span>}
                              {formData.paymentMethodId === m.id && <Check size={14} className="text-blue-600 shrink-0" />}
                            </button>
                          ))}
                          {(isNewMethod || filteredMethods.length === 0) && paymentText.trim() && (
                            <div className="px-4 py-3 flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold border-t border-slate-50 dark:border-white/5">
                              <Plus size={13} />
                              <span>ستُضاف "{paymentText.trim()}" كوسيلة دفع جديدة بعد الحفظ</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-300 pr-2">اكتب اسم طريقة دفع جديدة وسيتم حفظها تلقائياً لاستخدامها بعد ذلك</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider pr-2">مرتبط بطالب (اختياري)</label>
                    <div ref={studentSearchRef} className="relative">
                      <input
                        type="text"
                        value={formData.studentId ? (students.find((s: any) => s.id === formData.studentId)?.name || '') : studentSearch}
                        onChange={(e) => {
                          setStudentSearch(e.target.value);
                          onChange({ ...formData, studentId: '' });
                          setShowStudentDropdown(true);
                        }}
                        onFocus={() => setShowStudentDropdown(true)}
                        placeholder="ابحث عن طالب..."
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold dark:text-white"
                      />
                      {formData.studentId && (
                        <button
                          type="button"
                          onClick={() => { onChange({ ...formData, studentId: '' }); setStudentSearch(''); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-slate-300 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      )}
                      {showStudentDropdown && (
                        <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-card-dark rounded-xl shadow-xl border border-slate-100 dark:border-white/10 z-50 max-h-48 overflow-y-auto">
                          {students
                            .filter((s: any) => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                            .slice(0, 20)
                            .map((s: any) => (
                              <button
                                type="button"
                                key={s.id}
                                onClick={() => {
                                  onChange({ ...formData, studentId: s.id });
                                  setStudentSearch('');
                                  setShowStudentDropdown(false);
                                }}
                                className={`w-full text-right px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center gap-3 transition-colors text-sm ${formData.studentId === s.id ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-700 dark:text-slate-200'}`}
                              >
                                <User size={14} className="text-slate-400 dark:text-slate-300" />
                                <span>{s.name}</span>
                                {formData.studentId === s.id && <Check size={14} className="mr-auto text-blue-600" />}
                              </button>
                            ))}
                          {students.filter((s: any) => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                            <div className="px-4 py-6 text-center text-slate-400 dark:text-slate-300 text-sm">لا يوجد طلاب</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider pr-2">الوصف / ملاحظات</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => onChange({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-medium h-24 resize-none dark:text-white"
                    placeholder="اكتب ملاحظات المعاملة هنا..."
                  />
                </div>
              </div>

              <button type="submit" className="w-full py-4 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-bold rounded-2xl shadow-xl shadow-primary-500/20 hover:brightness-110 transition-all active:scale-95">
                {isEdit ? 'حفظ التعديلات' : 'تأكيد وحفظ المعاملة'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
