import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';

interface ScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  studentId?: string;
  studentName?: string;
  onSave: (points: number) => void;
  saving: boolean;
}

export function ScoreModal({
  isOpen,
  onClose,
  teamId,
  studentId,
  studentName,
  onSave,
  saving
}: ScoreModalProps) {
  const [scoreInput, setScoreInput] = useState('');

  useEffect(() => {
    if (isOpen) setScoreInput('');
  }, [isOpen]);

  const handleSubmit = () => {
    if (!scoreInput) return;
    const points = parseInt(scoreInput);
    if (isNaN(points) || points <= 0) return;
    onSave(points);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-card-dark p-10 rounded-[3rem] w-full max-w-sm relative shadow-2xl text-center" dir="rtl">
            <Trophy size={48} className="mx-auto text-amber-400 mb-4" />
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
              {studentId ? `نقاط لـ ${studentName}` : 'نقاط للفريق'}
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-300 font-bold mb-6">دخل عدد النقاط اللي عايز تضيفها</p>
            <input
              type="number"
              value={scoreInput}
              onChange={e => setScoreInput(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-black text-2xl text-center dark:text-white mb-6"
              placeholder="0"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
            <div className="flex gap-4">
              <button onClick={onClose} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-200 transition-all">إلغاء</button>
              <button onClick={handleSubmit} disabled={saving} className="flex-1 py-4 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white rounded-2xl font-black hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50">تأكيد</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
