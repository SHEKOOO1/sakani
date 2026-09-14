import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface AddOperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: any[];
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function AddOperatorModal({ isOpen, onClose, users, selectedUserId, onUserChange, onSave, saving }: AddOperatorModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md relative"
          >
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">تعيين مسؤول مغسلة</h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">اختر المستخدم</label>
                <select 
                  value={selectedUserId}
                  onChange={(e) => onUserChange(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 font-bold dark:text-white"
                >
                  <option value="">اختر مستخدم</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={onSave}
                disabled={saving}
                className="w-full py-4 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-black rounded-2xl shadow-xl shadow-primary-500/20 hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? 'جاري التعيين...' : 'تعيين المسؤول'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
