import { motion, AnimatePresence } from 'motion/react';
import { X, PenSquare } from 'lucide-react';

interface GuardianEditData {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  occupation: string;
  relationType: string;
  password: string;
}

interface GuardianEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Partial<GuardianEditData>;
  onChange: (data: any) => void;
  onSave: () => void;
  saving?: boolean;
}

export function GuardianEditModal({ isOpen, onClose, data, onChange, onSave, saving }: GuardianEditModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-[3rem] shadow-2xl w-full max-w-lg relative text-right overflow-y-auto max-h-[90vh]"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark">
              <div className="flex items-center gap-3">
                <PenSquare className="text-blue-500" size={24} />
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">تعديل بيانات ولي الأمر</h3>
              </div>
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X /></button>
            </div>
            <div className="p-4 sm:p-6 md:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الاسم</label>
                  <input type="text" value={data.name || ''} onChange={e => onChange({ ...data, name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">صلة القرابة</label>
                  <select value={data.relationType || 'father'} onChange={e => onChange({ ...data, relationType: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white">
                    <option value="father">الأب</option>
                    <option value="mother">الأم</option>
                    <option value="other">ولي أمر آخر</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">رقم الهاتف</label>
                  <input type="text" value={data.phone || ''} onChange={e => onChange({ ...data, phone: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">واتساب</label>
                  <input type="text" value={data.whatsapp || ''} onChange={e => onChange({ ...data, whatsapp: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الوظيفة</label>
                  <input type="text" value={data.occupation || ''} onChange={e => onChange({ ...data, occupation: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">البريد الإلكتروني</label>
                  <input type="email" value={data.email || ''} onChange={e => onChange({ ...data, email: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                </div>
                <div className="space-y-2 col-span-2 border-t border-slate-100 dark:border-white/10 pt-4">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">كلمة المرور الجديدة (اتركه فارغًا إذا لا تريد التغيير)</label>
                  <input type="password" value={data.password || ''} onChange={e => onChange({ ...data, password: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="********" />
                </div>
              </div>
              <button onClick={onSave} disabled={saving} className="neon-btn neon-btn-primary w-full py-5 text-sm shadow-glow mt-6">
                {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}