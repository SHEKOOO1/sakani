import { motion, AnimatePresence } from 'motion/react';
import { X, PenSquare, Plus, Trash2 } from 'lucide-react';

interface PhoneEntry {
  phoneType: string;
  label: string;
  phoneNumber: string;
}

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editForm: Record<string, any>;
  setEditForm: (form: any) => void;
  handleSaveEdit: () => void;
  isAdmin: boolean;
  rooms: any[];
}

export function EditStudentModal({ isOpen, onClose, editForm, setEditForm, handleSaveEdit, isAdmin, rooms }: EditStudentModalProps) {
  const phoneNumbers: PhoneEntry[] = editForm.phoneNumbers || [];

  const addPhone = () => {
    setEditForm({
      ...editForm,
      phoneNumbers: [...phoneNumbers, { phoneType: 'mobile', label: '', phoneNumber: '' }]
    });
  };

  const removePhone = (index: number) => {
    setEditForm({
      ...editForm,
      phoneNumbers: phoneNumbers.filter((_: any, i: number) => i !== index)
    });
  };

  const updatePhone = (index: number, field: keyof PhoneEntry, value: string) => {
    const updated = phoneNumbers.map((p: any, i: number) =>
      i === index ? { ...p, [field]: value } : p
    );
    setEditForm({ ...editForm, phoneNumbers: updated });
  };

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
                <PenSquare className="text-blue-500" size={24} />
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">تعديل بيانات الطالب</h3>
              </div>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الاسم</label>
                <input type="text" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الإيميل</label>
                <input type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الجامعة</label>
                <input type="text" value={editForm.university || ''} onChange={e => setEditForm({ ...editForm, university: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الكلية</label>
                <input type="text" value={editForm.college || ''} onChange={e => setEditForm({ ...editForm, college: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">التخصص</label>
                <input type="text" value={editForm.major || ''} onChange={e => setEditForm({ ...editForm, major: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">المحافظة</label>
                <input type="text" value={editForm.governorate || ''} onChange={e => setEditForm({ ...editForm, governorate: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">القرية</label>
                <input type="text" value={editForm.village || ''} onChange={e => setEditForm({ ...editForm, village: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الكنيسة</label>
                <input type="text" value={editForm.church_name || ''} onChange={e => setEditForm({ ...editForm, church_name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">أب الاعتراف</label>
                <input type="text" value={editForm.confession_father_name || ''} onChange={e => setEditForm({ ...editForm, confession_father_name: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">تليفون أب الاعتراف</label>
                <input type="text" value={editForm.confession_father_phone || ''} onChange={e => setEditForm({ ...editForm, confession_father_phone: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">واتساب أب الاعتراف</label>
                <input type="text" value={editForm.confession_father_whatsapp || ''} onChange={e => setEditForm({ ...editForm, confession_father_whatsapp: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">خدمة أب الاعتراف</label>
                <input type="text" value={editForm.confession_father_service || ''} onChange={e => setEditForm({ ...editForm, confession_father_service: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>

              <div className="border-t border-slate-100 dark:border-white/10 pt-4">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-300 mb-3">أرقام الهاتف</p>
                <div className="space-y-3">
                  {phoneNumbers.map((phone: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl">
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <select value={phone.phoneType} onChange={e => updatePhone(idx, 'phoneType', e.target.value)} className="p-2 bg-white dark:bg-card-dark rounded-xl outline-none font-bold text-xs dark:text-white">
                            <option value="mobile">موبايل</option>
                            <option value="whatsapp">واتساب</option>
                            <option value="work">عمل</option>
                            <option value="other">أخرى</option>
                          </select>
                          <input type="text" value={phone.label} onChange={e => updatePhone(idx, 'label', e.target.value)} placeholder="تسمية" className="p-2 bg-white dark:bg-card-dark rounded-xl outline-none font-bold text-xs dark:text-white" />
                          <input type="text" value={phone.phoneNumber} onChange={e => updatePhone(idx, 'phoneNumber', e.target.value)} placeholder="رقم الهاتف" className="p-2 bg-white dark:bg-card-dark rounded-xl outline-none font-bold text-xs dark:text-white" />
                        </div>
                      </div>
                      <button onClick={() => removePhone(idx)} className="p-2 text-red-400 hover:text-red-600 transition-colors shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button onClick={addPhone} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-xs font-black text-slate-400 dark:text-slate-300 hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                    <Plus size={16} /> إضافة رقم هاتف
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">واتساب الطالب</label>
                <input type="text" value={editForm.whatsapp_number || ''} onChange={e => setEditForm({ ...editForm, whatsapp_number: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>

              <div className="border-t border-slate-100 dark:border-white/10 pt-4">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-300 mb-3">بيانات الخدمة والشموسية</p>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl cursor-pointer">
                    <input type="checkbox" checked={!!editForm.is_servant} onChange={e => setEditForm({ ...editForm, is_servant: e.target.checked })} className="w-5 h-5" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">خادم</span>
                  </label>
                  {editForm.is_servant && (
                    <div className="space-y-2 pr-8">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">أنواع الخدمة</label>
                      <input type="text" value={editForm.servant_services || ''} onChange={e => setEditForm({ ...editForm, servant_services: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="خدمة المذبح، اجتماع الشباب، ..." />
                    </div>
                  )}
                  <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl cursor-pointer">
                    <input type="checkbox" checked={!!editForm.is_deacon} onChange={e => setEditForm({ ...editForm, is_deacon: e.target.checked })} className="w-5 h-5" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">شماس</span>
                  </label>
                  {editForm.is_deacon && (
                    <div className="space-y-4 pr-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الرتبة</label>
                        <input type="text" value={editForm.deacon_rank || ''} onChange={e => setEditForm({ ...editForm, deacon_rank: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="رتبة الشموسية" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">تفاصيل الشموسية</label>
                        <textarea rows={2} value={editForm.deacon_details || ''} onChange={e => setEditForm({ ...editForm, deacon_details: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold text-sm dark:text-white" placeholder="تفاصيل إضافية عن الشموسية..." />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-500/5 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                  <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">التحكم في الخدمات</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">تمكين قراءة اليوم</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={editForm.daily_readings_enabled !== false} onChange={e => setEditForm({ ...editForm, daily_readings_enabled: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all rtl:peer-checked:after:-translate-x-full peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">تمكين راديو 5:14</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={editForm.radio_514_enabled !== false} onChange={e => setEditForm({ ...editForm, radio_514_enabled: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all rtl:peer-checked:after:-translate-x-full peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">العنوان</label>
                <input type="text" value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الغرفة</label>
                <select value={editForm.room_id || ''} onChange={e => setEditForm({ ...editForm, room_id: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white">
                  <option value="">بدون غرفة</option>
                  {rooms.map((room: any) => (
                    <option key={room.id} value={room.id}>
                      {room.apartment_name || 'شقة'} / غرفة {room.room_number} ({room.current_occupancy}/{room.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-slate-100 dark:border-white/10 pt-4">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-300 mb-3">تغيير كلمة المرور</p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    value={editForm.password || ''}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white"
                    placeholder="اتركه فارغًا إذا لا تريد التغيير"
                  />
                </div>
              </div>

              <button onClick={handleSaveEdit} className="neon-btn neon-btn-primary w-full py-5 text-sm shadow-glow">
                حفظ التعديلات
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}