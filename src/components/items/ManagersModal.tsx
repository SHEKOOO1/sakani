import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Users, UserCheck, UserMinus, RefreshCw, Shield, Check } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface ManagersModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'event' | 'competition';
  itemId: string;
  itemTitle?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'ادارة',
  bishop: 'أسقف',
  priest: 'كاهن',
  supervisor: 'مشرف',
  assistant_supervisor: 'مساعد مشرف',
  employee: 'موظف',
};

export function ManagersModal({ isOpen, onClose, itemType, itemId, itemTitle }: ManagersModalProps) {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();
  const [managers, setManagers] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [canAssign, setCanAssign] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        request(`/api/items/${itemType}/${itemId}/managers`),
        request(`/api/items/${itemType}/${itemId}/assignable-users`),
      ]);
      setManagers(mRes.data || []);
      setCanAssign(!!mRes.canAssign);
      setCandidates(cRes.data || []);
      setSelected([]);
    } catch (e: any) {
      showSnackbar(e.message || 'فشل تحميل المتحكمين', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && itemId) load();
  }, [isOpen, itemId]);

  if (!isOpen) return null;

  const toggleCandidate = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (selected.length === 0) return;
    setAssigning(true);
    try {
      const res = await request(`/api/items/${itemType}/${itemId}/managers`, {
        method: 'POST',
        body: JSON.stringify({ userIds: selected }),
      });
      showSnackbar(`تم تعيين ${res.added || selected.length} متحكم بنجاح`, 'success');
      await load();
    } catch (e: any) {
      showSnackbar(e.message || 'فشل تعيين المتحكمين', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    try {
      await request(`/api/items/${itemType}/${itemId}/managers/${userId}`, { method: 'DELETE' });
      showSnackbar(`تمت إزالة ${name} من المتحكمين`, 'success');
      await load();
    } catch (e: any) {
      showSnackbar(e.message || 'فشل إزالة المتحكم', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 shadow-huge overflow-hidden rounded-ultra max-h-[90vh] flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-neon-secondary/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-neon-secondary/10 text-neon-secondary rounded-2xl"><Users size={24} /></div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">إدارة المتحكمين</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">{itemTitle || (itemType === 'event' ? 'فعالية' : 'مسابقة')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} aria-label="تحديث" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><RefreshCw size={18} /></button>
            <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <div>
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <UserCheck size={14} /> المتحكمون الحاليون ({managers.length})
            </p>
            {loading ? (
              <div className="p-10 text-center text-slate-400 font-bold">جارٍ التحميل...</div>
            ) : managers.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-slate-100 dark:border-white/10 rounded-2xl text-slate-400 font-bold text-sm">
                لا يوجد متحكمون لهذا العنصر بعد
              </div>
            ) : (
              <div className="space-y-2">
                {managers.map((m: any) => (
                  <div key={m.manager_id} className="p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-neon-secondary/10 text-neon-secondary flex items-center justify-center">
                        <Shield size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{m.user_name}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{ROLE_LABELS[m.role] || m.role} · {m.email}</p>
                      </div>
                    </div>
                    {canAssign && (
                      <button
                        onClick={() => handleRemove(m.user_id, m.user_name)}
                        aria-label={`إزالة ${m.user_name}`}
                        className="p-2 text-slate-400 hover:text-red-500 border border-slate-100 dark:border-white/10 rounded-xl transition-all"
                        title="إزالة المتحكم"
                      >
                        <UserMinus size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canAssign && (
            <div className="pt-6 border-t border-slate-100 dark:border-white/5 space-y-4">
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                تعيين متحكمين جدد (من نفس السكن فقط)
              </p>
              {candidates.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-100 dark:border-white/10 rounded-2xl text-slate-400 font-bold text-sm">
                  لا يوجد أعضاء متاحون من سكنك للتعيين
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {candidates.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => toggleCandidate(u.id)}
                        className={`p-4 rounded-2xl border text-right transition-all flex items-center gap-3 ${
                          selected.includes(u.id)
                            ? 'bg-neon-secondary/10 border-neon-secondary/40 text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 hover:border-neon-secondary/30'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                          selected.includes(u.id) ? 'bg-neon-secondary border-neon-secondary text-black' : 'border-slate-300 dark:border-white/20'
                        }`}>
                          {selected.includes(u.id) && <Check size={12} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                          <p className="text-[9px] text-slate-500 font-bold">{ROLE_LABELS[u.role] || u.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleAssign}
                    disabled={selected.length === 0 || assigning}
                    className="w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-neon-secondary text-black hover:brightness-110"
                  >
                    <UserCheck size={18} />
                    {assigning ? 'جارٍ التعيين...' : `تعيين ${selected.length} متحكم`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}