import { motion } from 'motion/react';
import { Church, X } from 'lucide-react';

interface ReportFormModalProps {
  reportForm: { title: string; description: string; type: string };
  sendingReport: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (field: string, value: string) => void;
}

export function ReportFormModal({ reportForm, sendingReport, onClose, onSubmit, onFormChange }: ReportFormModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white dark:bg-card-dark rounded-xl p-8 max-w-xl w-full shadow-2xl border border-slate-100 dark:border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-vibrant-50 dark:bg-vibrant-500/20">
              <Church size={24} className="text-vibrant-600 dark:text-vibrant-400" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-white">رفع تقرير للأسقف</h3>
              <p className="text-xs text-slate-400 dark:text-slate-300 font-bold">تقرير دوري أو بلاغ عاجل لنيافة الأسقف</p>
            </div>
          </div>
          
            <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
          
            </button>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-2">نوع التقرير</label>
            <div className="flex gap-2">
              {[
                { value: 'general', label: 'عام' },
                { value: 'warning', label: 'إنذار جماعي' },
                { value: 'penalty', label: 'عقوبات' },
                { value: 'event', label: 'فعاليات' },
              ].map(t => (
                <button key={t.value} onClick={() => onFormChange('type', t.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${reportForm.type === t.value ? 'bg-vibrant-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-2">عنوان التقرير</label>
            <input type="text" value={reportForm.title} onChange={e => onFormChange('title', e.target.value)}
              placeholder="مثال: تقرير شهري مايو - سكن النور"
              className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-vibrant-300 dark:focus:border-vibrant-500 transition-all dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-2">محتوى التقرير</label>
            <textarea value={reportForm.description} onChange={e => onFormChange('description', e.target.value)}
              rows={4} placeholder="اكتب تفاصيل التقرير هنا..."
              className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-vibrant-300 dark:focus:border-vibrant-500 transition-all resize-none dark:text-white"
            />
          </div>
          <button onClick={onSubmit} disabled={sendingReport}
            className="w-full py-3.5 bg-vibrant-600 text-white rounded-xl font-black text-sm hover:bg-vibrant-700 transition-all disabled:opacity-50 shadow-lg"
          >
            {sendingReport ? 'جاري الإرسال...' : 'إرسال التقرير للأسقف'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
