import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, XCircle } from 'lucide-react';

interface PointModalProps {
  open: boolean;
  onClose: () => void;
  studentName?: string;
  onSubmit: (data: { points: number; description: string }) => Promise<void>;
}

export default function PointModal({ open, onClose, studentName, onSubmit }: PointModalProps) {
  const [points, setPoints] = useState(10);
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ points, description });
    setPoints(10);
    setDescription('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="rounded-xl bg-white p-6 max-w-md w-full shadow-2xl dark:bg-card-dark border border-slate-100 dark:border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-50 dark:bg-ocean-500/20"><TrendingUp size={20} className="text-ocean-600 dark:text-ocean-400" /></div>
                <h3 className="font-black text-slate-800 dark:text-white">إضافة نقاط</h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"><XCircle size={18} /></button>
            </div>
            {studentName && <p className="text-sm font-bold text-slate-500 dark:text-slate-300 mb-4">الطالب: {studentName}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">عدد النقاط</label>
                <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} min={1} max={100}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-ocean-500 transition-all dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">السبب</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-ocean-500 transition-all resize-none dark:text-white" />
              </div>
              <button type="submit" className="w-full py-3.5 bg-ocean-600 text-white rounded-xl font-black text-sm hover:bg-ocean-700 transition-all shadow-lg">إضافة النقاط</button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
