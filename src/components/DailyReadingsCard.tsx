import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Quote, CrossIcon, ChevronDown, ChevronUp, FileText, BookText } from 'lucide-react';
import ReadingsSkeleton from './readings/ReadingsSkeleton';
import ReadingsError from './readings/ReadingsError';
import DOMPurify from 'dompurify';

interface SynaxariumItem {
  title: string;
  html: string;
}

interface ReadingsData {
  enabled: boolean;
  date?: string;
  copticDate?: string;
  bibleVerse?: string;
  gospelOfTheDay?: string;
  synaxarium?: SynaxariumItem[];
  readings?: { title: string; passage: string; text: string }[];
  raw?: any;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.4 }
  })
};

export function DailyReadingsCard() {
  const { request } = useApi();
  const [data, setData] = useState<ReadingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardExpanded, setCardExpanded] = useState(true);
  const [verseExpanded, setVerseExpanded] = useState(true);
  const [synaxExpanded, setSynaxExpanded] = useState(false);
  const [readingsExpanded, setReadingsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const mounted = useMounted();

  const fetchReadings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await request('/api/dashboard/daily-readings');
      if (!mounted.current) return;
      if (resp.success && resp.data && resp.data.enabled) {
        setData(resp.data);
      } else if (resp.success && resp.data && resp.data.enabled === false) {
        setData({ enabled: false });
      } else {
        setError(resp.message || 'فشل تحميل قراءة اليوم');
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل قراءة اليوم');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => {

    fetchReadings();
    
  }, [fetchReadings]);

  if (loading) return <ReadingsSkeleton />;
  if (error) return <ReadingsError message={error} onRetry={fetchReadings} />;
  if (data?.enabled === false) return null;

  const {
    bibleVerse, gospelOfTheDay, copticDate, date,
    synaxarium, readings
  } = data || {};

  const hasVerse = !!bibleVerse;
  const hasReadings = readings && readings.length > 0;
  const hasSynaxarium = synaxarium && synaxarium.length > 0;
  const hasContent = hasVerse || hasReadings || hasSynaxarium;

  const formattedDate = date
    ? new Date(date.split('-').reverse().join('-')).toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : '';

  const groupedReadings = hasReadings
    ? readings!.reduce((acc, r) => {
        const key = r.title || 'قراءة';
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {} as Record<string, typeof readings>)
    : {};

  const categoryKeys = Object.keys(groupedReadings);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden"
    >
      <button onClick={() => setCardExpanded(!cardExpanded)} className="relative w-full bg-gradient-to-l from-amber-600/10 via-amber-500/5 to-transparent dark:from-amber-500/10 dark:via-amber-400/5 p-8 pb-6 border-b border-slate-100 dark:border-white/[0.05] text-right">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shadow-sm">
              <BookOpen size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white">قراءات اليوم</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {formattedDate && (
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-300">{formattedDate}</p>
                )}
                {copticDate && (
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {copticDate}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-200/50 dark:bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
              {cardExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-full border border-amber-100 dark:border-amber-500/20">
              <CrossIcon size={12} className="text-amber-500 dark:text-amber-400" />
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-300">الكنيسة القبطية الأرثوذكسية</span>
            </div>
          </div>
        </div>
        <div className="absolute -top-6 -left-6 w-32 h-32 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M50 10 L50 90 M10 50 L90 50" stroke="currentColor" strokeWidth="8" className="text-amber-800 dark:text-amber-200" />
            <path d="M30 30 L70 70 M70 30 L30 70" stroke="currentColor" strokeWidth="4" className="text-amber-800 dark:text-amber-200" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {cardExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
          <div className="p-8 space-y-6">
        {hasVerse && (
          <motion.div
            custom={0} variants={sectionVariants} initial="hidden" animate="visible"
            className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10"
          >
            <button
              onClick={() => setVerseExpanded(!verseExpanded)}
              className="w-full flex items-center justify-between p-4 text-right"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Quote size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">آية اليوم</h3>
                  {!verseExpanded && gospelOfTheDay && (
                    <p className="text-[9px] font-bold text-amber-500 dark:text-amber-400 mt-0.5">{gospelOfTheDay}</p>
                  )}
                </div>
              </div>
              <div className="p-1.5 bg-slate-200/50 dark:bg-white/10 rounded-lg text-slate-500">
                {verseExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            <AnimatePresence>
              {verseExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <div className="p-4 bg-white dark:bg-card-dark rounded-xl border border-amber-100 dark:border-amber-500/20">
                      <p className="text-base font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                        &ldquo;{bibleVerse}&rdquo;
                      </p>
                      {gospelOfTheDay && (
                        <p className="text-[10px] font-bold text-amber-500 dark:text-amber-400 mt-2">
                          {gospelOfTheDay}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {hasReadings && categoryKeys.length > 0 && (
          <motion.div
            custom={1} variants={sectionVariants} initial="hidden" animate="visible"
          >
            <button
              onClick={() => setReadingsExpanded(!readingsExpanded)}
              className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <BookText size={18} />
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">قراءات اليوم</h3>
                  <p className="text-[10px] font-bold text-slate-400">{categoryKeys.length} أقسام</p>
                </div>
              </div>
              <div className="p-1.5 bg-slate-200/50 dark:bg-white/10 rounded-lg text-slate-500">
                {readingsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            <AnimatePresence>
              {readingsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    {categoryKeys.map((category, ci) => {
                      const catReadings = groupedReadings[category];
                      const isExpanded = expandedCategories[category] || false;
                      const firstReading = catReadings[0];
                      const remainingCount = catReadings.length - 1;

                      return (
                        <div key={ci} className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
                          <button
                            onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                            className="w-full p-4 flex items-center justify-between text-right hover:bg-slate-100/50 dark:hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`p-1.5 rounded-lg shrink-0 ${
                                ci % 6 === 0 ? 'bg-rose-600' :
                                ci % 6 === 1 ? 'bg-blue-600' :
                                ci % 6 === 2 ? 'bg-emerald-600' :
                                ci % 6 === 3 ? 'bg-purple-600' :
                                ci % 6 === 4 ? 'bg-cyan-600' : 'bg-orange-600'
                              } text-white`}>
                                <FileText size={14} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-black text-slate-700 dark:text-slate-200 block truncate">{category}</span>
                                {firstReading?.passage && (
                                  <span className="text-[9px] font-bold text-slate-400">{firstReading.passage}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {remainingCount > 0 && (
                                <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 text-[9px] font-black text-slate-500 rounded-md">
                                  +{remainingCount}
                                </span>
                              )}
                              <div className="p-1 bg-slate-200/50 dark:bg-white/10 rounded-lg text-slate-400">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </div>
                            </div>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 space-y-3">
                                  {catReadings.map((reading, ri) => (
                                    <div key={ri} className="p-4 bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/10">
                                      {catReadings.length > 1 && (
                                        <p className="text-[9px] font-black text-slate-400 mb-2">
                                          {reading.passage || `قراءة ${ri + 1}`}
                                        </p>
                                      )}
                                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {reading.text?.substring(0, 300) || '...'}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {hasSynaxarium && (
          <motion.div
            custom={2} variants={sectionVariants} initial="hidden" animate="visible"
            className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10"
          >
            <button
              onClick={() => setSynaxExpanded(!synaxExpanded)}
              className="w-full flex items-center justify-between p-4 text-right"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl">
                  <BookText size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">السنكسار</h3>
                  {!synaxExpanded && (
                    <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400">{synaxarium!.length} قديس</p>
                  )}
                </div>
              </div>
              <div className="p-1.5 bg-amber-100/50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                {synaxExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            <AnimatePresence>
              {synaxExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    {synaxarium!.map((item, i) => {
                      const isOpen = expandedCategories[`synax-${i}`] || false;
                      return (
                        <div key={i} className="bg-white dark:bg-card-dark rounded-xl border border-amber-100 dark:border-amber-500/20 overflow-hidden">
                          {item.title && (
                            <button
                              onClick={() => setExpandedCategories(prev => ({ ...prev, [`synax-${i}`]: !prev[`synax-${i}`] }))}
                              className="w-full p-3 flex items-center justify-between text-right hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors"
                            >
                              <span className="text-xs font-black text-amber-700 dark:text-amber-300">{item.title}</span>
                              <div className="p-1 bg-amber-100/50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                                {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </div>
                            </button>
                          )}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3">
                                  <p
                                    className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.html) }}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

          {!hasContent && (
            <div className="text-center py-10">
              <BookOpen size={40} className="mx-auto text-slate-200 dark:text-white/10 mb-3" />
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">لا توجد قراءات مضافة لليوم</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">يمكن إضافة القراءات من لوحة التحكم</p>
            </div>
          )}
          <div className="pt-4 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">المصدر: api.katameros.app</p>
            <button
              onClick={fetchReadings}
              className="text-[9px] font-black text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              تحديث
            </button>
          </div>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}


