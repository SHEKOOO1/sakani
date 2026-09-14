import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Tv, X, Loader2, RefreshCw, Upload, Save, BookOpen
} from 'lucide-react';
import { Category, Playlist } from './types';

interface VideoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: { title: string; description: string; youtube_url: string; tags: string[]; is_live: boolean; thumbnail: string };
  onChange: (data: any) => void;
  editingId: string | null;
  onSave: () => void;
  saving: boolean;
  fetchVideoInfo: (url: string) => void;
  fetchingVideoInfo: boolean;
  uploadingImage: boolean;
  coverFileRef: React.RefObject<HTMLInputElement | null>;
  categories: Category[];
  addToPlaylistId: string;
  onAddToPlaylistIdChange: (value: string) => void;
  playlists: Playlist[];
  onUploadImage: (file: File, onUrl: (url: string) => void) => void;
}

export const VideoFormModal: React.FC<VideoFormModalProps> = ({
  isOpen, onClose, formData, onChange, editingId, onSave, saving,
  fetchVideoInfo, fetchingVideoInfo, uploadingImage, coverFileRef,
  categories, addToPlaylistId, onAddToPlaylistIdChange, playlists, onUploadImage
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg relative overflow-hidden border border-slate-100 dark:border-white/10">
            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg"><Tv size={20} className="text-purple-600 dark:text-purple-400" /></div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{editingId ? 'تعديل البث المرئي' : 'إضافة بث مرئي جديد'}</h3>
              </div>
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">رابط الفيديو (YouTube / Facebook) *</label>
                <div className="flex gap-2">
                  <input type="url" value={formData.youtube_url} onChange={e => onChange({ ...formData, youtube_url: e.target.value })}
                    className="flex-1 p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all font-mono" placeholder="https://youtube.com/watch?v=... أو رابط فيسبوك" />
                  <button type="button" onClick={() => fetchVideoInfo(formData.youtube_url)} disabled={fetchingVideoInfo || !formData.youtube_url.trim()}
                    className="shrink-0 px-3 py-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-all disabled:opacity-40">
                    {fetchingVideoInfo ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">العنوان *</label>
                <input type="text" value={formData.title} onChange={e => onChange({ ...formData, title: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">الوصف</label>
                <textarea value={formData.description} onChange={e => onChange({ ...formData, description: e.target.value })} rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">وسوم (اختياري)</label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl min-h-[42px]">
                  {categories.length === 0 ? (
                    <span className="text-[11px] text-slate-400">لا توجد تصنيفات — أضف تصنيفات أولاً</span>
                  ) : categories.map(cat => {
                    const selected = formData.tags.includes(cat.id);
                    return (
                      <button key={cat.id} type="button" onClick={() => onChange({
                        ...formData,
                        tags: selected ? formData.tags.filter(t => t !== cat.id) : [...formData.tags, cat.id]
                      })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          selected
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-primary-300 dark:hover:border-primary-500/40'
                        }`}>
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">صورة الحلقة (اختياري)</label>
                {formData.thumbnail && (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
                    <img src={formData.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                    <button onClick={() => onChange({ ...formData, thumbnail: '' })}
                      className="absolute top-2 left-2 p-1 bg-black/50 backdrop-blur-sm text-white rounded-lg hover:bg-black/70 transition-all">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="url" value={formData.thumbnail} onChange={e => onChange({ ...formData, thumbnail: e.target.value })}
                    className="flex-1 p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="رابط الصورة (يُستخدم thumbnail اليوتيوب تلقائياً)" />
                  <label className={`shrink-0 flex items-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-all cursor-pointer ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    <span className="text-[10px] font-bold">رفع</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) onUploadImage(file, (url) => onChange({ ...formData, thumbnail: url }));
                    }} disabled={uploadingImage} />
                  </label>
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${formData.is_live ? 'bg-red-50 dark:bg-red-500/10' : 'bg-slate-100 dark:bg-white/[0.03]'}`}>
                    <Tv size={14} className={formData.is_live ? 'text-red-500' : 'text-slate-400'} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">بث مباشر</span>
                    <p className="text-[9px] text-slate-400">يظهر في قسم "مباشر الآن"</p>
                  </div>
                </div>
                <button onClick={() => onChange({ ...formData, is_live: !formData.is_live })}
                  className={`relative w-11 h-6 rounded-full transition-all ${formData.is_live ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <motion.div animate={{ x: formData.is_live ? 22 : 2 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </label>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
                  <BookOpen size={12} className="text-primary-500" />
                  إضافة إلى برنامج (اختياري)
                </label>
                <select value={addToPlaylistId} onChange={e => onAddToPlaylistIdChange(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white focus:border-primary-500/30 transition-all">
                  <option value="" className="bg-white dark:bg-slate-900">لا تفعيل</option>
                  {playlists.filter(p => p.is_active).map(pl => (
                    <option key={pl.id} value={pl.id} className="bg-white dark:bg-slate-900">{pl.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 md:p-8 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <button onClick={onClose} className="px-6 py-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">إلغاء</button>
              <button onClick={onSave} disabled={saving}
                className="px-6 py-3 bg-gradient-to-br from-purple-600 to-vibrant-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-purple-500/30 transition-all disabled:opacity-50 flex items-center gap-2">
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
