import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Percent, FileText, Trash2, Loader2, AlertCircle, Tag } from 'lucide-react';
import { useApi, getApiErrorMessage } from '../../../hooks/useApi';

export interface DiscountState {
  type: 'percent' | 'amount' | null;
  value: number | null;
  note: string | null;
  document: { id: number; doc_type: string | null; file_name: string | null; file_path: string } | null;
}

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  current: DiscountState | null;
  onSaved: () => void;
}

export function DiscountModal({ isOpen, onClose, studentId, current, onSaved }: DiscountModalProps) {
  const { request } = useApi();
  const [type, setType] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const hasCurrent = !!current?.type;
  const hasLetter = !!file || !!current?.document;

  useEffect(() => {
    if (isOpen) {
      setType(current?.type === 'amount' ? 'amount' : 'percent');
      setValue(current?.value != null ? String(current.value) : '');
      setNote(current?.note || '');
      setFile(null);
      setError('');
      setShowDelete(false);
    }
  }, [isOpen, current]);

  const save = async () => {
    setError('');
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('أدخل قيمة الخصم أكبر من صفر');
      return;
    }
    if (type === 'percent' && numeric > 100) {
      setError('نسبة الخصم لا يمكن أن تتجاوز 100%');
      return;
    }
    if (!hasLetter) {
      setError('لازم ترفق جواب الخصم (PDF أو صورة) لإثبات الخصم');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('type', type);
      fd.append('value', String(numeric));
      fd.append('note', note);
      if (file) fd.append('letter', file);
      await request(`/api/students/${studentId}/discount`, { method: 'PUT', body: fd });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'تعذر حفظ الخصم'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setError('');
    setDeleting(true);
    try {
      await request(`/api/students/${studentId}/discount`, { method: 'DELETE' });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'تعذر إلغاء الخصم'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
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
            className="bg-white dark:bg-card-dark text-slate-800 dark:text-white rounded-[3rem] shadow-2xl w-full max-w-md relative text-right overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tag className="text-emerald-500" size={24} />
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
                  {hasCurrent ? 'تعديل خصم الطالب' : 'إضافة خصم على سعر الإقامة'}
                </h3>
              </div>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setType('percent')}
                  className={`p-4 rounded-2xl border text-right transition-all ${type === 'percent' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5'}`}
                >
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Percent size={16} className="text-emerald-500" />
                    <span className="text-xs font-black">نسبة من السعر</span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 font-bold">مثلاً 10% من سعر الغرفة</p>
                </button>
                <button
                  onClick={() => setType('amount')}
                  className={`p-4 rounded-2xl border text-right transition-all ${type === 'amount' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5'}`}
                >
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Tag size={16} className="text-emerald-500" />
                    <span className="text-xs font-black">مبلغ ثابت</span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 font-bold">مثلاً 500 ج.م تُخصم من السعر</p>
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 px-2">
                  {type === 'percent' ? 'قيمة الخصم (%)' : 'قيمة الخصم (ج.م)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={type === 'percent' ? 100 : 999999999}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={type === 'percent' ? 'مثال: 10' : 'مثال: 500'}
                  className="w-full p-5 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl outline-none font-bold text-lg caret-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 px-2">سبب الخصم (اختياري)</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="مثلاً: كسر جزئي من صندوق الإغاثة"
                  className="w-full p-5 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl outline-none font-bold text-sm caret-emerald-500"
                />
                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold px-2">هذا السبب لا يراه الطالب ولا ولي الأمر.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 px-2">جواب الخصم (إثبات مطلوب)</label>
                <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 cursor-pointer hover:border-emerald-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {file ? file.name : hasLetter ? `${current?.document?.file_name || 'جواب محفوظ'} (مرفق حالياً)` : 'اختر ملف الجواب'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{file ? 'جديد' : hasLetter ? 'تم' : 'PDF / صورة'}</span>
                  <input
                    type="file"
                    hidden
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={e => { setFile(e.target.files?.[0] || null); setError(''); }}
                  />
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl">
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-xs font-bold text-red-600 dark:text-red-300">{error}</p>
                </div>
              )}

              <button onClick={save} disabled={saving} className="neon-btn neon-btn-success w-full py-5 text-sm shadow-glow-sm disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin inline ml-2" /> : null}
                {hasCurrent ? 'حفظ التعديل' : 'تفعيل الخصم'}
              </button>

              {hasCurrent && (
                <div className="pt-2 border-t border-slate-100 dark:border-white/10">
                  {!showDelete ? (
                    <button onClick={() => setShowDelete(true)} className="w-full py-4 text-xs font-black text-red-500 hover:text-red-600 transition-colors flex items-center justify-center gap-2">
                      <Trash2 size={14} /> إلغاء الخصم بالكامل
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-300 text-center">سيعود سعر الإقامة لقيمته الكاملة قبل الخصم. متأكد؟</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setShowDelete(false)} className="py-4 text-xs font-black rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">تراجع</button>
                        <button onClick={remove} disabled={deleting} className="py-4 text-xs font-black rounded-2xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-60">
                          {deleting ? <Loader2 size={14} className="animate-spin inline ml-1" /> : null}
                          نعم، إلغاء الخصم
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
