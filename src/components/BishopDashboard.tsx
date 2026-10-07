import { useState, useEffect, useRef } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';

import { MessagesSection } from './MessagesSection';
import { DashboardSkeleton } from './Skeleton';
import { DailyReadingsCard } from './DailyReadingsCard';
import {
  Building2, Users, Home, TrendingUp, ChevronLeft, MapPin, Activity, Download,
  Church, Bell, GraduationCap, UserMinus, Calendar, Clock, ShieldAlert, FileText,
  UserCheck, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StatCard, AnnualStatCard, MiniStat } from './bishop/DashboardHelpers';

export function BishopDashboard() {
  const { request } = useApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'tenants' | 'priests' | 'reports'>('overview');
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const mounted = useMounted();

  const fetchDataRef = useRef(() => {});
  fetchDataRef.current = () => {
    request('/api/dashboard/bishop-summary')
      .then(res => { if (mounted.current) setData(res.data); })
      .catch(e => { console.error('Bishop summary failed:', e); if (mounted.current) setError('فشل تحميل تقارير الأبرشية'); })
      .finally(() => { if (mounted.current) setLoading(false); });
  };

  useEffect(() => {

    fetchDataRef.current();
    
  }, []);

  const handleExportExcel = () => {
    if (!data?.tenants) return;
    const headers = ['اسم السكن', 'الموقع', 'الحالة', 'الأب الكاهن', 'عدد الطلاب', 'نسبة الإشغال', 'السعة الكلية', 'الأسرة الشاغرة'];
    const rows = data.tenants.map((t: any) => [
      `"${t.name}"`, `"${t.location || 'غير محدد'}"`,
      t.is_active ? 'نشط' : 'متوقف',
      `"${t.priestName || 'غير معين'}"`,
      t.studentCount, `${t.occupancyRate}%`,
      t.totalCapacity, (t.totalCapacity - t.currentOccupancy)
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `إحصائيات_الأبرشية_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) return <div className="p-10 text-center text-rose-500 font-bold">{error}</div>;
  if (loading) return <div className="p-8"><DashboardSkeleton /></div>;

  const tabs = [
    { id: 'overview', label: 'نظرة عامة', icon: Home },
    { id: 'tenants', label: 'السكنات', icon: Building2 },
    { id: 'priests', label: 'الكهنة', icon: Church },
    { id: 'reports', label: 'التقارير الواردة', icon: FileText },
  ] as const;
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6" dir="rtl">

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-4 sm:p-8 text-white shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black">لوحة إشراف الإيبارشية</h1>
              <p className="text-white/70 font-bold text-sm">متابعة شاملة لـ {data?.tenantsCount} سكنات و {data?.dioceseStudents} طالب.</p>
            </div>
          </div>
        </div>
        <Church className="absolute -left-10 -top-10 text-white/5 w-48 h-48" />
      </div>

      <div className="flex bg-slate-100 dark:bg-white/10 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeSection === tab.id ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 shadow-lg' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white'}`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeSection === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <StatCard label="السكنات (نشط/كلي)" value={`${data?.activeTenantsCount ?? 0} / ${data?.tenantsCount ?? 0}`} icon={<Building2 />} color="primary" />
              <StatCard label="إجمالي الطلاب" value={data?.dioceseStudents ?? 0} icon={<Users />} color="ocean" />
              <StatCard label={`الخريجون الحاليون ${year}`} value={data?.graduatesCount ?? 0} icon={<GraduationCap />} color="primary" />
              <StatCard label="عدد الكهنة" value={data?.priestsCount ?? 0} icon={<Church />} color="vibrant" />
              <StatCard label="إجمالي المشرفين" value={data?.supervisorsCount ?? 0} icon={<ShieldAlert />} color="rose" />
              <StatCard label="نسبة الإشغال" value={`${data?.occupancyRate}%`} icon={<TrendingUp />} color="warm" />
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
              <h3 className="mb-4 text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                <Calendar className="text-primary-600 dark:text-primary-400" size={20} />
                إحصائيات العام الحالي
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AnnualStatCard label="طلاب جدد" value={data?.annualStats?.newStudents || 0} icon={<UserCheck size={20} />} color="ocean" />
                <AnnualStatCard label="حالات الفصل" value={data?.annualStats?.expulsions || 0} icon={<UserMinus size={20} />} color="rose" />
                <AnnualStatCard label={`الخريجون ${year}`} value={data?.annualStats?.graduates || 0} icon={<GraduationCap size={20} />} color="primary" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data?.tenants?.slice(0, 4).map((tenant: any) => (
                <motion.div key={tenant.id} whileHover={{ y: -2 }}
                  className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-white/[0.04] dark:bg-card-dark flex items-center justify-between group cursor-pointer"
                  onClick={() => { setActiveSection('tenants'); setExpandedTenant(tenant.id); }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tenant.is_active ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400' : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-300'}`}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 dark:text-white text-sm">{tenant.name}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold flex items-center gap-1">
                        <MapPin size={11} /> {tenant.location || 'غير محدد'}
                        {tenant.priestName && <><span className="mx-1">•</span><Church size={11} /> {tenant.priestName}</>}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-black text-slate-800 dark:text-white">{tenant.occupancyRate}%</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{tenant.studentCount} طالب</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeSection === 'tenants' && (
          <motion.div key="tenants" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                <Activity className="text-primary-600 dark:text-primary-400" size={20} />
                حالة السكنات التابعة لنيافتكم
              </h3>
              <button onClick={handleExportExcel}
                className="flex items-center gap-2 px-5 py-2.5 bg-ocean-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-ocean-700 transition-all"
              >
                <Download size={16} />
                تصدير Excel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MiniStat label="إجمالي الشقق" value={data?.tenants?.reduce((acc: number, t: any) => acc + (t.apartment_count || 0), 0)} />
              <MiniStat label="إجمالي الغرف" value={data?.tenants?.reduce((acc: number, t: any) => acc + (t.room_count || 0), 0)} />
              <MiniStat label="السعة الاستيعابية" value={data?.tenants?.reduce((acc: number, t: any) => acc + (t.totalCapacity || 0), 0)} />
              <MiniStat label="الأماكن الشاغرة" value={data?.tenants?.reduce((acc: number, t: any) => acc + ((t.totalCapacity || 0) - (t.currentOccupancy || 0)), 0)} accent />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data?.tenants?.map((tenant: any) => (
                <motion.div key={tenant.id} layout
                  className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-all dark:border-white/[0.04] dark:bg-card-dark"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tenant.is_active ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400' : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-300'}`}>
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 dark:text-white">{tenant.name}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold flex items-center gap-1 mt-0.5">
                          <MapPin size={11} /> {tenant.location || 'غير محدد'}
                        </p>
                        {tenant.priestName && (
                          <p className="text-[10px] text-vibrant-600 dark:text-vibrant-400 font-bold flex items-center gap-1 mt-0.5">
                            <Church size={11} /> {tenant.priestName}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${tenant.is_active ? 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400' : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                      {tenant.is_active ? 'نشط' : 'متوقف'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-500 dark:text-slate-300">نسبة الإشغال</span>
                      <span className="text-slate-800 dark:text-white">{tenant.occupancyRate}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-600 dark:bg-primary-400 rounded-full transition-all duration-1000" style={{ width: `${tenant.occupancyRate}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 dark:text-slate-300">
                      <span>{tenant.studentCount} طالب مسجل</span>
                      <span>{tenant.totalCapacity - tenant.currentOccupancy} سرير شاغر</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeSection === 'priests' && (
          <motion.div key="priests" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-white/[0.04] dark:bg-card-dark overflow-hidden">
              <div className="p-6 border-b border-slate-50 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-vibrant-50 dark:bg-vibrant-500/20">
                    <Church size={24} className="text-vibrant-600 dark:text-vibrant-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white">كهنة الإيبارشية</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-300 font-bold">عدد الكهنة المسندين: {data?.priestsCount}</p>
                  </div>
                </div>
              </div>
              {data?.priests?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-white/5">
                        <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">الأب الكاهن</th>
                        <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">البريد الإلكتروني</th>
                        <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">السكنات المسندة</th>
                        <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">تقارير معلقة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/10">
                      {data.priests.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-vibrant-50 dark:bg-vibrant-500/20 font-black text-vibrant-600 dark:text-vibrant-400 text-xs">{p.name?.charAt(0)}</div>
                              <div className="font-black text-slate-700 dark:text-slate-200 text-sm">{p.name}</div>
                            </div>
                          </td>
                          <td className="p-5 text-xs text-slate-400 dark:text-slate-300 font-bold">{p.email}</td>
                          <td className="p-5 text-xs font-bold text-slate-600 dark:text-slate-300">{p.tenant_names}</td>
                          <td className="p-5 text-center">
                            <span className={`px-3 py-1 rounded-full font-black text-[10px] ${p.pending_reports > 0 ? 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' : 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400'}`}>
                              {p.pending_reports || 0}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center text-slate-300 dark:text-slate-400 font-bold">لا يوجد كهنة مسندين في الإيبارشية حالياً</div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'reports' && (
          <motion.div key="reports" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-white/[0.04] dark:bg-card-dark p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warm-50 dark:bg-warm-500/20">
                  <FileText size={24} className="text-warm-600 dark:text-warm-400" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white">آخر التقارير الواردة من الكهنة</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-300 font-bold">تقارير وبلاغات مرفوعة من كهنة الإيبارشية والمشرفين</p>
                </div>
              </div>
              {data?.receivedReports?.length > 0 ? (
                <div className="space-y-3">
                  {data.receivedReports.map((r: any) => (
                    <div key={r.id} className="p-5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            r.type === 'penalty' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                            r.type === 'warning' ? 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' : 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                          }`}>
                            {r.type === 'penalty' ? <ShieldAlert size={18}/> : r.type === 'warning' ? <AlertTriangle size={18}/> : <Bell size={18}/>}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 dark:text-white text-sm">{r.title}</h4>
                            <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-0.5">
                              {new Date(r.created_at).toLocaleDateString('ar-EG')} • {r.supervisor_name}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                          r.status === 'pending' ? 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' :
                          r.status === 'approved' ? 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-300'
                        }`}>
                          {r.status === 'pending' ? 'معلق' : r.status === 'approved' ? 'معتمد' : 'مرفوض'}
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed pr-12">{r.description.substring(0, 200)}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-slate-300 dark:text-slate-400 font-bold flex flex-col items-center gap-3">
                  <CheckCircle size={36} className="text-ocean-300 dark:text-ocean-400" />
                  لا توجد تقارير واردة حالياً
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DailyReadingsCard />
      <MessagesSection />
    </div>
  );
}


