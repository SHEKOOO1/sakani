import { motion } from 'motion/react';
import { Home } from 'lucide-react';

interface RoomInfoProps {
  roomInfo: {
    tenant_name?: string;
    building_name?: string;
    apartment_name?: string;
    room_number?: string;
  } | null;
}

export default function RoomInfo({ roomInfo }: RoomInfoProps) {
  return (
    <motion.div
      initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/10"><Home size={16} className="text-primary-600 dark:text-primary-400" /></div>
        <h3 className="font-black text-sm text-slate-800 dark:text-white">بيانات السكن</h3>
      </div>
      <div className="space-y-2">
        <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-white/5">
          <p className="text-lg font-black text-slate-900 dark:text-white truncate">{roomInfo?.tenant_name || '—'}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-1">السكن</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-white/5">
          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{roomInfo?.building_name || '—'}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-1">البيت / المبنى</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-slate-50 p-4 text-center dark:bg-white/5">
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{roomInfo?.apartment_name || '—'}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-1">الشقة</p>
          </div>
          <div className="flex-1 rounded-xl bg-primary-50 p-4 text-center dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20">
            <p className="text-lg font-black text-primary-700 dark:text-primary-300">{roomInfo?.room_number || '—'}</p>
            <p className="text-[10px] text-primary-400 dark:text-primary-300 font-bold mt-1">الغرفة</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
