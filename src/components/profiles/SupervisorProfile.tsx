import React, { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../../hooks/useMounted';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import {
  Home, Users, Mail, Shield, Phone, Clock, MessageCircle, PhoneCall,
  ChevronDown, ChevronUp, Plus, X, Building, BedDouble, DollarSign, Calendar,
  AlertCircle
} from 'lucide-react';
import { RoleBadge, AvatarUpload, InfoRow, SectionCard, SaveButton, PhoneInput } from './ProfileShared';

const DAYS = [
  { key: 'sun', label: 'الأحد' },
  { key: 'mon', label: 'الإثنين' },
  { key: 'tue', label: 'الثلاثاء' },
  { key: 'wed', label: 'الأربعاء' },
  { key: 'thu', label: 'الخميس' },
  { key: 'fri', label: 'الجمعة' },
  { key: 'sat', label: 'السبت' },
];

export function SupervisorProfile() {
  const { user } = useAuth();
  const { request } = useApi();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  

  const fetchProfile = useCallback(async () => {
    try {
      const [profRes, dashRes] = await Promise.all([
        request('/api/users/profile'),
        request('/api/dashboard/supervisor-summary'),
      ]);
      if (!mounted.current) return;
      const data = profRes.data;
      setProfile(data);
      setPhone(data?.user?.phone || '');
      setPhotoUrl(data?.user?.photo_url || '');
      setDashboardSummary(dashRes);
      if (data?.contactSettings) {
        setPhoneNumbers(data.contactSettings.phone_numbers || []);
        setAvailableFrom(data.contactSettings.available_from || '');
        setAvailableTo(data.contactSettings.available_to || '');
        setAvailableDays(data.contactSettings.available_days ? data.contactSettings.available_days.split(',').filter(Boolean) : []);
      }
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      if (mounted.current) setError(e.message || 'فشل تحميل البيانات');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await request('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ phone, photo_url: photoUrl }),
      });
      await request('/api/supervisor/contacts', {
        method: 'PUT',
        body: JSON.stringify({
          phone_numbers: phoneNumbers.filter((p: any) => p.number.trim()),
          available_from: availableFrom || null,
          available_to: availableTo || null,
          available_days: availableDays.length > 0 ? availableDays.join(',') : null,
        }),
      });
      fetchProfile();
    } catch (e: any) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const addPhone = () => setPhoneNumbers((prev: any[]) => [...prev, { id: Date.now().toString(), number: '', label: '', isForCalls: true, isForWhatsApp: false }]);
  const removePhone = (id: string) => setPhoneNumbers((prev: any[]) => prev.filter(p => p.id !== id));
  const updatePhone = (id: string, field: string, value: any) => setPhoneNumbers((prev: any[]) => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  const toggleDay = (day: string) => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay message={error} onRetry={fetchProfile} />;

  const tenant = profile?.tenant;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="bg-white dark:bg-card-dark rounded-xl p-8 border border-slate-100 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <AvatarUpload currentUrl={photoUrl} name={user?.name || ''} onSave={setPhotoUrl} />
          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{user?.name}</h1>
              <RoleBadge role="supervisor" />
            </div>
            <p className="text-sm text-slate-500 font-bold mb-4">{user?.email}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <InfoRow icon={<Mail size={14} />} label="البريد" value={user?.email || '---'} />
              <InfoRow icon={<Shield size={14} />} label="المعرف" value={`#${user?.id?.substring(0, 8).toUpperCase() || ''}`} />
              <InfoRow icon={<Home size={14} />} label="السكن" value={tenant?.name || '---'} />
            </div>
          </div>
        </div>
      </div>

      <PhoneInput phone={phone} onChange={setPhone} />

      {dashboardSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MiniStat value={dashboardSummary.totalStudents || 0} label="طالب" color="blue" icon={<Users size={14} />} />
          <MiniStat value={dashboardSummary.totalApartments || 0} label="شقة" color="emerald" icon={<Building size={14} />} />
          <MiniStat value={dashboardSummary.occupancyRate || '0'} label="إشغال %" color="purple" icon={<BedDouble size={14} />} />
          <MiniStat value={dashboardSummary.todayAttendance || 0} label="حضور اليوم" color="amber" icon={<Calendar size={14} />} />
        </div>
      )}

      <SectionCard title="السكن" icon={<Home size={16} />}>
        {tenant ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20">
            <p className="font-bold text-lg text-emerald-800 dark:text-emerald-300">{tenant.name}</p>
            {tenant.address && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{tenant.address}</p>}
            {tenant.phone && <p className="text-[10px] text-emerald-500 mt-1">هاتف السكن: {tenant.phone}</p>}
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-bold text-center py-4">لا يوجد سكن مسند إليك</p>
        )}
      </SectionCard>

      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
        <button onClick={() => setShowContactForm(!showContactForm)}
          className="w-full flex items-center justify-between p-8 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
              <PhoneCall size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-right">
              <p className="font-black text-sm text-slate-900 dark:text-white">وسائل التواصل مع أولياء الأمور</p>
              <p className="text-[10px] text-slate-400 font-bold">أرقام الهاتف، واتساب، مواعيد الاتصال المتاحة</p>
            </div>
          </div>
          {showContactForm ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>

        {showContactForm && (
          <div className="px-8 pb-8 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">أرقام الهاتف</h4>
                <button onClick={addPhone}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-bold hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors">
                  <Plus size={12} /> إضافة رقم
                </button>
              </div>
              {phoneNumbers.length === 0 && (
                <p className="text-[10px] text-slate-400 font-bold text-center py-4">لا توجد أرقام. أضف رقم هاتف للتواصل مع أولياء الأمور.</p>
              )}
              <div className="space-y-3">
                {phoneNumbers.map((p: any) => (
                  <div key={p.id} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <input value={p.label} onChange={e => updatePhone(p.id, 'label', e.target.value)}
                        className="w-32 px-2 py-1 rounded-lg bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        placeholder="تسمية (رئيسي، احتياطي)" />
                      <button onClick={() => removePhone(p.id)}
                        className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <input value={p.number} onChange={e => updatePhone(p.id, 'number', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 mb-2"
                      placeholder="رقم الهاتف (مع مفتاح الدولة)" />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={p.isForCalls}
                          onChange={e => updatePhone(p.id, 'isForCalls', e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <PhoneCall size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">اتصال</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={p.isForWhatsApp}
                          onChange={e => updatePhone(p.id, 'isForWhatsApp', e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-green-600 focus:ring-green-500" />
                        <MessageCircle size={12} className="text-green-500" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">واتساب</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Clock size={14} /> مواعيد الاتصال المتاحة
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-3 max-w-sm">
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
          </div>
        )}
      </div>

      <SaveButton onClick={saveProfile} saving={saving} />
    </div>
  );
}

function MiniStat({ value, label, color, icon }: { value: number | string; label: string; color: string; icon: React.ReactNode }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  };
  return (
    <div className={`p-4 rounded-xl text-center border ${c[color] || c.blue}`}>
      <div className="flex justify-center mb-1 opacity-60">{icon}</div>
      <p className="text-xl font-black">{value}</p>
      <p className="text-[9px] font-bold opacity-70">{label}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
    </div>
  );
}

function ErrorDisplay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="rtl">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
        <AlertCircle size={28} className="text-red-500" />
      </div>
      <p className="text-sm font-bold text-slate-600 dark:text-slate-400 text-center max-w-xs">{message}</p>
      <button onClick={onRetry}
        className="px-6 py-3 rounded-xl bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-bold text-xs hover:brightness-110 transition-all shadow-lg shadow-primary-500/20 active:scale-95">
        إعادة المحاولة
      </button>
    </div>
  );
}
