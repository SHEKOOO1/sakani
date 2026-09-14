import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { Building2, Users, ShieldCheck, Globe, UserCheck, Sparkles } from 'lucide-react';
import { MessagesSection } from './MessagesSection';
import { DashboardSkeleton } from './Skeleton';
import { DailyReadingsCard } from './DailyReadingsCard';

export function AdminDashboard() {
  const { request } = useApi();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  const fetchData = useCallback(() => {
    request('/api/dashboard/admin-summary')
      .then(res => { if (mounted.current) setStats(res.data); })
      .catch(e => { console.error('Admin summary failed:', e); if (mounted.current) setError('فشل تحميل بيانات لوحة التحكم'); })
      .finally(() => { if (mounted.current) setLoading(false); });
  }, [request]);

  useEffect(() => {

    fetchData();
    
  }, [fetchData]);

  if (error) return <div className="p-10 text-center text-rose-500 font-bold">{error}</div>;
  if (loading) return <div className="p-8"><DashboardSkeleton /></div>;

  const g = stats?.genderBreakdown || {};
  const totalUsers = stats?.totalUsers || 0;

  return (
    <div className="space-y-6" dir="rtl">

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-4 sm:p-8 text-white shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles size={24} />
            </div>
            <h1 className="text-2xl font-black">لوحة تحكم مدير التطبيق</h1>
          </div>
          <p className="text-white/70 font-bold text-sm">إشراف عام على {stats?.tenantsCount} سكنات و {totalUsers} مستخدم.</p>
        </div>
        <Globe className="absolute -left-10 -top-10 text-white/5 w-48 h-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي المستخدمين" value={totalUsers} icon={<Users />} color="primary" />
        <StatCard label="عدد السكنات" value={stats?.tenantsCount} icon={<Building2 />} color="vibrant" />
        <StatCard label="الأساقفة" value={stats?.bishopsCount} icon={<ShieldCheck />} color="warm" />
        <StatCard label="الكهنة" value={stats?.priestsCount} icon={<UserCheck />} color="ocean" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RoleCard title="الطلاب" male={g.maleStudents || 0} female={g.femaleStudents || 0} total={stats?.studentsCount || 0} color="primary" />
        <RoleCard title="المشرفين" male={g.maleSupervisors || 0} female={g.femaleSupervisors || 0} total={stats?.supervisorsCount || 0} color="ocean" />
        <RoleCard title="الموظفين" male={g.maleEmployees || 0} female={g.femaleEmployees || 0} total={stats?.employeesCount || 0} color="warm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="أولياء الأمور" value={stats?.parentsCount || 0} icon={<Users />} color="rose" />
      </div>

      {stats?.colleges && stats.colleges.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-card-dark dark:border-white/[0.04] border border-slate-100">
          <h3 className="mb-4 text-lg font-black text-slate-800 dark:text-white">توزيع الطلاب حسب الكلية</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {stats.colleges.slice(0, 18).map((c: any) => (
              <div key={c.name} className="rounded-xl bg-primary-50 p-4 text-center dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20">
                <p className="text-lg font-black text-primary-700 dark:text-primary-300">{c.count}</p>
                <p className="mt-1 truncate text-[10px] font-bold text-primary-500/70 dark:text-primary-400">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <DailyReadingsCard />
      <MessagesSection />
    </div>
  );
}

function StatCard({ label, value, icon, color }: any) {
  const colors: any = {
    primary: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    vibrant: 'bg-vibrant-50 dark:bg-vibrant-500/20 text-vibrant-600 dark:text-vibrant-400',
    warm: 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400',
    ocean: 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400',
    rose: 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-white/[0.04] dark:bg-card-dark">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${colors[color] || colors.primary}`}>{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-300">{label}</p>
      <h3 className="mt-0.5 text-3xl font-black text-slate-800 dark:text-white">{value}</h3>
    </div>
  );
}

function RoleCard({ title, male, female, total, color }: { title: string; male: number; female: number; total: number; color: string }) {
  const colors: any = {
    primary: { bg: 'bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30', dot: 'bg-primary-500' },
    ocean: { bg: 'bg-ocean-50 dark:bg-ocean-500/10 border-ocean-200 dark:border-ocean-500/30', dot: 'bg-ocean-500' },
    warm: { bg: 'bg-warm-50 dark:bg-warm-500/10 border-warm-200 dark:border-warm-500/30', dot: 'bg-warm-500' },
  };
  const c = colors[color] || colors.primary;
  return (
    <div className={`rounded-xl border p-6 shadow-sm ${c.bg}`}>
      <h4 className="mb-4 text-lg font-black text-slate-800 dark:text-white">{title}</h4>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-300">الإجمالي</span>
        <span className="text-2xl font-black text-slate-800 dark:text-white">{total}</span>
      </div>
      <div className="space-y-2 border-t border-slate-200/50 pt-3 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${c.dot}`} />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-300">ذكور</span>
          </div>
          <span className="text-sm font-black text-primary-600 dark:text-primary-400">{male}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rose-400" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-300">إناث</span>
          </div>
          <span className="text-sm font-black text-rose-500 dark:text-rose-400">{female}</span>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/50 dark:bg-white/10">
        <div className={`h-full rounded-full ${c.dot}`} style={{ width: `${total > 0 ? (male / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
