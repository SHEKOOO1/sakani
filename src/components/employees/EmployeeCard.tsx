import { motion } from 'motion/react';
import {
  ShieldCheck,
  Mail,
  Building,
  UserCog,
  GraduationCap,
  History,
  Edit,
  Trash2,
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  gender?: string;
  tenant_id?: string;
  tenant_name?: string;
  custom_role_id?: string;
  custom_role_name?: string;
  custom_permissions?: string;
  daily_readings_enabled?: number | boolean;
  radio_514_enabled?: number | boolean;
  created_at: string;
}

interface EmployeeCardProps {
  employee: Employee;
  isAdmin: boolean;
  isSupervisor: boolean;
  grantingPermission: string | null;
  onToggleStudentPermission: (employee: Employee) => void;
  onOpenAudit: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  bishop: 'أسقف',
  priest: 'كاهن',
  supervisor: 'مشرف سكن',
  assistant_supervisor: 'مساعد مشرف',
  employee: 'موظف',
};

export function EmployeeCard({
  employee: emp,
  isAdmin,
  isSupervisor,
  grantingPermission,
  onToggleStudentPermission,
  onOpenAudit,
  onEdit,
  onDelete,
}: EmployeeCardProps) {
  return (
    <motion.div
      layout
      key={emp.id}
      className="bg-white dark:bg-card-dark rounded-3xl p-8 border border-slate-100 dark:border-white/5 shadow-sm group hover:border-neon-primary/30 transition-all relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-neon-primary/5 rounded-full -mr-12 -mt-12 group-hover:bg-neon-primary/10 transition-colors"></div>
      <div className="flex items-center gap-5 mb-6">
        <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-neon-primary transition-colors font-black text-2xl">
          {emp.name[0]}
        </div>
        <div>
          <h3 className="text-xl font-black dark:text-white leading-none mb-1">{emp.name}</h3>
          <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
            <ShieldCheck size={12} className="text-neon-primary" /> {ROLE_LABELS[emp.role] || emp.role}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm font-bold">
          <Mail size={16} /> {emp.email}
        </div>
        {isAdmin && emp.tenant_name && (
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300 text-xs font-bold">
            <Building size={14} /> {emp.tenant_name}
          </div>
        )}
        {emp.custom_role_name && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-neon-primary/10 text-neon-primary rounded-xl text-xs font-black border border-neon-primary/20">
            <UserCog size={14} /> {emp.custom_role_name}
          </div>
        )}
      </div>
      <div className="mt-8 pt-6 border-t border-slate-50 dark:border-white/5 flex justify-end gap-2">
        {emp.role === 'employee' && isSupervisor && (
          <button
            onClick={() => onToggleStudentPermission(emp)}
            disabled={grantingPermission === emp.id}
            className={`p-3 rounded-xl transition-all ${
              emp.custom_permissions?.includes('EDIT_STUDENT')
                ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10'
            }`}
            title={emp.custom_permissions?.includes('EDIT_STUDENT') ? 'صلاحية إدارة الطلاب: مفعلة - اضغط للسحب' : 'منح صلاحية إدارة الطلاب'}
          >
            <GraduationCap size={18} />
          </button>
        )}
        <button
          onClick={() => onOpenAudit(emp)}
          className="p-3 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-all"
          title="سجل العمليات"
        >
          <History size={18} />
        </button>
        <button
          onClick={() => onEdit(emp)}
          className="p-3 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
        >
          <Edit size={18} />
        </button>
        <button
          onClick={() => onDelete(emp.id)}
          className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </motion.div>
  );
}
