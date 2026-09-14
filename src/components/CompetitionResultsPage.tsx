import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { Trophy, Medal, Target, Users, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Award, Star, Calendar } from 'lucide-react';

type CriterionScore = {
  criterion_id: string;
  criterion_title: string;
  max_score: number;
  score: number;
};

type TeamMember = {
  student_id: string;
  member_name: string;
};

type Team = {
  id: string;
  name: string;
  score: number;
  rank: number;
  members: TeamMember[];
  criterion_scores: CriterionScore[];
};

type CompetitionResult = {
  competition_id: string;
  title: string;
  status: string;
  is_event: boolean;
  created_at: string;
  total_teams: number;
  my_rank: number | null;
  my_team: Team | null;
  teams: Team[];
};

export default function CompetitionResultsPage() {
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl');
  }, []);
  const { user } = useAuth();
  const { request } = useApi();
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/students/competition-results');
        if (res.success) setResults(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">مستمرة</span>;
    if (status === 'finished') return <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-500/15 text-slate-500 border border-slate-500/30">منتهية</span>;
    return <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">مسودة</span>;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={16} className="text-amber-400" />;
    if (rank === 2) return <Medal size={16} className="text-slate-400" />;
    if (rank === 3) return <Medal size={16} className="text-amber-700" />;
    return <span className="text-[10px] font-black text-slate-400">#{rank}</span>;
  };

  const wins = results.filter(r => r.my_rank === 1).length;
  const activeCount = results.filter(r => r.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-amber-400/20 to-orange-400/10 rounded-2xl border border-amber-400/20">
          <Trophy size={28} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">نتائج المسابقات</h1>
          <p className="text-xs text-slate-500 font-bold">سجل مشاركاتك في المسابقات والفعاليات</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">إجمالي المسابقات</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{results.length}</p>
        </div>
        <div className="p-5 bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">مراكز أولى</p>
          <p className="text-3xl font-black text-amber-400 mt-1">{wins}</p>
        </div>
        <div className="p-5 bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">مستمرة حالياً</p>
          <p className="text-3xl font-black text-emerald-500 mt-1">{activeCount}</p>
        </div>
      </div>

      {results.length === 0 && (
        <div className="text-center py-20">
          <Trophy size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-lg font-bold text-slate-400">لم تشارك في أي مسابقة بعد</p>
          <p className="text-xs text-slate-400 mt-1">انضم إلى المسابقات من صفحة الأنشطة</p>
        </div>
      )}

      {/* Competition Cards */}
      <div className="space-y-4">
        {results.map((comp) => {
          const isExpanded = expanded[comp.competition_id] ?? (comp.status === 'active');

          return (
            <div key={comp.competition_id} className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
              {/* Competition Header */}
              <button onClick={() => toggleExpand(comp.competition_id)} className="w-full text-right p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${comp.my_rank === 1 ? 'bg-amber-400/10' : 'bg-slate-100 dark:bg-white/5'}`}>
                    <Award size={20} className={comp.my_rank === 1 ? 'text-amber-400' : 'text-slate-400'} />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">{comp.title}</h3>
                      {getStatusBadge(comp.status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                        <Users size={10} /> {comp.total_teams} فرق
                      </span>
                      {comp.my_rank && (
                        <span className="text-[10px] font-black flex items-center gap-1">
                          {comp.my_rank === 1 ? (
                            <span className="text-amber-400 flex items-center gap-1"><Trophy size={10} /> المركز الأول</span>
                          ) : (
                            <span className="text-slate-500">المركز #{comp.my_rank}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-6 pb-6 space-y-6 border-t border-slate-100 dark:border-white/5 pt-6">
                  {/* My Team Section */}
                  {comp.my_team && (
                    <div className="p-5 bg-gradient-to-br from-amber-400/5 to-orange-400/5 rounded-2xl border border-amber-400/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Star size={16} className="text-amber-400" />
                          <span className="text-sm font-black text-slate-900 dark:text-white">فريقي: {comp.my_team.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-500">المركز: <span className={`${comp.my_rank === 1 ? 'text-amber-400' : 'text-slate-900 dark:text-white'}`}>#{comp.my_rank}</span></span>
                          <span className="text-[10px] font-black text-slate-500">النقاط: <span className="text-slate-900 dark:text-white">{comp.my_team.score}</span></span>
                        </div>
                      </div>

                      {/* Criterion Breakdown */}
                      {comp.my_team.criterion_scores.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">تفصيل النقاط حسب المعايير</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {comp.my_team.criterion_scores.map((cs) => (
                              <div key={cs.criterion_id} className="p-3 bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{cs.criterion_title}</span>
                                  <span className="text-[10px] font-black text-slate-500">{cs.score}/{cs.max_score}</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-l from-amber-400 to-orange-400 rounded-full transition-all" style={{ width: `${Math.min(100, (cs.score / cs.max_score) * 100)}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Team Members */}
                      <div className="mt-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">أعضاء الفريق</p>
                        <div className="flex flex-wrap gap-2">
                          {comp.my_team.members.map((m) => (
                            <span key={m.student_id} className="px-2.5 py-1 bg-white dark:bg-white/5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-white/5">
                              {m.member_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* All Teams Leaderboard */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Target size={14} className="text-slate-400" />
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">ترتيب الفرق</span>
                    </div>
                    <div className="space-y-2">
                      {comp.teams.map((team) => {
                        const isMyTeam = comp.my_team?.id === team.id;
                        return (
                          <div key={team.id} className={`p-4 rounded-xl border transition-all ${isMyTeam ? 'bg-amber-400/5 border-amber-400/20' : 'bg-white dark:bg-white/[0.02] border-slate-100 dark:border-white/5'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                                  {getRankIcon(team.rank)}
                                </div>
                                <div>
                                  <span className="text-sm font-black text-slate-900 dark:text-white">{team.name}</span>
                                  {isMyTeam && <span className="mr-2 text-[9px] font-black text-amber-400">(أنت)</span>}
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {team.members.map((m) => (
                                      <span key={m.student_id} className="text-[9px] text-slate-400 font-medium">{m.member_name}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                {comp.my_team && team.id !== comp.my_team.id && (
                                  team.rank < (comp.my_rank || Infinity)
                                    ? <span className="text-[10px] font-black text-red-500 flex items-center gap-1"><TrendingUp size={12} /> متقدم</span>
                                    : team.rank > (comp.my_rank || 0)
                                      ? <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1"><TrendingDown size={12} /> متأخر</span>
                                      : null
                                )}
                                <span className="text-base font-black text-slate-900 dark:text-white">{team.score}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wins/Losses Summary */}
                  {comp.my_team && comp.teams.length > 1 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-center">
                        <TrendingDown size={16} className="mx-auto text-emerald-500 mb-1" />
                        <p className="text-lg font-black text-emerald-500">
                          {comp.teams.filter(t => t.rank > (comp.my_rank || Infinity)).length}
                        </p>
                        <p className="text-[9px] font-bold text-emerald-600/70">فرق خلفك</p>
                      </div>
                      <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10 text-center">
                        <TrendingUp size={16} className="mx-auto text-red-500 mb-1" />
                        <p className="text-lg font-black text-red-500">
                          {comp.teams.filter(t => t.rank < (comp.my_rank || 0)).length}
                        </p>
                        <p className="text-[9px] font-bold text-red-600/70">فرق أمامك</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
