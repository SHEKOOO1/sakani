import { ArrowRight } from 'lucide-react';
import { RestoreStudentModal } from './modals/RestoreStudentModal';

interface StudentArchivePageProps {
  archive: any[];
  onBack: () => void;
  canAddStudent: boolean;
  isBishop: boolean;
  restoreModalOpen: boolean;
  onRestoreModalClose: () => void;
  onRestore: () => void;
  restoreLoading: boolean;
  restoreTargetName: string;
  restoreRoomId: string;
  onRoomIdChange: (id: string) => void;
  rooms: any[];
  onOpenRestore: (item: any) => void;
}

export function StudentArchivePage({
  archive, onBack, canAddStudent, isBishop,
  restoreModalOpen, onRestoreModalClose, onRestore,
  restoreLoading, restoreTargetName, restoreRoomId,
  onRoomIdChange, rooms, onOpenRestore
}: StudentArchivePageProps) {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl">
            <ArrowRight size={24} />
          </button>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">أرشيف الطلاب السابقين</h1>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {archive.map((item: any) => (
          <div key={item.id} className="bg-white dark:bg-card-dark p-6 rounded-card border border-slate-100 dark:border-white/[0.05] shadow-sm relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-2 h-full ${
              item.exit_reason === 'graduated' ? 'bg-emerald-500' :
              item.exit_reason === 'dismissed' ? 'bg-red-500' : 'bg-amber-500'
            }`} />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-white/10 rounded-xl flex items-center justify-center font-black text-slate-600 dark:text-slate-300">
                  {item.student_name[0]}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-[11px] leading-tight mb-0.5">{item.student_name}</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{new Date(item.exit_date).toLocaleDateString('ar-EG')}</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                item.exit_reason === 'graduated' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                item.exit_reason === 'dismissed' ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}>
                {item.exit_reason === 'graduated' ? 'تخرج' :
                 item.exit_reason === 'dismissed' ? 'فصل' :
                 item.exit_reason === 'withdrawn' ? 'انسحاب' : 'انتهاء'}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                {item.notes || 'لا يوجد ملاحظات إضافية'}
              </p>
              {item.data_snapshot?.guardians && item.data_snapshot.guardians.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.data_snapshot.guardians.map((g: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md text-[9px] font-black">
                      {g.relation_type === 'father' ? 'الأب' : g.relation_type === 'mother' ? 'الأم' : 'ولي الأمر'}: {g.guardian_name || g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {canAddStudent && !isBishop && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => onOpenRestore(item)}
                  className="neon-btn neon-btn-success neon-btn-sm px-3 py-2"
                >
                  استعادة الطالب
                </button>
              </div>
            )}
          </div>
        ))}
        {archive.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 dark:text-slate-300 font-bold">الأرشيف فارغ حالياً</div>}
      </div>

      <RestoreStudentModal
        isOpen={restoreModalOpen}
        onClose={onRestoreModalClose}
        onRestore={onRestore}
        loading={restoreLoading}
        studentName={restoreTargetName}
        roomId={restoreRoomId}
        onRoomIdChange={onRoomIdChange}
        rooms={rooms}
      />
    </div>
  );
}
