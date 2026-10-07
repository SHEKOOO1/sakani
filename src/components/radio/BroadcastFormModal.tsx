import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarDays, X, Image, Upload, Radio, Tv, Save, Loader2, Repeat
} from 'lucide-react';
import { FALLBACK_COVER } from './types';

interface BroadcastFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: { title: string; cover_image: string; host_name: string; guest_name: string; type: string; scheduled_at: string; recurring: boolean; recurring_day: string; recurring_time: string; playlist_id: string };
  onChange: (data: any) => void;
  editingId: string | null;
  onSave: () => void;
  saving: boolean;
  uploadingImage: boolean;
  coverFileRef: React.RefObject<HTMLInputElement | null>;
  playlists: any[];
  onUploadImage: (file: File, onUrl: (url: string) => void) => void;
}

export const BroadcastFormModal: React.FC<BroadcastFormModalProps> = ({
  isOpen, onClose, formData, onChange, editingId, onSave, saving,
  uploadingImage, coverFileRef, playlists, onUploadImage
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl relative overflow-hidden border border-slate-100 dark:border-white/10">
            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg"><CalendarDays size={20} className="text-amber-600 dark:text-amber-400" /></div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{editingId ? 'تعديل البرنامج' : 'إضافة برنامج جديد'}</h3>
              </div>
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 md:p-8 space-y-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">اسم البرنامج *</label>
                <input type="text" value={formData.title} onChange={e => onChange({ ...formData, title: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="مثال: برنامج صباح الخير" />
              </div>

              {/* Cover Image */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">صورة البرنامج</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-white/10">
                    {formData.cover_image ? (
                      <img src={formData.cover_image} alt="" className="w-full h-full object-cover"
                        onError={(e) => { const el = e.target as HTMLImageElement; el.src = FALLBACK_COVER; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300"><Image size={20} /></div>
                    )}
                  </div>
                  <div className="flex-1 flex gap-2">
                    <input type="url" value={formData.cover_image} onChange={e => onChange({ ...formData, cover_image: e.target.value })}
                      className="flex-1 p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="رابط الصورة" />
                    <label className="shrink-0 flex items-center justify-center p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-slate-400 hover:text-primary-600 hover:border-primary-500/30 cursor-pointer transition-all">
                      <Upload size={16} />
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) onUploadImage(file, (url) => onChange({ ...formData, cover_image: url })); }} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Host & Guest */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-2">اسم المذيع</label>
                  <input type="text" value={formData.host_name} onChange={e => onChange({ ...formData, host_name: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="مثال: ميشيل" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-2">اسم الضيف</label>
                  <input type="text" value={formData.guest_name} onChange={e => onChange({ ...formData, guest_name: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="إن وجد" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">نوع البرنامج *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {(['audio', 'video', 'both'] as const).map(t => {
                    const isActive = formData.type === t;
                    const icons = { audio: <Radio size={14} />, video: <Tv size={14} />, both: <><Radio size={14} /><Tv size={14} /></> };
                    const labels = { audio: 'إذاعي', video: 'مرئي', both: 'سمعي + مرئي' };
                    return (
                      <button key={t} type="button" onClick={() => onChange({ ...formData, type: t })}
                        className={`flex items-center justify-center gap-1.5 p-3 rounded-xl border text-[11px] font-bold transition-all ${
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400'
                            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                        }`}>
                        {icons[t]} {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-2">اليوم</label>
                  <select value={formData.scheduled_at ? new Date(formData.scheduled_at).toLocaleDateString('en-CA') : ''}
                    onChange={e => {
                      const time = formData.scheduled_at ? new Date(formData.scheduled_at).toTimeString().slice(0, 5) : '12:00';
                      onChange({ ...formData, scheduled_at: `${e.target.value}T${time}` });
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white focus:border-primary-500/30 transition-all">
                    <option value="">اختر اليوم</option>
                    {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d, i) => {
                      const date = new Date();
                      const diff = (i + 7 - date.getDay()) % 7;
                      date.setDate(date.getDate() + diff);
                      return <option key={i} value={date.toLocaleDateString('en-CA')}>{d}</option>;
                    })}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-2">الوقت</label>
                  <input type="time" value={formData.scheduled_at ? new Date(formData.scheduled_at).toTimeString().slice(0, 5) : ''}
                    onChange={e => {
                      const day = formData.scheduled_at ? new Date(formData.scheduled_at).toLocaleDateString('en-CA') : '';
                      onChange({ ...formData, scheduled_at: day ? `${day}T${e.target.value}` : '' });
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white focus:border-primary-500/30 transition-all" />
                </div>
              </div>

              {/* Recurrence Toggle */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Repeat size={16} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">برنامج متكرر أسبوعياً</span>
                  </div>
                  <button type="button" onClick={() => onChange({ ...formData, recurring: !formData.recurring })}
                    className={`relative w-11 h-6 rounded-full transition-all ${formData.recurring ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${formData.recurring ? 'right-0.5' : 'right-[22px]'}`} />
                  </button>
                </div>
                {formData.recurring && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 px-1">يوم الإعادة</label>
                      <select value={formData.recurring_day} onChange={e => onChange({ ...formData, recurring_day: e.target.value })}
                        className="w-full p-2.5 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-xs font-bold text-slate-900 dark:text-white focus:border-primary-500/30 transition-all">
                        <option value="">اختر اليوم</option>
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                          <option key={d} value={d}>{['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][i]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 px-1">وقت الإعادة</label>
                      <input type="time" value={formData.recurring_time} onChange={e => onChange({ ...formData, recurring_time: e.target.value })}
                        className="w-full p-2.5 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-xs font-bold text-slate-900 dark:text-white focus:border-primary-500/30 transition-all" />
                    </div>
                  </div>
                )}
              </div>

              {/* Playlist Link */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">قائمة تشغيل مرتبطة</label>
                <select value={formData.playlist_id} onChange={e => onChange({ ...formData, playlist_id: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white focus:border-primary-500/30 transition-all">
                  <option value="">بدون قائمة تشغيل</option>
                  {playlists.filter(p => p.is_active).map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 md:p-8 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <button onClick={onClose} className="px-6 py-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">إلغاء</button>
              <button onClick={onSave} disabled={saving}
                className="px-6 py-3 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
