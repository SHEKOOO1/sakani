import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useSnackbar } from '../contexts/SnackbarContext';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search,
  DollarSign,
  Calendar,
  FileText,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  BarChart3,
  ChevronDown,
  FileSpreadsheet,
  FileIcon,
  Sparkles,
  Users,
  Pencil,
  Trash2
} from 'lucide-react';
import { FinanceRecordModal } from './finance/FinanceRecordModal';
import { FinanceReportPanel } from './finance/FinanceReportPanel';
import { StudentAccountsPanel } from './finance/StudentAccountsPanel';
import { Pagination } from './Pagination';
import { Skeleton } from './Skeleton';

const EXPENSE_CATEGORIES = ['صيانة', 'كهرباء ومياه', 'رواتب', 'أدوات نظافة', 'أخرى'];
const REVENUE_CATEGORIES = ['رسوم سكن', 'رسوم فعاليات', 'أخرى'];
const ALL_CATEGORIES = [...new Set([...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES])];

export function FinancePage() {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [finances, setFinances] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summary, setSummary] = useState<any>({ income: 0, expense: 0 });
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [reportData, setReportData] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showStudentAccounts, setShowStudentAccounts] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    type: 'revenue',
    category: 'رسوم سكن',
    amount: '',
    description: '',
    studentId: '',
    date: '',
    paymentMethodId: '',
    paymentMethodName: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const mounted = useMounted();
  const fetchSeq = useRef(0);

  // Debounce the search term so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

      const resp = await request(`/api/finances?${params.toString()}`);
      // Ignore stale responses: only the latest request may update the view.
      if (!mounted.current || seq !== fetchSeq.current) return;
      setFinances(Array.isArray(resp.data) ? resp.data : []);
      setTotalRecords(Number(resp.total || 0));

      // The stat cards reflect the active date/category scope so they line up
      // with the filtered list instead of always showing all-time totals.
      const summaryParams = new URLSearchParams();
      if (categoryFilter) summaryParams.set('category', categoryFilter);
      if (startDate) summaryParams.set('startDate', startDate);
      if (endDate) summaryParams.set('endDate', endDate);

      const summaryResp = await request(`/api/finances/summary?${summaryParams.toString()}`);
      if (!mounted.current || seq !== fetchSeq.current) return;
      const sum = { income: 0, expense: 0 };
      (Array.isArray(summaryResp.data) ? summaryResp.data : []).forEach((item: any) => {
        if (item.type === 'revenue') sum.income = item.total;
        if (item.type === 'expense') sum.expense = item.total;
      });
      setSummary(sum);
    } catch (err) {
      console.error(err);
    } finally {
      if (mounted.current && seq === fetchSeq.current) setLoading(false);
    }
  }, [request, filter, categoryFilter, startDate, endDate, debouncedSearch, page]);

  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const resp = await request(`/api/finances/report?${params.toString()}`);
      if (!mounted.current) return;
      setReportData(resp.data);
      setShowReport(true);
    } catch (err) {
      console.error(err);
    } finally {
      if (mounted.current) setReportLoading(false);
    }
  }, [request, filter, categoryFilter, startDate, endDate]);

  const fetchStudents = useCallback(async () => {
    try {
      const resp = await request('/api/students');
      if (mounted.current) setStudents(resp.data);
    } catch (err) {
      console.error(err);
    }
  }, [request]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const resp = await request('/api/payments/methods');
      const data = resp?.data;
      if (mounted.current && Array.isArray(data)) setPaymentMethods(data.filter((m: any) => m.is_active !== false));
    } catch (err) {
      console.error(err);
    }
  }, [request]);

  const loadRef = useRef(() => {});
  loadRef.current = () => { fetchStudents(); fetchPaymentMethods(); };

  useEffect(() => {
    loadRef.current();
  }, []);

  // Refetch whenever any list filter, the page, or the search term changes.
  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages);
  }, [page, totalPages]);

  const handleExport = async (format: 'excel' | 'pdf') => {
    setShowExportMenu(false);
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (filter !== 'all') params.set('type', filter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/finances/export?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'فشل التصدير');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      a.download = `financial-report-${startDate || 'all'}-${endDate || 'all'}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const resetForm = () => {
    setFormData({ type: 'revenue', category: 'رسوم سكن', amount: '', description: '', studentId: '', date: '', paymentMethodId: '', paymentMethodName: '' });
  };

  const openCreateModal = () => {
    setEditingId(null);
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (record: any) => {
    setEditingId(record.id);
    const method = paymentMethods.find((m: any) => m.id === (record.payment_method_id || record.paymentMethodId));
    setFormData({
      type: record.type || 'revenue',
      category: record.category || 'رسوم سكن',
      amount: String(record.amount ?? ''),
      description: record.description || '',
      studentId: record.student_id || '',
      date: record.date ? String(record.date).slice(0, 10) : '',
      paymentMethodId: record.payment_method_id || record.paymentMethodId || '',
      paymentMethodName: method?.name || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      amount: Math.max(0.01, parseFloat(formData.amount) || 0),
      date: formData.date || undefined,
      studentId: formData.studentId || null,
      paymentMethodId: formData.paymentMethodId || null,
      paymentMethodName: formData.paymentMethodName?.trim() || undefined
    };
    try {
      if (editingId) {
        await request(`/api/finances/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await request('/api/finances', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setModalOpen(false);
      setEditingId(null);
      resetForm();
      fetchData();
      fetchPaymentMethods();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!await confirm({ message: 'هل أنت متأكد من حذف هذه المعاملة؟', type: 'danger' })) return;
    try {
      await request(`/api/finances/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setCategoryFilter('');
    setSearchTerm('');
    setFilter('all');
    setPage(1);
  };

  const hasActiveFilters = startDate || endDate || categoryFilter || searchTerm || filter !== 'all';

  const selectedCategories = filter === 'revenue' ? REVENUE_CATEGORIES
    : filter === 'expense' ? EXPENSE_CATEGORIES
    : ALL_CATEGORIES;

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-8 sm:p-10">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter">النظام المالي</h1>
              <p className="text-white/70 mt-1 font-bold">تتبع كافة الإيرادات والمصروفات الخاصة بالمجمع السكني.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => { setShowReport(false); fetchReport(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all font-medium border border-white/10"
            >
              <BarChart3 size={18} />
              <span>تقارير</span>
            </button>
            <button 
              onClick={() => { setShowReport(false); setShowStudentAccounts(!showStudentAccounts); }}
              className={`flex items-center gap-2 px-4 py-2.5 backdrop-blur-sm text-white rounded-xl transition-all font-medium border ${showStudentAccounts ? 'bg-white/40 border-white/30' : 'bg-white/20 hover:bg-white/30 border-white/10'}`}
            >
              <Users size={18} />
              <span>حسابات الطلاب</span>
            </button>
            <div ref={exportRef} className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all font-medium border border-white/10"
              >
                <Download size={18} />
                <span>تصدير</span>
                <ChevronDown size={14} />
              </button>
              {showExportMenu && (
                <div className="absolute left-0 top-full mt-2 bg-white dark:bg-card-dark rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 py-2 w-44 z-50 overflow-hidden">
                  <button onClick={() => handleExport('excel')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors">
                    <FileSpreadsheet size={18} className="text-emerald-600" />
                    Excel
                  </button>
                  <button onClick={() => handleExport('pdf')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors">
                    <FileIcon size={18} className="text-rose-600" />
                    PDF
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={openCreateModal}
              className="flex min-w-[10rem] flex-1 items-center justify-center gap-2 px-5 py-2.5 bg-white text-primary-600 rounded-xl hover:bg-primary-50 transition-all shadow-lg font-medium sm:flex-none"
            >
              <Plus size={18} />
              <span>إضافة معاملة</span>
            </button>
          </div>
        </div>
        <div className="absolute -top-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-2xl">
                 <DollarSign size={24} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">صافي الرصيد</span>
           </div>
           <h3 className="text-3xl font-black text-slate-800 dark:text-white">{(summary.income - summary.expense).toLocaleString()} ج.م</h3>
           <p className="text-xs text-slate-400 dark:text-slate-300 mt-2">إجمالي المتوفر في الخزينة حالياً</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                 <ArrowUpRight size={24} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">إجمالي الإيرادات</span>
           </div>
           <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{summary.income.toLocaleString()} ج.م</h3>
           <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-2 font-bold">+ {summary.income > 0 ? 100 : 0}% نمو إيجابي</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl">
                 <ArrowDownLeft size={24} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">إجمالي المصروفات</span>
           </div>
           <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400">{summary.expense.toLocaleString()} ج.م</h3>
           <p className="text-xs text-rose-500 dark:text-rose-400 mt-2 font-bold">تغطية تشغيلية مستقرة</p>
        </motion.div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-white/5 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { setFilter('all'); setPage(1); }}
                className={`text-sm font-bold transition-all px-4 py-2 rounded-xl ${filter === 'all' ? 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                الكل
              </button>
              <button 
                onClick={() => { setFilter('revenue'); setPage(1); }}
                className={`text-sm font-bold transition-all px-4 py-2 rounded-xl flex items-center gap-2 ${filter === 'revenue' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-300 hover:text-emerald-500'}`}
              >
                <TrendingUp size={16} />
                <span>الإيرادات</span>
              </button>
              <button 
                onClick={() => { setFilter('expense'); setPage(1); }}
                className={`text-sm font-bold transition-all px-4 py-2 rounded-xl flex items-center gap-2 ${filter === 'expense' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-300 hover:text-rose-500'}`}
              >
                <TrendingDown size={16} />
                <span>المصروفات</span>
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400 dark:text-slate-300" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm dark:text-white"
                />
                <span className="text-slate-300 dark:text-slate-400 text-xs">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm dark:text-white"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className="px-4 py-2 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-slate-600 dark:text-white"
              >
                <option value="">كل التصنيفات</option>
                {selectedCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium px-2">
                  مسح الكل
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="البحث في البيان أو التصنيف أو اسم الطالب..."
              className="pr-12 pl-6 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 text-sm w-full dark:text-white"
            />
          </div>
        </div>

        <FinanceReportPanel
          showReport={showReport}
          onClose={() => setShowReport(false)}
          reportData={reportData}
          reportLoading={reportLoading}
          startDate={startDate}
          endDate={endDate}
        />

        <StudentAccountsPanel
          open={showStudentAccounts}
          onClose={() => setShowStudentAccounts(false)}
        />

        {/* Transactions Table */}
        <div className="overflow-auto">
           <table className="w-full text-right border-collapse min-w-[800px]">
               <thead className="bg-slate-50/50 dark:bg-white/5 text-[10px] font-black uppercase text-slate-400 dark:text-slate-300 tracking-widest border-b border-slate-50 dark:border-white/5">
                <tr>
                   <th className="px-8 py-5">المعاملة</th>
                   <th className="px-8 py-5">التصنيف</th>
                   <th className="px-8 py-5">التاريخ</th>
                   <th className="px-8 py-5">المبلغ</th>
                   <th className="px-8 py-5">مرتبطة بـ</th>
                   <th className="px-8 py-5">إجراءات</th>
                </tr>
             </thead>
               <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                 {loading ? Array.from({ length: 6 }).map((_, i) => (
                   <tr key={`skel-${i}`}>
{Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-8 py-6"><Skeleton className="h-6 w-full" /></td>
                      ))}
                   </tr>
                 )) : finances.length > 0 ? finances.map((f: any) => (
                    <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                             <div className={`p-2.5 rounded-xl ${f.type === 'revenue' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                               {f.type === 'revenue' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">{f.description || 'بدون وصف'}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-300 font-medium">كود العملية: {f.id ? String(f.id).split('-')[0] : '—'}</p>
                            </div>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                          <span className="px-3 py-1 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold">{f.category || '—'}</span>
                      </td>
                      <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300 text-xs">
                            <Calendar size={14} />
                            <span>{f.date ? new Date(f.date).toLocaleDateString('ar-EG') : '—'}</span>
                         </div>
                      </td>
                      <td className="px-8 py-6 font-black text-lg">
                          <span className={f.type === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                             {f.type === 'revenue' ? '+' : '-'}{Number(f.amount || 0).toLocaleString()} ج.م
                          </span>
                      </td>
                      <td className="px-8 py-6">
                         {f.student_name ? (
                             <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs bg-blue-50 dark:bg-blue-500/20 px-3 py-1.5 rounded-xl w-fit">
                               <User size={14} />
                               <span>{f.student_name}</span>
                            </div>
                         ) : (
                             <span className="text-slate-300 dark:text-slate-400 text-xs">---</span>
                         )}
                      </td>
                      <td className="px-8 py-6">
                         {f.is_reversal ? (
                           <span className="px-3 py-1.5 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 rounded-lg text-xs font-bold">قيد عكسي</span>
                         ) : (
                           <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(f)}
                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10"
                                title="تعديل المعاملة"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(f.id)}
                                className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                                title="حذف المعاملة"
                              >
                                <Trash2 size={16} />
                              </button>
                           </div>
                         )}
                      </td>
                   </tr>
                )) : (
                   <tr>
                      <td colSpan={6} className="py-20 text-center">
                         <div className="flex flex-col items-center gap-4">
                             <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-full text-slate-200 dark:text-slate-600">
                                <FileText size={48} />
                             </div>
                             <p className="text-slate-400 dark:text-slate-300 font-medium">لا توجد معاملات مالية مسجلة حالياً</p>
                         </div>
                      </td>
                   </tr>
                )}
             </tbody>
           </table>
         </div>

        <Pagination page={page} totalPages={totalPages} total={totalRecords} onPageChange={setPage} />
       </div>

      <FinanceRecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        formData={formData}
        onChange={setFormData}
        onSave={handleSave}
        students={students}
        paymentMethods={paymentMethods}
        isEdit={editingId !== null}
      />
    </div>
  );
}
