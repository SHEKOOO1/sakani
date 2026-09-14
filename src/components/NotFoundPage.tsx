import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileQuestion, Home, Search, Users, DoorOpen, Package, Calendar, Settings, ChevronLeft, Compass } from 'lucide-react';

const quickLinks = [
  { label: 'لوحة التحكم', icon: Home, view: 'dashboard' },
  { label: 'الطلاب', icon: Users, view: 'students' },
  { label: 'الغرف', icon: DoorOpen, view: 'rooms' },
  { label: 'المخازن', icon: Package, view: 'inventory' },
  { label: 'الفعاليات', icon: Calendar, view: 'events' },
  { label: 'الإعدادات', icon: Settings, view: 'settings' },
];

export function NotFoundPage({ onBack }: { onBack: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    const match = quickLinks.find(l => l.label.includes(q) || q.includes(l.label));
    if (match) onBack();
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-8" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        className="text-center max-w-lg w-full"
      >
        {/* Animated 404 */}
        <motion.div
          className="relative mx-auto mb-8"
          animate={{ rotate: [0, -8, 8, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-32 h-32 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20 text-amber-600 dark:text-amber-400 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-lg border border-amber-200 dark:border-amber-500/30">
            <span className="text-6xl font-black tracking-tighter">404</span>
          </div>
          <motion.div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Compass size={24} className="text-amber-400" />
          </motion.div>
        </motion.div>

        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-3">الصفحة غير موجودة</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها. قد يكون الرابط غير صحيح أو الصفحة قد أزيلت.
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative max-w-sm mx-auto mb-8">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث عن صفحة..."
            className="w-full pr-12 pl-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
          />
        </form>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {quickLinks.map(link => (
            <button
              key={link.view}
              onClick={onBack}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all group"
            >
              <link.icon size={20} className="text-slate-500 dark:text-slate-400 group-hover:text-amber-500 transition-colors" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{link.label}</span>
            </button>
          ))}
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl font-bold hover:scale-105 transition-all shadow-lg text-sm"
        >
          <ChevronLeft size={18} />
          العودة للرئيسية
        </button>
      </motion.div>
    </div>
  );
}
