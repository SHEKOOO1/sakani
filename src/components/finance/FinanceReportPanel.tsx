import { motion } from 'motion/react';
import { X, BarChart3, PieChart } from 'lucide-react';

interface FinanceReportPanelProps {
  showReport: boolean;
  onClose: () => void;
  reportData: any;
  reportLoading: boolean;
  startDate?: string;
  endDate?: string;
}

export function FinanceReportPanel({ showReport, onClose, reportData, reportLoading, startDate, endDate }: FinanceReportPanelProps) {
  if (!showReport) return null;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-t border-slate-100 dark:border-white/10">
      {reportLoading ? (
        <div className="p-8 text-center text-slate-400 dark:text-slate-300">جاري تحميل التقرير...</div>
      ) : reportData ? (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
              التقرير التفصيلي
              {(startDate || endDate) && (
                <span className="text-sm font-normal text-slate-400 dark:text-slate-300">
                  ({startDate || 'البداية'} — {endDate || 'النهاية'})
                </span>
              )}
            </h3>
            
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
            
              </button>
          </div>

          {/* Report Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-500/20 p-4 rounded-2xl">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">إجمالي الوارد</p>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{reportData.totals.income.toLocaleString()}$</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-500/20 p-4 rounded-2xl">
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">إجمالي المصروفات</p>
              <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">{reportData.totals.expense.toLocaleString()}$</p>
            </div>
            <div className={`p-4 rounded-2xl ${reportData.totals.net >= 0 ? 'bg-blue-50 dark:bg-blue-500/20' : 'bg-amber-50 dark:bg-amber-500/20'}`}>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">صافي الرصيد</p>
              <p className={`text-2xl font-black mt-1 ${reportData.totals.net >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {reportData.totals.net.toLocaleString()}$
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">عدد المعاملات</p>
              <p className="text-2xl font-black text-slate-700 dark:text-white mt-1">{reportData.totals.transactionCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
              <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <PieChart size={16} />
                تحليل حسب التصنيف
              </h4>
              {reportData.byCategory.length > 0 ? (
                <div className="space-y-2">
                  {reportData.byCategory.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-white dark:bg-card-dark p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${item.type === 'revenue' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {item.type === 'revenue' ? 'وارد - ' : 'مصروف - '}{item.category}
                        </span>
                      </div>
                      <span className={`text-sm font-black ${item.type === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {Number(item.total).toLocaleString()}$
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 dark:text-slate-300 text-sm text-center py-6">لا توجد بيانات</p>
              )}
            </div>

            {/* Monthly Breakdown */}
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
              <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <BarChart3 size={16} />
                تحليل شهري
              </h4>
              {reportData.byMonth.length > 0 ? (
                <div className="space-y-2">
                  {reportData.byMonth.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-white dark:bg-card-dark p-3 rounded-xl">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.month}</span>
                      <div className="flex items-center gap-4 text-sm font-black">
                        <span className="text-emerald-600 dark:text-emerald-400">{Number(item.income).toLocaleString()}$</span>
                        <span className="text-rose-600 dark:text-rose-400">{Number(item.expense).toLocaleString()}$</span>
                        <span className={`${Number(item.income) - Number(item.expense) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {(Number(item.income) - Number(item.expense)).toLocaleString()}$
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 dark:text-slate-300 text-sm text-center py-6">لا توجد بيانات</p>
              )}
              {reportData.byMonth.length > 0 && (
                <div className="flex items-center justify-between mt-3 px-1 text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">
                  <span>الشهر</span>
                  <div className="flex items-center gap-4">
                    <span>الوارد</span>
                    <span>المصروفات</span>
                    <span>الصافي</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
