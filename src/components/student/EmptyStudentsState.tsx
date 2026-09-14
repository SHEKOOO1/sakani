import { Users } from 'lucide-react';

interface EmptyStudentsStateProps {
  colSpan: number;
}

export function EmptyStudentsState({ colSpan }: EmptyStudentsStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-24 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-8 bg-slate-50 dark:bg-white/5 rounded-full text-slate-200 dark:text-white/10">
            <Users size={64} />
          </div>
          <p className="text-slate-400 dark:text-slate-300 font-bold">لا يوجد طلاب يطابقون بحثك</p>
        </div>
      </td>
    </tr>
  );
}
