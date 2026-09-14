import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Home, X } from 'lucide-react';

interface MaintenanceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: { description: string; priority: string; room_id: string };
  onFormDataChange: (data: { description: string; priority: string; room_id: string }) => void;
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: (e: React.FormEvent) => void;
  isStudent: boolean;
  studentProfile: any;
  rooms: any[];
}

export function MaintenanceRequestModal({
  isOpen,
  onClose,
  formData,
  onFormDataChange,
  selectedFiles,
  onFilesChange,
  onSubmit,
  isStudent,
  studentProfile,
  rooms,
}: MaintenanceRequestModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-xl relative text-right max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark z-10">
              <h3 className="text-xl font-black text-slate-800 dark:text-white">بلاغ صيانة جديد</h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>

            <form onSubmit={onSubmit} className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">وصف العطل / البلاغ</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => onFormDataChange({...formData, description: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold h-32 resize-none dark:text-white"
                    placeholder="اشرح المشكلة بالتفصيل"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">الصور والفيديوهات التوضيحية</label>
                  <div className="grid grid-cols-1 gap-4">
                    <label className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 cursor-pointer hover:border-blue-400 transition-all group">
                      <Camera size={32} className="text-slate-300 dark:text-slate-400 group-hover:text-blue-500 mb-2" />
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-300">ارفق صور أو فيديو للعطل (يمكن اختيار متعدد)</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => onFilesChange(Array.from(e.target.files || []))}
                      />
                    </label>

                    {selectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                        {selectedFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-card-dark rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-white/10 shadow-sm">
                            <span className="max-w-[120px] truncate">{f.name}</span>
                            <button type="button" onClick={() => onFilesChange(selectedFiles.filter((_, idx) => idx !== i))} className="text-red-500 hover:bg-red-50 p-1 rounded-md">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">الأولوية</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => onFormDataChange({...formData, priority: (e.target.value as any)})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                    >
                      <option value="low">منخفضة</option>
                      <option value="medium">متوسطة</option>
                      <option value="high">عالية</option>
                      <option value="urgent">عاجل جداً</option>
                    </select>
                  </div>
                  {isStudent ? (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">الغرفة</label>
                      <div className="px-6 py-4 bg-blue-50 dark:bg-blue-500/20 border border-blue-100 dark:border-blue-500/30 rounded-2xl flex items-center gap-3">
                        <Home size={16} className="text-blue-600 dark:text-blue-400" />
                        <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">
                          {studentProfile?.room_number ? `غرفة ${studentProfile.room_number}` : 'لم يتم تحديد الغرفة'}
                          {studentProfile?.apartment_name && <span className="text-blue-400 dark:text-blue-300"> — {studentProfile.apartment_name}</span>}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">الغرفة</label>
                      <select
                        value={formData.room_id}
                        onChange={(e) => onFormDataChange({...formData, room_id: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                      >
                        <option value="">اختر الغرفة</option>
                        {rooms.map((room: any) => (
                          <option key={room.id} value={room.id}>غرفة {room.room_number}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-primary-500/20 hover:brightness-110 transition-all active:scale-95">
                إرسال البلاغ للفريق الفني
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
