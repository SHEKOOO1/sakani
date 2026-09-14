import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useSnackbar } from '../contexts/SnackbarContext';
import { Wallet, Plus, X, Edit3, Smartphone, CreditCard, Landmark, Check } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'instapay', label: 'إنستاباي', icon: Smartphone },
  { value: 'vodafone_cash', label: 'فودافون كاش', icon: Smartphone },
  { value: 'orange_money', label: 'أورنج موني', icon: Smartphone },
  { value: 'etisalat_wallet', label: 'اتصالات ووليت', icon: Smartphone },
  { value: 'bank_transfer', label: 'تحويل بنكي', icon: Landmark },
  { value: 'other', label: 'أخرى', icon: CreditCard },
];

export function PaymentMethodsManager() {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone_number: '', type: 'instapay' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('/api/payments/methods');
      if (mountedRef.current) setMethods(res.data || []);
    } catch (err) { console.error(err); } finally { if (mountedRef.current) setLoading(false); }
  }, [request]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await request(`/api/payments/methods/${editingId}`, {
          method: 'PUT', body: JSON.stringify(form),
        });
      } else {
        await request('/api/payments/methods', {
          method: 'POST', body: JSON.stringify(form),
        });
      }
      setShowAdd(false);
      setEditingId(null);
      setForm({ name: '', phone_number: '', type: 'instapay' });
      fetchMethods();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ message: 'حذف وسيلة الدفع؟', type: 'danger' })) return;
    try {
      await request(`/api/payments/methods/${id}`, { method: 'DELETE' });
      fetchMethods();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleEdit = (m: any) => {
    setForm({ name: m.name, phone_number: m.phone_number, type: m.type });
    setEditingId(m.id);
    setShowAdd(true);
  };

  const getTypeLabel = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.label || t;

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" /></div>;
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-blue-600" />
          <span className="font-bold text-sm text-slate-900 dark:text-white">وسائل الدفع الإلكتروني</span>
        </div>
        <button onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: '', phone_number: '', type: 'instapay' }); }}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-700 transition-colors">
          <Plus size={14} /> إضافة وسيلة
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {methods.map(m => {
          const TypeIcon = TYPE_OPTIONS.find(o => o.value === m.type)?.icon || Smartphone;
          return (
            <div key={m.id} className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <TypeIcon size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{m.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold" dir="ltr">{m.phone_number}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><X size={12} /></button>
                </div>
              </div>
              <span className="text-[9px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 font-bold">{getTypeLabel(m.type)}</span>
            </div>
          );
        })}
        {methods.length === 0 && (
          <div className="col-span-full py-6 text-center">
            <Wallet size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400 font-bold">لم يتم إضافة وسائل دفع بعد</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-card-dark rounded-[2.5rem] p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm text-slate-900 dark:text-white">{editingId ? 'تعديل وسيلة دفع' : 'إضافة وسيلة دفع'}</h3>
              <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم الوسيلة</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  placeholder="مثال: إنستاباي - فودافون كاش" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">رقم الهاتف (مرتبط بالوسيلة)</label>
                <input required value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500" dir="ltr"
                  placeholder="0100xxxxxxx" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">نوع الوسيلة</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white outline-none">
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <button type="submit"
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg">
                {editingId ? 'حفظ التعديلات' : 'إضافة الوسيلة'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Student payment card - shown in event details for paid events
export function StudentPaymentCard({ eventId, price, eventAvailableMethods }: { eventId: string; price: number; eventAvailableMethods?: string[] }) {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();
  const [methods, setMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/payments/methods');
        let allMethods = res.data || [];
        if (eventAvailableMethods && eventAvailableMethods.length > 0) {
          allMethods = allMethods.filter((m: any) => eventAvailableMethods.includes(m.id));
        }
        setMethods(allMethods);
      } catch (e) { console.error('Load payment methods failed:', e); }
    })();
  }, [request, eventAvailableMethods]);

  const handlePay = async () => {
    if (!selectedMethod) return;
    setSubmitting(true);
    try {
      await request('/api/payments/pay', {
        method: 'POST',
        body: JSON.stringify({ eventId, paymentMethodId: selectedMethod, amount: price }),
      });
      setDone(true);
    } catch (err: any) {
      showSnackbar(err.message || 'فشل الدفع', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-center">
        <Check size={32} className="mx-auto text-emerald-500 mb-2" />
        <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">تم إرسال طلب الدفع</p>
        <p className="text-[10px] text-emerald-500 mt-1">بانتظار تأكيد المشرف</p>
      </div>
    );
  }

  if (methods.length === 0) return null;

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 shadow-sm space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-blue-600" />
        <h4 className="font-bold text-sm text-slate-900 dark:text-white">طرق الدفع المتاحة</h4>
      </div>
      <p className="text-[10px] text-slate-400 font-bold">رسوم الفعالية: <span className="text-blue-600">{price} ج.م</span></p>
      <p className="text-[9px] text-slate-500">اختر وسيلة الدفع ثم قم بالتحويل على الرقم الظاهر:</p>
      <div className="space-y-2">
        {methods.map(m => {
          const isSelected = selectedMethod === m.id;
          const TypeIcon = TYPE_OPTIONS.find(o => o.value === m.type)?.icon || Smartphone;
          return (
            <div key={m.id}
              onClick={() => setSelectedMethod(m.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-slate-300'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <TypeIcon size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white">{m.name}</p>
                    <p className="text-[11px] text-slate-500 font-bold" dir="ltr">{m.phone_number}</p>
                  </div>
                </div>
                {isSelected && <Check size={20} className="text-blue-600" />}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={handlePay} disabled={!selectedMethod || submitting}
        className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50">
        {submitting ? 'جاري الإرسال...' : `تأكيد الدفع (${price} ج.م)`}
      </button>
    </div>
  );
}
