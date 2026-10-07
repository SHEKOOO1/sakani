import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  X,
  ChevronLeft,
  Activity,
  Terminal,
} from 'lucide-react';

interface AuditLog {
  id: string;
  action_type: string;
  method: string;
  url: string;
  status_code: number;
  created_at: string;
}

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLog[];
  loading: boolean;
  employeeName?: string;
}

export function AuditLogModal({
  isOpen,
  onClose,
  auditLogs,
  loading,
  employeeName,
}: AuditLogModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-card-dark w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col border border-white/10"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-400/10 rounded-2xl flex items-center justify-center text-amber-500 shadow-glow-sm">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black dark:text-white leading-none">سجل تدقيق العمليات</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">الموظف: {employeeName}</p>
                </div>
              </div>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X  size={20} className="text-slate-400" />
              
                </button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar space-y-4">
              {loading ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto mb-4"></div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">جاري جلب السجلات من الخادم...</p>
                </div>
              ) : auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-neon-primary/20 transition-all group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[8px] ${
                      log.method === 'POST' ? 'bg-blue-500/10 text-blue-500' :
                      log.method === 'PUT' ? 'bg-amber-500/10 text-amber-500' :
                      log.method === 'DELETE' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      {log.method}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-tight">
                          {log.action_type?.replace(/_/g, ' ') || 'عملية إدارية'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">{new Date(log.created_at).toLocaleString('ar-EG')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                        <span className={`px-1.5 py-0.5 rounded font-black ${log.status_code < 300 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {log.status_code}
                        </span>
                        <Terminal size={12} className="text-slate-400" />
                        <span className="truncate max-w-[300px] font-mono">{log.url}</span>
                      </div>
                    </div>
                    <ChevronLeft size={14} className="text-slate-300 group-hover:translate-x-[-4px] transition-transform" />
                  </div>
                ))
              ) : (
                <div className="py-20 text-center space-y-4">
                  <Activity size={48} className="mx-auto text-slate-100 dark:text-white/5" />
                  <p className="text-slate-400 font-bold">لا يوجد نشاط مسجل لهذا الموظف حتى الآن</p>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 text-center">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em]">نظام DormMaster للرقابة والشفافية الرعوية</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
