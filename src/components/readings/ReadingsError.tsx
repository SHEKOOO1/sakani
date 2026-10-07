import { BookOpen } from 'lucide-react';

interface ReadingsErrorProps {
  message: string;
  onRetry: () => void;
}

export default function ReadingsError({ message, onRetry }: ReadingsErrorProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm p-8">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
          <BookOpen size={28} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white">قراءات اليوم</h2>
          <p className="text-xs font-bold text-rose-500 dark:text-rose-400 mt-0.5">تعذر التحميل</p>
        </div>
      </div>
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-amber-600 text-white rounded-2xl text-xs font-black hover:bg-amber-700 transition-all shadow-lg"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
