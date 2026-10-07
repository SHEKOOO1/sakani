import { CalendarDays, Clock, Tv, Radio, Repeat, List, Bell, Film } from 'lucide-react';
import { Playlist, DEFAULT_COVER, FALLBACK_COVER } from '../types';

interface BroadcastScheduleProps {
  broadcasts: any[];
  playlists: Playlist[];
  broadcastReminders: Set<string>;
  user: any;
  publicCalView: boolean;
  onToggleView: () => void;
  onToggleReminder: (broadcastId: string) => void;
  onOpenProgram: (playlist: Playlist) => void;
}

export function BroadcastSchedule({ broadcasts, playlists, broadcastReminders, user, publicCalView, onToggleView, onToggleReminder, onOpenProgram }: BroadcastScheduleProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
            <CalendarDays size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">جدول البرنامج الأسبوعي</h3>
              {user && broadcastReminders.size > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-[9px] font-bold text-amber-600 dark:text-amber-400 rounded-full">
                  {broadcastReminders.size} تذكير{broadcastReminders.size > 1 ? 'ات' : ''}
                </span>
              )}
            </div>
            <p className="text-[9px] text-slate-500 font-bold mt-0.5">مواعيد البث المبرمجة — سمعي / مرئي</p>
          </div>
        </div>
        <button onClick={onToggleView}
          className={"px-2.5 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 " + (publicCalView ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20')}>
          <CalendarDays size={12} /> {publicCalView ? 'عرض القائمة' : 'عرض التقويم'}
        </button>
      </div>
      {broadcasts.length === 0 ? (
        <p className="text-xs font-bold text-slate-400 text-center py-4">لا توجد برامج مجدولة حالياً</p>
      ) : publicCalView ? (
        (() => {
          const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
          const now = new Date();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const weekDates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
          });
          return (
            <div className="grid grid-cols-7 gap-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
              {weekDates.map((date, i) => {
                const dateStr = date.toLocaleDateString('en-CA');
                const dayBroadcasts = broadcasts.filter((b: any) => b.is_active && b.scheduled_at).filter((b: any) => {
                  const bd = new Date(b.scheduled_at);
                  return bd.toLocaleDateString('en-CA') === dateStr;
                }).sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                const isToday = date.toLocaleDateString('en-CA') === now.toLocaleDateString('en-CA');
                return (
                  <div key={i}
                    className={"rounded-xl border p-2 min-h-[120px] transition-all " + (isToday ? 'bg-primary-50 dark:bg-primary-500/5 border-primary-200 dark:border-primary-500/20' : 'bg-white dark:bg-card-dark border-slate-100 dark:border-white/[0.06]')}>
                    <div className={"text-center mb-2 pb-2 border-b border-dashed " + (isToday ? 'border-primary-200 dark:border-primary-500/20' : 'border-slate-100 dark:border-white/10')}>
                      <p className={"text-[8px] font-bold " + (isToday ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400')}>{dayNames[i]}</p>
                      <p className={"text-[15px] font-black " + (isToday ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300')}>{date.getDate()}</p>
                    </div>
                    <div className="space-y-1">
                      {dayBroadcasts.length === 0 ? (
                        <p className="text-[7px] text-slate-300 dark:text-slate-600 text-center py-3">—</p>
                      ) : dayBroadcasts.map((b: any) => (
                        <div key={b.id}
                          onClick={b.playlist_id ? () => { const pl = playlists.find((p: any) => p.id === b.playlist_id); if (pl) onOpenProgram(pl); } : undefined}
                          className="group relative p-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all cursor-pointer">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[8px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{b.title}</span>
                            {b.type === 'video' ? <Tv size={8} className="shrink-0 text-red-500" /> : b.type === 'both' ? null : <Radio size={8} className="shrink-0 text-primary-500" />}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={7} className="text-slate-400" />
                            <span className="text-[7px] font-bold text-slate-500 font-mono">
                              {b.scheduled_at ? new Date(b.scheduled_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {broadcasts.sort((a: any, b: any) => {
            const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            if (!a.scheduled_at) return 1; if (!b.scheduled_at) return -1;
            const aDate = new Date(a.scheduled_at); const bDate = new Date(b.scheduled_at);
            const aDay = dayOrder.indexOf(aDate.toLocaleDateString('en-US', { weekday: 'long' }));
            const bDay = dayOrder.indexOf(bDate.toLocaleDateString('en-US', { weekday: 'long' }));
            if (aDay !== bDay) return aDay - bDay;
            return aDate.getTime() - bDate.getTime();
          }).map((b: any) => {
            const dt = b.scheduled_at ? new Date(b.scheduled_at) : null;
            const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const type = b.type || 'audio';
            const diff = dt ? dt.getTime() - Date.now() : 0;
            const isPast = diff < 0;
            const linkedPlaylist = b.playlist_id ? playlists.find(p => p.id === b.playlist_id) : null;
            return (
              <div key={b.id} onClick={linkedPlaylist ? () => onOpenProgram(linkedPlaylist) : undefined}
                role={linkedPlaylist ? 'button' : undefined} tabIndex={linkedPlaylist ? 0 : undefined}
                onKeyDown={linkedPlaylist ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onOpenProgram(linkedPlaylist); } : undefined}
                className={"flex items-start gap-4 p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all group" + (linkedPlaylist ? ' cursor-pointer' : '')}>
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-white/10">
                  <img src={b.cover_image || DEFAULT_COVER} alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { const el = e.target as HTMLImageElement; el.src = FALLBACK_COVER; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{b.title}</p>
                    {type === 'video' ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 rounded text-[8px] font-bold text-red-600 dark:text-red-400"><Tv size={10} /> مرئي</span>
                    ) : type === 'both' ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 rounded text-[8px] font-bold text-purple-600 dark:text-purple-400">سمعي + مرئي</span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-500/10 rounded text-[8px] font-bold text-primary-600 dark:text-primary-400"><Radio size={10} /> إذاعي</span>
                    )}
                    {b.recurring && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 rounded text-[8px] font-bold text-emerald-600 dark:text-emerald-400"><Repeat size={10} /> أسبوعي</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {dt && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{dayNames[dt.getDay()]}</span>}
                    {dt && <span className="text-[10px] font-bold text-slate-500 font-mono" dir="ltr">{dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {!isPast && diff > 0 && diff < 86400000 && <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">بعد {Math.ceil(diff / 60000)}د</span>}
                    {!isPast && diff >= 86400000 && <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">بعد {Math.ceil(diff / 3600000)}س</span>}
                  </div>
                  {(b.host_name || b.guest_name) && (
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {b.host_name && <span className="text-[9px] font-bold text-slate-500">المذيع: {b.host_name}</span>}
                      {b.guest_name && <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">الضيف: {b.guest_name}</span>}
                    </div>
                  )}
                  {b.recurring && b.recurring_day && b.recurring_time && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Repeat size={10} className="text-amber-500" />
                      <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400">
                        إعادة: {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(b.recurring_day)]} {b.recurring_time}
                      </span>
                    </div>
                  )}
                  {linkedPlaylist && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <List size={10} className="text-primary-500" />
                      <span className="text-[8px] font-bold text-primary-600 dark:text-primary-400">
                        {linkedPlaylist.name}
                      </span>
                    </div>
                  )}
                </div>
                {user && (
                  <button onClick={e => { e.stopPropagation(); onToggleReminder(b.id); }}
                    className={"shrink-0 p-1.5 rounded-full transition-colors " + (broadcastReminders.has(b.id) ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500')}>
                    <Bell size={14} className={broadcastReminders.has(b.id) ? 'fill-amber-500' : ''} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
