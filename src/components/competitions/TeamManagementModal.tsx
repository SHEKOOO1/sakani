import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  employees: any[];
  onCreateTeam: (data: { name: string; responsibleId: string; studentIds: string[] }) => void;
  saving: boolean;
}

export function TeamManagementModal({
  isOpen,
  onClose,
  students,
  employees,
  onCreateTeam,
  saving
}: TeamManagementModalProps) {
  const [name, setName] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [studentIds, setStudentIds] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateTeam({ name, responsibleId, studentIds });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-card-dark p-6 sm:p-10 rounded-[3rem] w-full max-w-xl relative shadow-2xl">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mb-4 sm:mb-8">إنشاء فريق جديد</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2">اسم الفريق</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-black dark:text-white" placeholder="مثال: فريق النسور" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2">مسؤول الفريق (موظف أو طالب)</label>
                <select required value={responsibleId} onChange={e => setResponsibleId(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-bold dark:text-white">
                  <option value="">اختر مسؤولاً...</option>
                  {[...employees, ...students.map((s: any) => ({ id: s.user_id, name: `${s.name} (طالب)` }))].map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2">الأعضاء (اختر من الطلاب)</label>
                <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 border border-slate-100 dark:border-white/10 max-h-48 overflow-y-auto space-y-2">
                  {students.map((s: any) => (
                    <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-card-dark rounded-xl cursor-pointer">
                      <input
                        type="checkbox" checked={studentIds.includes(s.id)}
                        onChange={e => {
                          if (e.target.checked) setStudentIds([...studentIds, s.id]);
                          else setStudentIds(studentIds.filter(id => id !== s.id));
                        }}
                        className="w-5 h-5 accent-blue-600 rounded"
                      />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={saving} className="w-full py-5 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-primary-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                {saving ? 'جاري الإنشاء...' : 'إنشاء الفريق وتسكين الطلاب'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
