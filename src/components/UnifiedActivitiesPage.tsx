import { useState, useEffect, useCallback, useRef } from 'react';
import { EventDetailModal } from './activities/EventDetailModal';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
  Calendar, Trophy, MapPin, Users, Clock, Check,
  ChevronLeft, Star, Target, Loader2, AlertCircle,
  UserPlus, Sword, Flag, Zap, CheckCircle2,
  Smartphone
} from 'lucide-react';

export function UnifiedActivitiesPage() {
  const { request } = useApi();
  const { user } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const [activeTab, setActiveTab] = useState<'events' | 'competitions'>('events');

  const [events, setEvents] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [compTeams, setCompTeams] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [joiningComp, setJoiningComp] = useState<string | null>(null);

  const [detailEvent, setDetailEvent] = useState<any>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, compRes] = await Promise.all([
        request('/api/events'),
        request('/api/competitions')
      ]);
      if (eventsRes.success) setEvents(eventsRes.data || []);
      if (compRes.success) {
        const comps = compRes.data || [];
        setCompetitions(comps);

        const activeComps = comps.filter((c: any) => c.status === 'active');
        const teamsMap: Record<string, any[]> = {};
        await Promise.all(activeComps.map(async (c: any) => {
          try {
            const tRes = await request(`/api/competitions/${c.id}/teams`);
            if (tRes.success) teamsMap[c.id] = tRes.data || [];
          } catch { console.error('فشل تحميل فرق المسابقة'); }
        }));
        setCompTeams(teamsMap);
      }
    } catch (err) { console.error(err); showSnackbar('فشل تحميل الأنشطة', 'error'); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkAttendance = async (eventId: string) => {
    setJoining(eventId);
    try {
      await request('/api/events/attendance', {
        method: 'POST',
        body: JSON.stringify({ eventId, status: 'present', checkInMethod: 'manual' })
      });
      fetchData();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setJoining(null); }
  };

  const handleJoinCompetition = async (compId: string) => {
    setJoiningComp(compId);
    try {
      await request(`/api/competitions/${compId}/join`, { method: 'POST' });
      fetchData();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setJoiningComp(null); }
  };

  const isEnrolled = (event: any) => !!(event.attendance_records?.length);
  const today = new Date();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans" dir="rtl">
      <div>
        <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">
          الفعاليات والمسابقات
        </h1>
        <p className="text-slate-500 mt-2 font-bold">
          سجل حضورك في الفعاليات وشارك في المسابقات
        </p>
      </div>

      <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl w-fit border border-slate-200 dark:border-white/5">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
            activeTab === 'events'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Calendar size={18} /> الفعاليات
        </button>
        <button
          onClick={() => setActiveTab('competitions')}
          className={`px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
            activeTab === 'competitions'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Trophy size={18} /> المسابقات
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'events' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
              <Calendar size={48} className="mx-auto text-slate-300 dark:text-slate-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-300 font-bold">لا توجد فعاليات حالياً</p>
            </div>
          )}
          {events.map((event: any) => (
            <div
              key={event.id}
              onClick={() => {
                setDetailEvent(event);
                setShowEventDetail(true);
              }}
              className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Calendar size={24} />
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {new Date(event.event_date).toLocaleDateString('ar-EG')}
                </span>
              </div>

              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">{event.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">{event.description}</p>

              <div className="flex items-center gap-4 text-xs font-bold text-slate-400 dark:text-slate-500 mb-6">
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} /> {event.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} /> {event.is_paid ? `${event.price} ج.م` : 'مجاني'}
                </span>
              </div>

              {event.is_paid && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 mb-4">
                  <Smartphone size={12} />
                  دفع عبر InstaPay
                </div>
              )}

              {/* Subscription status badges */}
              {event._user_subscription && event._user_subscription.status === 'approved' && (
                <div className="flex items-center justify-center gap-2 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-500/20 font-bold text-xs mb-3">
                  <Check size={14} /> مشترك
                </div>
              )}
              {event._user_subscription && event._user_subscription.status === 'pending' && (
                <div className="flex items-center justify-center gap-2 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-500/20 font-bold text-xs mb-3">
                  <Clock size={14} /> قيد المراجعة
                </div>
              )}

              {isEnrolled(event) ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-500/20 font-bold text-sm">
                  <CheckCircle2 size={18} /> مسجل حضورك
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAttendance(event.id);
                  }}
                  disabled={joining === event.id}
                  className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:bg-black dark:hover:bg-slate-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {joining === event.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  تسجيل حضور
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {competitions.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
              <Trophy size={48} className="mx-auto text-slate-300 dark:text-slate-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-300 font-bold">لا توجد مسابقات حالياً</p>
            </div>
          )}
          {competitions.map((comp: any) => {
            const isActive = comp.status === 'active';
            const isFinished = comp.status === 'finished';
            const teams = compTeams[comp.id] || [];
            const sortedTeams = [...teams].sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0));

            return (
              <div
                key={comp.id}
                className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden"
              >
                <div className="p-6 md:p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${
                        isActive ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        isFinished ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        'bg-slate-50 dark:bg-slate-500/10 text-slate-500'
                      }`}>
                        <Trophy size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">{comp.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{comp.description}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black ${
                      isActive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' :
                      isFinished ? 'bg-slate-100 dark:bg-slate-500/10 text-slate-500 border border-slate-200 dark:border-slate-500/20' :
                      'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
                    }`}>
                      {isActive ? 'جارية' : isFinished ? 'منتهية' : 'قادمة'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-6 text-sm font-bold text-slate-500 dark:text-slate-400 mb-6">
                    <span className="flex items-center gap-1.5"><Star size={16} className="text-amber-500" /> {comp.prize_points || 0} نقطة جوائز</span>
                    <span className="flex items-center gap-1.5"><Users size={16} /> {teams.reduce((s: number, t: any) => s + (t.members?.length || 0), 0)} مشارك</span>
                    {comp.start_date && <span className="flex items-center gap-1.5"><Clock size={16} /> من {new Date(comp.start_date).toLocaleDateString('ar-EG')}</span>}
                  </div>

                  {isActive && (
                    <div className="mb-6">
                      <button
                        onClick={() => handleJoinCompetition(comp.id)}
                        disabled={joiningComp === comp.id}
                        className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {joiningComp === comp.id ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                        انضم للمسابقة
                      </button>
                    </div>
                  )}

                  {sortedTeams.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-white/10 pt-6">
                      <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <Zap size={16} className="text-amber-500" /> ترتيب الفرق
                      </h4>
                      <div className="space-y-3">
                        {sortedTeams.map((team: any, idx: number) => (
                          <div key={team.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                                idx === 0 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                idx === 1 ? 'bg-slate-200 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400' :
                                idx === 2 ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                                'bg-slate-100 dark:bg-slate-500/10 text-slate-500'
                              }`}>
                                {idx === 0 ? <Trophy size={14} /> : idx + 1}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-slate-800 dark:text-white">{team.name}</span>
                                <span className="text-xs text-slate-400 mr-3">{team.members?.length || 0} أعضاء</span>
                              </div>
                            </div>
                            <span className="text-lg font-black text-slate-800 dark:text-white">{team.total_score || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EventDetailModal
        open={showEventDetail}
        detailEvent={detailEvent}
        onClose={() => { setShowEventDetail(false); setDetailEvent(null); }}
      />
    </div>
  );
}
