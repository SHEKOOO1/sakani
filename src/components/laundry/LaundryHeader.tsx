import { Activity, Square, Play } from 'lucide-react';

interface LaundryHeaderProps {
  session: any;
  canOperate: boolean;
  onStartSession: () => void;
  onCloseSession: () => void;
}

export function LaundryHeader({ session, canOperate, onStartSession, onCloseSession }: LaundryHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-8 sm:p-10">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Activity className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">نظام المغسلة الذكي</h1>
            <p className="text-white/70 mt-1 font-bold">إدارة الطوابير، الجلسات، وعمليات الغسيل اليومية.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {session ? (
            <div className="flex items-center gap-4 bg-white/20 backdrop-blur-sm border border-white/10 p-2 pr-6 rounded-2xl">
              <div className="text-right">
                <p className="text-[10px] font-black text-emerald-300 uppercase">الجلسة نشطة الآن</p>
                <p className="text-sm font-bold text-white">المسؤول: {session.operator_name}</p>
              </div>
              {canOperate && (
                <button onClick={onCloseSession} className="bg-white/20 backdrop-blur-sm text-rose-300 p-3 rounded-xl hover:bg-white/30 transition-all border border-white/10" title="إغلاق المغسلة">
                  <Square size={20} fill="currentColor" />
                </button>
              )}
            </div>
          ) : (
            canOperate && (
              <button onClick={onStartSession} className="flex items-center gap-3 px-8 py-4 bg-white text-primary-600 rounded-2xl hover:bg-primary-50 transition-all shadow-lg font-black">
                <Play size={20} fill="currentColor" />
                <span>فتح المغسلة</span>
              </button>
            )
          )}
        </div>
      </div>
      <div className="absolute -top-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
    </div>
  );
}
