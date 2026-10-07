import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../../hooks/useMounted';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Mail, Shield, Home, Phone, Building, MapPin,
  PhoneCall, MessageCircle, Clock, X, AlertTriangle, Star, AlertCircle
} from 'lucide-react';
import { RoleBadge, AvatarUpload, InfoRow, SectionCard, SaveButton, PhoneInput } from './ProfileShared';

export function ParentProfile() {
  const { user } = useAuth();
  const { request } = useApi();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [childReports, setChildReports] = useState<Record<string, any>>({});
  const [supervisorContacts, setSupervisorContacts] = useState<Record<string, any>>({});
  const [showContactModal, setShowContactModal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  

  const fetchProfile = useCallback(async () => {
    try {
      const res = await request('/api/users/profile');
      if (!mounted.current) return;
      setProfile(res.data);
      setPhone(res.data?.user?.phone || '');
      setPhotoUrl(res.data?.user?.photo_url || '');
      const children = res.data?.children || [];
      if (children.length > 0 && !selectedChild) {
        setSelectedChild(children[0].id);
      }
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      if (mounted.current) setError(e.message || 'فشل تحميل البيانات');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request, selectedChild]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    const children = profile?.children || [];
    children.forEach(async (child: any) => {
      try {
        const [cr, sc] = await Promise.all([
          request(`/api/parents/child/${child.id}/report`),
          request(`/api/supervisor/${child.tenant_id}/contact`).catch(() => null),
        ]);
        if (!mounted.current) return;
        setChildReports(prev => ({ ...prev, [child.id]: cr }));
        if (sc) setSupervisorContacts(prev => ({ ...prev, [child.tenant_id]: sc }));
      } catch {}
    });
  }, [profile, request]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await request('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ phone, photo_url: photoUrl }),
      });
      fetchProfile();
    } catch (e: any) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay message={error} onRetry={fetchProfile} />;

  const children = profile?.children || [];
  const activeChild = children.find((c: any) => c.id === selectedChild);
  const activeReport = activeChild ? childReports[activeChild.id] : null;
  const activeContact = activeChild ? supervisorContacts[activeChild.tenant_id] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="bg-white dark:bg-card-dark rounded-xl p-8 border border-slate-100 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <AvatarUpload currentUrl={photoUrl} name={user?.name || ''} onSave={setPhotoUrl} />
          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{user?.name}</h1>
              <RoleBadge role="parent" />
            </div>
            <p className="text-sm text-slate-500 font-bold mb-4">{user?.email}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <InfoRow icon={<Mail size={14} />} label="البريد" value={user?.email || '---'} />
              <InfoRow icon={<Shield size={14} />} label="المعرف" value={`#${user?.id?.substring(0, 8).toUpperCase() || ''}`} />
            </div>
          </div>
        </div>
      </div>

      <PhoneInput phone={phone} onChange={setPhone} />

      <SectionCard title="الأبناء" icon={<Users size={16} />}>
        {children.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {children.map((c: any) => (
                <button key={c.id} onClick={() => setSelectedChild(c.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    selectedChild === c.id
                      ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-slate-300'
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>

            {activeChild && (
              <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-sm text-indigo-800 dark:text-indigo-300">{activeChild.name}</p>
                    <p className="text-[10px] text-indigo-500">المعرف: {activeChild.id?.substring(0, 8)}</p>
                  </div>
                </div>
                {activeChild.tenant_name && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    <InfoRow icon={<Home size={14} />} label="السكن" value={activeChild.tenant_name} />
                    <InfoRow icon={<Building size={14} />} label="الشقة" value={activeChild.apartment_name || '---'} />
                    <InfoRow icon={<MapPin size={14} />} label="الغرفة" value={activeChild.room_number || '---'} />
                  </div>
                )}
              </div>
            )}

            {activeReport && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ChildStat value={activeReport.attendanceCount || 0} label="حضور" color="blue" />
                <ChildStat value={activeReport.totalPoints || 0} label="نقاط" color="emerald" />
                <ChildStat value={activeReport.activeWarnings || 0} label="إنذارات" color={activeReport.activeWarnings > 0 ? 'red' : 'emerald'} />
                <ChildStat value={`${activeReport.remainingBalance || 0} ج`} label="المتبقي" color={activeReport.remainingBalance > 0 ? 'amber' : 'emerald'} />
              </div>
            )}

            {activeContact && (
              <button onClick={() => setShowContactModal(activeChild.tenant_id)}
                className="w-full py-3 px-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                <Phone size={14} /> الاتصال بالمشرف
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-bold text-center py-4">لا يوجد أبناء مسجلين</p>
        )}
      </SectionCard>

      {activeChild?.recent_warnings?.length > 0 && (
        <SectionCard title="إنذارات غير مقروءة" icon={<AlertTriangle size={16} className="text-red-500" />}>
          {activeChild.recent_warnings.map((w: any) => (
            <div key={w.id} className="p-3 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10 mb-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{w.reason}</p>
              <p className="text-[9px] text-red-400 mt-1">{new Date(w.created_at).toLocaleDateString('ar-EG')}</p>
            </div>
          ))}
        </SectionCard>
      )}

      <SaveButton onClick={saveProfile} saving={saving} />

      {/* نافذة الاتصال بالمشرف */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowContactModal(null)}>
          <div className="bg-white dark:bg-card-dark rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm text-slate-900 dark:text-white">معلومات التواصل مع المشرف</h3>
              <button onClick={() => setShowContactModal(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>

            {activeContact?.name && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400">
                  {activeContact.name[0]}
                </div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">{activeContact.name}</p>
              </div>
            )}

            <div className="space-y-3">
              {(activeContact?.phone_numbers || []).filter((p: any) => p.number).map((p: any) => (
                <div key={p.id} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300" dir="ltr">{p.number}</p>
                    {p.label && <span className="text-[9px] text-slate-400">{p.label}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {p.isForCalls && (
                      <a href={`tel:${p.number}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:bg-blue-100 transition-colors">
                        <PhoneCall size={12} /> اتصال
                      </a>
                    )}
                    {p.isForWhatsApp && (
                      <a href={`https://wa.me/${p.number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold hover:bg-green-100 transition-colors">
                        <MessageCircle size={12} /> واتساب
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {(activeContact?.available_from || activeContact?.available_to) && (
              <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-blue-500" />
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">مواعيد الاتصال المتاحة</span>
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {activeContact.available_from} - {activeContact.available_to}
                </p>
                {activeContact?.available_days && (
                  <p className="text-[10px] text-slate-400 mt-1">{activeContact.available_days}</p>
                )}
              </div>
            )}

            {(!activeContact?.phone_numbers || activeContact.phone_numbers.filter((p: any) => p.number).length === 0) && (
              <p className="text-xs text-slate-400 font-bold text-center py-4">لم يقم المشرف بإضافة أرقام تواصل بعد</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChildStat({ value, label, color }: { value: number | string; label: string; color: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className={`p-3 rounded-xl text-center ${c[color] || c.blue}`}>
      <p className="text-lg font-black">{value}</p>
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
