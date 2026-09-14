import { motion } from 'motion/react';
import { Star, Rocket, X } from 'lucide-react';

interface ScoringModalProps {
  isOpen: boolean;
  team: any | null;
  scores: Record<string, number>;
  individualScores: Record<string, { studentId: string; score: number }>;
  criteria: any[];
  onClose: () => void;
  onScoreChange: (scores: Record<string, number>) => void;
  onIndividualScoreChange: (individualScores: Record<string, { studentId: string; score: number }>) => void;
  onSaveScores: () => void;
}

export function ScoringModal({
  isOpen, team, scores, individualScores, criteria,
  onClose, onScoreChange, onIndividualScoreChange, onSaveScores
}: ScoringModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 shadow-huge rounded-ultra overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-amber-400/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-400/10 text-amber-400 rounded-xl"><Star size={24} /></div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">رصد نقاط المسابقة</h3>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{team?.name || 'اختر فريقاً'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white" aria-label="إغلاق"><X /></button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8 custom-scrollbar">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">1. رصد جماعي للفريق</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {criteria.map(c => (
                <div key={c.id} className="p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white">{c.title}</span>
                  <input
                    type="number"
                    className="w-16 px-2 py-1 bg-white dark:bg-white/10 border border-slate-100 dark:border-white/10 rounded text-slate-900 dark:text-white text-center font-black outline-none focus:border-amber-400"
                    value={scores[c.id] || ''}
                    onChange={(e) => onScoreChange({ ...scores, [c.id]: parseInt(e.target.value) || 0 })}
                  />
                </div>
              ))}
            </div>
          </div>

          {team && (
            <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">2. رصد فردي (يضاف للفريق)</label>
              <div className="space-y-2">
                {(team.members || []).map((member: any) => (
                  <div key={member.id} className="p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center text-[10px] font-black text-amber-400">{member.member_name?.[0] || '?'}</div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{member.member_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-bold">نقاط تميز:</span>
                      <input
                        type="number"
                        className="w-14 px-2 py-1 bg-white dark:bg-white/10 border border-slate-100 dark:border-white/5 rounded text-slate-900 dark:text-white text-center font-black text-xs outline-none"
                        placeholder="0"
                        onChange={(e) => {
                          const score = parseInt(e.target.value) || 0;
                          onIndividualScoreChange({
                            ...individualScores,
                            [member.id]: { studentId: member.id, score }
                          });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-black/20 flex gap-4">
          <button
            onClick={onSaveScores}
            className="flex-1 py-4 bg-amber-400 text-black font-black rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!team}
          >
            حفظ جميع الدرجات وتحديث الصدارة <Rocket size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
