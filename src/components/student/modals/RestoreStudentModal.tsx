import { motion, AnimatePresence } from 'motion/react';
import { DoorOpen, X } from 'lucide-react';

interface RestoreStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
  loading: boolean;
  studentName: string;
  roomId: string;
  onRoomIdChange: (id: string) => void;
  rooms: any[];
}

export function RestoreStudentModal({
  isOpen,
  onClose,
  onRestore,
  loading,
  studentName,
  roomId,
  onRoomIdChange,
  rooms,
}: RestoreStudentModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-[3rem] shadow-2xl w-full max-w-md relative text-right"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DoorOpen className="text-emerald-500" size={24} />
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">استعادة الطالب</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300">{studentName || 'طالب مؤرشف'}</p>
                </div>
              </div>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">اختر الغرفة</label>
                <select
                  value={roomId}
                  onChange={(e) => onRoomIdChange(e.target.value)}
                  className="w-full p-5 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold text-lg dark:text-white"
                >
                  <option value="">اختر الغرفة لاستعادة الطالب</option>
                  {rooms
                    .filter((room: any) => Number(room.current_occupancy) < Number(room.capacity))
                    .map((room: any) => (
                      <option key={room.id} value={room.id}>
                        عمارة {room.building || '?'} - غرفة {room.room_number} ({room.current_occupancy}/{room.capacity})
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={onRestore}
                disabled={loading}
                className="neon-btn neon-btn-success w-full py-5 text-sm shadow-glow-sm"
              >
                {loading ? 'جاري الاستعادة...' : 'تأكيد الاستعادة'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
