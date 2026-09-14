import { motion } from 'motion/react';
import { Trophy, BellRing, Zap, Target, Plus, Sword, Flag, Rocket, Star, Activity, ChevronLeft } from 'lucide-react';
import { AppPermission } from '../../types/permissions';

interface EventCompetitionViewProps {
  selectedEvent: any;
  teams: any[];
  criteria: any[];
  setShowCriteriaModal: (open: boolean) => void;
  setShowTeamModal: (open: boolean) => void;
  setShowLiveLeaderboard: (open: boolean) => void;
  handleCallCompetition: () => void;
  isCompetitionActive: boolean;
  setScoringModal: (data: any) => void;
  hasPermission: (perm: AppPermission) => boolean;
}

export function EventCompetitionView({
  selectedEvent, teams, criteria, setShowCriteriaModal, setShowTeamModal,
  setShowLiveLeaderboard, handleCallCompetition, isCompetitionActive, setScoringModal, hasPermission,
}: EventCompetitionViewProps) {
  const canManageCompetition = selectedEvent?.canManage || hasPermission(AppPermission.MANAGE_COMPETITIONS);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="competition" className="space-y-10">
      <div className="flex justify-between items-center bg-white dark:bg-white/5 p-8 rounded-card border border-slate-100 dark:border-white/10">
        <div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white">لوحة تنافس الفرق</h3>
          <p className="text-xs text-amber-400 font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
            <Trophy size={14} /> التحدي الجاري: {selectedEvent.title}
          </p>
        </div>
        <div className="flex gap-4">
          {canManageCompetition && (
            <button
              onClick={handleCallCompetition}
              className={`neon-btn neon-btn-sm ${isCompetitionActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-default' : 'neon-btn-danger opacity-80'}`}
            >
              <BellRing size={14} /> {isCompetitionActive ? 'المسابقة مفعّلة' : 'استدعاء المسابقة'}
            </button>
          )}
          <button
            onClick={() => setShowLiveLeaderboard(true)}
            className="neon-btn neon-btn-secondary neon-btn-sm shadow-glow"
          >
            <Zap size={14} /> وضع العرض المباشر
          </button>
          {canManageCompetition && (
            <button onClick={() => setShowCriteriaModal(true)} className="neon-btn neon-btn-info neon-btn-sm">
              <Target size={14} /> معايير التقييم
            </button>
          )}
          {canManageCompetition && (
            <button onClick={() => setShowTeamModal(true)} className="neon-btn neon-btn-primary neon-btn-sm shadow-glow">
              <Plus size={16} /> بناء فريق جديد
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h4 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Zap className="text-amber-400" size={20} /> ترتيب الفرق المباشر
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0)).map((team: any, idx: number) => {
              const progress = Math.min(((team.total_score || 0) / selectedEvent.winning_threshold) * 100, 100);
              return (
                <div key={team.id} className="p-6 bg-white dark:bg-white/5 rounded-card border border-slate-100 dark:border-white/5 hover:border-amber-400/20 transition-all group overflow-hidden relative">
                  {idx === 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-amber-400/10 rounded-bl-full flex items-center justify-center"><Trophy size={20} className="text-amber-400 translate-x-2 -translate-y-2" /></div>}
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-400/10 rounded-2xl flex items-center justify-center text-amber-400">
                        <Sword size={24} />
                      </div>
                      <div>
                        <h5 className="text-xl font-black text-slate-900 dark:text-white">{team.name}</h5>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{team.members_count || 0} عضو</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-3xl font-black text-slate-900 dark:text-white">{team.total_score || 0}</p>
                      <p className="text-[8px] text-slate-500 font-black uppercase">إجمالي النقاط</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                      <span>التقدم نحو الفوز</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-white dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]" />
                    </div>
                  </div>
                </div>
              );
            })}
            {teams.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-card">
                <Flag className="mx-auto text-slate-400 mb-4" size={40} />
                <p className="text-slate-400 font-bold">لم يتم إنشاء أي فرق لهذه المسابقة بعد</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Rocket className="text-neon-secondary" size={20} /> العمليات السريعة والتقييم
          </h4>
          <div className="bg-white dark:bg-white/5 rounded-card border border-slate-100 dark:border-white/5 p-8 space-y-8">
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-black uppercase tracking-widest">توزيع درجات فورية</p>
              {canManageCompetition ? (
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => setScoringModal({ isOpen: true, team: teams[0] || null, scores: {}, individualScores: {} })}
                    className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><Plus size={16} /></div>
                      <span className="text-xs font-black">إضافة نقاط جماعية</span>
                    </div>
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => setScoringModal({ isOpen: true, team: teams[0] || null, scores: {}, individualScores: {} })}
                    className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 hover:bg-rose-500 hover:text-black transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center"><Plus size={16} className="rotate-45" /></div>
                      <span className="text-xs font-black">خصم نقاط (سالب)</span>
                    </div>
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-slate-400 font-bold border-2 border-dashed border-slate-100 dark:border-white/10 rounded-xl">
                  عرض النتائج فقط — يملك التحكم الكامل متحكم مُعيَّن أو من لديه صلاحية إدارة المسابقات
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-slate-100 dark:border-white/5 space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500 font-black uppercase tracking-widest">آخر التحركات</p>
                <Activity size={14} className="text-amber-400 animate-pulse" />
              </div>
              <div className="p-6 text-center text-sm text-slate-500 font-bold">
                سيتم عرض آخر التحركات هنا عند توفرها
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 dark:border-white/5 space-y-6">
              <p className="text-xs text-slate-500 font-black uppercase tracking-widest">المعايير النشطة</p>
              <div className="space-y-3">
                {criteria.map((c: any) => (
                  <div key={c.id} className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <h6 className="text-sm font-black text-slate-900 dark:text-white">{c.title}</h6>
                      <p className="text-[10px] text-slate-500 font-bold">الدرجة القصوى: {c.max_score}</p>
                    </div>
                    <div className="p-2 bg-neon-secondary/10 text-neon-secondary rounded-lg">
                      <Star size={14} />
                    </div>
                  </div>
                ))}
                {criteria.length === 0 && (
                  <div className="text-center py-6 text-[10px] text-slate-400 font-bold italic">
                    يرجى إضافة معايير لبدء التقييم
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
