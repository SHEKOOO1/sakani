import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { AppPermission } from '../types/permissions';
import { Wrench, Sparkles } from 'lucide-react';

import { MessagesSection } from './MessagesSection';
import { DailyReadingsCard } from './DailyReadingsCard';

export function EmployeeDashboard({ onNavigate }: any) {
  const { request } = useApi();
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  const fetchData = useCallback(() => {
    setLoading(true);
    request('/api/dashboard/employee-summary')
      .then(res => { if (mounted.current) setStats(res.data); })
      .catch(e => { console.error('Employee summary failed:', e); if (mounted.current) setError('فشل تحميل البيانات'); })
      .finally(() => { if (mounted.current) setLoading(false); });
  }, [request]);

  useEffect(() => {

    fetchData();
    
  }, [fetchData]);

  if (error) return <div className="p-10 text-center text-rose-500 font-bold">{error}</div>;

  return (
    <div className="space-y-6" dir="rtl">

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-ocean-600 via-ocean-500 to-ocean-700 p-8 text-white shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black">مرحباً بك في ورديتك!</h1>
              <p className="text-white/70 font-bold text-sm">
                {loading ? (
                  <span className="inline-block h-4 w-48 bg-white/20 rounded-lg animate-pulse" />
                ) : (
                  <>لديك {stats?.activeTasks ?? 0} بلاغات صيانة قيد العمل حالياً.</>
                )}
              </p>
            </div>
          </div>
        </div>
        <Wrench className="absolute -left-10 -top-10 text-white/5 w-48 h-48 rotate-12" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasPermission(AppPermission.VIEW_MAINTENANCE) && (
          <button onClick={() => onNavigate?.('maintenance')} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-white/[0.04] dark:bg-card-dark flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-warm-50 text-warm-600 dark:bg-warm-500/20 dark:text-warm-400">
              <Wrench size={32} />
            </div>
            <div className="text-right">
              <h3 className="text-xl font-black text-slate-800 dark:text-white">بلاغات الصيانة</h3>
              <p className="text-sm text-slate-400 dark:text-slate-300 font-bold">ابدأ العمل على البلاغات المسندة إليك</p>
            </div>
          </button>
        )}
      </div>

      <DailyReadingsCard />
      <MessagesSection />
    </div>
  );
}
