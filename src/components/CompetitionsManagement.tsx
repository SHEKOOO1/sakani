import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { 
  Trophy,
  Calendar,
  Users,
  Play,
  CheckCircle,
  Plus,
  Rocket,
  Timer,
  X,
  LayoutDashboard,
  Trash2,
  Clock
} from 'lucide-react';
import { CreateCompetitionModal } from './competitions/CreateCompetitionModal';
import { TeamManagementModal } from './competitions/TeamManagementModal';
import { ScoreModal } from './competitions/ScoreModal';
import { FinishCompetitionModal } from './competitions/FinishCompetitionModal';
import { ManagersModal } from './items/ManagersModal';
import { Skeleton } from './Skeleton';

export function CompetitionsManagement({ defaultView = 'setup' }: { defaultView?: 'setup' | 'teams' }) {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(defaultView);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [finishModal, setFinishModal] = useState<any>(null);
  const [selectedComp, setSelectedComp] = useState<any>(null); // For detailed team view
  const [teamModal, setTeamModal] = useState(false);
  const [compTeams, setCompTeams] = useState<any[]>([]);
  const [managersItem, setManagersItem] = useState<{ itemType: 'competition'; itemId: string; itemTitle?: string } | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    prizePoints: 50,
    questionsCount: 0,
    responsibleId: '',
    criteria: [] as { _key?: string; title: string; maxPoints: number }[]
  });

  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const [scoreModal, setScoreModal] = useState<{ teamId: string; studentId?: string; studentName?: string } | null>(null);
  const mounted = useMounted();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes, eRes] = await Promise.all([
        request('/api/competitions'),
        request('/api/students'),
        request('/api/users')
      ]);
      if (!mounted.current) return;
      setCompetitions(cRes.data || []);
      setStudents(sRes.data || []);
      setEmployees((eRes.data || []).filter((u: any) => u.role !== 'student'));
    } catch (err) { console.error(err); showSnackbar('فشل تحميل بيانات المسابقات', 'error'); }
    finally { if (mounted.current) setLoading(false); }
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) fetchData();
    return () => { cancelled = true; };
  }, [fetchData]);

  const fetchTeams = async (compId: string) => {
    try {
        const resp = await request(`/api/competitions/${compId}/teams`);
        setCompTeams(resp.data || []);
    } catch (err) { console.error(err); showSnackbar('فشل تحميل الفرق', 'error'); }
  };

  const handleCreate = async () => {
    try {
      await request('/api/competitions', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setModal(false);
      fetchData();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await request(`/api/competitions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleCreateTeam = async (teamData: { name: string; responsibleId: string; studentIds: string[] }) => {
    try {
        await request(`/api/competitions/${selectedComp.id}/teams`, {
            method: 'POST',
            body: JSON.stringify(teamData)
        });
        setTeamModal(false);
        fetchTeams(selectedComp.id);
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleSubmitScore = async (points: number) => {
    if (!scoreModal) return;
    if (points <= 0) { showSnackbar('دخل رقم صحيح من فضلك', 'warning'); return; }
    try {
      if (scoreModal.studentId) {
        await request(`/api/competitions/teams/${scoreModal.teamId}/members/${scoreModal.studentId}/score`, {
          method: 'POST',
          body: JSON.stringify({ points })
        });
        showSnackbar(`تم منح ${points} نقطة لـ ${scoreModal.studentName}`, 'success');
      } else {
        await request(`/api/competitions/teams/${scoreModal.teamId}/score`, {
          method: 'POST',
          body: JSON.stringify({ points })
        });
      }
      setScoreModal(null);
      fetchTeams(selectedComp.id);
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleTeamScore = (teamId: string) => {
    setScoreModal({ teamId });
  };

  const handleMemberScore = (teamId: string, studentId: string, studentName: string) => {
    setScoreModal({ teamId, studentId, studentName });
  };

  const toggleWinner = (id: string) => {
    setSelectedWinners(prev => 
      prev.includes(id) ? prev.filter(wi => wi !== id) : [...prev, id]
    );
  };

  const handleFinish = async (winners: string[]) => {
    if (!finishModal) return;
    if (!await confirm({ message: 'هل أنت متأكد من توزيع الجوائز على المختارين وإغلاق المسابقة نهائياً؟', type: 'danger' })) return;
    try {
        await request(`/api/competitions/${finishModal.id}/finish`, {
            method: 'POST',
            body: JSON.stringify({ winners })
        });
        setFinishModal(null);
        setSelectedWinners([]);
        fetchData();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  if (!hasPermission(AppPermission.MANAGE_COMPETITIONS) && !loading && competitions.every((c: any) => !c.canManage)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Trophy size={60} className="mx-auto text-slate-300 dark:text-slate-400" />
          <h2 className="text-2xl font-black text-slate-400 dark:text-slate-300">غير مصرح بالوصول</h2>
          <p className="text-slate-500 dark:text-slate-300 font-bold">ليست لديك صلاحية إدارة المسابقات.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-800 dark:text-white tracking-tighter">المسابقات التفاعلية</h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1 font-medium italic">تحفيز الروح التنافسية والالتزام داخل السكن.</p>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate('/leaderboard')}
                className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl active:scale-95"
            >
                <LayoutDashboard size={20} />
                لوحة الصدارة المباشرة
            </button>
            <div className="flex bg-slate-100 dark:bg-white/10 p-1 rounded-2xl">
                <button onClick={() => setActiveTab('setup')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'setup' ? 'bg-white dark:bg-card-dark text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'}`}>التهيئة</button>
                <button onClick={() => setActiveTab('teams')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'teams' ? 'bg-white dark:bg-card-dark text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'}`}>الفرق والنتائج</button>
            </div>
            {hasPermission(AppPermission.MANAGE_COMPETITIONS) && activeTab === 'setup' && (
            <button 
                onClick={() => setModal(true)}
                className="px-8 py-4 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-3 active:scale-95"
            >
                <Plus size={24} />
                إنشاء مسابقة جديدة
            </button>
            )}
        </div>
      </div>

      {activeTab === 'teams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-[2rem]" />
              )) : competitions.filter(c => c.status === 'active').map((c: any) => (
                  <div key={c.id} className="bg-white dark:bg-card-dark p-6 rounded-[2rem] border border-slate-100 dark:border-white/[0.05] shadow-sm flex items-center justify-between">
                      <div>
                          <h3 className="font-black text-slate-800 dark:text-white">{c.title}</h3>
                          <p className="text-xs text-blue-500 dark:text-blue-400 font-bold">بإشراف: {employees.find((e: any) => e.id === c.responsible_id)?.name || 'غير محدد'}</p>
                      </div>
                      <button 
                        onClick={() => {
                            setSelectedComp(c);
                            fetchTeams(c.id);
                        }}
                        className="px-6 py-2 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-all"
                      >
                          إدارة الفرق
                      </button>
                  </div>
              ))}
              {competitions.filter(c => c.status === 'active').length === 0 && !loading && <p className="col-span-full text-center py-20 text-slate-400 dark:text-slate-300 font-bold">لا يوجد مسابقات نشطة حالياً للتحكيم</p>}
          </div>
      )}

      {activeTab === 'setup' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[420px] rounded-[3rem]" />
        )) : competitions.map((c) => (
          <motion.div 
            key={c.id} 
            layout
            className="bg-white dark:bg-card-dark rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden flex flex-col group hover:shadow-2xl hover:shadow-slate-100 dark:hover:shadow-black/20 transition-all"
          >
            <div className={`h-4 ${
              c.status === 'active' ? 'bg-primary-600' : 
              c.status === 'finished' ? 'bg-emerald-500' : 'bg-slate-200'
            }`} />
            
            <div className="p-8 flex-1 flex flex-col">
               <div className="flex justify-between items-start mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                     c.status === 'active' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-300'
                  }`}>
                    <Trophy size={28} />
                  </div>
                  <div className="text-left">
                     <p className="text-[10px] font-black text-slate-300 dark:text-slate-400 uppercase tracking-widest">Prize</p>
                     <p className="text-xl font-black text-blue-600 dark:text-blue-400">{c.prize_points} pt</p>
                  </div>
               </div>

               <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 truncate">{c.title}</h3>
               <p className="text-slate-400 dark:text-slate-300 font-medium text-sm line-clamp-2 mb-6 leading-relaxed">{c.description}</p>
               
               <div className="space-y-3 mt-auto">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                     <Calendar size={14} className="text-slate-300 dark:text-slate-400" />
                     تنتهي في: {new Date(c.end_date).toLocaleDateString('ar-EG')}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                     <Timer size={14} className="text-slate-300 dark:text-slate-400" />
                     الحالة: 
                     <span className={`font-black ${
                       c.status === 'active' ? 'text-blue-600' : 
                       c.status === 'finished' ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-300'
                     }`}>
                        {c.status === 'draft' ? 'مسودة' : 
                         c.status === 'active' ? 'جارية الآن' : 
                         c.status === 'finished' ? 'انتهت' : 'ملغاة'}
                     </span>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-white/5 flex gap-4">
                <button 
                  onClick={() => {
                    setSelectedComp(c);
                    fetchTeams(c.id);
                  }}
                  className="px-4 py-4 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all font-black text-sm"
                  title="إدارة الفرق"
                >
                  <Users size={16} />
                </button>
               {(['admin', 'bishop', 'priest', 'supervisor'].includes(user?.role as string) || c.canManage) && (
                  <button 
                    onClick={() => setManagersItem({ itemType: 'competition', itemId: c.id, itemTitle: c.title })}
                    className="px-4 py-4 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all font-black text-sm"
                    title="إدارة المتحكمين"
                  >
                    <Users size={16} className="rotate-180" />
                  </button>
               )}
               {c.status === 'draft' && (c.canManage || hasPermission(AppPermission.MANAGE_COMPETITIONS)) && (
                  <button 
                     onClick={() => updateStatus(c.id, 'active')}
                     className="flex-1 py-4 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 shadow-lg shadow-primary-500/20 transition-all"
                  >
                     <Play size={16} />
                     إطلاق المسابقة
                  </button>
               )}
               {c.status === 'active' && (c.canManage || hasPermission(AppPermission.MANAGE_COMPETITIONS)) && (
                 <button 
                    onClick={() => setFinishModal(c)}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 shadow-lg"
                 >
                    <CheckCircle size={16} />
                    تحديد الفائزين وإنهاء
                 </button>
               )}
               {c.status === 'finished' && (
                  <div className="w-full flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-sm">
                    <Clock size={16} />
                    تم توزيع الجوائز
                 </div>
               )}
               {c.status !== 'active' && (c.canManage || hasPermission(AppPermission.MANAGE_COMPETITIONS)) && (
                 <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!await confirm({ message: `هل أنت متأكد من حذف المسابقة "${c.title}" بالكامل؟`, type: 'danger' })) return;
                      try {
                        await request(`/api/competitions/${c.id}`, { method: 'DELETE' });
                        await fetchData();
                        showSnackbar('تم حذف المسابقة بنجاح', 'success');
                      } catch (err: any) { showSnackbar(err.message, 'error'); }
                    }}
                    className="px-4 py-4 bg-white dark:bg-card-dark border border-red-200 dark:border-red-900/30 rounded-2xl text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all font-black text-sm"
                    title="حذف المسابقة"
                 >
                    <Trash2 size={16} />
                 </button>
               )}
            </div>
          </motion.div>
        ))}

        {competitions.length === 0 && !loading && (
          <div className="col-span-full py-40 border-4 border-dashed border-slate-100 dark:border-white/[0.05] rounded-[3rem] flex flex-col items-center justify-center text-center">
             <Rocket size={64} className="text-slate-100 dark:text-slate-700 mb-6" />
             <h3 className="text-2xl font-black text-slate-300 dark:text-slate-400">لا يوجد مسابقات حالية</h3>
             <p className="text-slate-200 dark:text-slate-600 font-bold max-w-xs mx-auto mt-2 italic">ابدأ بإنشاء أول مسابقة لتحفيز التفاعل بين الطلاب.</p>
          </div>
        )}
      </div>
      )}

      <CreateCompetitionModal
        isOpen={modal}
        onClose={() => setModal(false)}
        formData={formData}
        onChange={setFormData}
        onSubmit={handleCreate}
        saving={false}
        employees={employees}
        students={students}
      />

      {/* Team Management Modal */}
      <AnimatePresence>
        {selectedComp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={()=>setSelectedComp(null)}/>
                <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white dark:bg-card-dark p-6 sm:p-12 rounded-[4rem] w-full max-w-5xl relative shadow-2xl max-h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-4 sm:mb-8">
                        <div>
                            <h3 className="text-xl sm:text-4xl font-black text-slate-800 dark:text-white">{selectedComp.title}</h3>
                           <p className="text-slate-400 dark:text-slate-300 font-bold mt-1">إدارة الفرق وتوزيع النقاط التفاعلية</p>
                        </div>
                        <div className="flex gap-4">
                           {selectedComp && (selectedComp.canManage || hasPermission(AppPermission.MANAGE_COMPETITIONS)) && (
                           <button onClick={() => setTeamModal(true)} className="px-6 py-3 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-primary-500/20 hover:brightness-110 active:scale-95 transition-all">
                               <Plus size={20} />
                               بناء فريق جديد
                           </button>
                           )}
                           <button onClick={()=>setSelectedComp(null)} className="p-3 bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-300 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all">
                               <X size={24} />
                           </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {compTeams.map(t => (
                                <div key={t.id} className="bg-slate-50 dark:bg-white/5 rounded-xl p-8 border border-slate-100 dark:border-white/10 flex flex-col">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-800 dark:text-white">{t.name}</h4>
                                            <p className="text-xs font-black text-blue-500 dark:text-blue-400 mt-1 uppercase tracking-widest">مسؤول الفريق: {t.responsible_name || 'لا يوجد'}</p>
                                        </div>
                                        <div className="text-left font-black">
                                            <p className="text-[10px] text-slate-400 dark:text-slate-300">نقاط الفريق</p>
                                            <p className="text-2xl text-emerald-600 dark:text-emerald-400">+{t.score}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 mb-6 flex-1">
                                        <p className="text-[10px] font-black text-slate-300 dark:text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
                                            <span>الأعضاء ({t.members.length})</span>
                                            <span>انقر على العضو لرصد نقاط فردية</span>
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {t.members.map((m: any) => (
                                                <button 
                                                    key={m.student_id} 
                                                    onClick={() => selectedComp && (selectedComp.canManage || hasPermission(AppPermission.MANAGE_COMPETITIONS)) && handleMemberScore(t.id, m.student_id, m.student_name)}
                                                    className="group relative px-4 py-2 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-2"
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[8px] group-hover:bg-blue-600 group-hover:text-white">
                                                        {m.student_name.charAt(0)}
                                                    </div>
                                                    {m.student_name}
                                                    {m.score > 0 && (
                                                        <span className="bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md text-[8px]">
                                                            +{m.score}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-auto">
                                        {selectedComp && (selectedComp.canManage || hasPermission(AppPermission.MANAGE_COMPETITIONS)) && (
                                        <button onClick={() => handleTeamScore(t.id)} className="py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 text-xs">
                                            رصد نقاط للفريق
                                        </button>
                                        )}
                                        <button className="py-4 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                                            تعديل الفريق
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {compTeams.length === 0 && (
                                <div className="col-span-full py-20 bg-slate-50 dark:bg-white/5 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-slate-300 dark:text-slate-400">
                                    <Users size={48} className="mb-4 opacity-20" />
                                    <p className="font-bold lowercase">ابدأ ببناء الفرق لتفعيل ميزة النقاط الجماعية</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <TeamManagementModal
        isOpen={teamModal}
        onClose={() => setTeamModal(false)}
        students={students}
        employees={employees}
        onCreateTeam={handleCreateTeam}
        saving={false}
      />
      <ScoreModal
        isOpen={!!scoreModal}
        onClose={() => setScoreModal(null)}
        teamId={scoreModal?.teamId || ''}
        studentId={scoreModal?.studentId}
        studentName={scoreModal?.studentName}
        onSave={handleSubmitScore}
        saving={false}
      />

      <FinishCompetitionModal
        isOpen={!!finishModal}
        onClose={() => setFinishModal(null)}
        onConfirm={handleFinish}
        saving={false}
        competition={finishModal}
        students={students}
        selectedWinners={selectedWinners}
        onToggleWinner={toggleWinner}
      />

      <ManagersModal
        isOpen={!!managersItem}
        onClose={() => setManagersItem(null)}
        itemType="competition"
        itemId={managersItem?.itemId || ''}
        itemTitle={managersItem?.itemTitle}
      />
    </div>
  );
}
