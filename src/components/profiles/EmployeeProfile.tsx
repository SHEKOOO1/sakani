import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../../hooks/useMounted';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Mail, Shield, Wrench, Calendar, AlertCircle } from 'lucide-react';
import { RoleBadge, AvatarUpload, InfoRow, SectionCard, SaveButton, PhoneInput } from './ProfileShared';

export function EmployeeProfile() {
  const { user } = useAuth();
  const { request } = useApi();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [taskCount, setTaskCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  

  const fetchProfile = useCallback(async () => {
    try {
      const res = await request('/api/users/profile');
      if (!mounted.current) return;
      setProfile(res.data);
      setPhone(res.data?.user?.phone || '');
      setPhotoUrl(res.data?.user?.photo_url || '');
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      if (mounted.current) setError(e.message || 'فشل تحميل البيانات');
    } finally {
      if (mounted.current) setLoading(false);
    }
    try {
      const dash = await request('/api/dashboard/employee-summary');
      if (mounted.current) setTaskCount(dash?.pendingTasks || 0);
    } catch (e: any) {
      console.error('Employee summary error:', e);
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

  const tenant = profile?.tenant;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="bg-white dark:bg-card-dark rounded-xl p-8 border border-slate-100 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <AvatarUpload currentUrl={photoUrl} name={user?.name || ''} onSave={setPhotoUrl} />
          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{user?.name}</h1>
              <RoleBadge role="employee" />
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

      <SectionCard title="نظرة سريعة" icon={<Calendar size={16} />}>
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex-1 text-center">
            <Wrench size={20} className="mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{taskCount}</p>
            <p className="text-[10px] font-bold text-amber-500">مهمة صيانة معلقة</p>
          </div>
        </div>
      </SectionCard>

      {tenant && (
        <SectionCard title="السكن" icon={<Home size={16} />}>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
            <p className="font-bold text-sm text-amber-800 dark:text-amber-300">{tenant.name}</p>
            {tenant.address && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{tenant.address}</p>}
          </div>
        </SectionCard>
      )}

      <SaveButton onClick={saveProfile} saving={saving} />
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
