import { motion, AnimatePresence } from 'motion/react';
import { Search, Send, X } from 'lucide-react';

interface SendTargets {
  toBishop: boolean;
  priestIds: string[];
  supervisorIds: string[];
  employeeIds: string[];
}

interface FilteredSendOptions {
  bishop: { id: string; name: string } | null;
  priests: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
  employees: { id: string; name: string }[];
}

interface SendProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  sendTargets: SendTargets;
  setSendTargets: (targets: any) => void;
  recipientSearchTerm: string;
  setRecipientSearchTerm: (term: string) => void;
  filteredSendOptions: FilteredSendOptions;
  sendingProfile: boolean;
  handleSendProfile: () => void;
}

export function SendProfileModal({
  isOpen, onClose, sendTargets, setSendTargets,
  recipientSearchTerm, setRecipientSearchTerm,
  filteredSendOptions, sendingProfile, handleSendProfile
}: SendProfileModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-[3rem] shadow-2xl w-full max-w-md relative text-right"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send className="text-blue-500" size={24} />
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">إرسال ملف الطالب</h3>
              </div>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="relative">
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={recipientSearchTerm} onChange={e => setRecipientSearchTerm(e.target.value)} placeholder="ابحث بالاسم..." className="w-full p-4 pr-12 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none text-sm font-bold dark:text-white" />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-3 custom-scrollbar pl-2">
                {filteredSendOptions.bishop && (
                  <label className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] cursor-pointer hover:bg-blue-50/50 transition-colors border-2 border-transparent has-[:checked]:border-blue-200 has-[:checked]:bg-blue-50">
                    <input type="checkbox" checked={sendTargets.toBishop} onChange={e => setSendTargets({ ...sendTargets, toBishop: e.target.checked })} className="w-5 h-5" />
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">{filteredSendOptions.bishop.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">الأسقف</p>
                    </div>
                  </label>
                )}
                {filteredSendOptions.priests?.map((priest: any) => (
                  <label key={priest.id} className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] cursor-pointer hover:bg-blue-50/50 transition-colors border-2 border-transparent has-[:checked]:border-blue-200 has-[:checked]:bg-blue-50">
                    <input type="checkbox" checked={sendTargets.priestIds.includes(priest.id)} onChange={e => {
                      const ids = e.target.checked
                        ? [...sendTargets.priestIds, priest.id]
                        : sendTargets.priestIds.filter(id => id !== priest.id);
                      setSendTargets({ ...sendTargets, priestIds: ids });
                    }} className="w-5 h-5" />
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">{priest.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">كاهن</p>
                    </div>
                  </label>
                ))}
                {filteredSendOptions.supervisors?.map((sup: any) => (
                  <label key={sup.id} className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] cursor-pointer hover:bg-blue-50/50 transition-colors border-2 border-transparent has-[:checked]:border-blue-200 has-[:checked]:bg-blue-50">
                    <input type="checkbox" checked={sendTargets.supervisorIds.includes(sup.id)} onChange={e => {
                      const ids = e.target.checked
                        ? [...sendTargets.supervisorIds, sup.id]
                        : sendTargets.supervisorIds.filter(id => id !== sup.id);
                      setSendTargets({ ...sendTargets, supervisorIds: ids });
                    }} className="w-5 h-5" />
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">{sup.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">مشرف</p>
                    </div>
                  </label>
                ))}
                {filteredSendOptions.employees?.map((emp: any) => (
                  <label key={emp.id} className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] cursor-pointer hover:bg-blue-50/50 transition-colors border-2 border-transparent has-[:checked]:border-blue-200 has-[:checked]:bg-blue-50">
                    <input type="checkbox" checked={sendTargets.employeeIds.includes(emp.id)} onChange={e => {
                      const ids = e.target.checked
                        ? [...sendTargets.employeeIds, emp.id]
                        : sendTargets.employeeIds.filter(id => id !== emp.id);
                      setSendTargets({ ...sendTargets, employeeIds: ids });
                    }} className="w-5 h-5" />
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">{emp.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">موظف</p>
                    </div>
                  </label>
                ))}
                {!filteredSendOptions.bishop && filteredSendOptions.priests.length === 0 && filteredSendOptions.supervisors.length === 0 && filteredSendOptions.employees.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem]">
                    <p className="text-sm text-slate-300 dark:text-slate-500 font-bold">لا يوجد مستلمين يطابقون بحثك</p>
                  </div>
                )}
              </div>
              <button onClick={handleSendProfile} disabled={sendingProfile || (!sendTargets.toBishop && sendTargets.priestIds.length === 0 && sendTargets.supervisorIds.length === 0 && sendTargets.employeeIds.length === 0)} className="neon-btn neon-btn-primary w-full py-5 text-sm shadow-glow">
                {sendingProfile ? 'جاري الإرسال...' : `إرسال الملف (${[sendTargets.toBishop, ...sendTargets.priestIds, ...sendTargets.supervisorIds, ...sendTargets.employeeIds].filter(Boolean).length} مستلم)`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
