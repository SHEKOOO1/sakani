import { motion, AnimatePresence } from 'motion/react';
import { Trophy, CheckCircle } from 'lucide-react';

interface FinishCompetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (winners: string[]) => void;
  saving: boolean;
  competition: any;
  students: any[];
  selectedWinners: string[];
  onToggleWinner: (id: string) => void;
}

export function FinishCompetitionModal({
  isOpen,
  onClose,
  onConfirm,
  saving,
  competition,
  students,
  selectedWinners,
  onToggleWinner
}: FinishCompetitionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && competition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-card-dark p-6 sm:p-12 rounded-[4rem] w-full max-w-4xl relative shadow-2xl max-h-[90vh] sm:h-[80vh] flex flex-col">
            <div className="mb-6 sm:mb-10 text-center">
              <Trophy size={64} className="text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <h3 className="text-2xl sm:text-4xl font-black text-slate-800 dark:text-white">تتويج الفائزين</h3>
              <p className="text-slate-400 dark:text-slate-300 font-bold mt-2">اختر الطلاب الذين استحقوا الجائزة بناءً على أدائهم في: <span className="text-blue-600 dark:text-blue-400">{competition.title}</span></p>
            </div>

            <div className="flex-1 overflow-y-auto mb-8 pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => onToggleWinner(s.id)}
                    className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 relative ${
                      selectedWinners.includes(s.id) ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 shadow-xl shadow-emerald-50' : 'bg-white dark:bg-card-dark border-slate-50 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-xl ${
                      selectedWinners.includes(s.id) ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-300'
                    }`}>
                      {s.name.charAt(0)}
                    </div>
                    <span className="font-black text-slate-700 dark:text-slate-200 text-sm">{s.name}</span>
                    {selectedWinners.includes(s.id) && (
                      <div className="absolute top-4 right-4 bg-emerald-500 text-white rounded-full p-1">
                        <CheckCircle size={16} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-[3rem] flex items-center justify-between">
              <div className="text-right">
                <p className="text-xs font-black text-slate-400 dark:text-slate-300 mb-1 uppercase">إجمالي الجوائز التي ستوزع</p>
                <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{selectedWinners.length * competition.prize_points} <span className="text-sm">نقطة</span></h4>
              </div>
              <button
                onClick={() => onConfirm(selectedWinners)}
                disabled={selectedWinners.length === 0 || saving}
                className="px-12 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:scale-100 hover:scale-105 active:scale-95"
              >
                {saving ? 'جاري التوزيع...' : 'توزيع الجوائز وإتمام الإغلاق'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
