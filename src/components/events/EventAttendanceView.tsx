import { motion } from 'motion/react';
import { QrCode, Camera, Check, DollarSign } from 'lucide-react';

interface EventAttendanceViewProps {
  selectedSession: any;
  setSelectedSession: (session: any) => void;
  selectedEvent: any;
  studentsList: any[];
  detailedAttendance: any[];
  setShowScanner: (open: boolean) => void;
  setAbsenceModal: (data: any) => void;
  handleQrScan: (code: string) => void;
  handleUpdateAttendanceStatus: (studentId: string, status: string, reason?: string, isPaid?: boolean) => void;
}

export function EventAttendanceView({
  selectedSession, setSelectedSession, selectedEvent, studentsList,
  detailedAttendance, setShowScanner, setAbsenceModal, handleQrScan, handleUpdateAttendanceStatus,
}: EventAttendanceViewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="attendance" className="space-y-8">
      <div className="flex justify-between items-center pb-6 border-b border-slate-100 dark:border-white/5">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">إدارة كشف الحضور والغياب</h3>
          <p className="text-xs text-slate-500 font-bold mt-1">
            {selectedSession ? `القسم: ${selectedSession.title}` : 'الفعالية العامة'}
          </p>
        </div>
        <div className="flex gap-4">
          {selectedSession && (
            <>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-bold border border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
              >
                العودة للعام
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="neon-btn neon-btn-secondary neon-btn-sm"
              >
                <QrCode size={16} /> مسح QR للجلسة
              </button>
            </>
          )}
          {!selectedSession && (
            <button onClick={() => setShowScanner(true)} className="neon-btn neon-btn-primary neon-btn-sm">
              <Camera size={16} /> فتح الكاميرا للـ QR
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto custom-scrollbar space-y-4">
        {studentsList.map(student => {
          const currentAtt = detailedAttendance.find(a => a.student_id === student.id && (selectedSession ? a.session_id === selectedSession.id : (a.event_id === selectedEvent.id && !a.session_id)));
          return (
            <div key={student.id} className={`p-6 rounded-card border transition-all flex items-center justify-between ${
              currentAtt?.status === 'present' ? 'bg-neon-primary/5 border-neon-primary/20' :
              currentAtt?.status === 'absent' ? 'bg-red-500/5 border-red-500/20' :
              currentAtt ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10'
            }`}>
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center font-black text-slate-900 dark:text-white border border-slate-100 dark:border-white/10">
                  {student.name[0]}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-lg">{student.name}</h4>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{student.student_id_number}</span>
                    {currentAtt?.absence_reason && (
                      <span className="text-[10px] text-neon-accent font-black">📝 {currentAtt.absence_reason}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedEvent.is_paid && (
                  <button
                    onClick={() => handleUpdateAttendanceStatus(student.id, currentAtt?.status || 'absent', currentAtt?.absence_reason, !currentAtt?.is_paid)}
                    className={`p-3 rounded-xl transition-all border ${currentAtt?.is_paid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    title={currentAtt?.is_paid ? 'تم الدفع' : 'لم يتم الدفع'}
                  >
                    <DollarSign size={20} />
                  </button>
                )}
                {currentAtt?.status !== 'present' && (
                  <button onClick={() => setAbsenceModal({ isOpen: true, student })} className="p-3 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all">
                    إدارة الغياب
                  </button>
                )}
                <button
                  onClick={() => handleQrScan(student.student_id_number)}
                  className={`p-3 rounded-xl transition-all ${currentAtt?.status === 'present' ? 'bg-neon-primary text-black' : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <Check size={20} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
