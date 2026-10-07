import { motion } from 'motion/react';
import { Clock, QrCode, Plus, ChevronLeft, LayoutGrid } from 'lucide-react';

interface EventSessionsViewProps {
  sessions: any[];
  setSelectedSession: (session: any) => void;
  setShowScanner: (open: boolean) => void;
  setActiveView: (view: string) => void;
  setShowSessionModal: (open: boolean) => void;
}

export function EventSessionsView({
  sessions, setSelectedSession, setShowScanner, setActiveView, setShowSessionModal,
}: EventSessionsViewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="sessions" className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">الأقسام الفرعية (السيشنات)</h3>
          <p className="text-xs text-slate-500 font-bold mt-1">المحاضرات، والورش، أو الصلوات داخل الفعالية</p>
        </div>
        <button onClick={() => setShowSessionModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white rounded-xl hover:brightness-110 transition-all font-black text-xs shadow-lg">
          <Plus size={14}/> إضافة قسم جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sessions.map(session => (
          <div key={session.id} className="p-8 bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] hover:border-ocean-300 dark:hover:border-ocean-500/30 transition-all group flex flex-col justify-between h-56 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-3 py-1 bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400 text-[8px] font-black uppercase tracking-widest rounded-lg border border-ocean-200 dark:border-ocean-500/30">
                  {session.type}
                </span>
                <h4 className="text-xl font-black text-slate-800 dark:text-white mt-4">{session.title}</h4>
              </div>
              <div className="p-3 bg-white dark:bg-white/5 rounded-xl text-slate-400 dark:text-slate-300 group-hover:text-ocean-600 transition-colors">
                <Clock size={20} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 font-bold">{new Date(session.start_time).toLocaleTimeString('ar-EG')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedSession(session); setShowScanner(true); }}
                  className="p-2 bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400 rounded-lg hover:bg-ocean-600 hover:text-white dark:hover:bg-ocean-500 transition-all"
                  title="مسح QR سريع"
                >
                  <QrCode size={16}/>
                </button>
                <button
                  onClick={() => { setSelectedSession(session); setActiveView('attendance_list'); }}
                  className="text-xs font-black text-ocean-600 dark:text-ocean-400 flex items-center gap-2 group-hover:translate-x-[-4px] transition-transform"
                >
                  أخذ الحضور <ChevronLeft size={16}/>
                </button>
              </div>
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="col-span-full py-20 bg-white dark:bg-white/[0.02] rounded-card border border-dashed border-slate-100 dark:border-white/10 text-center">
            <LayoutGrid className="mx-auto text-slate-400 mb-4" size={40} />
            <p className="text-slate-400 font-bold text-sm">لا يوجد أقسام فرعية مضافة حتى الآن</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
