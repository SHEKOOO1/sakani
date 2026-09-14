import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface RoomFormData {
  roomNumber: string;
  apartmentId: string;
  capacity: number;
  price_daily: number;
  price_monthly: number;
  price_semester: number;
  amenities: string[];
  has_kitchen: boolean;
  kitchen_details: string[];
  has_bathroom: boolean;
  bathroom_details: string[];
}

interface RoomFormModalProps {
  isOpen: boolean;
  isEditMode: boolean;
  formData: RoomFormData;
  apartments: { id: string; name: string }[];
  onFormDataChange: (data: RoomFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function RoomFormModal({ isOpen, isEditMode, formData, apartments, onFormDataChange, onSubmit, onClose }: RoomFormModalProps) {
  if (!isOpen) return null;

  const update = (field: keyof RoomFormData, value: any) => {
    onFormDataChange({ ...formData, [field]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-card-dark rounded-[2.5rem] shadow-2xl w-full max-w-xl relative overflow-hidden text-right"
      >
        <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark z-10">
          <h3 className="text-xl font-black text-slate-800 dark:text-white">{isEditMode ? 'تعديل بيانات الغرفة' : 'إضافة غرفة سكنية جديدة'}</h3>
          
            <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
          
            </button>
        </div>

        <form onSubmit={onSubmit} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">رقم الغرفة</label>
              <input
                required type="text"
                value={formData.roomNumber} onChange={(e) => update('roomNumber', e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                placeholder="مثال: 101"
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">الشقة التابعة لها</label>
                <select
                  required
                  value={formData.apartmentId} onChange={(e) => update('apartmentId', e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                >
                  <option value="">اختر الشقة</option>
                  {apartments.map((apt: any) => (
                    <option key={apt.id} value={apt.id}>{apt.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">السعة (عدد الطلاب)</label>
                <input
                  required type="number" min="1"
                  value={formData.capacity} onChange={(e) => update('capacity', parseInt(e.target.value))}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-white/10">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block font-black">أسعار الإقامة (ج.م)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 dark:text-slate-300 font-bold">يومي</label>
                  <input
                    type="number" value={formData.price_daily} onChange={(e) => update('price_daily', parseFloat(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 dark:text-slate-300 font-bold">شهري</label>
                  <input
                    type="number" value={formData.price_monthly} onChange={(e) => update('price_monthly', parseFloat(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 dark:text-slate-300 font-bold">للترم</label>
                  <input
                    type="number" value={formData.price_semester} onChange={(e) => update('price_semester', parseFloat(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl outline-none font-bold dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-50 dark:border-white/10">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block font-black">محتويات الغرفة</label>
              <div className="grid grid-cols-2 gap-2">
                {['تكييف', 'مروحة', 'مكتب دراسة', 'دولاب خاص', 'كرسي مريح'].map(opt => (
                  <button
                    key={opt} type="button"
                    onClick={() => {
                      const current = formData.amenities || [];
                      update('amenities', current.includes(opt) ? current.filter(i => i !== opt) : [...current, opt]);
                    }}
                    className={`px-3 py-2.5 rounded-xl text-[10px] font-bold border transition-all ${
                      formData.amenities?.includes(opt) ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-card-dark border-slate-100 dark:border-white/10 text-slate-400 dark:text-slate-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50 dark:border-white/10">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.has_kitchen} onChange={(e) => update('has_kitchen', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">مطبخ خاص</span>
                </label>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.has_bathroom} onChange={(e) => update('has_bathroom', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">حمام خاص</span>
                </label>
              </div>
            </div>
          </div>

          <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95">
            {isEditMode ? 'حفظ التعديلات' : 'تأكيد إضافة الغرفة'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
