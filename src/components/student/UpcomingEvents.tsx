import { motion } from 'motion/react';
import { Calendar, ChevronLeft, Clock, Bell } from 'lucide-react';

interface UpcomingEventsProps {
  events: any[];
  onNavigate?: (view: string) => void;
}

export default function UpcomingEvents({ events, onNavigate }: UpcomingEventsProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/10"><Calendar size={16} className="text-primary-600 dark:text-primary-400" /></div>
          <h2 className="font-black text-sm text-slate-800 dark:text-white">الأحداث القادمة</h2>
        </div>
        <button onClick={() => onNavigate?.('events')}
          className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 transition-colors"
        >
          عرض الكل <ChevronLeft size={13} />
        </button>
      </div>

      <div className="space-y-2">
        {events?.length > 0 ? events.map((event: any) => {
          const eventDate = new Date(event.event_date);
          const isSoon = eventDate.getTime() - Date.now() < 86400000;
          return (
            <motion.div key={event.id} whileHover={{ x: -3 }}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition-all hover:border-primary-200 hover:bg-primary-50/50 dark:border-white/10 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/10 group"
            >
              <div className={`flex w-10 flex-col items-center justify-center rounded-xl py-2 font-black ${isSoon ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300'}`}>
                <span className="text-sm leading-none">{eventDate.getDate()}</span>
                <span className="text-[8px] uppercase">{eventDate.toLocaleDateString('ar-EG', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{event.title}</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-300 mt-0.5">
                  <Clock size={10} className="inline" /> {eventDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  {event.location && <span> • {event.location}</span>}
                </p>
              </div>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 opacity-0 transition-all hover:bg-primary-600 hover:text-white group-hover:opacity-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-primary-500">
                <Bell size={13} />
              </button>
            </motion.div>
          );
        }) : (
          <div className="py-10 text-center">
            <Calendar size={28} className="mx-auto text-slate-200 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-400 dark:text-slate-300 font-bold">لا توجد فعاليات قادمة</p>
            <p className="text-[10px] text-slate-300 dark:text-slate-400 mt-1">سيتم تحديث القائمة عند إضافة فعاليات جديدة</p>
          </div>
        )}
      </div>
    </div>
  );
}
