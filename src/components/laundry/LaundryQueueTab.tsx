import { motion } from 'motion/react';
import { Waves, Clock, AlertTriangle, UserCheck, X, CheckCircle2 } from 'lucide-react';
import { AppPermission } from '../../types/permissions';

interface LaundryQueueTabProps {
  canOperate: boolean;
  queue: any[];
  hasPermission: (perm: AppPermission) => boolean;
  joining: boolean;
  onJoinQueue: () => void;
  onCallNext: (queueId: string, machineId: string) => void;
  onComplete: (queueId: string) => void;
  onCancel: (queueId: string) => void;
  getStatusLabel: (status: string) => { label: string; color: string };
  showConfirm: (message: string) => Promise<boolean>;
  machines: any[];
  session: any;
  currentUserInQueue: any;
  userPosition: number | null;
  userId?: string;
}

export function LaundryQueueTab({
  canOperate, queue, hasPermission, joining, onJoinQueue,
  onCallNext, onComplete, onCancel, getStatusLabel,
  showConfirm, machines, session, currentUserInQueue, userPosition, userId
}: LaundryQueueTabProps) {
  return (
    <motion.div
      key="queue"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Student Personal Actions */}
      {hasPermission(AppPermission.JOIN_LAUNDRY) && (
        <div className="bg-white dark:bg-card-dark p-8 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm flex items-center justify-between">
          {userPosition ? (
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <span className="text-2xl font-black">#{userPosition}</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">أنت الآن في الطابور!</h3>
                <p className="text-slate-500 font-medium italic">يرجى تجهيز ملابسك وانتظار الاستدعاء.</p>
              </div>
              {currentUserInQueue && (currentUserInQueue.status === 'waiting' || currentUserInQueue.status === 'called') && (
                <button
                  onClick={async () => {
                    const confirmed = await showConfirm('هل أنت متأكد من الاعتذار عن هذا الدور؟');
                    if (confirmed) onCancel(currentUserInQueue.id);
                  }}
                  className="mr-auto px-6 py-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-black hover:bg-rose-100 transition-all border border-rose-200"
                >
                  اعتذار عن الدور
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Waves size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">هل لديك غسيل اليوم؟</h3>
                <p className="text-slate-500 font-medium">ارفع يدك واحجز دورك في الطابور.</p>
              </div>
            </div>
          )}

          {!userPosition && (
            <button
              onClick={onJoinQueue}
              disabled={joining}
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {joining ? 'جاري الحجز...' : 'أريد الغسيل الآن'}
            </button>
          )}
        </div>
      )}

      {/* Queue List */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-xl flex items-center justify-center font-black">
              {queue.length}
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">الطلاب المنتظرين</h3>
          </div>
        </div>

        <div className="space-y-4">
          {queue.length > 0 ? queue.map((item: any, index: number) => {
            const status = getStatusLabel(item.status);
            const isStale = item.waiting_days >= 3;
            const isCurrentUser = item.student_id === userId || item.user_id === userId;

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-6 rounded-3xl border transition-all ${
                  isCurrentUser ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' :
                  isStale ? 'bg-amber-50/50 border-amber-200' :
                  'bg-slate-50/30 border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold border shadow-sm ${
                    isCurrentUser ? 'bg-blue-600 text-white border-blue-600' :
                    'bg-white text-slate-400 border-slate-100'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800">
                        {item.student_name}
                        {isCurrentUser && <span className="mr-2 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-lg">أنت</span>}
                      </h4>
                      {isStale && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded-lg animate-pulse">
                          <AlertTriangle size={10} />
                          <span>انتظار طويل ({Math.floor(item.waiting_days)} يوم)</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2 mt-1 font-medium">
                      <Clock size={12} />
                      <span>منذ {new Date(item.joined_at).toLocaleString('ar-EG')}</span>
                    </p>
                    {item.machine_name && (
                      <p className="text-xs text-blue-600 font-bold mt-1">يستخدم الآن: {item.machine_name}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${status.color}`}>
                    {status.label}
                  </div>

                  {isCurrentUser && (item.status === 'waiting' || item.status === 'called') && (
                    <button
                      onClick={async () => {
                        const confirmed = await showConfirm('هل أنت متأكد من الاعتذار عن هذا الدور؟');
                        if (confirmed) onCancel(item.id);
                      }}
                      className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-100 transition-all border border-rose-200"
                    >
                      اعتذار عن الدور
                    </button>
                  )}

                  {canOperate && (
                    <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                      {item.status === 'waiting' && session && (
                        <div className="flex gap-2">
                          {machines.filter(m => m.status === 'available').map(m => (
                            <button
                              key={m.id}
                              onClick={() => onCallNext(item.id, m.id)}
                              className="px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700"
                            >
                              استدعاء ({m.name})
                            </button>
                          ))}
                          {machines.filter(m => m.status === 'available').length === 0 && (
                            <span className="text-[10px] text-slate-400 font-bold italic">لا توجد غسالات متاحة</span>
                          )}
                        </div>
                      )}
                      {item.status === 'called' && (
                        <button
                          onClick={() => onComplete(item.id)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700"
                        >
                          تم الانتهاء
                        </button>
                      )}
                      <button
                        onClick={() => onCancel(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                        title="إلغاء الدور"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="py-20 text-center space-y-4 bg-slate-50/50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
              <UserCheck size={48} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-slate-400 dark:text-slate-300 font-bold">لا يوجد أحد في الانتظار حالياً</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
