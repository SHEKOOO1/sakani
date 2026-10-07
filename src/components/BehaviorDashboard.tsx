import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { motion, AnimatePresence } from 'motion/react';
import { useApi } from '../hooks/useApi';
import { useSnackbar } from '../contexts/SnackbarContext';
import { 
  Trophy, AlertTriangle, History, TrendingUp,
  Undo2, Sparkles, Search
} from 'lucide-react';
import PointModal from './behavior/PointModal';
import WarningModal from './behavior/WarningModal';

export function BehaviorDashboard() {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const mounted = useMounted();
  
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'points' | 'warnings'>('points');
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  
  const [pointModal, setPointModal] = useState(false);
  const [warningModal, setWarningModal] = useState(false);

  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = students.filter((s: any) =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleStudentSelection = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleIssueWarning = async (data: { level: string; reason: string; deductPoints: number }) => {
    try {
      const targetIds = isBulkMode ? selectedStudents : [selectedStudent?.id];
      if (targetIds.length === 0 || !targetIds[0]) {
        showSnackbar('يرجى اختيار طالب واحد على الأقل', 'warning');
        return;
      }
      await Promise.all(targetIds.map(id => 
        request('/api/behavior/warnings', {
          method: 'POST',
          body: JSON.stringify({ studentId: id, level: data.level, reason: data.reason, deductPoints: data.deductPoints || 0 })
        })
      ));
      showSnackbar(`تم إصدار الإنذار بنجاح لـ ${targetIds.length} طالب`, 'success');
      setWarningModal(false);
      setSelectedStudents([]);
      setIsBulkMode(false);
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleAddPoints = async (data: { points: number; description: string }) => {
    if (!selectedStudent) { showSnackbar('يرجى اختيار طالب', 'warning'); return; }
    try {
      await request('/api/behavior/points', {
        method: 'POST',
        body: JSON.stringify({ studentId: selectedStudent.id, points: data.points, description: data.description })
      });
      showSnackbar('تم إضافة النقاط بنجاح', 'success');
      setPointModal(false);
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleUndoWarning = async (warningId: string) => {
    if (!await confirm({ message: 'هل أنت متأكد من إلغاء هذا الإنذار؟', type: 'danger' })) return;
    try {
      await request(`/api/behavior/warnings/${warningId}/reverse`, { method: 'POST' });
      showSnackbar('تم إلغاء الإنذار بنجاح', 'success');
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsRes, historyRes, warningsRes] = await Promise.all([
        request('/api/behavior/students'),
        request('/api/behavior/points/history'),
        request('/api/behavior/warnings')
      ]);
      if (!mounted.current) return;
      setStudents(studentsRes.data || []);
      setPointsHistory(historyRes.data || []);
      setWarnings(warningsRes.data || []);
    } catch (err) { console.error(err); }
    finally { if (mounted.current) setLoading(false); }
  }, [request]);

  useEffect(() => {

    fetchData();
    
  }, [fetchData]);

  const tabs = [
    { id: 'overview', label: 'نظرة عامة', icon: Trophy },
    { id: 'history', label: 'السجل', icon: History },
  ] as const;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-6 text-white shadow-xl">
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black">لوحة السلوك</h1>
            <p className="text-white/70 font-bold text-sm">إدارة نقاط السلوك والإنذارات</p>
          </div>
        </div>
      </div>

      <div className="flex bg-slate-100 dark:bg-white/10 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 shadow-lg' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white'}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-white/[0.04] dark:bg-card-dark overflow-hidden">
              <div className="border-b border-slate-50 p-5 dark:border-white/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">الطلاب</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث..."
                        className="pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none w-48 dark:text-white" />
                    </div>
                    <button onClick={() => { setIsBulkMode(!isBulkMode); setSelectedStudents([]); }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${isBulkMode ? 'bg-primary-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300'}`}>
                      متعدد
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/5">
                      {isBulkMode && <th className="p-4 w-12"></th>}
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-300">الطالب</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">النقاط</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">إنذارات نشطة</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">التقييم</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/10">
                    {filteredStudents.length > 0 ? filteredStudents.map((s: any) => {
                      const evalColor = s.points >= 80 ? 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400' : s.points >= 60 ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400' : s.points >= 30 ? 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400';
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          {isBulkMode && (
                            <td className="p-4 text-center">
                              <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => toggleStudentSelection(s.id)} className="accent-primary-600" />
                            </td>
                          )}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-black text-slate-500 dark:bg-white/10 dark:text-slate-300 text-xs">{s.name?.charAt(0)}</div>
                              <span className="font-black text-slate-700 dark:text-slate-200 text-sm">{s.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center font-black text-lg text-slate-800 dark:text-white">{s.points}</td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full font-black text-xs ${s.active_warnings > 0 ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400'}`}>
                              {s.active_warnings || 0}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full font-black text-[10px] ${evalColor}`}>
                              {s.points >= 80 ? 'ممتاز' : s.points >= 60 ? 'جيد' : s.points >= 30 ? 'متوسط' : 'منخفض'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => { setSelectedStudent(s); setPointModal(true); }}
                                className="px-3 py-1.5 bg-ocean-600 text-white rounded-xl text-[10px] font-black hover:bg-ocean-700 transition-all">نقاط</button>
                              <button onClick={() => { setSelectedStudent(s); setWarningModal(true); }}
                                className="px-3 py-1.5 bg-warm-600 text-white rounded-xl text-[10px] font-black hover:bg-warm-700 transition-all">إنذار</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={isBulkMode ? 6 : 5} className="p-12 text-center text-slate-300 dark:text-slate-400 font-bold">لا يوجد طلاب</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-white/[0.04] dark:bg-card-dark overflow-hidden">
              <div className="border-b border-slate-50 flex dark:border-white/5">
                <button onClick={() => setActiveHistoryTab('points')}
                  className={`flex-1 py-4 text-xs font-black transition-all ${activeHistoryTab === 'points' ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 border-b-2 border-primary-600' : 'text-slate-400 dark:text-slate-300'}`}>
                  سجل النقاط
                </button>
                <button onClick={() => setActiveHistoryTab('warnings')}
                  className={`flex-1 py-4 text-xs font-black transition-all ${activeHistoryTab === 'warnings' ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 border-b-2 border-primary-600' : 'text-slate-400 dark:text-slate-300'}`}>
                  سجل الإنذارات
                </button>
              </div>

              {activeHistoryTab === 'points' ? (
                <div className="divide-y divide-slate-50 dark:divide-white/10">
                  {pointsHistory.length > 0 ? pointsHistory.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-50 dark:bg-ocean-500/20">
                        <TrendingUp size={16} className="text-ocean-600 dark:text-ocean-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{p.student_name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-300">{p.description || 'إضافة نقاط'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(p.created_at).toLocaleString('ar-EG')}</p>
                      </div>
                      <span className="text-lg font-black text-ocean-600 dark:text-ocean-400">+{p.points}</span>
                    </div>
                  )) : <div className="p-12 text-center text-slate-300 dark:text-slate-400 font-bold">لا توجد سجلات نقاط</div>}
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-white/10">
                  {warnings.length > 0 ? warnings.map((w: any) => (
                    <div key={w.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/20">
                        <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{w.student_name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-300">{w.reason}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(w.created_at).toLocaleString('ar-EG')} • مستوى: {w.level}</p>
                      </div>
                      <button onClick={() => handleUndoWarning(w.id)}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-rose-500 hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10 transition-all">
                        <Undo2 size={12} /> إلغاء
                      </button>
                    </div>
                  )) : <div className="p-12 text-center text-slate-300 dark:text-slate-400 font-bold">لا توجد إنذارات مسجلة</div>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PointModal
        open={pointModal}
        onClose={() => setPointModal(false)}
        studentName={selectedStudent?.name}
        onSubmit={handleAddPoints}
      />

      <WarningModal
        open={warningModal}
        onClose={() => setWarningModal(false)}
        studentName={selectedStudent?.name}
        hasPoints={selectedStudent?.points ?? 0}
        onSubmit={handleIssueWarning}
      />
    </div>
  );
}
