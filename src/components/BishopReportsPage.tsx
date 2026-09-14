import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { TenantFilter } from './reports/TenantFilter';
import { StatsGrid } from './reports/StatsGrid';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  AlertCircle,
  Activity,
  PieChart as PieChartIcon,
  Filter,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayStr() { return formatDate(new Date()); }
function monthStartStr() {
  const d = new Date(); d.setDate(1); return formatDate(d);
}
function yearStartStr() {
  return `${new Date().getFullYear()}-01-01`;
}

export function BishopReportsPage() {
  const { request } = useApi();
  const { user } = useAuth();

  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [tenantOpen, setTenantOpen] = useState(false);

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'year' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [globalStats, setGlobalStats] = useState<any>(null);
  const [financeSummary, setFinanceSummary] = useState<any[]>([]);
  const [financeTotals, setFinanceTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/admin/my-tenants');
        if (res?.success && res.data) {
          setTenants(res.data);
        }
      } catch { }
    })();
  }, [request]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (!selectAll && selectedTenantIds.length > 0) {
      params.set('tenant_ids', selectedTenantIds.join(','));
    }
    if (dateFilter === 'today') {
      params.set('startDate', todayStr());
      params.set('endDate', todayStr());
    } else if (dateFilter === 'month') {
      params.set('startDate', monthStartStr());
      params.set('endDate', todayStr());
    } else if (dateFilter === 'year') {
      params.set('startDate', yearStartStr());
      params.set('endDate', todayStr());
    } else if (dateFilter === 'custom' && startDate && endDate) {
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [selectAll, selectedTenantIds, dateFilter, startDate, endDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery();
      const [gsRes, fsRes] = await Promise.all([
        request(`/api/reports/global-stats${qs}`),
        request(`/api/reports/finance-summary${qs}`)
      ]);
      if (!mounted.current) return;
      if (!gsRes.success) throw new Error(gsRes.message || 'فشل تحميل الإحصائيات');
      setGlobalStats(gsRes.data);
      setFinanceSummary(fsRes.data || []);
      setFinanceTotals(fsRes.summary || null);
    } catch (err: any) {
      console.error(err);
      if (mounted.current) setError(err.message || 'فشل تحميل التقارير');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request, buildQuery]);

  useEffect(() => {

    fetchData();
    
  }, [fetchData]);

  const toggleTenant = (id: string) => {
    setSelectedTenantIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setSelectAll(next.length === tenants.length);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedTenantIds([]);
      setSelectAll(false);
    } else {
      setSelectedTenantIds(tenants.map(t => t.id));
      setSelectAll(true);
    }
  };

  const chartData = financeSummary.map((item: any) => ({
    name: item.month,
    إيرادات: item.revenue,
    مصروفات: item.expenses,
  })).reverse();

  const breakdown = globalStats?.tenantBreakdown || [];

  const dateFilters = [
    { key: 'all', label: 'الكل' },
    { key: 'today', label: 'اليوم' },
    { key: 'month', label: 'هذا الشهر' },
    { key: 'year', label: 'هذا العام' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6" dir="rtl">
      <AlertCircle size={64} className="text-red-400" />
      <p className="text-xl font-bold text-red-400">{error}</p>
      <button onClick={fetchData} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-all">
        إعادة المحاولة
      </button>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-1000" dir="rtl">
      <div className="bg-white dark:bg-card-dark p-4 sm:p-6 md:p-10 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-right">
            <h2 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">تقارير الرعاية الأبرشية</h2>
            <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">إحصائيات سيدنا الأسقف</h1>
            <p className="text-slate-500 dark:text-slate-300 mt-2 font-medium italic">عرض وتحليل شامل لكامل القطاعات تحت الرعاية.</p>
          </div>
          <div className="flex gap-4">
            <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200">
              <Download size={18} />
              تصدير PDF
            </button>
          </div>
        </div>
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-50/50 dark:bg-blue-500/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      </div>

      <div className="bg-white dark:bg-card-dark p-4 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Filter size={20} className="text-slate-400" />
          <span className="text-sm font-black text-slate-600 dark:text-slate-300">تصفية البيانات:</span>

          <TenantFilter
            tenants={tenants}
            selectedIds={selectedTenantIds}
            selectAll={selectAll}
            isOpen={tenantOpen}
            onToggle={() => setTenantOpen(!tenantOpen)}
            onToggleSelectAll={toggleSelectAll}
            onToggleTenant={toggleTenant}
            onRemoveTenant={toggleTenant}
          />

          <div className="h-8 w-px bg-slate-200 dark:bg-white/[0.1]" />

          {dateFilters.map(df => (
            <button
              key={df.key}
              onClick={() => { setDateFilter(df.key as any); if (df.key !== 'custom') { setStartDate(''); setEndDate(''); } }}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${dateFilter === df.key ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
            >
              {df.label}
            </button>
          ))}

          <button
            onClick={() => setDateFilter('custom')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${dateFilter === 'custom' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
          >
            <Calendar size={16} />
            مخصص
          </button>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/[0.1] rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200"
              />
              <span className="text-xs font-bold text-slate-400">إلى</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/[0.1] rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200"
              />
              {startDate && endDate && (
                <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-all">
                  تطبيق
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <StatsGrid
        totalStudents={globalStats?.totalStudents?.count || 0}
        totalTenants={globalStats?.totalTenants?.count || 0}
        occupancyRate={globalStats?.occupancyRate || 0}
        emptyRooms={globalStats?.rooms?.empty || 0}
      />

      {financeTotals && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-card-dark p-4 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-500/20 flex items-center justify-center text-green-600">
                <TrendingUp size={28} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 dark:text-slate-300">إجمالي الإيرادات</p>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white">{Number(financeTotals.totalRevenue || 0).toLocaleString()} ج.م</h3>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-card-dark p-4 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/20 flex items-center justify-center text-red-600">
                <TrendingDown size={28} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 dark:text-slate-300">إجمالي المصروفات</p>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white">{Number(financeTotals.totalExpenses || 0).toLocaleString()} ج.م</h3>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white dark:bg-card-dark p-10 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">الأداء المالي السنوي</h3>
              <p className="text-slate-400 dark:text-slate-300 text-sm font-bold">مقارنة الإيرادات والمصروفات</p>
            </div>
            <Activity className="text-slate-200 dark:text-slate-600" size={40} />
          </div>

          {chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-slate-400 font-bold">لا توجد بيانات مالية للفترة المحددة</p>
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="إيرادات" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="مصروفات" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
            <h3 className="text-xl font-black mb-8 relative z-10 leading-tight">توزيع الحالات<br />والتزامات الصيانة</h3>
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">الغرف الفارغة</span>
                <span className="bg-amber-500/20 text-amber-500 px-3 py-1 rounded-lg text-xs font-black">{globalStats?.rooms?.empty || 0} غرفة</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">الغرف الكاملة</span>
                <span className="bg-blue-500/20 text-blue-500 px-3 py-1 rounded-lg text-xs font-black">{globalStats?.rooms?.full || 0} غرفة</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">الغرف المشغولة</span>
                <span className="bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-lg text-xs font-black">{globalStats?.rooms?.occupied || 0} غرفة</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">إجمالي الغرف</span>
                <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-black">{globalStats?.rooms?.total || 0} غرفة</span>
              </div>
              <div className="border-t border-white/10 pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">طلبات صيانة معلقة</span>
                  <span className="bg-amber-500/20 text-amber-500 px-3 py-1 rounded-lg text-xs font-black">{globalStats?.maintenance?.pending || 0} طلب</span>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-slate-400 font-bold">متوسط وقت الإصلاح</span>
                  <span className="bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-lg text-xs font-black">{globalStats?.maintenance?.avgRepairHours || 0} ساعة</span>
                </div>
              </div>
            </div>
            <BarChart3 className="absolute -bottom-10 -left-10 text-white/5" size={200} />
          </div>

          <div className="bg-white dark:bg-card-dark rounded-[3rem] p-10 border border-slate-100 dark:border-white/[0.05] shadow-sm">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <PieChartIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
              إشغال الغرف
            </h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 dark:text-slate-300">إجمالي الغرف</p>
                  <p className="font-bold text-2xl text-slate-800 dark:text-white">{globalStats?.rooms?.total || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 dark:text-slate-300">مشغولة حاليًا</p>
                  <p className="font-bold text-2xl text-slate-800 dark:text-white">{globalStats?.rooms?.occupied || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 dark:text-slate-300">فارغة</p>
                  <p className="font-bold text-2xl text-slate-800 dark:text-white">{globalStats?.rooms?.empty || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-rose-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 dark:text-slate-300">نسبة الإشغال</p>
                  <p className="font-bold text-2xl text-slate-800 dark:text-white">{Math.round(globalStats?.occupancyRate || 0)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="bg-white dark:bg-card-dark rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 dark:border-white/[0.05]">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white">تفصيل السكنات</h3>
            <p className="text-slate-400 text-sm font-bold mt-1">بيانات مفصلة لكل سكن</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.05]">
                  <th className="text-right p-5 text-xs font-black text-slate-400 dark:text-slate-300">السكن</th>
                  <th className="text-right p-5 text-xs font-black text-slate-400 dark:text-slate-300">الطلاب</th>
                  <th className="text-right p-5 text-xs font-black text-slate-400 dark:text-slate-300">الغرف الكلية</th>
                  <th className="text-right p-5 text-xs font-black text-slate-400 dark:text-slate-300">المشغولة</th>
                  <th className="text-right p-5 text-xs font-black text-slate-400 dark:text-slate-300">الفارغة</th>
                  <th className="text-right p-5 text-xs font-black text-slate-400 dark:text-slate-300">الإشغال</th>
                  <th className="text-right p-5 text-xs font-black text-slate-400 dark:text-slate-300">الإيرادات</th>
                  <th className="text-right p-5 text-xs font-black text-slate-400 dark:text-slate-300">المصروفات</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((t: any) => {
                  const rate = t.totalCapacity > 0 ? Math.round((t.occupancy / t.totalCapacity) * 100) : 0;
                  return (
                    <tr key={t.id} className="border-b border-slate-50 dark:border-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
                      <td className="p-5 font-bold text-slate-800 dark:text-white">{t.name}</td>
                      <td className="p-5 text-slate-600 dark:text-slate-300">{t.students}</td>
                      <td className="p-5 text-slate-600 dark:text-slate-300">{t.totalCapacity}</td>
                      <td className="p-5 text-slate-600 dark:text-slate-300">{t.occupancy}</td>
                      <td className="p-5 text-slate-600 dark:text-slate-300">{t.emptyRooms}</td>
                      <td className="p-5">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black ${rate > 80 ? 'bg-emerald-500/20 text-emerald-600' : rate > 50 ? 'bg-amber-500/20 text-amber-600' : 'bg-red-500/20 text-red-600'}`}>
                          {rate}%
                        </span>
                      </td>
                      <td className="p-5 text-green-600 font-bold">{Number(t.income).toLocaleString()} ج.م</td>
                      <td className="p-5 text-red-600 font-bold">{Number(t.expenses).toLocaleString()} ج.م</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
