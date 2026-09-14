import React, { useEffect } from 'react';
import { X, FileText, ExternalLink, Image as ImageIcon } from 'lucide-react';

export interface ViewableFile {
  id?: string;
  file_name?: string;
  doc_type?: string;
  file_path?: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

export function fileExtension(p?: string): string {
  if (!p) return '';
  const name = (p || '').toLowerCase();
  const base = name.split(/[?#]/)[0];
  return base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : '';
}

export function isImageFile(file: ViewableFile): boolean {
  return IMAGE_EXTENSIONS.includes(fileExtension(file.file_name || file.file_path));
}

// الملفات المخزنة بمسار مطلق (from multer) → تحويلها لرابط متصفح يبدأ بـ /uploads
export function normalizeFilePath(p?: string): string {
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('/uploads')) return p;
  const marker = 'uploads';
  const idx = p.toUpperCase().lastIndexOf(marker.toUpperCase());
  if (idx >= 0) {
    let rel = p.slice(idx + marker.length).replace(/\\/g, '/');
    if (!rel.startsWith('/')) rel = '/' + rel;
    return `/uploads${rel}`;
  }
  return p;
}

export function getFileUrl(file: ViewableFile): string {
  return normalizeFilePath(file.file_path);
}

interface FileViewerModalProps {
  file: ViewableFile | null;
  onClose: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({ file, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!file) return null;
  const url = getFileUrl(file);
  const isImage = isImageFile(file);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full max-h-[90vh] bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl overflow-hidden flex flex-col" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-3 font-black text-slate-800 dark:text-white text-sm">
            {isImage ? <ImageIcon size={18} className="text-blue-500" /> : <FileText size={18} className="text-blue-500" />}
            <span className="truncate">{file.file_name || 'ملف'}</span>
            <span className="text-[10px] text-slate-400 font-bold shrink-0">({file.doc_type || 'ملف'})</span>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-[300px] bg-slate-50 dark:bg-black/20">
          {isImage && url ? (
            <img src={url} alt={file.file_name || 'ملف'} className="max-h-[70vh] max-w-full rounded-2xl shadow-lg object-contain" />
          ) : (
            <div className="text-center py-10">
              <FileText size={56} className="mx-auto text-slate-300 dark:text-slate-500 mb-3" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                هذا المستند ليس صورة ({fileExtension(file.file_path || file.file_name) || 'ملف'})
              </p>
            </div>
          )}
        </div>
        {url && (
          <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/10">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all">
              <ExternalLink size={14} /> فتح في نافذة جديدة
            </a>
          </div>
        )}
      </div>
    </div>
  );
};