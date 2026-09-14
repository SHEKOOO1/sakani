import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Plus, Mail, ShieldAlert, Hash, Calendar, MapPin, Building,
  Camera, CheckCircle2, Trash2, Map, Cross, UserCheck, Heart,
  Phone, School
} from 'lucide-react';

interface PhoneEntry {
  id: string;
  phoneType: 'mobile' | 'whatsapp' | 'work' | 'other';
  label: string;
  phoneNumber: string;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  studentIdNumber: string;
  birthDate: string;
  college: string;
  major: string;
  university: string;
  enrollmentYear: number;
  studentPhoto: string;
  address: string;
  roomId: string;
  idCardNumber: string;
  billingCycle: 'daily' | 'monthly' | 'semester';
  agreedPrice: number;
  governorate: string;
  village: string;
  churchName: string;
  confessionFatherName: string;
  phoneNumbers: PhoneEntry[];
  docTypes: Record<string, File | null>;
  isServant: boolean;
  isDeacon: boolean;
  servantServices: string[];
  deaconRank: string;
  serviceTrainingCertificate: File | null;
}

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  rooms: any[];
}

export function AddStudentModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  rooms,
}: AddStudentModalProps) {
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
            className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-2xl relative text-right max-h-[95vh] overflow-y-auto"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark z-10">
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">تسجيل طالب جديد</h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <form onSubmit={onSubmit} className="p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="space-y-2 col-span-full bg-gradient-to-l from-primary-50 to-vibrant-50 dark:from-primary-900/20 dark:to-vibrant-900/20 p-6 rounded-2xl border border-primary-100 dark:border-primary-500/20 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-primary-800 dark:text-primary-300">بيانات الحساب الأساسية</h4>
                    <p className="text-[10px] text-primary-500 dark:text-primary-400 font-bold">يتم استخدام الإيميل للدخول للتطبيق</p>
                  </div>
                  <div className="flex gap-4">
                    <Mail className="text-primary-200 dark:text-primary-500/30" size={32} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    <Plus size={10} /> الاسم الكامل
                  </label>
                  <input
                    required type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                    placeholder="الاسم الرباعي"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    <Mail size={10} /> البريد الإلكتروني
                  </label>
                  <input
                    required type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    <ShieldAlert size={10} /> كلمة المرور
                  </label>
                  <input
                    required type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                    placeholder="كلمة المرور"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    <Hash size={10} /> الرقم القومي
                  </label>
                  <input
                    required type="text"
                    value={formData.idCardNumber}
                    onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-mono font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    <Calendar size={10} /> تاريخ الميلاد
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    المحافظة
                  </label>
                  <input
                    required type="text"
                    value={formData.governorate}
                    onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                    placeholder="مثال: أسيوط"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    الكنيسة التابع لها
                  </label>
                  <input
                    required type="text"
                    value={formData.churchName}
                    onChange={(e) => setFormData({ ...formData, churchName: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    اسم أب الاعتراف
                  </label>
                  <input
                    required type="text"
                    value={formData.confessionFatherName}
                    onChange={(e) => setFormData({ ...formData, confessionFatherName: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    الكلية
                  </label>
                  <input
                    type="text"
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    التخصص
                  </label>
                  <input
                    type="text"
                    value={formData.major}
                    onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    سنة الالتحاق بالسكن
                  </label>
                  <input
                    type="number"
                    value={formData.enrollmentYear}
                    onChange={(e) => setFormData({ ...formData, enrollmentYear: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  />
                </div>

                <div className="space-y-2 col-span-full bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] border border-slate-100 dark:border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">
                        تليفونات متعددة (نوع + وصف + رقم)
                      </label>
                      <p className="text-[10px] text-slate-500 dark:text-slate-300 font-bold">يمكن إضافة أكثر من رقم بدون حد</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          phoneNumbers: [
                            ...formData.phoneNumbers,
                            { id: crypto.randomUUID(), phoneType: 'mobile', label: '', phoneNumber: '' }
                          ]
                        })
                      }
                      className="neon-btn neon-btn-primary neon-btn-sm"
                    >
                      <Plus size={14} /> إضافة رقم
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.phoneNumbers.map((p, idx) => (
                      <div key={p.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                            نوع الرقم
                          </label>
                          <select
                            value={p.phoneType}
                            onChange={(e) => {
                              const phoneType = e.target.value as PhoneEntry['phoneType'];
                              setFormData({
                                ...formData,
                                phoneNumbers: formData.phoneNumbers.map((x) => x.id === p.id ? { ...x, phoneType } : x)
                              });
                            }}
                            className="w-full px-5 py-4 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-bold dark:text-white"
                          >
                            <option value="mobile">محمول</option>
                            <option value="whatsapp">واتساب</option>
                            <option value="work">عمل</option>
                            <option value="other">آخر</option>
                          </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                            وصف/اسم الرقم
                          </label>
                          <input
                            type="text"
                            value={p.label}
                            onChange={(e) => {
                              const label = e.target.value;
                              setFormData({
                                ...formData,
                                phoneNumbers: formData.phoneNumbers.map((x) => x.id === p.id ? { ...x, label } : x)
                              });
                            }}
                            className="w-full px-5 py-4 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-bold dark:text-white"
                            placeholder="مثال: رقم المحمول للأب"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                            الرقم
                          </label>
                          <input
                            type="text"
                            value={p.phoneNumber}
                            onChange={(e) => {
                              const phoneNumber = e.target.value;
                              setFormData({
                                ...formData,
                                phoneNumbers: formData.phoneNumbers.map((x) => x.id === p.id ? { ...x, phoneNumber } : x)
                              });
                            }}
                            className="w-full px-5 py-4 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-bold dark:text-white"
                            placeholder="01xxxxxxxxx"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, phoneNumbers: formData.phoneNumbers.filter(x => x.id !== p.id) })}
                            className="p-3 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-100 dark:hover:bg-red-500/30 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {formData.phoneNumbers.length === 0 && (
                      <div className="py-6 text-center text-slate-400 dark:text-slate-300 font-bold">
                        لا توجد أرقام. اضغط "إضافة رقم".
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 col-span-full bg-blue-50/30 dark:bg-blue-500/10 p-8 rounded-[2.5rem] border border-blue-100/50 dark:border-blue-500/30">
                  <h4 className="font-black text-blue-800 dark:text-blue-300 flex items-center gap-2"><Camera size={18} /> الوثائق الرسمية المطلوبة</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { id: 'id_front', label: 'بطاقة الطالب (وجه)' },
                      { id: 'id_back', label: 'بطاقة الطالب (ظهر)' },
                      { id: 'parent_id', label: 'بطاقة ولي الأمر' },
                      { id: 'church_recom', label: 'جواب تزكية الكنيسة' }
                    ].map(doc => (
                      <div key={doc.id} className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2 uppercase">{doc.label}</label>
                        <div className="relative group">
                          <input
                            type="file"
                            onChange={e => setFormData({
                              ...formData,
                              docTypes: { ...formData.docTypes, [doc.id]: e.target.files?.[0] || null }
                            })}
                            className="hidden"
                            id={`file-${doc.id}`}
                          />
                          <label
                            htmlFor={`file-${doc.id}`}
                            className={`w-full p-4 rounded-2xl border-2 border-dashed flex items-center justify-between cursor-pointer transition-all ${
                              formData.docTypes[doc.id]
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-white dark:bg-card-dark border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-300 hover:border-blue-400'
                            }`}
                          >
                            <span className="text-xs font-bold">{formData.docTypes[doc.id]?.name || 'اضغط لاختيار ملف'}</span>
                            {formData.docTypes[doc.id] ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    رابط صورة الطالب
                  </label>
                  <input
                    type="text"
                    value={formData.studentPhoto}
                    onChange={(e) => setFormData({ ...formData, studentPhoto: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2 col-span-full">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    <MapPin size={10} /> العنوان بالتفصيل
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-4 col-span-full border-t border-slate-100 dark:border-white/10 pt-6">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2 flex items-center gap-2">
                    <Building size={10} /> التسكين والنظام المالي
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-300 pr-2">اختر الغرفة</label>
                      <select
                        value={formData.roomId}
                        onChange={(e) => {
                          const roomId = e.target.value;
                          const room = rooms.find((r: any) => r.id === roomId);
                          setFormData({
                            ...formData,
                            roomId,
                            agreedPrice: formData.billingCycle === 'daily'
                              ? (room?.price_daily || 0)
                              : formData.billingCycle === 'monthly'
                                ? (room?.price_monthly || 0)
                                : (room?.price_semester || 0)
                          });
                        }}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm dark:text-white"
                      >
                        <option value="">بانتظار التسكين</option>
                        {rooms.map((room: any) => (
                          <option key={room.id} value={room.id}>
                            عمارة {room.building || '?'} - غرفة {room.room_number} ({room.current_occupancy}/{room.capacity})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-300 pr-2">نظام المحاسبة</label>
                      <select
                        value={formData.billingCycle}
                        onChange={(e) => {
                          const cycle = e.target.value as FormData['billingCycle'];
                          const room = rooms.find((r: any) => r.id === formData.roomId);
                          setFormData({
                            ...formData,
                            billingCycle: cycle,
                            agreedPrice: cycle === 'daily'
                              ? (room?.price_daily || 0)
                              : cycle === 'monthly'
                                ? (room?.price_monthly || 0)
                                : (room?.price_semester || 0)
                          });
                        }}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm dark:text-white"
                      >
                        <option value="daily">يومي</option>
                        <option value="monthly">شهري</option>
                        <option value="semester">للترم الدراسي</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-300 pr-2">المبلغ المتفق عليه (ج.م)</label>
                      <input
                        type="number"
                        value={formData.agreedPrice}
                        onChange={(e) => setFormData({ ...formData, agreedPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-primary-500/20 hover:brightness-110 transition-all active:scale-95"
              >
                إتمام عملية تسجيل الطالب
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
