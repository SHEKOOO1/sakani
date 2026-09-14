import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Users, Search, Printer, FileSpreadsheet, Wallet, TrendingUp, AlertCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface StudentAccountsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function StudentAccountsPanel({ open, onClose }: StudentAccountsPanelProps) {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState({ invoice: 0, paid: 0, remaining: 0 });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await request('/api/finances/student-accounts');
      if (!resp || !resp.data) return;
      setRows(resp.data.rows || []);
      setTotals(resp.data.totals || { invoice: 0, paid: 0, remaining: 0 });
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [request, showSnackbar]);

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      fetchAccounts();
    }
  }, [open, fetchAccounts]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const blob = await request(`/api/finances/student-accounts/export?format=${format}`, { responseType: 'blob' });
      if (!blob) return;
      const url = URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students-accounts-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  if (!open) return null;

  const filteredRows = rows.filter((r: any) =>
    !searchTerm || (r.student_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-slate-100 dark:border-white/10">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-primary-600 dark:text-primary-400" />
            تقرير حسابات الطلاب
            <span className="text-xs font-normal text-slate-400 dark:text-slate-300">
              كل طالب في خانه واحده بإجمالي كل دفعاته طوال الترم
            </span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm"
            >
              <Printer size={16} />
              طباعة التقرير
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm"
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>
            <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-500/20 p-4 rounded-2xl">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">إجمالي المدفوع</p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-2"><TrendingUp size={16} /> {totals.paid.toLocaleString()}$</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-500/20 p-4 rounded-2xl">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">إجمالي الفواتير</p>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1 flex items-center gap-2"><Wallet size={16} /> {totals.invoice.toLocaleString()}$</p>
          </div>
          <div className={`p-4 rounded-2xl ${totals.remaining > 0 ? 'bg-amber-50 dark:bg-amber-500/20' : 'bg-slate-50 dark:bg-white/5'}`}>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">إجمالي المتبقي</p>
            <p className={`text-2xl font-black mt-1 ${totals.remaining > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-300'}`}>{totals.remaining.toLocaleString()}$</p>
          </div>
          <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">عدد الطلاب</p>
            <p className="text-2xl font-black text-slate-700 dark:text-white mt-1 flex items-center gap-2"><Users size={16} /> {rows.length}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث باسم طالب..."
            className="pr-11 pl-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 text-sm w-full md:w-80 dark:text-white"
          />
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-100 dark:border-white/10">
          <table className="w-full text-right border-collapse min-w-[640px]">
            <thead className="bg-slate-50/50 dark:bg-white/5 text-[10px] font-black uppercase text-slate-400 dark:text-slate-300 tracking-widest border-b border-slate-50 dark:border-white/5">
              <tr>
                <th className="px-6 py-4">الطالب</th>
                <th className="px-6 py-4">الغرفة</th>
                <th className="px-6 py-4">الفاتورة</th>
                <th className="px-6 py-4">المدفوع (الإجمالي)</th>
                <th className="px-6 py-4">المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-6 py-4"><div className="h-5 bg-slate-100 dark:bg-white/5 rounded animate-pulse" /></td>
                  ))}
                </tr>
              )) : filteredRows.length > 0 ? filteredRows.map((r: any) => (
                <tr key={r.student_id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        <Users size={16} />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-white">{r.student_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-300">{r.room_number || '---'}</td>
                  <td className="px-6 py-4 font-black text-slate-700 dark:text-white">{r.totalInvoice.toLocaleString()}$</td>
                  <td className="px-6 py-4 font-black text-emerald-600 dark:text-emerald-400">{r.totalPaid.toLocaleString()}$</td>
                  <td className="px-6 py-4">
                    <span className={`font-black ${r.remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {r.remaining.toLocaleString()}$
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-full text-slate-200 dark:text-slate-600"><AlertCircle size={32} /></div>
                      <p className="text-slate-400 dark:text-slate-300 font-medium">لا يوجد طلاب في هذا النطاق</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/80 dark:bg-white/5 text-sm">
                <td className="px-6 py-4 font-black text-slate-800 dark:text-white">الإجمالي</td>
                <td className="px-6 py-4"></td>
                <td className="px-6 py-4 font-black text-slate-800 dark:text-white">{totals.invoice.toLocaleString()}$</td>
                <td className="px-6 py-4 font-black text-emerald-600 dark:text-emerald-400">{totals.paid.toLocaleString()}$</td>
                <td className="px-6 py-4 font-black text-amber-600 dark:text-amber-400">{totals.remaining.toLocaleString()}$</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}