import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData: { status: string; assignedTo: string };
  onEditDataChange: (data: { status: string; assignedTo: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
  staff: any[];
}

export function UpdateStatusModal({
  isOpen,
  onClose,
  editData,
  onEditDataChange,
  onSubmit,
  staff,
}: UpdateStatusModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-lg relative text-right max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark z-10">
              <h3 className="text-xl font-black text-slate-800 dark:text-white">تحديث حالة البلاغ</h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>

            <form onSubmit={onSubmit} className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">الحالة الحالية</label>
                  <select
                    value={editData.status}
                    onChange={(e) => onEditDataChange({...editData, status: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  >
                    <option value="pending">قيد الانتظار</option>
                    <option value="in-progress">جاري العمل</option>
                    <option value="completed">تم الإصلاح</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">تعيين إلى (موظف الصيانة)</label>
                  <select
                    value={editData.assignedTo}
                    onChange={(e) => onEditDataChange({...editData, assignedTo: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  >
                    <option value="">اختر موظفاً</option>
                    {staff.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-primary-500/20 hover:brightness-110 transition-all active:scale-95">
                تحديث بيانات البلاغ
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
