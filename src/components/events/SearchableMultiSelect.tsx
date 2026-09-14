import { useState, useEffect, useRef } from 'react';
import { Eye } from 'lucide-react';

export const SearchableMultiSelect = ({ label, items, selected, onChange, searchPlaceholder, excluded, onToggleExclude, onAsyncSearch }: {
  label: string; items: any[]; selected: string[]; onChange: (v: string) => void;
  searchPlaceholder?: string; excluded?: boolean; onToggleExclude?: () => void;
  onAsyncSearch?: (q: string) => Promise<any[]>
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [asyncResults, setAsyncResults] = useState<any[] | null>(null);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (onAsyncSearch) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (search.length < 2) { setAsyncResults([]); setAsyncLoading(false); return; }
      setAsyncLoading(true);
      timerRef.current = setTimeout(async () => {
        try { const res = await onAsyncSearch(search); setAsyncResults(res || []); }
        catch { setAsyncResults([]); }
        setAsyncLoading(false);
      }, 300);
    }
  }, [search, onAsyncSearch]);

  const filtered = onAsyncSearch ? (asyncResults || []) : items.filter(item => {
    const display = typeof item === 'string' ? item : item.name || item.id || '';
    return display.toLowerCase().includes(search.toLowerCase());
  });

  const getName = (val: string) => {
    const found = items.find(i => { const v = typeof i === 'string' ? i : i.id || i.name; return v === val; });
    if (found) return typeof found === 'string' ? found : found.name || found.id;
    if (asyncResults) {
      const afound = asyncResults.find(i => { const v = typeof i === 'string' ? i : i.id || i.name; return v === val; });
      if (afound) return typeof afound === 'string' ? afound : afound.name || afound.id;
    }
    return val;
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">{label}</label>
        {onToggleExclude && (
          <button onClick={(e) => { e.stopPropagation(); onToggleExclude(); }}
            className={`p-0.5 rounded transition-colors ${
              excluded
                ? 'text-red-400 hover:text-red-300 bg-red-50 dark:bg-red-500/10'
                : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
            }`}
            title={excluded ? 'استثناء هذه الفئة' : 'الاستهداف العادي'}>
            <Eye size={13} />
          </button>
        )}
      </div>
      <div className="relative">
        <input value={open ? search : ''}
          onFocus={() => setOpen(true)}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          placeholder={selected.length > 0 ? `${selected.length} مختار` : (searchPlaceholder || `اختر ${label}...`)}
          className={`w-full px-3 py-2 rounded-xl border text-sm dark:text-white focus:outline-none focus:border-neon-primary/50 cursor-pointer ${
            excluded
              ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20 text-red-500'
              : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900'
          }`}
        />
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.filter(Boolean).map(val => (
            <span key={val} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neon-primary/15 text-neon-primary text-[10px] font-bold border border-neon-primary/30">
              {getName(val)}
              <button onClick={() => onChange(val)} className="hover:text-red-400">&times;</button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-1">
          {asyncLoading ? (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">جاري البحث...</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">لا توجد نتائج</div>
          ) : (
            filtered.map((item, idx) => {
              const val = typeof item === 'string' ? (item || `str-${idx}`) : item.id || item.name || `opt-${idx}`;
              const display = typeof item === 'string' ? item : item.name || item.id || val;
              const isSel = selected.includes(val);
              return (
                <button key={val} onClick={() => onChange(val)}
                  className={`w-full text-right px-3 py-2 text-xs font-bold flex items-center gap-2 transition-colors ${
                    isSel ? 'bg-neon-primary/10 text-neon-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}>
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isSel ? 'bg-neon-primary border-neon-primary' : 'border-slate-300 dark:border-slate-500'
                  }`}>
                    {isSel && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  {display}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
