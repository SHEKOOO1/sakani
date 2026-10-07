import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../../hooks/useMounted';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { Church, Users, Home, BookOpen, Mail, Shield, MapPin, AlertCircle } from 'lucide-react';
import { RoleBadge, AvatarUpload, InfoRow, SectionCard, PermissionsCard, SaveButton, PhoneInput } from './ProfileShared';

export function BishopProfile() {
  const { user } = useAuth();
  const { request } = useApi();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
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
  const priests = profile?.priests || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="bg-white dark:bg-card-dark rounded-xl p-8 border border-slate-100 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <AvatarUpload currentUrl={photoUrl} name={user?.name || ''} onSave={setPhotoUrl} />
          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{user?.name}</h1>
              <RoleBadge role="bishop" />
            </div>
            <p className="text-sm text-slate-500 font-bold mb-4">{user?.email}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <InfoRow icon={<Mail size={14} />} label="البريد" value={user?.email || '---'} />
              <InfoRow icon={<Shield size={14} />} label="المعرف" value={`#${user?.id?.substring(0, 8).toUpperCase() || ''}`} />
              <InfoRow icon={<Church size={14} />} label="السكنات" value={`${tenants.length}`} />
            </div>
          </div>
        </div>
      </div>

      <PhoneInput phone={phone} onChange={setPhone} />

      <SectionCard title="السكنات التابعة للأبراشية" icon={<Church size={16} />}>
        {tenants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tenants.map((t: any) => (
              <div key={t.id} className="p-4 rounded-xl bg-purple-50 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20">
                <p className="font-bold text-sm text-purple-800 dark:text-purple-300">{t.name}</p>
                {t.address && <p className="text-[10px] text-purple-500 mt-1">{t.address}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-bold text-center py-4">لا توجد سكنات مسجلة</p>
        )}
      </SectionCard>

      {priests.length > 0 && (
        <SectionCard title="الكهنة" icon={<BookOpen size={16} />}>
          <div className="space-y-2">
            {priests.map((p: any) => (
              <div key={p.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-xs">
                  {p.name?.[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.name}</p>
                  <p className="text-[9px] text-slate-400">{p.email || p.phone || '---'}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="الصلاحية" icon={<MapPin size={16} />}>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
          <MapPin size={18} className="text-amber-500 shrink-0" />
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
            نطاق صلاحيتك يقتصر على أبرشيتك فقط. يمكنك رؤية وإدارة السكنات والكهنة التابعين لك.
          </p>
        </div>
      </SectionCard>

      <PermissionsCard role="bishop" />
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
