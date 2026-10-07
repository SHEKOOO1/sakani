import { motion } from 'motion/react';
import { Radio, Film } from 'lucide-react';

interface RadioHeaderProps {
  activeTab: 'live' | 'library';
  onTabChange: (tab: 'live' | 'library') => void;
}

export function RadioHeader({ activeTab, onTabChange }: RadioHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-white/90 dark:bg-card-dark/90 backdrop-blur-xl border-b border-slate-100 dark:border-white/5 -mx-3 md:-mx-4 lg:-mx-5 px-3 md:px-4 lg:px-5 -mt-3 md:-mt-4 lg:-mt-5 mb-6 pt-3 md:pt-4 lg:pt-5 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Live Broadcast</span>
          </div>
          <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-white/10" />
          <div className="hidden sm:block">
            <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">راديو 5:14</h1>
            <p className="text-[9px] text-slate-500 font-bold leading-tight mt-0.5">أنتم نور العالم — الراديو الرسمي لايبارشية السويس</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
          {([
            { id: 'live' as const, icon: Radio, label: 'البث الإذاعي والمرئي' },
            { id: 'library' as const, icon: Film, label: 'مكتبة الفيديو' },
          ] as const).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => onTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
                }`}>
                {isActive && (
                  <motion.div layoutId="radio-header-tab"
                    className="absolute inset-0 bg-gradient-to-br from-primary-600 to-vibrant-600 rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon size={16} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
