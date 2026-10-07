import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useSnackbar } from '../contexts/SnackbarContext';
import { Phone, MessageCircle, Clock, Plus, X, Save, ChevronDown, ChevronUp, Sun, Moon } from 'lucide-react';

const DAYS = [
  { key: 'sun', label: 'الأحد' },
  { key: 'mon', label: 'الإثنين' },
  { key: 'tue', label: 'الثلاثاء' },
  { key: 'wed', label: 'الأربعاء' },
  { key: 'thu', label: 'الخميس' },
  { key: 'fri', label: 'الجمعة' },
  { key: 'sat', label: 'السبت' },
];

interface PhoneEntry {
  id: string;
  number: string;
  label: string;
  isForCalls: boolean;
  isForWhatsApp: boolean;
}

export function SupervisorContactSettings() {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneEntry[]>([]);
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const mounted = useMounted();

  

  const loadContacts = useCallback(async () => {
    try {
      const res = await request('/api/supervisor/contacts');
      if (!mounted.current) return;
      if (res.data) {
        setPhoneNumbers(res.data.phone_numbers || []);
        setAvailableFrom(res.data.available_from || '');
        setAvailableTo(res.data.available_to || '');
        setAvailableDays(res.data.available_days ? res.data.available_days.split(',').filter(Boolean) : []);
      }
    } catch (e) { console.error('Load contacts failed:', e); showSnackbar('فشل تحميل بيانات الاتصال', 'error'); } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const addPhone = () => {
    setPhoneNumbers(prev => [...prev, {
      id: Date.now().toString(),
      number: '',
      label: '',
      isForCalls: true,
      isForWhatsApp: false,
    }]);
  };

  const removePhone = (id: string) => {
    setPhoneNumbers(prev => prev.filter(p => p.id !== id));
  };

  const updatePhone = (id: string, field: keyof PhoneEntry, value: any) => {
    setPhoneNumbers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const toggleDay = (day: string) => {
    setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await request('/api/supervisor/contacts', {
        method: 'PUT',
        body: JSON.stringify({
          phone_numbers: phoneNumbers.filter(p => p.number.trim()),
          available_from: availableFrom || null,
          available_to: availableTo || null,
          available_days: availableDays.length > 0 ? availableDays.join(',') : null,
        }),
      });
      setSaved(true);
      showSnackbar('تم حفظ بيانات الاتصال', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error('Save contacts failed:', e); showSnackbar('فشل حفظ بيانات الاتصال', 'error'); } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white dark:bg-card-dark rounded-[2rem] border border-slate-200 dark:border-white/10 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
            <Phone size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-right">
            <p className="font-black text-sm text-slate-900 dark:text-white">إعدادات التواصل</p>
            <p className="text-[10px] text-slate-400 font-bold">أرقام الهاتف، واتساب، مواعيد الاتصال</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-6">
          {/* أرقام الهاتف */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">أرقام الهاتف</h4>
              <button onClick={addPhone}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                <Plus size={12} /> إضافة رقم
              </button>
            </div>

            {phoneNumbers.length === 0 && (
              <p className="text-[10px] text-slate-400 font-bold text-center py-4">لا توجد أرقام. أضف رقم هاتف للتواصل مع أولياء الأمور.</p>
            )}

            <div className="space-y-3">
              {phoneNumbers.map((phone) => (
                <div key={phone.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <input value={phone.label} onChange={e => updatePhone(phone.id, 'label', e.target.value)}
                      className="w-32 px-2 py-1 rounded-lg bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      placeholder="تسمية (رئيسي، احتياطي)" />
                    <button onClick={() => removePhone(phone.id)}
                      className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  <input value={phone.number} onChange={e => updatePhone(phone.id, 'number', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 mb-2"
                    placeholder="رقم الهاتف (مع مفتاح الدولة)" />
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={phone.isForCalls}
                        onChange={e => updatePhone(phone.id, 'isForCalls', e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <Phone size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">اتصال</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={phone.isForWhatsApp}
                        onChange={e => updatePhone(phone.id, 'isForWhatsApp', e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <MessageCircle size={12} className="text-green-500" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">واتساب</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* مواعيد الاتصال */}
          <div>
            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Clock size={14} /> مواعيد الاتصال المتاحة
            </h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">من</label>
                <input type="time" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">إلى</label>
                <input type="time" value={availableTo} onChange={e => setAvailableTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(day => {
                const isSelected = availableDays.includes(day.key);
                return (
                  <button key={day.key} onClick={() => toggleDay(day.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/10 hover:border-slate-300'
                    }`}>
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* حفظ */}
          <button onClick={handleSave} disabled={saving}
            className={`w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
            {saved ? (
              <>تم الحفظ ✓</>
            ) : saving ? (
              <>جاري الحفظ...</>
            ) : (
              <><Save size={16} /> حفظ الإعدادات</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
