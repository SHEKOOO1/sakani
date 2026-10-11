import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, X } from 'lucide-react';
import { uploadImage } from '../../utils/uploadImage';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  onError?: (message: string) => void;
}

// حقل صورة موحّد: رفع من جهاز المستخدم أو لصق رابط — مع معاينة وإزالة.
export function ImageUploadField({ value, onChange, label, placeholder = 'رابط الصورة (اختياري)', onError }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err: any) {
      const message = err?.message || 'فشل رفع الصورة';
      setError(message);
      onError?.(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">{label}</label>
      )}
      <div className="flex items-center gap-3">
        <label className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0 cursor-pointer group">
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <ImagePlus size={18} className="text-slate-400" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          </span>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 size={14} className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" />
            <input
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold"
              dir="ltr"
            />
          </div>
          {value && (
            <button type="button" onClick={() => onChange('')} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="إزالة الصورة">
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] font-bold text-slate-400 pr-2">ارفع صورة من جهازك (PNG/JPG حتى 5 ميجابايت) أو ألصق رابطاً.</p>
      {error && <p className="text-[10px] font-bold text-rose-500 pr-2">{error}</p>}
    </div>
  );
}
