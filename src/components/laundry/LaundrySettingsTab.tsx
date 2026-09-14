import { motion } from 'motion/react';
import { Settings } from 'lucide-react';

interface LaundrySettingsTabProps {
  settings: any;
  loading: boolean;
  onSettingsChange: (settings: any) => void;
  onUpdateSettings: () => void;
  onInitDefault: () => void;
}

export function LaundrySettingsTab({ settings, loading, onSettingsChange, onUpdateSettings, onInitDefault }: LaundrySettingsTabProps) {
  return (
    <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      className="bg-white dark:bg-card-dark p-8 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm space-y-8"
    >
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-bold">جاري تحميل الإعدادات...</p>
        </div>
      ) : !settings ? (
        <div className="py-20 text-center space-y-4">
          <Settings size={48} className="mx-auto text-slate-200" />
          <p className="text-slate-400 font-bold">لم يتم ضبط إعدادات المغسلة بعد</p>
          <p className="text-slate-300 text-sm">قم بضبط الإعدادات الافتراضية للمغسلة من هنا</p>
          <button onClick={onInitDefault} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all">
            تهيئة الإعدادات الافتراضية
          </button>
        </div>
      ) : (
        <>
          <h3 className="text-xl font-black text-slate-800">إعدادات المغسلة</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ساعة البدء</label>
              <input type="time" value={settings.start_hour} onChange={e => onSettingsChange({...settings, start_hour: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ساعة الانتهاء</label>
              <input type="time" value={settings.end_hour} onChange={e => onSettingsChange({...settings, end_hour: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-4">أيام العمل</label>
            <div className="grid grid-cols-7 gap-2">
              {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((day, i) => (
                <button key={i}
                  onClick={() => {
                    const days = settings.days.includes(i) ? settings.days.filter((d: any) => d !== i) : [...settings.days, i];
                    onSettingsChange({...settings, days});
                  }}
                  className={`p-4 rounded-2xl font-black ${settings.days.includes(i) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onUpdateSettings} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black">حفظ الإعدادات</button>
        </>
      )}
    </motion.div>
  );
}
