import { motion, AnimatePresence } from 'motion/react';
import { PenSquare, X } from 'lucide-react';

interface PriestEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: Record<string, any>;
  onChange: (form: Record<string, any>) => void;
  onSave: () => void;
  saving: boolean;
}

export function PriestEditModal({ isOpen, onClose, form, onChange, onSave, saving }: PriestEditModalProps) {
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
            className="bg-white dark:bg-card-dark rounded-[3rem] shadow-2xl w-full max-w-lg relative text-right"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PenSquare className="text-blue-500" size={24} />
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">تعديل بيانات الكاهن</h3>
              </div>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الاسم</label>
                <input type="text" value={form.name || ''} onChange={e => onChange({ ...form, name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الإيميل</label>
                <input type="email" value={form.email || ''} onChange={e => onChange({ ...form, email: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">المحافظة</label>
                <input type="text" value={form.governorate || ''} onChange={e => onChange({ ...form, governorate: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">القرية</label>
                <input type="text" value={form.village || ''} onChange={e => onChange({ ...form, village: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الكنيسة</label>
                <input type="text" value={form.church_name || ''} onChange={e => onChange({ ...form, church_name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">أب الاعتراف</label>
                <input type="text" value={form.confession_father_name || ''} onChange={e => onChange({ ...form, confession_father_name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">تليفون أب الاعتراف</label>
                <input type="text" value={form.confession_father_phone || ''} onChange={e => onChange({ ...form, confession_father_phone: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">واتساب أب الاعتراف</label>
                <input type="text" value={form.confession_father_whatsapp || ''} onChange={e => onChange({ ...form, confession_father_whatsapp: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">خدمة أب الاعتراف</label>
                <input type="text" value={form.confession_father_service || ''} onChange={e => onChange({ ...form, confession_father_service: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="border-t border-slate-100 dark:border-white/10 pt-4">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-300 mb-3">بيانات الخدمة والشموسية</p>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl cursor-pointer">
                    <input type="checkbox" checked={!!form.is_servant} onChange={e => onChange({ ...form, is_servant: e.target.checked })} className="w-5 h-5" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">خادم</span>
                  </label>
                  {form.is_servant && (
                    <div className="space-y-2 pr-8">
                      <input type="text" value={form.servant_services || ''} onChange={e => onChange({ ...form, servant_services: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="الخدمات" />
                    </div>
                  )}
                  <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl cursor-pointer">
                    <input type="checkbox" checked={!!form.is_deacon} onChange={e => onChange({ ...form, is_deacon: e.target.checked })} className="w-5 h-5" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">شماس</span>
                  </label>
                  {form.is_deacon && (
                    <div className="space-y-2 pr-8">
                      <input type="text" value={form.deacon_rank || ''} onChange={e => onChange({ ...form, deacon_rank: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="الرتبة" />
                      <input type="date" value={form.deacon_ordination_date?.split('T')[0] || ''} onChange={e => onChange({ ...form, deacon_ordination_date: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
                      <input type="text" value={form.deacon_details || ''} onChange={e => onChange({ ...form, deacon_details: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="تفاصيل" />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">شهادة تدريب الخدمة</label>
                <input type="text" value={form.service_training_certificate || ''} onChange={e => onChange({ ...form, service_training_certificate: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">العنوان الدائم</label>
                <textarea rows={3} value={form.address || ''} onChange={e => onChange({ ...form, address: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold resize-none dark:text-white" />
              </div>
            </div>
            <div className="p-8 border-t border-slate-100 dark:border-white/10 flex justify-between">
              <button onClick={onClose} className="px-6 py-3 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all">
                إلغاء
              </button>
              <button onClick={onSave} disabled={saving} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <PenSquare size={14} />}
                حفظ التعديلات
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
