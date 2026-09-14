
interface LaundryTabNavProps {
  activeTab: 'queue' | 'machines' | 'operators' | 'settings';
  onTabChange: (tab: 'queue' | 'machines' | 'operators' | 'settings') => void;
  isStudent: boolean;
  isLaundryManager: boolean;
  isOperatorManager: boolean;
}

export function LaundryTabNav({ activeTab, onTabChange, isStudent, isLaundryManager, isOperatorManager }: LaundryTabNavProps) {
  return (
    <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl w-fit">
      <button onClick={() => onTabChange('queue')}
        className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'queue' ? 'bg-white dark:bg-card-dark text-primary-600 shadow-lg border border-slate-200 dark:border-white/10' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600'}`}
      >
        طابور الانتظار
      </button>
      {!isStudent && (
        <button onClick={() => onTabChange('machines')}
          className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'machines' ? 'bg-white dark:bg-card-dark text-primary-600 shadow-lg border border-slate-200 dark:border-white/10' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600'}`}
        >
          الغسالات
        </button>
      )}
      {isOperatorManager && (
        <button onClick={() => onTabChange('operators')}
          className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'operators' ? 'bg-white dark:bg-card-dark text-primary-600 shadow-lg border border-slate-200 dark:border-white/10' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600'}`}
        >
          المسؤولين
        </button>
      )}
      {isLaundryManager && (
        <button onClick={() => onTabChange('settings')}
          className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-card-dark text-primary-600 shadow-lg border border-slate-200 dark:border-white/10' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600'}`}
        >
          إعدادات المغسلة
        </button>
      )}
    </div>
  );
}
