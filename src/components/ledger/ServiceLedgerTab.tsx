import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../../hooks/useApi';
import { useMounted } from '../../hooks/useMounted';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { motion } from 'motion/react';
import {
  TrendingUp, TrendingDown, Plus, Search, Calendar, Wallet,
  Trash2, Loader2, FileText, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react';
import { Pagination } from '../Pagination';
import { Skeleton } from '../Skeleton';

const INCOME_CATEGORIES = ['مبيعات', 'أخرى'];
const EXPENSE_CATEGORIES = ['مشتريات', 'رواتب', 'صيانة', 'مرافق', 'أخرى'];
const ALL_CATEGORIES = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];

interface Movement {
  id: string;
  type: 'revenue' | 'expense';
  entry_type: string;
  status: string;
  category: string;
  amount: number;
  description: string | null;
  date: string | null;
  created_at: string | null;
  is_reversal: boolean;
}

interface Summary { income: number; expense: number; net: number; transactionCount: number; }

interface Props {
  /** Ledger endpoint base, e.g. '/api/restaurant/ledger'. */
  basePath: string;
  /** Whether the caller may record/delete (backed by the same check server-side). */
  canRecord: boolean;
}

export function ServiceLedgerTab({ basePath, canRecord }: Props) {
  const { request } = useApi();
  const { showSuccess, showError, confirm } = useSnackbar();
  const mounted = useMounted();
  const fetchSeq = useRef(0);

  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summary, setSummary] = useState<Summary>({ income: 0, expense: 0, net: 0, transactionCount: 0 });

  const [filter, setFilter] = useState<'all' | 'revenue' | 'expense'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [form, setForm] = useState({ type: 'income' as 'income' | 'expense', category: 'مبيعات', amount: '', description: '', date: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const resp = await request(`${basePath}?${params.toString()}`);
      if (!mounted.current || seq !== fetchSeq.current) return;
      setMovements(Array.isArray(resp.data) ? resp.data : []);
      setTotalRecords(Number(resp.total || 0));

      const summaryParams = new URLSearchParams();
      if (categoryFilter) summaryParams.set('category', categoryFilter);
      if (startDate) summaryParams.set('startDate', startDate);
      if (endDate) summaryParams.set('endDate', endDate);
      const summaryResp = await request(`${basePath}/summary?${summaryParams.toString()}`);
      if (!mounted.current || seq !== fetchSeq.current) return;
      setSummary({
        income: Number(summaryResp?.data?.income || 0),
        expense: Number(summaryResp?.data?.expense || 0),
        net: Number(summaryResp?.data?.net || 0),
        transactionCount: Number(summaryResp?.data?.transactionCount || 0),
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (mounted.current && seq === fetchSeq.current) setLoading(false);
    }
  }, [request, basePath, filter, categoryFilter, startDate, endDate, debouncedSearch, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages);
  }, [page, totalPages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0.01, parseFloat(form.amount) || 0);
    if (!form.category.trim()) { showError('اختر التصنيف'); return; }
    setBusy(true);
    try {
      await request(basePath, {
        method: 'POST',
        body: JSON.stringify({
          type: form.type,
          category: form.category.trim(),
          amount,
          description: form.description.trim() || undefined,
          date: form.date || undefined,
        }),
      });
      setForm(f => ({ ...f, amount: '', description: '', date: '' }));
      showSuccess('تم تسجيل الحركة');
      if (page !== 1) setPage(1); else fetchData();
    } catch (err: any) {
      showError(err.message || 'تعذر حفظ الحركة');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!await confirm({ message: 'حذف هذه الحركة من دفتر اليومية؟', type: 'danger' })) return;
    try {
      await request(`${basePath}/${id}`, { method: 'DELETE' });
      showSuccess('تم حذف الحركة');
      fetchData();
    } catch (err: any) {
      showError(err.message || 'تعذر حذف الحركة');
    }
  };

  const hasActiveFilters = startDate || endDate || categoryFilter || searchTerm || filter !== 'all';
  const clearFilters = () => { setStartDate(''); setEndDate(''); setCategoryFilter(''); setSearchTerm(''); setFilter('all'); setPage(1); };
  const selectedCategories = filter === 'revenue' ? INCOME_CATEGORIES : filter === 'expense' ? EXPENSE_CATEGORIES : ALL_CATEGORIES;
  const formCategories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Accounts summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl"><ArrowUpRight size={20} /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">إجمالي الوارد</span>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{summary.income.toLocaleString()} ج.م</h3>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl"><ArrowDownLeft size={20} /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">إجمالي المصروف</span>
          </div>
          <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">{summary.expense.toLocaleString()} ج.م</h3>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-xl"><Wallet size={20} /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">الصافي</span>
          </div>
          <h3 className={`text-2xl font-black ${summary.net >= 0 ? 'text-slate-800 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>{summary.net.toLocaleString()} ج.م</h3>
          <p className="text-[11px] text-slate-400 mt-1 font-bold">{summary.transactionCount.toLocaleString()} حركة</p>
        </motion.div>
      </div>

      {/* Record form */}
      {canRecord && (
        <form onSubmit={submit} className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
            <Plus size={18} /> تسجيل حركة يدوية
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex rounded-xl overflow-hidden border border-slate-100 dark:border-white/5">
              <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category: 'مبيعات' }))}
                className={`flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 ${form.type === 'income' ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-white/5 text-slate-500'}`}>
                <TrendingUp size={15} /> وارد
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category: 'مشتريات' }))}
                className={`flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 ${form.type === 'expense' ? 'bg-rose-500 text-white' : 'bg-slate-50 dark:bg-white/5 text-slate-500'}`}>
                <TrendingDown size={15} /> مصروف
              </button>
            </div>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
              {formCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" min="0" step="0.01" required placeholder="المبلغ"
              className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
            <input value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} type="date"
              className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold dark:text-white" />
          </div>
          <div className="flex gap-3">
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="البيان (اختياري)"
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
            <button type="submit" disabled={busy} className="px-6 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-black disabled:opacity-50 flex items-center gap-2">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} حفظ
            </button>
          </div>
        </form>
      )}

      {/* Filters + list */}
      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 dark:border-white/5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              {([['all', 'الكل'], ['revenue', 'الوارد'], ['expense', 'المصروف']] as const).map(([id, label]) => (
                <button key={id} onClick={() => { setFilter(id as any); setPage(1); }}
                  className={`text-sm font-bold px-4 py-2 rounded-xl transition-all ${filter === id ? 'bg-slate-900 dark:bg-white/10 text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl outline-none text-sm dark:text-white" />
              <span className="text-slate-300 text-xs">—</span>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl outline-none text-sm dark:text-white" />
            </div>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-xl outline-none text-sm font-bold text-slate-600 dark:text-white">
              <option value="">كل التصنيفات</option>
              {selectedCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2">مسح الكل</button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="البحث في البيان أو التصنيف..."
              className="pr-12 pl-4 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none text-sm w-full dark:text-white" />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-right border-collapse min-w-[720px]">
            <thead className="bg-slate-50/50 dark:bg-white/5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 dark:border-white/5">
              <tr>
                <th className="px-6 py-4">الحركة</th>
                <th className="px-6 py-4">التصنيف</th>
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4">المبلغ</th>
                {canRecord && <th className="px-6 py-4">إجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>{Array.from({ length: canRecord ? 5 : 4 }).map((_, j) => (
                  <td key={j} className="px-6 py-5"><Skeleton className="h-6 w-full" /></td>
                ))}</tr>
              )) : movements.length > 0 ? movements.map(m => (
                <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${m.type === 'revenue' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                        {m.type === 'revenue' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </div>
                      <p className="font-bold text-slate-800 dark:text-white">{m.description || 'بدون بيان'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold">{m.category || '—'}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-slate-500 dark:text-slate-300 text-xs">{m.date ? new Date(m.date).toLocaleDateString('ar-EG') : '—'}</span>
                  </td>
                  <td className="px-6 py-5 font-black">
                    <span className={m.type === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {m.type === 'revenue' ? '+' : '-'}{Number(m.amount || 0).toLocaleString()} ج.م
                    </span>
                  </td>
                  {canRecord && (
                    <td className="px-6 py-5">
                      {m.is_reversal ? (
                        <span className="px-3 py-1.5 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 rounded-lg text-xs font-bold">قيد عكسي</span>
                      ) : (
                        <button onClick={() => remove(m.id)} title="حذف الحركة"
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={canRecord ? 5 : 4} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-full text-slate-200 dark:text-slate-600"><FileText size={40} /></div>
                      <p className="text-slate-400 font-bold">لا توجد حركات مسجلة بعد</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} total={totalRecords} onPageChange={setPage} />
      </div>
    </div>
  );
}
