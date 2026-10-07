import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../../hooks/useMounted';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { Building, Users, Mail, Shield, Church, FileText, AlertCircle } from 'lucide-react';
import { RoleBadge, AvatarUpload, InfoRow, SectionCard, SaveButton, PhoneInput } from './ProfileShared';

export function PriestProfile() {
  const { user } = useAuth();
  const { request } = useApi();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  

  const fetchProfile = useCallback(async () => {
    try {
      const [profRes, statsRes] = await Promise.all([
        request('/api/users/profile'),
        request('/api/dashboard/priest/stats'),
      ]);
      if (!mounted.current) return;
      setProfile(profRes.data);
      setStats(statsRes);
      setPhone(profRes.data?.user?.phone || '');
      setPhotoUrl(profRes.data?.user?.photo_url || '');
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
      fetchProfile();
    } catch (e: any) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay message={error} onRetry={fetchProfile} />;

  const tenants = profile?.tenants || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="bg-white dark:bg-card-dark rounded-xl p-8 border border-slate-100 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <AvatarUpload currentUrl={photoUrl} name={user?.name || ''} onSave={setPhotoUrl} />
          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{user?.name}</h1>
              <RoleBadge role="priest" />
            </div>
            <p className="text-sm text-slate-500 font-bold mb-4">{user?.email}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <InfoRow icon={<Mail size={14} />} label="البريد" value={user?.email || '---'} />
              <InfoRow icon={<Shield size={14} />} label="المعرف" value={`#${user?.id?.substring(0, 8).toUpperCase() || ''}`} />
              <InfoRow icon={<Building size={14} />} label="السكنات" value={`${tenants.length}`} />
            </div>
          </div>
        </div>
      </div>

      <PhoneInput phone={phone} onChange={setPhone} />

      <SectionCard title="السكنات المسؤول عنها" icon={<Church size={16} />}>
        {tenants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tenants.map((t: any) => (
              <div key={t.id} className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20">
                <p className="font-bold text-sm text-blue-800 dark:text-blue-300">{t.name}</p>
                {t.address && <p className="text-[10px] text-blue-500 mt-1">{t.address}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-bold text-center py-4">لا توجد سكنات مسندة إليك</p>
        )}
      </SectionCard>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MiniStat value={stats.studentsCount || 0} label="طالب" color="blue" />
          <MiniStat value={stats.vacantBeds || 0} label="أسرة خالية" color="emerald" />
          <MiniStat value={stats.warningsCount || 0} label="إنذار نشط" color="red" />
          <MiniStat value={stats.reportsCount || 0} label="تقرير معلق" color="amber" />
        </div>
      )}

      <SectionCard title="الصلاحية" icon={<FileText size={16} />}>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20">
          <FileText size={18} className="text-blue-500 shrink-0" />
          <p className="text-xs font-bold text-blue-800 dark:text-blue-300">
            نطاق صلاحيتك يقتصر على السكنات المسندة إليك. يمكنك متابعة الطلاب وإرسال تقارير للأسقف.
          </p>
        </div>
      </SectionCard>

      <SaveButton onClick={saveProfile} saving={saving} />
    </div>
  );
}

function MiniStat({ value, label, color }: { value: number; label: string; color: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  };
  return (
    <div className={`p-4 rounded-xl text-center border ${c[color] || c.blue}`}>
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
