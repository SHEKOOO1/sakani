import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../../hooks/useMounted';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { Building, Users, BookOpen, DollarSign, Shield, Activity, Globe, Server, Mail, AlertCircle } from 'lucide-react';
import { RoleBadge, AvatarUpload, InfoRow, SectionCard, PermissionsCard, SaveButton, PhoneInput } from './ProfileShared';

export function AdminProfile() {
  const { user } = useAuth();
  const { request } = useApi();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
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
      const logs = await request('/api/audit?limit=5');
      if (mounted.current) setRecentActivity(logs?.data || []);
    } catch (e: any) {
      console.error('Audit fetch error:', e);
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
    } catch {} finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay message={error} onRetry={fetchProfile} />;

  const stats = profile?.stats || { tenants: 0, users: 0, students: 0 };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="bg-white dark:bg-card-dark rounded-xl p-8 border border-slate-100 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <AvatarUpload currentUrl={photoUrl} name={user?.name || ''} onSave={setPhotoUrl} />
          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{user?.name}</h1>
              <RoleBadge role="admin" />
            </div>
            <p className="text-sm text-slate-500 font-bold mb-4">{user?.email}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <InfoRow icon={<Mail size={14} />} label="البريد" value={user?.email || '---'} />
              <InfoRow icon={<Shield size={14} />} label="المعرف" value={`#${user?.id?.substring(0, 8).toUpperCase() || ''}`} />
              <InfoRow icon={<Globe size={14} />} label="الصلاحية" value="النظام بالكامل" />
            </div>
          </div>
        </div>
      </div>

      <PhoneInput phone={phone} onChange={setPhone} />

      <SectionCard title="إحصائيات النظام" icon={<Server size={16} />}>
        <div className="grid grid-cols-3 gap-4">
          <StatCard value={stats.tenants} label="سكن" color="red" />
          <StatCard value={stats.users} label="مستخدم" color="blue" />
          <StatCard value={stats.students} label="طالب" color="emerald" />
        </div>
      </SectionCard>

      {recentActivity.length > 0 && (
        <SectionCard title="آخر النشاطات" icon={<Activity size={16} />}>
          <div className="space-y-3">
            {recentActivity.map((log: any, i: number) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800 dark:text-white">{log.actorName || log.userEmail || 'غير معروف'}</span>
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-slate-200 dark:bg-white/10 text-slate-500">
                      {log.userRole === 'admin' ? 'مدير تطبيق' : 
                       log.userRole === 'bishop' ? 'أسقف' :
                       log.userRole === 'priest' ? 'كاهن' :
                       log.userRole === 'supervisor' ? 'مشرف' :
                       log.userRole === 'employee' ? 'موظف' :
                       log.userRole === 'student' ? 'طالب' :
                       log.userRole === 'parent' ? 'ولي أمر' : log.userRole}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">{new Date(log.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{log.action}</p>
                <div className="flex flex-wrap gap-2">
                  {log.tenantName && (
                    <span className="text-[9px] px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                      السكن: {log.tenantName}
                    </span>
                  )}
                  {log.bishopName && (
                    <span className="text-[9px] px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                      تحت رعاية: {log.bishopName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <PermissionsCard role="admin" />
      <SaveButton onClick={saveProfile} saving={saving} />
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };
  return (
    <div className={`p-4 rounded-xl text-center ${colorMap[color] || colorMap.blue}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[10px] font-bold opacity-70">{label}</p>
    </div>
  );
}

function LoadingSpinner() {
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
