import { motion } from 'motion/react';
import { Activity, Plus } from 'lucide-react';

interface LaundryMachinesTabProps {
  machines: any[];
  canOperate: boolean;
  isLaundryManager: boolean;
  onRename: (machine: { id: string; name: string }) => void;
  onReportFault: (machineId: string) => void;
  onFixMachine: (machineId: string) => void;
  onAddMachine: () => void;
}

export function LaundryMachinesTab({ machines, canOperate, isLaundryManager, onRename, onReportFault, onFixMachine, onAddMachine }: LaundryMachinesTabProps) {
  return (
    <motion.div key="machines" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {machines.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-500">
          <Activity size={56} className="mb-5 opacity-50" />
          <p className="text-lg font-black">لا توجد غسالات مضافة بعد</p>
          <p className="text-sm font-medium mt-2">قم بإضافة الغسالات الأولى للمغسلة</p>
        </div>
      ) : machines.map((m: any) => (
        <div key={m.id} className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-8 shadow-sm group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className={`p-4 rounded-2xl ${
              m.status === 'available' ? 'bg-emerald-50 text-emerald-600' :
              m.status === 'occupied' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <Activity size={32} className={m.status === 'occupied' ? 'animate-pulse' : ''} />
            </div>
            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
              m.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
              m.status === 'occupied' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {m.status === 'available' ? 'متاحة' : m.status === 'occupied' ? 'قيد العمل' : 'معطلة'}
            </div>
          </div>
          <h4 className="text-2xl font-black text-slate-800 mb-2">{m.name}</h4>
          <p className="text-slate-400 text-xs font-medium italic">معرف الغسالة: {m.id.substring(0,8)}</p>
          {canOperate && (
            <div className="flex gap-2 mt-8 pt-6 border-t border-slate-100">
              <button onClick={() => onRename({ id: m.id, name: m.name })}
                className="flex-1 py-3 text-[10px] font-black bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
              >
                تغيير الاسم
              </button>
              {m.status === 'broken' ? (
                <button onClick={() => onFixMachine(m.id)}
                  className="flex-1 py-3 text-[10px] font-black bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"
                >
                  تم الإصلاح
                </button>
              ) : (
                <button onClick={() => onReportFault(m.id)}
                  className="flex-1 py-3 text-[10px] font-black bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"
                >
                  تبليغ عطل
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {isLaundryManager && (
        <button onClick={onAddMachine}
          className="h-full min-h-[250px] border-4 border-dashed border-slate-100 dark:border-white/10 rounded-xl flex flex-col items-center justify-center text-slate-300 dark:text-slate-500 hover:text-primary-500 hover:border-primary-200 hover:bg-primary-50/30 dark:hover:bg-primary-500/10 transition-all group"
        >
          <Plus size={48} className="mb-4 group-hover:scale-110 transition-transform" />
          <span className="font-black">إضافة غسالة جديدة</span>
        </button>
      )}
    </motion.div>
  );
}
