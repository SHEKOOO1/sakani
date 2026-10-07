import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { motion, AnimatePresence } from 'motion/react';
import { useApi } from '../hooks/useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

import { MessagesSection } from './MessagesSection';
import { DailyReadingsCard } from './DailyReadingsCard';
import { 
  Home, Users, UserMinus, GraduationCap, Bell, TrendingUp, ShieldAlert,
  Search, Building2, Bed, Target,
  AlertTriangle, Sparkles, Send, Church
} from 'lucide-react';
import { ReportFormModal } from './priest/ReportFormModal';
import { DisciplineTab } from './priest/DisciplineTab';
import { WarningsTab } from './priest/WarningsTab';
import { ExpulsionTab } from './priest/ExpulsionTab';
import { ReportsTab } from './priest/ReportsTab';

export function PriestDashboard() {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState<'overview' | 'discipline' | 'warnings' | 'expulsion' | 'graduates' | 'reports'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [expulsionCandidates, setExpulsionCandidates] = useState<any[]>([]);
  const [graduates, setGraduates] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [discipline, setDiscipline] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [disciplineSearch, setDisciplineSearch] = useState('');
  const [graduatesSearch, setGraduatesSearch] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ title: '', description: '', type: 'general' });
  const [sendingReport, setSendingReport] = useState(false);
  const mounted = useMounted();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, expRes, gradRes, repRes, discRes, warnRes] = await Promise.all([
        request('/api/dashboard/priest/stats'),
        request('/api/dashboard/priest/expulsion-candidates'),
        request('/api/dashboard/priest/graduates'),
        request('/api/dashboard/priest/reports'),
        request('/api/dashboard/priest/discipline'),
        request('/api/dashboard/priest/warnings')
      ]);
      if (!mounted.current) return;
      setStats(statsRes.data);
      setExpulsionCandidates(expRes.data);
      setGraduates(gradRes.data);
      setReports(repRes.data);
      setDiscipline(discRes.data);
      setWarnings(warnRes.data);
    } catch (err) { console.error(err); showSnackbar('فشل تحميل بيانات لوحة التحكم', 'error'); }
    finally { if (mounted.current) setLoading(false); }
  }, [request]);

  useEffect(() => {

    fetchData();
    
  }, [fetchData]);

  const handleApproveReport = async (reportId: string) => {
    try {
      await request(`/api/dashboard/priest/reports/${reportId}/approve`, { method: 'POST' });
      fetchData();
      showSnackbar('تم اعتماد التقرير بنجاح', 'success');
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleApproveExpulsion = async (studentId: string) => {
    try {
      await request(`/api/dashboard/priest/expulsion-candidates/${studentId}/approve`, { method: 'POST' });
      fetchData();
      showSnackbar('تم اعتماد فصل الطالب', 'success');
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleRejectExpulsion = async (studentId: string) => {
    try {
      await request(`/api/dashboard/priest/expulsion-candidates/${studentId}/reject`, { method: 'POST' });
      fetchData();
      showSnackbar('تم رفض مقترح الفصل', 'success');
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleSendReport = async () => {
    if (!reportForm.title.trim()) { showSnackbar('الرجاء إدخال عنوان التقرير', 'warning'); return; }
    setSendingReport(true);
    try {
      await request('/api/dashboard/priest/send-report', {
        method: 'POST',
        body: JSON.stringify(reportForm)
      });
      showSnackbar('تم رفع التقرير للأسقف بنجاح', 'success');
      setShowReportModal(false);
      setReportForm({ title: '', description: '', type: 'general' });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setSendingReport(false); }
  };


  const tabs = [
    { id: 'overview', icon: Home, label: 'نظرة عامة' },
    { id: 'discipline', icon: Target, label: 'الانضباط' },
    { id: 'warnings', icon: AlertTriangle, label: 'الإنذارات' },
    { id: 'expulsion', icon: UserMinus, label: 'مقترحات الفصل' },
    { id: 'graduates', icon: GraduationCap, label: 'الخريجين' },
    { id: 'reports', icon: Bell, label: 'البلاغات' },
  ] as const;
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
              <h1 className="text-2xl font-black">لوحة تحكم الأب المسؤول</h1>
              <p className="text-white/70 font-bold text-sm">متابعة الانضباط، السعة السكنية، والتقارير الإدارية.</p>
            </div>
          </div>
        </div>
        <Church className="absolute -left-10 -top-10 text-white/5 w-48 h-48" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 dark:bg-white/10 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
          {tabs.map(tab => (
            <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={<tab.icon size={18}/>} label={tab.label} />
          ))}
        </div>
        <button 
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-vibrant-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-vibrant-700 transition-all whitespace-nowrap"
        >
          <Send size={16} />
          رفع تقرير للأسقف
        </button>
      </div>

      <AnimatePresence>
        {showReportModal && (
          <ReportFormModal
            reportForm={reportForm}
            sendingReport={sendingReport}
            onClose={() => setShowReportModal(false)}
            onSubmit={handleSendReport}
            onFormChange={(field, value) => setReportForm(prev => ({ ...prev, [field]: value }))}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="إجمالي الطلاب" value={stats?.totalStudents || 0} icon={<Users />} color="primary" />
              <StatCard label={`الخريجون الحاليون ${year}`} value={stats?.graduatesCount || 0} icon={<GraduationCap />} color="warm" />
              <StatCard label="الأسرة الفارغة" value={stats?.emptyBeds || 0} icon={<Bed />} color="ocean" />
              <StatCard label="إنذارات نشطة" value={stats?.activeWarnings || 0} icon={<ShieldAlert />} color="rose" />
              <StatCard label="طلبات معلقة" value={stats?.pendingReports || 0} icon={<Bell />} color="warm" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
                <h3 className="mb-4 text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                  <Building2 className="text-primary-600 dark:text-primary-400" size={20} />
                  إحصائيات المباني السكنية
                </h3>
                <div className="space-y-3">
                  {stats?.buildings?.map((b: any) => (
                    <div key={b.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-card-dark">
                          <Home size={18} className="text-slate-400 dark:text-slate-300" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-700 dark:text-slate-200 text-sm">{b.name}</h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{b.responsibleName}</p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-center rounded-xl border border-slate-200 px-4 py-2.5 dark:border-white/10">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">الطلاب</p>
                          <p className="font-black text-slate-800 dark:text-white">{b.studentCount}</p>
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-white/10" />
                        <div>
                          <p className="text-[10px] font-black text-ocean-500 dark:text-ocean-400">أسرة شاغرة</p>
                          <p className="font-black text-ocean-600 dark:text-ocean-400">{b.emptyBeds}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-700 via-vibrant-700 to-primary-800 p-6 text-white shadow-xl">
                <div className="relative z-10 flex flex-col h-full">
                  <h3 className="text-lg font-black mb-1">إجمالي المسكن</h3>
                  <p className="text-white/60 text-xs font-bold">إحصائيات إجمالية لجميع المباني المسؤولة عنها.</p>
                  <div className="mt-auto pt-8 grid grid-cols-2 gap-6 text-center">
                    <div>
                      <p className="text-white/50 text-[10px] font-black uppercase mb-2">نسبة الإشغال</p>
                      <div className="inline-flex items-end gap-1">
                        <span className="text-4xl font-black leading-none">{stats?.occupancyRate || 0}</span>
                        <span className="text-lg font-black text-white/50">%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-white/50 text-[10px] font-black uppercase mb-2">معدل الانضباط</p>
                      <div className="inline-flex items-end gap-1">
                        <span className="text-4xl font-black leading-none">{stats?.disciplineRate || 0}</span>
                        <span className="text-lg font-black text-white/50">%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <TrendingUp className="absolute -right-8 -bottom-8 text-white/5 w-48 h-48 rotate-12" />
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'discipline' && (
          <DisciplineTab
            discipline={discipline}
            disciplineSearch={disciplineSearch}
            onDisciplineSearchChange={setDisciplineSearch}
          />
        )}

        {activeTab === 'warnings' && (
          <WarningsTab warnings={warnings} />
        )}

        {activeTab === 'expulsion' && (
          <ExpulsionTab
            expulsionCandidates={expulsionCandidates}
            onApproveExpulsion={handleApproveExpulsion}
            onRejectExpulsion={handleRejectExpulsion}
          />
        )}

        {activeTab === 'graduates' && (
          <motion.div key="graduates" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            {(() => {
              const filteredGraduates = graduates.filter((g: any) => {
                if (!graduatesSearch.trim()) return true;
                const q = graduatesSearch.trim().toLowerCase();
                return (g.name || '').toLowerCase().includes(q)
                  || (g.university || '').toLowerCase().includes(q)
                  || (g.college || '').toLowerCase().includes(q)
                  || (g.major || '').toLowerCase().includes(q);
              });
              return (
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-white/[0.04] dark:bg-card-dark overflow-hidden">
              <div className="border-b border-slate-50 p-6 dark:border-white/5 flex justify-between items-center flex-wrap gap-3">
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                  <GraduationCap className="text-primary-600 dark:text-primary-400" size={20} />
                  سجل الخريجين
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">({graduates.length} خريج)</span>
                </h3>
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={15} />
                  <input type="text" value={graduatesSearch} onChange={e => setGraduatesSearch(e.target.value)} placeholder="بحث بالاسم / الجامعة / الكلية / التخصص..." className="pr-10 pl-5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white w-64" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/5">
                      <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">الخريج</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">تاريخ التخرج</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">الجامعة</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">الكلية</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">التخصص</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">الحالة في المنظومة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/10">
                    {filteredGraduates.map((g: any) => (
                      <tr key={g.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-black text-slate-400 dark:bg-white/10 dark:text-slate-300 text-xs">{g.name?.charAt(0) || '؟'}</div>
                            <div className="font-black text-slate-700 dark:text-slate-200 text-sm">{g.name}</div>
                          </div>
                        </td>
                        <td className="p-5 text-xs text-slate-400 dark:text-slate-300 font-bold">{g.graduatedAt ? new Date(g.graduatedAt).toLocaleDateString('ar-EG') : '—'}</td>
                        <td className="p-5 font-bold text-slate-600 dark:text-slate-300 text-xs">{g.university || '—'}</td>
                        <td className="p-5 font-bold text-slate-600 dark:text-slate-300 text-xs">{g.college || '—'}</td>
                        <td className="p-5 font-bold text-slate-600 dark:text-slate-300 text-xs">{g.major || '—'}</td>
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-full font-black text-[10px] ${g.status === 'current' ? 'bg-vibrant-50 dark:bg-vibrant-500/20 text-vibrant-600 dark:text-vibrant-400' : 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400'}`}>{g.status === 'current' ? 'خريج - مكتمل' : 'خريج سابق'}</span>
                        </td>
                      </tr>
                    ))}
                    {filteredGraduates.length === 0 && (
                      <tr><td colSpan={6} className="p-16 text-center text-slate-300 dark:text-slate-400 font-bold">لا يوجد خريجين مسجلين حالياً</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              );
            })()}
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <ReportsTab reports={reports} onApproveReport={handleApproveReport} />
        )}
      </AnimatePresence>

      <DailyReadingsCard />
      <MessagesSection />
    </div>
  );
}

function StatCard({ label, value, icon, color = 'primary' }: any) {
  const colors: any = {
    primary: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    ocean: 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400',
    rose: 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    warm: 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400'
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-white/[0.04] dark:bg-card-dark flex items-center gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-sm ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-300">{label}</p>
        <h4 className="text-xl font-black text-slate-800 dark:text-white">{value}</h4>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick}
      className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${active ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 shadow-lg' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white'}`}
    >
      {icon}
      {label}
    </button>
  );
}
