import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { 
  Undo2, User, ArrowRightLeft, CheckCircle2, XCircle,
  Clock, ExternalLink, ShieldAlert, Sparkles
} from 'lucide-react';

export function DecisionsLog() {
  const { request } = useApi();
  const { user } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('/api/decisions');
      if (mounted.current) setLogs(res.data || []);
    } catch (err) { console.error(err); }
    finally { if (mounted.current) setLoading(false); }
  }, [request]);

  useEffect(() => {

    fetchLogs();
    
  }, [fetchLogs]);

  const handleUndo = async (id: string) => {
    if (!await confirm({ message: 'هل أنت متأكد من التراجع عن هذا القرار؟ سيتم عكس كافة التأثيرات المرتبطة به.', type: 'danger' })) return;
    try {
      await request(`/api/decisions/${id}/undo`, { method: 'POST' });
      showSnackbar('تم التراجع بنجاح', 'success');
      fetchLogs();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const getActionLabel = (type: string, log?: any) => {
    const labels: any = {
      ADD_POINTS: 'إضافة نقاط',
      DEDUCT_POINTS: 'خصم نقاط',
      ISSUE_WARNING: 'إصدار إنذار',
      REVOKE_WARNING: 'إلغاء إنذار',
      MARK_ATTENDANCE: 'تسجيل حضور',
      APPROVE_REWARD: 'اعتماد مكافأة',
      REJECT_REWARD: 'رفض مكافأة',
    };
    const student = log?.student_name || log?.details?.studentName || '';
    return `${labels[type] || type}${student ? ` — ${student}` : ''}`;
  };

  const getActionIcon = (type: string) => {
    const icons: any = {
      ADD_POINTS: <User size={15} className="text-ocean-500" />,
      DEDUCT_POINTS: <User size={15} className="text-rose-500" />,
      ISSUE_WARNING: <ShieldAlert size={15} className="text-warm-500" />,
      REVOKE_WARNING: <CheckCircle2 size={15} className="text-ocean-500" />,
      MARK_ATTENDANCE: <ArrowRightLeft size={15} className="text-primary-500" />,
      APPROVE_REWARD: <CheckCircle2 size={15} className="text-ocean-500" />,
      REJECT_REWARD: <XCircle size={15} className="text-rose-500" />,
    };
    return icons[type] || <User size={15} className="text-slate-400" />;
  };

  if (loading) return (
    <div className="space-y-3 p-6">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-6 text-white shadow-xl">
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black">سجل القرارات</h1>
            <p className="text-white/70 font-bold text-sm">جميع القرارات والتفاعلات المسجلة في النظام</p>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-card-dark">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 dark:bg-white/5">
            <ArrowRightLeft size={28} className="text-slate-200 dark:text-slate-600" />
          </div>
          <p className="font-black text-slate-400 dark:text-slate-300">لا توجد قرارات مسجلة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const det = typeof log.details === 'string' ? (() => { try { return JSON.parse(log.details); } catch { return null; } })() : log.details;
            return (
              <motion.div key={log.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-white/[0.04] dark:bg-card-dark"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 dark:bg-white/10">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">{log.creator_name}</p>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">{getActionLabel(log.action, log)}</p>
                  {det?.reason && <p className="text-[10px] text-slate-400 dark:text-slate-400">{det.reason}</p>}
                  <p className="text-[10px] text-slate-400 dark:text-slate-300 mt-0.5">{new Date(log.created_at).toLocaleString('ar-EG')}</p>
                </div>
                {user && ['admin', 'supervisor', 'assistant_supervisor'].includes(user.role) && (
                  <button onClick={() => handleUndo(log.id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-rose-500 transition-all hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10"
                  >
                    <Undo2 size={13} /> تراجع
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
