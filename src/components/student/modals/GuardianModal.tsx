import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface GuardianData {
  name: string;
  email: string;
  password: string;
  phone: string;
  whatsapp: string;
  occupation: string;
  relationType: 'father' | 'mother' | 'other';
  photo: string;
}

interface GuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Partial<GuardianData>;
  onChange: (data: any) => void;
  onSave: () => void;
}

export function GuardianModal({ isOpen, onClose, data, onChange, onSave }: GuardianModalProps) {
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
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">إضافة ولي أمر</h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <div className="p-4 sm:p-6 md:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الاسم</label>
                  <input type="text" value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="اسم ولي الأمر" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">كلمة المرور</label>
                  <input type="password" value={data.password} onChange={e => onChange({ ...data, password: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="كلمة المرور الافتراضية" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">البريد الإلكتروني</label>
                  <input type="email" value={data.email} onChange={e => onChange({ ...data, email: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="parent@mail.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">صلة القرابة</label>
                  <select value={data.relationType} onChange={e => onChange({ ...data, relationType: e.target.value as any })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white">
                    <option value="father">الأب</option>
                    <option value="mother">الأم</option>
                    <option value="other">ولي أمر آخر</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">رقم الهاتف</label>
                  <input type="text" value={data.phone} onChange={e => onChange({ ...data, phone: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">واتساب</label>
                  <input type="text" value={data.whatsapp} onChange={e => onChange({ ...data, whatsapp: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الوظيفة</label>
                  <input type="text" value={data.occupation} onChange={e => onChange({ ...data, occupation: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                </div>
              </div>
              <button onClick={onSave} className="neon-btn neon-btn-primary w-full py-5 text-sm shadow-glow mt-6">
                إنشاء حساب ولي الأمر وربطه
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}