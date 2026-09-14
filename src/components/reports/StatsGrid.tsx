import { Users, Building2, Home, DoorOpen } from 'lucide-react';

interface StatsGridProps {
  totalStudents: number;
  totalTenants: number;
  occupancyRate: number;
  emptyRooms: number;
}

export function StatsGrid({ totalStudents, totalTenants, occupancyRate, emptyRooms }: StatsGridProps) {
  const stats = [
    { label: 'إجمالي الطلاب', value: totalStudents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'عدد السكنات', value: totalTenants, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'نسبة الإشغال', value: `${Math.round(occupancyRate)}%`, icon: Home, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'الغرف الفارغة', value: emptyRooms, icon: DoorOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((s, i) => (
        <div key={i} className="bg-white dark:bg-card-dark p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm group hover:scale-[1.02] transition-all">
          <div className={`${s.bg} ${s.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6`}>
            <s.icon size={28} />
          </div>
          <p className="text-xs font-black text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">{s.label}</p>
          <h3 className="text-3xl font-black text-slate-800 dark:text-white">{s.value}</h3>
        </div>
      ))}
    </div>
  );
}
