import { motion } from 'motion/react';
import { UserPlus, Trash2 } from 'lucide-react';

interface LaundryOperatorsTabProps {
  operators: any[];
  onRemoveOperator: (userId: string) => void;
  onAddOperator: () => void;
}

export function LaundryOperatorsTab({ operators, onRemoveOperator, onAddOperator }: LaundryOperatorsTabProps) {
  return (
    <motion.div key="operators" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-white/[0.05] shadow-sm overflow-hidden"
    >
      <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-800 dark:text-white">مسؤولي المغسلة المعتمدين</h3>
        <button onClick={onAddOperator}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white rounded-xl font-bold hover:brightness-110 transition-all"
        >
          <UserPlus size={18} />
          <span>تعيين مسؤول جديد</span>
        </button>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-right min-w-[600px]">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">الاسم</th>
              <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">الايميل</th>
              <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">الدور</th>
              <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left">تاريخ التعيين</th>
              <th className="px-8 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {operators.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-16 text-center text-slate-300 dark:text-slate-500">
                  <div className="flex flex-col items-center gap-3">
                    <UserPlus size={40} className="opacity-50" />
                    <p className="text-lg font-black">لا يوجد مسؤولون معتمدون</p>
                    <p className="text-sm font-medium">قم بتعيين مسؤول جديد للمغسلة</p>
                  </div>
                </td>
              </tr>
            ) : operators.map((op: any) => (
              <tr key={op.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-black">
                      {op.name.charAt(0)}
                    </div>
                    <span className="font-bold text-slate-800">{op.name}</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-sm text-slate-500 font-medium">{op.email}</td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg uppercase">{op.role}</span>
                </td>
                <td className="px-8 py-5 text-sm text-slate-400 text-left">{new Date(op.assigned_at).toLocaleDateString()}</td>
                <td className="px-8 py-5">
                  <button onClick={() => onRemoveOperator(op.user_id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
