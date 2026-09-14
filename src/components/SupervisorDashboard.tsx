import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useSnackbar } from '../contexts/SnackbarContext';
import { DailyReadingsCard } from './DailyReadingsCard';
import {
  Users, MapPin, Wrench, Waves, Activity, TrendingUp, TrendingDown, Wallet,
  Home, Clock, Calendar, FileText, ShieldAlert, Plane, Star, GraduationCap,
  Building, UserCheck, Sparkles,
} from 'lucide-react';
import { SupervisorContactSettings } from './SupervisorContactSettings';
import { QuickActionCard, AlertBadge, StatusDot, StatusBadge, DecisionIcon } from './supervisor/DashboardHelpers';

export function SupervisorDashboard({ onNavigate }: any) {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    request('/api/dashboard/supervisor-summary')
      .then(r => { setStats(r.data); })
      .catch(e => {
        console.error('Supervisor summary failed:', e);
        setError(e?.message || 'حدث خطأ في تحميل البيانات');
      })
      .finally(() => setLoading(false));
  }, [request]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <div className="p-10 flex items-center justify-center"><div className="animate-pulse text-slate-400 dark:text-slate-300 text-center"><div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" /><p>جاري تحميل بيانات السكن...</p></div></div>;

  if (error) return (
    <div className="p-10 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
          <ShieldAlert size={32} className="text-rose-500" />
        </div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">تعذر تحميل البيانات</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error}</p>
        <button onClick={fetchData} className="neon-btn neon-btn-primary px-6 py-3 text-sm font-black rounded-xl">إعادة المحاولة</button>
      </div>
    </div>
  );

  const netProfit = (stats?.totalIncome || 0) - (stats?.totalExpenses || 0);
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6" dir="rtl">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-8 text-white shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black">إدارة السكن التشغيلية</h1>
              <p className="text-white/70 font-bold text-sm">لديك اليوم {stats?.presentToday || 0} طالب حاضر من أصل {stats?.studentCount || 0}.</p>
            </div>
          </div>
        </div>
        <Activity className="absolute -left-10 -top-10 text-white/5 w-48 h-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <QuickActionCard label="الطلاب المسجلين" value={stats?.studentCount || 0} icon={<Users />} color="primary" onClick={() => onNavigate?.('students')} />
        <QuickActionCard label={`الخريجون ${year}`} value={stats?.graduatesCount || 0} icon={<GraduationCap />} color="vibrant" onClick={() => onNavigate?.('students')} />
        <QuickActionCard label="عدد الشقق" value={stats?.apartmentsCount || 0} icon={<Building />} color="vibrant" onClick={() => onNavigate?.('apartments')} />
        <QuickActionCard label="حضور اليوم" value={stats?.presentToday || 0} icon={<MapPin />} color="ocean" onClick={() => onNavigate?.('attendance')} />
        <QuickActionCard label="صيانة معلقة" value={stats?.pendingMaintenance || 0} icon={<Wrench />} color="rose" onClick={() => onNavigate?.('maintenance')} />
        <QuickActionCard label="إشغال الأسرة" value={`${stats?.roomStats?.occupancyRate || 0}%`} icon={<Home />} color="warm" subtitle={`${stats?.roomStats?.occupied || 0}/${stats?.roomStats?.total || 0}`} />
        <QuickActionCard label="طابور المغسلة" value={stats?.laundryQueue || 0} icon={<Waves />} color="primary" onClick={() => onNavigate?.('laundry')} />
      </div>

      <SupervisorContactSettings />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AlertBadge label="إنذارات نشطة" value={stats?.activeWarnings || 0} icon={<ShieldAlert />} color="rose" onClick={() => onNavigate?.('behavior')} />
        <AlertBadge label="شكاوى معلقة" value={stats?.pendingComplaints || 0} icon={<FileText />} color="warm" onClick={() => onNavigate?.('complaints')} />
        <AlertBadge label="طلاب مسافرون" value={stats?.travelingStudents || 0} icon={<Plane />} color="primary" onClick={() => onNavigate?.('students')} />
        <AlertBadge label="مهام المغسلة" value={stats?.laundryQueue || 0} icon={<Waves />} color="vibrant" onClick={() => onNavigate?.('laundry')} />
      </div>

      <DailyReadingsCard />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Wrench size={18} className="text-rose-500" /> آخر طلبات الصيانة
            </h3>
            <button onClick={() => onNavigate?.('maintenance')} className="text-[10px] font-black text-primary-600 dark:text-primary-400 hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-2">
            {stats?.recentMaintenance?.length > 0 ? stats.recentMaintenance.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <StatusDot status={m.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{m.description || 'طلب صيانة'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{m.requester_name} • {new Date(m.created_at).toLocaleDateString('ar-EG')}</p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            )) : (
              <div className="py-6 text-center text-slate-300 dark:text-slate-400 text-sm font-bold">لا توجد طلبات صيانة حديثة</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar size={18} className="text-vibrant-500" /> الفعاليات القادمة
            </h3>
            <button onClick={() => onNavigate?.('events')} className="text-[10px] font-black text-primary-600 dark:text-primary-400 hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-2">
            {stats?.upcomingEvents?.length > 0 ? stats.upcomingEvents.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vibrant-50 font-black text-vibrant-600 dark:bg-vibrant-500/20 dark:text-vibrant-400 text-xs leading-tight text-center">
                  {new Date(e.event_date).getDate()}<br />
                  <span className="text-[8px]">{new Date(e.event_date).toLocaleDateString('ar-EG', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{e.title}</p>
                  {e.location && <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{e.location}</p>}
                </div>
              </div>
            )) : (
              <div className="py-6 text-center text-slate-300 dark:text-slate-400 text-sm font-bold">لا توجد فعاليات قادمة</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <MapPin size={18} className="text-ocean-500" /> آخر تسجيلات الحضور
            </h3>
            <button onClick={() => onNavigate?.('attendance')} className="text-[10px] font-black text-primary-600 dark:text-primary-400 hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-2">
            {stats?.recentAttendance?.length > 0 ? stats.recentAttendance.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${a.type === 'check-in' ? 'bg-ocean-100 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400' : 'bg-warm-100 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400'}`}>
                  {a.type === 'check-in' ? <UserCheck size={14} /> : <Clock size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{a.student_name || 'طالب'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-300">{new Date(a.created_at).toLocaleString('ar-EG')}</p>
                </div>
              </div>
            )) : (
              <div className="py-6 text-center text-slate-300 dark:text-slate-400 text-sm font-bold">لا توجد تسجيلات حضور حديثة</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Activity size={18} className="text-warm-500" /> آخر القرارات والتفاعلات
            </h3>
            <button onClick={() => onNavigate?.('decisions')} className="text-[10px] font-black text-primary-600 dark:text-primary-400 hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-2">
            {stats?.recentDecisions?.length > 0 ? stats.recentDecisions.map((d: any) => {
              let det: any = null;
              try { det = typeof d.details === 'string' ? JSON.parse(d.details) : d.details; } catch {}
              const actionLabel: any = { 'ADD_POINTS': 'إضافة نقاط', 'MARK_ATTENDANCE': 'تسجيل حضور', 'ISSUE_WARNING': 'إصدار إنذار', 'APPROVE_REWARD': 'قبول مكافأة', 'REJECT_REWARD': 'رفض مكافأة' };
              const label = (d.student_name ? `${actionLabel[d.action] || d.action} (${d.student_name})` : actionLabel[d.action] || d.action);
              const reason = det?.reason || det?.title || '';
              const levelMap: any = { low: 'منخفض', medium: 'متوسط', high: 'شديد' };
              const extras = [det?.level ? levelMap[det.level] || det.level : '', det?.amount ? `${det.amount} نقطة` : ''].filter(Boolean).join(' · ');
              return (
              <div key={d.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <DecisionIcon action={d.action} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{d.creator_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300 font-bold">{label}{reason ? ` — ${reason}` : ''}</p>
                  {extras && <p className="text-[10px] text-slate-400 font-medium">{extras}</p>}
                  <p className="text-[10px] text-slate-400 dark:text-slate-300">{new Date(d.created_at).toLocaleString('ar-EG')}</p>
                </div>
              </div>
            )}) : (
              <div className="py-6 text-center text-slate-300 dark:text-slate-400 text-sm font-bold">لا توجد قرارات حديثة</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <Star size={18} className="text-warm-500" /> أفضل الطلاب هذا الشهر
            </h3>
            {stats?.topStudents?.length > 0 ? (
              <div className="space-y-2">
                {stats.topStudents.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-black text-sm ${i === 0 ? 'bg-warm-100 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' : i === 1 ? 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-300' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-700 dark:text-slate-200">{s.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{s.points} نقطة</p>
                    </div>
                    <TrendingUp size={18} className="text-ocean-500" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-300 dark:text-slate-400 text-sm font-bold">لا توجد نقاط مسجلة هذا الشهر</div>
            )}
          </div>

          {stats?.colleges && stats.colleges.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-5">توزيع الطلاب حسب الكلية</h3>
              <div className="grid grid-cols-2 gap-2">
                {stats.colleges.slice(0, 12).map((c: any) => (
                  <div key={c.name} className="rounded-xl bg-slate-50 p-4 text-center dark:bg-white/5 border border-slate-100 dark:border-white/10">
                    <p className="text-lg font-black text-slate-800 dark:text-white">{c.count}</p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300 mt-1 truncate">{c.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats?.multiTenant && stats?.tenantsFinance?.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2">
                <Building size={18} className="text-warm-500" /> المالية لكل سكن
              </h3>
              <div className="space-y-2">
                {stats.tenantsFinance.map((t: any) => {
                  const tNet = (t.totalIncome || 0) - (t.totalExpenses || 0);
                  return (
                    <div key={t.id} className="rounded-xl bg-slate-50 p-5 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-black text-slate-800 dark:text-white">{t.name}</p>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-300">{t.studentCount} طالب</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[9px] font-black text-ocean-600 dark:text-ocean-400">إيرادات</p>
                          <p className="text-sm font-black text-ocean-700 dark:text-ocean-300">{t.totalIncome.toLocaleString()} $</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-rose-600 dark:text-rose-400">مصروفات</p>
                          <p className="text-sm font-black text-rose-700 dark:text-rose-300">{t.totalExpenses.toLocaleString()} $</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-500 dark:text-slate-300">صافي</p>
                          <p className={`text-sm font-black ${tNet >= 0 ? 'text-warm-700 dark:text-warm-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {tNet >= 0 ? '+' : ''}{tNet.toLocaleString()} $
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-5 flex items-center gap-3">
          <Wallet size={20} className="text-warm-500" />
          الملخص المالي التقديري
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-ocean-50 p-5 dark:bg-ocean-500/10 border border-ocean-100 dark:border-ocean-500/20">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={18} className="text-ocean-600 dark:text-ocean-400" />
              <span className="text-[10px] font-black text-ocean-600 dark:text-ocean-400">إجمالي الإيرادات</span>
            </div>
            <p className="text-2xl font-black text-ocean-700 dark:text-ocean-300">{stats?.totalIncome?.toLocaleString()} $</p>
          </div>
          <div className="rounded-xl bg-rose-50 p-5 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown size={18} className="text-rose-600 dark:text-rose-400" />
              <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">إجمالي المصروفات</span>
            </div>
            <p className="text-2xl font-black text-rose-700 dark:text-rose-300">{stats?.totalExpenses?.toLocaleString()} $</p>
          </div>
          <div className={`rounded-xl p-5 border ${netProfit >= 0 ? 'bg-warm-50 dark:bg-warm-500/10 border-warm-100 dark:border-warm-500/20' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Wallet size={18} className={netProfit >= 0 ? 'text-warm-600 dark:text-warm-400' : 'text-rose-600 dark:text-rose-400'} />
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-300">صافي الربح التقديري</span>
            </div>
            <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-warm-700 dark:text-warm-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()} $
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


