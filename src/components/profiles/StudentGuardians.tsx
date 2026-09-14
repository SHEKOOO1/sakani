import { UserCircle, Phone, MessageSquareShare, Mail } from 'lucide-react';

interface Guardian {
  id: string;
  name: string;
  relation_type: string;
  photo?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
}

interface StudentGuardiansProps {
  guardians: Guardian[];
}

export function StudentGuardians({ guardians }: StudentGuardiansProps) {
  return (
    <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
      <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6">أولياء الأمور</h3>
      <div className="space-y-4">
        {guardians?.length > 0 ? guardians.map((g: any) => (
          <div key={g.id} className="p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white dark:bg-card-dark rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 dark:border-white/10 overflow-hidden shadow-sm">
                {g.photo ? <img src={g.photo} className="w-full h-full object-cover" /> : <UserCircle size={24} />}
              </div>
              <div>
                <p className="font-black text-slate-800 dark:text-white text-sm">{g.name}</p>
                <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase">{g.relation_type === 'father' ? 'الأب' : g.relation_type === 'mother' ? 'الأم' : 'ولي أمر'}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white dark:border-white/10 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-300">
              <div className="flex items-center gap-1"><Phone size={10} /> {g.phone}</div>
              <div className="flex items-center gap-1"><MessageSquareShare size={10} /> {g.whatsapp || '---'}</div>
              <div className="col-span-full truncate"><Mail size={10} className="inline mr-1" /> {g.email}</div>
            </div>
          </div>
        )) : (
          <div className="py-10 text-center border-2 border-dashed border-slate-100 dark:border-white/10 rounded-[2.5rem]">
            <p className="text-xs text-slate-300 dark:text-slate-400 font-bold">لا يوجد أولياء أمور مسجلين</p>
          </div>
        )}
      </div>
    </div>
  );
}
