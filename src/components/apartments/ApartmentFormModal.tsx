import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Trash2, Wand2 } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';

export interface ApartmentRoomInput {
  roomNumber: string;
  capacity: number;
}

interface ApartmentFormData {
  name: string;
  building: string;
  is_active: boolean;
  amenities: string[];
  has_kitchen: boolean;
  kitchen_details: string[];
  has_bathroom: boolean;
  bathroom_details: string[];
  rooms: ApartmentRoomInput[];
}

interface ApartmentFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ApartmentFormData;
  onFormDataChange: (data: ApartmentFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function ApartmentFormModal({ isOpen, isEditing, formData, onFormDataChange, onSubmit, onClose }: ApartmentFormModalProps) {
  useCloseOnEscape(onClose, isOpen);
  const [genStart, setGenStart] = useState('101');
  const [genCount, setGenCount] = useState(2);
  const [genCapacity, setGenCapacity] = useState(2);

  if (!isOpen) return null;

  const update = (field: keyof ApartmentFormData, value: any) => {
    onFormDataChange({ ...formData, [field]: value });
  };

  const toggleArrayItem = (field: 'amenities' | 'kitchen_details' | 'bathroom_details', item: string) => {
    const current = formData[field] || [];
    update(field, current.includes(item) ? current.filter(i => i !== item) : [...current, item]);
  };

  const rooms = formData.rooms || [];
  const setRooms = (next: ApartmentRoomInput[]) => update('rooms', next);
  const addRoom = () => setRooms([...rooms, { roomNumber: '', capacity: 2 }]);
  const removeRoom = (index: number) => setRooms(rooms.filter((_, i) => i !== index));
  const updateRoom = (index: number, patch: Partial<ApartmentRoomInput>) =>
    setRooms(rooms.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const generateRooms = () => {
    const start = parseInt(genStart, 10);
    const count = Math.max(1, Math.min(60, Number(genCount) || 1));
    const capacity = Math.max(1, Number(genCapacity) || 1);
    const next = [...rooms];
    for (let i = 0; i < count; i++) {
      next.push({ roomNumber: isNaN(start) ? `${genStart}-${i + 1}` : String(start + i), capacity });
    }
    setRooms(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-card-dark rounded-[2.5rem] shadow-2xl w-full max-w-lg relative overflow-hidden text-right"
      >
        <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark z-10">
          <h3 className="text-xl font-black text-slate-800 dark:text-white">
            {isEditing ? 'تعديل بيانات الشقة' : 'إضافة شقة سكنية جديدة'}
          </h3>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X /></button>
        </div>

        <form onSubmit={onSubmit} className="p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">اسم الشقة</label>
              <input
                required type="text"
                value={formData.name} onChange={(e) => update('name', e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                placeholder="مثال: شقة 101"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">اسم العمارة (المبنى)</label>
              <input
                type="text"
                value={formData.building} onChange={(e) => update('building', e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                placeholder="مثال: مبنى النور"
              />
            </div>

            {!isEditing && (
              <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">غرف الشقة</label>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400">{rooms.length} غرفة</span>
                </div>

                <div className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-white/5 rounded-2xl p-3">
                  <div className="col-span-4 space-y-1">
                    <label className="text-[9px] text-slate-400 dark:text-slate-300 font-bold">رقم البداية</label>
                    <input type="text" value={genStart} onChange={(e) => setGenStart(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg outline-none text-xs font-bold dark:text-white" />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] text-slate-400 dark:text-slate-300 font-bold">العدد</label>
                    <input type="number" min="1" value={genCount} onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg outline-none text-xs font-bold dark:text-white" />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] text-slate-400 dark:text-slate-300 font-bold">السعة</label>
                    <input type="number" min="1" value={genCapacity} onChange={(e) => setGenCapacity(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg outline-none text-xs font-bold dark:text-white" />
                  </div>
                  <button type="button" onClick={generateRooms}
                    className="col-span-2 flex items-center justify-center gap-1 px-2 py-2.5 bg-blue-600 text-white rounded-lg text-[10px] font-black hover:bg-blue-700 transition-all">
                    <Wand2 size={12} /> توليد
                  </button>
                </div>

                <div className="space-y-2">
                  {rooms.map((room, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text" value={room.roomNumber}
                        onChange={(e) => updateRoom(index, { roomNumber: e.target.value })}
                        placeholder="رقم الغرفة"
                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-sm font-bold dark:text-white"
                      />
                      <input
                        type="number" min="1" value={room.capacity}
                        onChange={(e) => updateRoom(index, { capacity: parseInt(e.target.value) || 1 })}
                        className="w-20 px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-sm font-bold dark:text-white"
                      />
                      <button type="button" onClick={() => removeRoom(index)} aria-label="حذف الغرفة"
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addRoom}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl text-xs font-black text-slate-500 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 transition-all">
                  <Plus size={14} /> إضافة غرفة
                </button>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-white/10">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block">محتويات الشقة (عام)</label>
              <div className="grid grid-cols-2 gap-3">
                {['تكييف', 'مروحة', 'شاشة تلفزيون', 'واي فاي'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleArrayItem('amenities', opt)}
                    className={`px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                      formData.amenities?.includes(opt) ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-card-dark border-slate-100 dark:border-white/10 text-slate-400 dark:text-slate-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-white/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_kitchen} onChange={(e) => update('has_kitchen', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">تحتوي الشقة على مطبخ</span>
              </label>

              {formData.has_kitchen && (
                <div className="space-y-3 pr-8 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">تجهيزات المطبخ</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['ثلاجة', 'بوتاجاز', 'سخان مياه', 'ميكروويف', 'فلتر مياه'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleArrayItem('kitchen_details', opt)}
                        className={`px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                          formData.kitchen_details?.includes(opt) ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-white dark:bg-card-dark border-slate-100 dark:border-white/10 text-slate-400 dark:text-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-white/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_bathroom} onChange={(e) => update('has_bathroom', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">تحتوي الشقة على حمام خاص بكافة الغرف</span>
              </label>

              {formData.has_bathroom && (
                <div className="space-y-3 pr-8 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">تجهيزات الحمام</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['سخان كهرباء', 'سخان غاز', 'غسالة ملابس', 'مجفف يدوي'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleArrayItem('bathroom_details', opt)}
                        className={`px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                          formData.bathroom_details?.includes(opt) ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-white dark:bg-card-dark border-slate-100 dark:border-white/10 text-slate-400 dark:text-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer pt-4 border-t border-slate-50 dark:border-white/10">
              <input
                type="checkbox"
                checked={formData.is_active} onChange={(e) => update('is_active', e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">الشقة نشطة وجاهزة للتسكين</span>
            </label>
          </div>

          <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95">
            {isEditing ? 'حفظ التعديلات' : 'تأكيد إضافة الشقة'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
