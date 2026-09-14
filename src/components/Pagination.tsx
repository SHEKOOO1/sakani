import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex items-center justify-between gap-4 pt-6 border-t border-slate-100 dark:border-white/10">
      <span className="text-xs font-bold text-slate-400 dark:text-slate-300">
        إجمالي {total} نتيجة — صفحة {page} من {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-2 rounded-lg bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={16} />
        </button>
        {getPageNumbers().map((p, i) =>
          typeof p === 'string' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-xs text-slate-400">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[36px] h-9 rounded-lg text-xs font-bold transition-all ${
                p === page
                  ? 'bg-gradient-to-br from-primary-600 to-vibrant-600 text-white shadow-md'
                  : 'bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-primary-200 dark:hover:border-primary-500/30'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2 rounded-lg bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    </div>
  );
}
