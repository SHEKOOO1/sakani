import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, XCircle } from 'lucide-react';

interface WarningModalProps {
  open: boolean;
  onClose: () => void;
  studentName?: string;
  hasPoints: boolean;
  onSubmit: (data: { level: string; reason: string; deductPoints: number }) => Promise<void>;
}

export default function WarningModal({ open, onClose, studentName, hasPoints, onSubmit }: WarningModalProps) {
  const [level, setLevel] = useState('medium');
  const [reason, setReason] = useState('');
  const [deductPoints, setDeductPoints] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const points = Number(deductPoints);
    await onSubmit({ level, reason, deductPoints: isNaN(points) || points <= 0 ? 0 : Math.floor(points) });
    setLevel('medium');
    setReason('');
    setDeductPoints('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="rounded-xl bg-white p-6 max-w-md w-full shadow-2xl dark:bg-card-dark border border-slate-100 dark:border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/20"><AlertTriangle size={20} className="text-rose-600 dark:text-rose-400" /></div>
                <h3 className="font-black text-slate-800 dark:text-white">إصدار إنذار</h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"><XCircle size={18} /></button>
            </div>
            {studentName && <p className="text-sm font-bold text-slate-500 dark:text-slate-300 mb-4">الطالب: {studentName} · رصيد النقاط: {hasPoints || 0}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">المستوى</label>
                <select value={level} onChange={e => setLevel(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-rose-500 transition-all dark:text-white">
                  <option value="low">منخفض</option>
                  <option value="medium">متوسط</option>
                  <option value="high">شديد</option>
                  <option value="critical">خطير</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">السبب</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-rose-500 transition-all resize-none dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">خصم نقاط (اختياري)</label>
                <input type="number" min={0} value={deductPoints} onChange={e => setDeductPoints(e.target.value)} placeholder="مثال: 5 — يُخصم من رصيد الطالب وإن لم يملك نقاط يصبح بالسالب"
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-rose-500 transition-all dark:text-white" />
              </div>
              <button type="submit" className="w-full py-3.5 bg-rose-600 text-white rounded-xl font-black text-sm hover:bg-rose-700 transition-all shadow-lg">إصدار الإنذار</button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}