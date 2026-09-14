import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  X, Calendar, Target, Search, Wallet, Smartphone, Check, Plus, Send
} from 'lucide-react';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import { useApi } from '../../hooks/useApi';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalData: any;
  setModalData: (data: any) => void;
  handleSave: () => void;
  editMode: boolean;
  saving: boolean;
}

const defaultFormData = {
  title: '',
  description: '',
  event_date: '',
  location: '',
  price: 0,
  is_paid: false,
  is_competition: false,
  winning_threshold: 100,
  max_score: 200,
  responsibleIds: [] as any[],
  location_lat: '',
  location_lng: '',
  location_radius: 50,
  qr_code: '',
  type: 'event',
  registration_deadline: '',
  available_payment_methods: [] as string[],
  max_participants: '',
};

export function EventCreateModal({
  isOpen,
  onClose,
  modalData,
  setModalData,
  handleSave,
  editMode,
  saving,
}: EventCreateModalProps) {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();

  const [formData, setFormData] = useState<any>(modalData?.formData || defaultFormData);
  const [targeting, setTargeting] = useState<Record<string, any>>(modalData?.targeting || {});
  const [paymentMethods, setPaymentMethods] = useState<any[]>(modalData?.paymentMethods || []);
  const [showNewPaymentForm, setShowNewPaymentForm] = useState(false);
  const [newPaymentName, setNewPaymentName] = useState('');
  const [newPaymentPhone, setNewPaymentPhone] = useState('');
  const [responsibleSearch, setResponsibleSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [tenants, setTenants] = useState<any[]>(modalData?.tenants || []);
  const [colleges, setColleges] = useState<string[]>(modalData?.colleges || []);
  const [governorates, setGovernorates] = useState<string[]>(modalData?.governorates || []);
  const [churches, setChurches] = useState<string[]>(modalData?.churches || []);
  const [bishops, setBishops] = useState<any[]>(modalData?.bishops || []);
  const [priests, setPriests] = useState<any[]>(modalData?.priests || []);
  const [supervisors, setSupervisors] = useState<any[]>(modalData?.supervisors || []);
  const [employees, setEmployees] = useState<any[]>(modalData?.employees || []);
  const [guardianRelations, setGuardianRelations] = useState<string[]>(modalData?.guardianRelations || []);
  const [recipientCount, setRecipientCount] = useState<number | null>(modalData?.recipientCount ?? null);

  const studentsList = modalData?.studentsList || [];
  const employeeList = modalData?.employeeList || [];

  useEffect(() => {
    if (isOpen) {
      if (modalData?.formData) {
        setFormData(modalData.formData);
      }
      if (modalData?.targeting) {
        setTargeting(modalData.targeting);
      }
      if (modalData?.paymentMethods) {
        setPaymentMethods(modalData.paymentMethods);
      }
      if (!editMode) {
        request('/api/payments/methods').then(res => {
          setPaymentMethods(res.data || []);
        }).catch(e => console.error('Load payment methods failed:', e));
        loadTargetData();
        if (!modalData?.targeting || Object.keys(modalData.targeting).length === 0) {
          setTargeting({});
        }
        setRecipientCount(null);
      }
    }
  }, [isOpen]);

  const loadTargetData = useCallback(async () => {
    try {
      const [tenantsRes, collegesRes, govsRes, churchesRes, bishopsRes, priestsRes, supervisorsRes, employeesRes, guardianRelRes] = await Promise.all([
        request('/api/broadcasts/targets/tenants'),
        request('/api/broadcasts/targets/colleges'),
        request('/api/broadcasts/targets/governorates'),
        request('/api/broadcasts/targets/churches'),
        request('/api/broadcasts/targets/bishops'),
        request('/api/broadcasts/targets/priests'),
        request('/api/broadcasts/targets/supervisors'),
        request('/api/broadcasts/targets/employees'),
        request('/api/broadcasts/targets/guardian-relations'),
      ]);
      if (tenantsRes.data) setTenants(tenantsRes.data);
      if (collegesRes.data) setColleges(collegesRes.data);
      if (govsRes.data) setGovernorates(govsRes.data);
      if (churchesRes.data) setChurches(churchesRes.data);
      if (bishopsRes.data) setBishops(bishopsRes.data);
      if (priestsRes.data) setPriests(priestsRes.data);
      if (supervisorsRes.data) setSupervisors(supervisorsRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data);
      if (guardianRelRes.data) setGuardianRelations(guardianRelRes.data);
    } catch {}
  }, [request]);

  useEffect(() => {
    if (isOpen) {
      const data: any = {};
      let changed = false;
      if (formData !== modalData?.formData) { data.formData = formData; changed = true; }
      if (targeting !== modalData?.targeting) { data.targeting = targeting; changed = true; }
      if (changed) {
        setModalData({ ...modalData, ...data });
      }
    }
  }, [formData, targeting, isOpen]);

  const estimateRecipients = useCallback(async (t: any) => {
    try {
      const res = await request('/api/broadcasts/recipients-count', {
        method: 'POST', body: JSON.stringify({ targeting: t }),
      });
      setRecipientCount(res.data?.count ?? null);
    } catch { setRecipientCount(null); }
  }, [request]);

  useEffect(() => {
    if (isOpen && Object.keys(targeting).length > 0) {
      const timer = setTimeout(() => estimateRecipients(targeting), 500);
      return () => clearTimeout(timer);
    }
  }, [targeting, isOpen]);

  const toggleTarget = (key: string, value: string) => {
    setTargeting(prev => {
      const current = prev[key] as string[] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: next.length > 0 ? next : undefined };
    });
  };

  const toggleExclude = (field: string, excludeField: string) => {
    setTargeting(prev => {
      const willExclude = !prev[excludeField];
      return { ...prev, [excludeField]: willExclude, ...(willExclude ? { [field]: undefined } : {}) };
    });
  };

  const searchStudentsTarget = useCallback(async (q: string) => {
    if (q.length < 2) return [];
    const res = await request(`/api/broadcasts/targets/students?search=${encodeURIComponent(q)}`);
    return res.data || [];
  }, [request]);

  useEffect(() => {
    if (responsibleSearch.length > 1) {
      const filtered = [...studentsList, ...employeeList].filter((u: any) =>
        u.name.toLowerCase().includes(responsibleSearch.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [responsibleSearch, studentsList, employeeList]);

  if (!isOpen) return null;

  return (
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
              <Calendar className="text-neon-primary" size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 dark:text-white">{editMode ? 'تعديل الفعالية' : 'فعالية جديدة'}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{editMode ? 'عدل بيانات الفعالية الحالية' : 'أنشئ فعالية مع نظام استهداف متكامل'}</p>
            </div>
          </div>
          
            <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
          
            </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* العنوان */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">عنوان الفعالية</label>
            <input type="text" required value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50"
              placeholder="مثال: يوم رياضي، مؤتمر الشباب..." />
          </div>

          {/* التاريخ والموقع */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">التاريخ والوقت</label>
              <input type="datetime-local" required value={formData.event_date}
                onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">الموقع</label>
              <input type="text" required value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50"
                placeholder="مثال: ملاعب المجمع" />
            </div>
          </div>

          {/* النوع والموعد النهائي */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">نوع الفعالية</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50">
                <option value="event">فعالية عادية</option>
                <option value="conference">مؤتمر</option>
                <option value="trip">رحلة</option>
              </select>
            </div>
            {(formData.type === 'conference' || formData.type === 'trip') && (
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">آخر موعد للتسجيل</label>
                <input type="datetime-local" value={formData.registration_deadline}
                  onChange={e => setFormData({ ...formData, registration_deadline: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50" />
              </div>
            )}
          </div>

          {/* مدفوعة + وسائل الدفع */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={formData.is_paid}
                onChange={e => setFormData({ ...formData, is_paid: e.target.checked })}
                className="w-5 h-5 accent-neon-primary rounded" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">فعالية مدفوعة (رسوم)</span>
            </label>
            {formData.is_paid && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">السعر (ج.م)</label>
                    <input type="number" value={formData.price}
                      onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">العدد الأقصى للمشتركين</label>
                    <input type="number" min="1" value={formData.max_participants}
                      onChange={e => setFormData({ ...formData, max_participants: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50"
                      placeholder="مثال: 50" />
                  </div>
                </div>
                {paymentMethods.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Wallet size={14} /> وسائل الدفع المتاحة للطلاب
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      {paymentMethods.map((pm: any) => {
                        const isSel = formData.available_payment_methods.includes(pm.id);
                        return (
                          <div key={pm.id} onClick={() => {
                            const next = isSel
                              ? formData.available_payment_methods.filter((id: string) => id !== pm.id)
                              : [...formData.available_payment_methods, pm.id];
                            setFormData({ ...formData, available_payment_methods: next });
                          }}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-2 ${
                              isSel ? 'border-neon-primary bg-neon-primary/10' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300'
                            }`}>
                            <Smartphone size={16} className={isSel ? 'text-neon-primary' : 'text-slate-400'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{pm.name}</p>
                              <p className="text-[9px] text-slate-400" dir="ltr">{pm.phone_number}</p>
                            </div>
                            {isSel && <Check size={14} className="text-neon-primary shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                    {showNewPaymentForm ? (
                      <div className="space-y-2 p-3 rounded-xl bg-white dark:bg-white/5 border border-blue-200 dark:border-blue-500/20">
                        <input type="text" placeholder="اسم وسيلة الدفع" value={newPaymentName}
                          onChange={e => setNewPaymentName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50" />
                        <input type="text" placeholder="رقم الهاتف" value={newPaymentPhone}
                          onChange={e => setNewPaymentPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50" />
                        <div className="flex gap-2">
                          <button type="button" onClick={async () => {
                            if (!newPaymentName.trim() || !newPaymentPhone.trim()) { showSnackbar('الرجاء إدخال الاسم والهاتف', 'warning'); return; }
                            try {
                              const res = await request('/api/payments/methods', {
                                method: 'POST',
                                body: JSON.stringify({ name: newPaymentName.trim(), phone_number: newPaymentPhone.trim(), type: 'instapay' })
                              });
                              if (res.success && res.data) {
                                setPaymentMethods((prev: any[]) => [...prev, { id: res.data.id, name: newPaymentName.trim(), phone_number: newPaymentPhone.trim(), type: 'instapay' }]);
                                setFormData((prev: any) => ({ ...prev, available_payment_methods: [...prev.available_payment_methods, res.data.id] }));
                                setShowNewPaymentForm(false);
                                setNewPaymentName('');
                                setNewPaymentPhone('');
                                showSnackbar('تم إضافة وسيلة الدفع', 'success');
                              }
                            } catch (e: any) { showSnackbar(e.message || 'فشل إضافة وسيلة الدفع', 'error'); }
                          }} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all">إضافة</button>
                          <button type="button" onClick={() => { setShowNewPaymentForm(false); setNewPaymentName(''); setNewPaymentPhone(''); }} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all">إلغاء</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowNewPaymentForm(true)} className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
                        <Plus size={14} /> إضافة وسيلة دفع جديدة
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* المسابقات */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={formData.is_competition}
                onChange={e => setFormData({ ...formData, is_competition: e.target.checked })}
                className="w-5 h-5 accent-amber-500 rounded" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">تفعيل نظام المسابقات والفرق</span>
            </label>
            {formData.is_competition && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">درجة الفوز</label>
                  <input type="number" value={formData.winning_threshold}
                    onChange={e => setFormData({ ...formData, winning_threshold: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">الدرجة النهائية</label>
                  <input type="number" value={formData.max_score}
                    onChange={e => setFormData({ ...formData, max_score: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* المسؤولين */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">المسؤولين عن الفعالية</label>
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={responsibleSearch}
                onChange={e => setResponsibleSearch(e.target.value)}
                className="w-full pr-10 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50"
                placeholder="ابحث عن مسؤول..." />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto py-1">
                  {searchResults.map((u: any) => (
                    <button key={u.id} type="button"
                      onClick={() => {
                        if (!formData.responsibleIds.find((r: any) => r.id === u.id)) {
                          setFormData({ ...formData, responsibleIds: [...formData.responsibleIds, u] });
                        }
                        setResponsibleSearch('');
                      }}
                      className="w-full text-right px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between">
                      <span>{u.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-lg font-bold ${u.role === 'student' || !u.role ? 'bg-neon-primary/10 text-neon-primary' : 'bg-blue-500/10 text-blue-500'}`}>
                        {u.role === 'student' || !u.role ? 'طالب' : 'موظف'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {formData.responsibleIds.map((r: any) => (
                <div key={r.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neon-primary/10 text-neon-primary text-[10px] font-bold border border-neon-primary/20">
                  {r.name}
                  <button type="button" onClick={() => setFormData({
                    ...formData, responsibleIds: formData.responsibleIds.filter((x: any) => x.id !== r.id)
                  })} className="hover:text-red-400">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* === نظام الاستهداف === */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-neon-primary" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">الاستهداف</h4>
              {recipientCount !== null && (
                <span className="text-xs text-slate-400">~{recipientCount} مستلم</span>
              )}
            </div>
            <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-lg text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              <span className="font-bold text-blue-600 dark:text-blue-400">نظام الفلتره الذكي:</span><br />
              • كل فئة مستقلة — اختيار طالب لا يعني إرسال لولي أمره (يجب اختيار "صلة القرابة" أيضاً)<br />
              • زر العين <span className="text-red-400">❌</span> يستثني الفئة بالكامل دون المساس بالفئات الأخرى<br />
              • مثال: اختر طالب [أ] + ولي أمره، ثم اضغط عين على الطلاب ← الطالب محجوب لكن ولي أمره يستقبل<br />
              • مثال: اختر "أب" من صلة القرابة ثم اضغط عين على أولياء الأمور ← كل الأولياء محجوبين
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SearchableMultiSelect label="المساكن" items={tenants} selected={targeting.tenants || []}
                onChange={v => toggleTarget('tenants', v)} searchPlaceholder="ابحث عن سكن..."
                excluded={!!targeting.exclude_tenants}
                onToggleExclude={() => toggleExclude('tenants', 'exclude_tenants')} />
              <SearchableMultiSelect label="الكليات" items={colleges} selected={targeting.colleges || []}
                onChange={v => toggleTarget('colleges', v)} searchPlaceholder="ابحث عن كلية..."
                excluded={!!targeting.exclude_colleges}
                onToggleExclude={() => toggleExclude('colleges', 'exclude_colleges')} />
              <SearchableMultiSelect label="المحافظات" items={governorates} selected={targeting.governorates || []}
                onChange={v => toggleTarget('governorates', v)} searchPlaceholder="ابحث عن محافظة..."
                excluded={!!targeting.exclude_governorates}
                onToggleExclude={() => toggleExclude('governorates', 'exclude_governorates')} />
              <SearchableMultiSelect label="الكنائس" items={churches} selected={targeting.churches || []}
                onChange={v => toggleTarget('churches', v)} searchPlaceholder="ابحث عن كنيسة..."
                excluded={!!targeting.exclude_churches}
                onToggleExclude={() => toggleExclude('churches', 'exclude_churches')} />
              <SearchableMultiSelect label="الأساقفة" items={bishops} selected={targeting.bishops || []}
                onChange={v => toggleTarget('bishops', v)} searchPlaceholder="ابحث عن أسقف..."
                excluded={!!targeting.exclude_bishops}
                onToggleExclude={() => toggleExclude('bishops', 'exclude_bishops')} />
              <SearchableMultiSelect label="الآباء الكهنة" items={priests} selected={targeting.priests || []}
                onChange={v => toggleTarget('priests', v)} searchPlaceholder="ابحث عن كاهن..."
                excluded={!!targeting.exclude_priests}
                onToggleExclude={() => toggleExclude('priests', 'exclude_priests')} />
              <SearchableMultiSelect label="المشرفين" items={supervisors} selected={targeting.supervisors || []}
                onChange={v => toggleTarget('supervisors', v)} searchPlaceholder="ابحث عن مشرف..."
                excluded={!!targeting.exclude_supervisors}
                onToggleExclude={() => toggleExclude('supervisors', 'exclude_supervisors')} />
              <SearchableMultiSelect label="الموظفين" items={employees} selected={targeting.employees || []}
                onChange={v => toggleTarget('employees', v)} searchPlaceholder="ابحث عن موظف..."
                excluded={!!targeting.exclude_employees}
                onToggleExclude={() => toggleExclude('employees', 'exclude_employees')} />
              <SearchableMultiSelect label="الطلاب" items={[]} selected={targeting.students || []}
                onChange={v => toggleTarget('students', v)} searchPlaceholder="ابحث عن طالب..."
                excluded={!!targeting.exclude_students}
                onToggleExclude={() => toggleExclude('students', 'exclude_students')}
                onAsyncSearch={searchStudentsTarget} />
              <SearchableMultiSelect label="صلة القرابة" items={guardianRelations} selected={targeting.guardian_types || []}
                onChange={v => toggleTarget('guardian_types', v)} searchPlaceholder="ابحث عن صلة قرابة..."
                excluded={!!targeting.exclude_parents}
                onToggleExclude={() => toggleExclude('guardian_types', 'exclude_parents')} />
            </div>
            {/* Sibling genders */}
            {['brother', 'sister'].some(t => (targeting.guardian_types || []).includes(t)) && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">جنس الأخ/الأخت</label>
                <div className="flex flex-wrap gap-1.5">
                  {[{ value: 'male', label: 'ذكر' }, { value: 'female', label: 'أنثى' }].map(g => {
                    const isSel = (targeting.sibling_genders || []).includes(g.value);
                    return (
                      <button key={g.value} onClick={() => toggleTarget('sibling_genders', g.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          isSel
                            ? 'bg-neon-primary/20 text-neon-primary border-neon-primary/40'
                            : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                        }`}>
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Selected targets summary */}
            {(targeting.tenants?.length || targeting.colleges?.length || targeting.governorates?.length || targeting.churches?.length || targeting.students?.length || targeting.guardian_types?.length || targeting.priests?.length || targeting.supervisors?.length || targeting.employees?.length || targeting.exclude_tenants || targeting.exclude_colleges || targeting.exclude_governorates || targeting.exclude_churches || targeting.exclude_students || targeting.exclude_parents || targeting.exclude_priests || targeting.exclude_supervisors || targeting.exclude_employees) && (
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-400">
                {targeting.tenants?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">مساكن: {targeting.tenants.length}</span> : null}
                {targeting.colleges?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">كليات: {targeting.colleges.length}</span> : null}
                {targeting.governorates?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">محافظات: {targeting.governorates.length}</span> : null}
                {targeting.churches?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">كنائس: {targeting.churches.length}</span> : null}
                {targeting.students?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">طلاب: {targeting.students.length}</span> : null}
                {targeting.priests?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">كهنة: {targeting.priests.length}</span> : null}
                {targeting.supervisors?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">مشرفين: {targeting.supervisors.length}</span> : null}
                {targeting.employees?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">موظفين: {targeting.employees.length}</span> : null}
                {targeting.guardian_types?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">أولياء: {targeting.guardian_types.join(', ')}</span> : null}
                {targeting.sibling_genders?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">جنس الأخوة: {targeting.sibling_genders.map((g: string) => g === 'male' ? 'ذكر' : 'أنثى').join(', ')}</span> : null}
                {targeting.exclude_students ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ طلاب</span> : null}
                {targeting.exclude_parents ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ أولياء أمور</span> : null}
                {targeting.exclude_employees ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ موظفين</span> : null}
                {targeting.exclude_supervisors ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ مشرفين</span> : null}
                {targeting.exclude_priests ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ كهنة</span> : null}
              </div>
            )}
          </div>

          {/* الوصف */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">وصف الفعالية</label>
            <textarea required value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50 resize-none h-28"
              placeholder="اكتب تفاصيل الفعالية وبرنامج اليوم هنا..." />
          </div>

          {/* الأزرار */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
              إلغاء
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-neon-primary text-black font-bold rounded-xl hover:bg-neon-primary/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {editMode ? 'تعديل الفعالية' : 'نشر الفعالية'} <Send size={16} />
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
