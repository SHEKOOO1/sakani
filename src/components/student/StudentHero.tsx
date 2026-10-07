import { Sparkles, Archive, UserPlus } from 'lucide-react';

interface StudentHeroProps {
  canAddStudent: boolean;
  isBishop: boolean;
  onAddStudent: () => void;
  onViewArchive: () => void;
}

export function StudentHero({ canAddStudent, isBishop, onAddStudent, onViewArchive }: StudentHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-8 sm:p-10">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Sparkles className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">إدارة الطلاب</h1>
            <p className="text-white/70 mt-1 font-bold">إدارة شاملة للمشتركين وأرشيف الطلاب السابقين.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onViewArchive} className="flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all font-black text-xs border border-white/10">
            <Archive size={16} /> الأرشيف
          </button>
          {canAddStudent && !isBishop && (
            <button onClick={onAddStudent}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-primary-600 rounded-xl hover:bg-primary-50 transition-all font-black text-xs shadow-lg">
              <UserPlus size={16} /> تسجيل طالب جديد
            </button>
          )}
        </div>
      </div>
      <div className="absolute -top-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
    </div>
  );
}
