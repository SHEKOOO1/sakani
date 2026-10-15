import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { LogIn, LogOut, AlertTriangle, Loader2, Navigation, RefreshCw } from 'lucide-react';

interface Props {
  studentId: string;
  limit?: number;
}

/**
 * سجل حركات الطالب (دخول/خروج السكن) مع فلترة بالتاريخ والنوع والتأخير.
 * يعتمد على /api/attendance/movement/:studentId الذي يخضع لنفس صلاحيات
 * عرض الحضور (الطالب نفسه أو مشرف داخل نطاق سكنه).
 */
export function MovementHistoryCard({ studentId, limit = 100 }: Props) {
  const { request } = useApi();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '', type: '', lateOnly: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.type) params.set('type', filters.type);
      if (filters.lateOnly) params.set('lateOnly', 'true');
      const res = await request(`/api/attendance/movement/${studentId}?${params.toString()}`);
      setRows(res?.data || []);
    } catch {
      // الصمت عند التعذر — لا نكسر صفحة الملف
    } finally {
      setLoading(false);
    }
  }, [request, studentId, limit, filters]);

  useEffect(() => { load(); }, [load]);

  const lateCount = rows.filter((r) => r.status === 'late').length;
  const inCount = rows.filter((r) => r.type === 'check-in').length;
  const outCount = rows.filter((r) => r.type === 'check-out').length;

  const inputCls = 'px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:border-primary-300 dark:text-white';

  return (
    <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <Navigation size={20} className="text-primary-500" />
          سجل حركات السكن
        </h3>
        <span className="text-[10px] font-black text-slate-400">{collapsed ? 'عرض' : 'إخفاء'}</span>
      </button>

      {!collapsed && (
        <>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className={inputCls} />
            <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className={inputCls} />
            <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
              <option value="">الكل (دخول/خروج)</option>
              <option value="check-in">دخول</option>
              <option value="check-out">خروج</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] font-black text-slate-500 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={filters.lateOnly} onChange={(e) => setFilters((f) => ({ ...f, lateOnly: e.target.checked }))} className="accent-amber-500" />
                المتأخرون بعد الإغلاق
              </label>
              <button onClick={load} className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-primary-500" title="تحديث">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-black">
            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">دخول: {inCount}</span>
            <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300">خروج: {outCount}</span>
            <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">تأخير: {lateCount}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm font-bold text-slate-400">لا توجد حركات مطابقة</div>
          ) : (
            <div className="mt-5 space-y-2">
              {rows.map((r) => {
                const isIn = r.type === 'check-in';
                const late = r.status === 'late';
                return (
                  <div key={r.id} className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isIn ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
                        {isIn ? <LogIn size={16} /> : <LogOut size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-white">{isIn ? 'دخول السكن' : 'خروج من السكن'}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                          {r.created_at ? new Date(r.created_at).toLocaleString('ar-EG') : ''}
                          {r.location_lat != null && r.location_lng != null ? ` • ${Number(r.location_lat).toFixed(4)}, ${Number(r.location_lng).toFixed(4)}` : ''}
                        </p>
                      </div>
                    </div>
                    {late ? (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black shrink-0 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        <AlertTriangle size={11} /> متأخر
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[10px] font-black shrink-0 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">في الموعد</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
