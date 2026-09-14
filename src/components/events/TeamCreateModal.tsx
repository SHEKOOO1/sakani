import { motion } from 'motion/react';
import { X, Sword, Search, Check, Rocket } from 'lucide-react';

interface TeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: { name: string; memberIds: string[] };
  onFormDataChange: (data: any) => void;
  studentsList: any[];
  studentSearch: string;
  onStudentSearchChange: (value: string) => void;
}

export function TeamCreateModal({
  isOpen, onClose, onSubmit, formData, onFormDataChange,
  studentsList, studentSearch, onStudentSearchChange
}: TeamCreateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 shadow-huge overflow-hidden rounded-ultra"
      >
        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-amber-400/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-400/10 text-amber-400 rounded-2xl"><Sword size={24} /></div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">بناء فريق جديد</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white" aria-label="إغلاق"><X /></button>
        </div>
        <form onSubmit={onSubmit} className="p-8 space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">اسم الفريق المميز</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              className="w-full px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none text-slate-900 dark:text-white font-black text-lg focus:border-amber-400/30 transition-all"
              placeholder="مثال: أسود القوات، صقور المعرفة..."
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">تحديد أعضاء الفريق ({formData.memberIds.length} مختارين)</label>
              <button type="button" onClick={() => onFormDataChange({ ...formData, memberIds: [] })} className="text-[10px] text-red-500 font-bold">مسح الكل</button>
            </div>
            <div className="relative">
              <Search size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => onStudentSearchChange(e.target.value)}
                className="w-full pr-14 pl-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none text-slate-900 dark:text-white font-bold text-sm"
                placeholder="ابحث عن طلاب لإضافتهم للفريق..."
              />
            </div>
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {studentsList
                .filter((s: any) => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                .map((student: any) => {
                  const isSelected = formData.memberIds.includes(student.id);
                  return (
                    <div
                      key={student.id}
                      onClick={() => {
                        const newIds = isSelected
                          ? formData.memberIds.filter((id: string) => id !== student.id)
                          : [...formData.memberIds, student.id];
                        onFormDataChange({ ...formData, memberIds: newIds });
                      }}
                      className={`p-4 border rounded-xl flex items-center justify-between group transition-all cursor-pointer ${isSelected ? 'bg-amber-400/10 border-amber-400/30' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${isSelected ? 'bg-amber-400 text-black' : 'bg-neon-primary/20 text-neon-primary'}`}>{student.name[0]}</div>
                        <span className={`text-xs font-black ${isSelected ? 'text-amber-400' : 'text-slate-900 dark:text-white'}`}>{student.name}</span>
                      </div>
                      <div className={`w-6 h-6 border-2 rounded-lg transition-all flex items-center justify-center ${isSelected ? 'bg-amber-400 border-amber-400' : 'border-white/10 group-hover:border-amber-400'}`}>
                        {isSelected && <Check size={14} className="text-black" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <button type="submit" className="w-full py-5 bg-amber-400 text-black font-black rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all hover:scale-[1.01] active:scale-[0.98]">
            اعتماد الفريق وتدشينه <Rocket size={18} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
