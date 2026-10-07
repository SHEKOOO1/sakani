interface ServiceToggleProps {
  checked: boolean;
  label: string;
  onClick: (e: React.MouseEvent) => void;
}

export function ServiceToggle({ checked, label, onClick }: ServiceToggleProps) {
  return (
    <div className="flex items-center gap-1 cursor-pointer select-none" onClick={onClick}>
      <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold">{label}</span>
      <div className={`w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
        <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all ${checked ? 'start-[18px]' : 'start-[2px]'}`} />
      </div>
    </div>
  );
}
