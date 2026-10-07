import { motion, AnimatePresence } from 'motion/react';
import { Building2, ChevronDown, Check, X } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
}

interface TenantFilterProps {
  tenants: Tenant[];
  selectedIds: string[];
  selectAll: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onToggleSelectAll: () => void;
  onToggleTenant: (id: string) => void;
  onRemoveTenant: (id: string) => void;
}

export function TenantFilter({
  tenants, selectedIds, selectAll, isOpen,
  onToggle, onToggleSelectAll, onToggleTenant, onRemoveTenant
}: TenantFilterProps) {
  const selectedNames = selectAll
    ? 'كل السكنات'
    : selectedIds.length === 0
      ? 'اختر السكنات'
      : selectedIds.map(id => tenants.find(t => t.id === id)?.name).filter(Boolean).join('، ');

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/[0.1] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.1] transition-all text-sm font-bold text-slate-700 dark:text-slate-200 max-w-[300px]"
      >
        <Building2 size={16} className="text-blue-500 shrink-0" />
        <span className="truncate">{selectedNames}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/[0.1] z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-slate-50 dark:border-white/[0.05]">
              <button
                onClick={onToggleSelectAll}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all text-sm font-bold text-slate-700 dark:text-slate-200"
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectAll ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'}`}>
                  {selectAll && <Check size={12} className="text-white" />}
                </div>
                كل السكنات
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto p-2 space-y-1">
              {tenants.map(t => {
                const checked = selectAll || selectedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => onToggleTenant(t.id)}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all text-right"
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'}`}>
                      {checked && <Check size={12} className="text-white" />}
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!selectAll && selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedIds.map(id => {
            const t = tenants.find(x => x.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold">
                <Building2 size={12} />
                {t?.name || id}
                <button onClick={() => onRemoveTenant(id)} className="hover:text-red-500 transition-colors">
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
