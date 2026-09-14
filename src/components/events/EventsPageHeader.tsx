import { Sparkles, Plus, ChevronRight } from 'lucide-react';

interface EventsPageHeaderProps {
  selectedEvent: any;
  user: any;
  activeTab: string;
  onBack: () => void;
  onTabChange: (tab: any) => void;
  onNewEvent: () => void;
  hasCreatePermission: boolean;
}

export function EventsPageHeader({ selectedEvent, user, activeTab, onBack, onTabChange, onNewEvent, hasCreatePermission }: EventsPageHeaderProps) {
  return (
    <>
      {selectedEvent ? (
        <button onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-primary-400 transition-all font-black text-xs uppercase tracking-widest group"
        >
          <ChevronRight size={16} className="group-hover:-translate-x-1 transition-transform" />
          العودة لقائمة الفعاليات
        </button>
      ) : (
        user?.role !== 'parent' && user?.role !== 'student' && (
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-8 sm:p-10">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Sparkles className="text-white" size={32} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tighter">الأنشطة والفعاليات</h1>
                  <p className="text-white/70 mt-1 font-bold">نظّم الفعاليات والمسابقات مع نظام استهداف متكامل</p>
                </div>
              </div>
              {hasCreatePermission && (
                <button onClick={onNewEvent}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-primary-600 rounded-2xl hover:bg-primary-50 transition-all font-black shadow-lg active:scale-95"
                >
                  <Plus size={22} />
                  <span>فعالية جديدة</span>
                </button>
              )}
            </div>
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          </div>
        )
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tighter leading-none">
            {selectedEvent ? 'لوحة تحكم الفعالية' : user?.role === 'parent' ? 'فعاليات الأبناء' : user?.role === 'student' ? 'الفعاليات والمسابقات' : 'الفعاليات والأنشطة'}
          </h1>
          <p className="text-white/60 font-bold mt-2 tracking-tight">
            {selectedEvent
              ? `إدارة كاملة لفعالية: ${selectedEvent.title}`
              : user?.role === 'parent'
                ? 'عرض الفعاليات المتاحة لأبنك وتسجيله فيها.'
                : user?.role === 'student'
                  ? 'سجل حضورك في الفعاليات والمسابقات المتاحة.'
                  : 'نظام إدارة شامل للفعاليات، الصلوات، ولقطات الـ QR الذكية.'}
          </p>
        </div>
        {!selectedEvent && user?.role !== 'parent' && user?.role !== 'student' && (
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
              <button onClick={() => onTabChange('management')}
                className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'management' ? 'bg-white dark:bg-card-dark text-primary-600 shadow-lg border border-slate-200 dark:border-white/10' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700'
                }`}
              >
                الإدارة
              </button>
              <button onClick={() => onTabChange('attendance')}
                className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'attendance' ? 'bg-white dark:bg-card-dark text-primary-600 shadow-lg border border-slate-200 dark:border-white/10' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700'
                }`}
              >
                الحضور
              </button>
            </div>
            {activeTab === 'management' && (
              <button onClick={onNewEvent}
                className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-2xl hover:bg-primary-50 transition-all font-black text-xs shadow-lg"
              >
                فعالية جديدة <Plus size={16} />
              </button>
            )}
          </div>
        )}
        {!selectedEvent && user?.role === 'parent' && (
          <div className="text-[10px] font-black text-slate-400 px-2">
            يمكنك تسجيل حضورك في الفعاليات المتاحة أدناه
          </div>
        )}
      </div>
    </>
  );
}
