import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Search } from 'lucide-react';

interface PrivateMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchStudents: (q: string) => Promise<any[]>;
  searchParents: (q: string) => Promise<any[]>;
  saving: boolean;
  onSend: (payload: { recipient_user_id: string; title: string; content: string; to_parents: boolean }) => void;
}

export function PrivateMessageModal({ isOpen, onClose, searchStudents, searchParents, saving, onSend }: PrivateMessageModalProps) {
  const [mode, setMode] = useState<'student' | 'parent'>('student');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [toParents, setToParents] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    if (dropdownOpen) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dropdownOpen]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (search.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = mode === 'student'
          ? await searchStudents(search)
          : await searchParents(search);
        setResults(res || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  }, [search, mode, searchStudents, searchParents]);

  const reset = () => {
    setMode('student');
    setSearch('');
    setResults([]);
    setSelected(null);
    setToParents(false);
    setTitle('');
    setContent('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = () => {
    if (!selected || !content.trim()) return;
    onSend({ recipient_user_id: selected.user_id || selected.id, title: title.trim() || 'رسالة خاصة', content: content.trim(), to_parents: toParents && mode === 'student' });
  };

  const pick = (item: any) => {
    setSelected(item);
    setDropdownOpen(false);
    setSearch('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-lg relative text-right"
          >
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter">رسالة خاصة</h3>
              <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative" ref={ref}>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 mb-1.5">المستلم</label>

                {/* mode toggle */}
                <div className="flex bg-slate-100 dark:bg-white/10 p-1 rounded-xl mb-2">
                  {(['student', 'parent'] as const).map(m => (
                    <button key={m} onClick={() => { setMode(m); setSelected(null); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                        mode === m ? 'bg-white dark:bg-card-dark shadow text-neon-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}>
                      {m === 'student' ? 'طالب' : 'ولي أمر'}
                    </button>
                  ))}
                </div>

                {selected ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-neon-primary/10 border border-neon-primary/30">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                      {mode === 'student' ? selected.name : `${selected.name}${selected.children?.length ? ` (ولي أمر ${selected.children.length} طالب)` : ''}`}
                    </span>
                    <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-red-400 text-xs font-bold">تغيير</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onFocus={() => search.length >= 2 && setDropdownOpen(true)}
                      onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
                      placeholder={mode === 'student' ? "ابحث عن طالب بالاسم..." : "ابحث عن ولي أمر بالاسم..."}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50"
                    />
                    {dropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-1">
                        {loading ? (
                          <div className="px-3 py-4 text-xs text-slate-400 text-center">جاري البحث...</div>
                        ) : results.length === 0 ? (
                          <div className="px-3 py-4 text-xs text-slate-400 text-center">لا توجد نتائج</div>
                        ) : (
                          results.map((item, idx) => {
                            const key = item.id || `r-${idx}`;
                            return (
                              <button key={key} onClick={() => pick(item)}
                                className="w-full text-right px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                                <span>{item.name}</span>
                                {mode === 'student' && item.is_graduate ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-vibrant/15 text-vibrant">خريج</span>
                                ) : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}

                {mode === 'student' && selected && (
                  <label className="flex items-center gap-2 mt-2 text-xs font-bold text-slate-500 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={toParents} onChange={e => setToParents(e.target.checked)}
                      className="w-4 h-4 accent-[var(--neon-primary, #00e5a0)]" />
                    إرسال أيضاً لأولياء أمور هذا الطالب
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 mb-1.5">العنوان (اختياري)</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50"
                  placeholder="عنوان الرسالة" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 mb-1.5">نص الرسالة</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50 resize-none"
                  placeholder="اكتب نص الرسالة..." />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                  إلغاء
                </button>
                <button onClick={handleSend} disabled={saving || !selected || !content.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-neon-primary text-black font-bold rounded-xl hover:bg-neon-primary/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'جاري الإرسال...' : 'إرسال'}
                  {!saving && <Send size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}