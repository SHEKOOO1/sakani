import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserCog,
  UserPlus,
  X,
  Search,
  Mail,
  Key,
  ShieldPlus,
  Save,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  gender?: string;
  tenant_id?: string;
  tenant_name?: string;
  custom_role_id?: string;
  custom_role_name?: string;
  custom_permissions?: string;
  daily_readings_enabled?: number | boolean;
  radio_514_enabled?: number | boolean;
  created_at: string;
}

interface CustomRole {
  id: string;
  name: string;
}

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEmployee: Employee | null;
  formData: {
    name: string;
    email: string;
    password: string;
    role: string;
    gender: string;
    custom_role_id: string;
    daily_readings_enabled: boolean;
    radio_514_enabled: boolean;
  };
  onChange: (data: any) => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  searchQuery: string;
  onSearch: (query: string) => void;
  searchResults: any[];
  searching: boolean;
  onAddToTenant: (userId: string) => void;
  allowedRoleOptions: { value: string; label: string }[];
  customRoles: CustomRole[];
  isAdmin: boolean;
}

export function EmployeeFormModal({
  isOpen,
  onClose,
  editingEmployee,
  formData,
  onChange,
  onSave,
  saving,
  searchQuery,
  onSearch,
  searchResults,
  searching,
  onAddToTenant,
  allowedRoleOptions,
  customRoles,
  isAdmin,
}: EmployeeFormModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-card-dark w-full max-w-xl rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col border border-white/10"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark z-10">
              <h3 className="text-2xl font-black dark:text-white flex items-center gap-3">
                {editingEmployee ? <UserCog className="text-neon-primary" /> : <UserPlus className="text-neon-primary" />}
                {editingEmployee ? 'تحديث بيانات الموظف' : 'إضافة موظف جديد'}
              </h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X  size={20} className="text-slate-400" />
              
                </button>
            </div>

            {!editingEmployee && (
              <div className="p-6 mx-6 mt-6 bg-blue-50 dark:bg-blue-500/5 rounded-2xl border border-blue-200 dark:border-blue-500/20 space-y-4 text-right">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-black">
                  <Search size={16} /> بحث عن مستخدم موجود مسبقاً
                </div>
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => onSearch(e.target.value)}
                    placeholder="ابحث باسم المستخدم أو البريد الإلكتروني..."
                    className="w-full p-4 pr-12 bg-white dark:bg-white/10 dark:text-white border-none rounded-2xl outline-none focus:ring-2 ring-blue-400/30 font-bold text-sm"
                  />
                </div>
                {searchQuery.trim().length >= 2 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searching ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((u: any) => (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 rounded-xl border border-blue-100 dark:border-blue-500/10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 dark:bg-white/10 rounded-xl flex items-center justify-center font-black text-sm text-slate-500">
                              {u.name?.[0] || '?'}
                            </div>
                            <div>
                              <p className="font-black text-sm text-slate-800 dark:text-white">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{u.email} {u.tenant_name && `· ${u.tenant_name}`}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onAddToTenant(u.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-black text-xs hover:bg-blue-500/20 transition-all"
                          >
                            <UserCheck size={14} /> إضافة إلى هذا السكن
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-bold py-2 pr-1">
                        <AlertCircle size={12} /> لا يوجد مستخدمين بهذا الاسم
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-blue-200 dark:bg-blue-500/20"></div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest shrink-0">أو إنشاء حساب جديد</span>
                  <div className="flex-1 h-px bg-blue-200 dark:bg-blue-500/20"></div>
                </div>
              </div>
            )}

            <form onSubmit={onSave} className="p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar text-right">
              {/* Name */}
              <div className="space-y-2 text-right">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">الاسم الكامل</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => onChange({...formData, name: e.target.value})}
                  placeholder="اسم الموظف الثلاثي..."
                  className="w-full p-4 bg-slate-50 dark:bg-white/[0.03] dark:text-white border-none rounded-2xl outline-none focus:ring-2 ring-neon-primary/20 font-bold"
                />
              </div>

              {/* Email */}
              <div className="space-y-2 text-right">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => onChange({...formData, email: e.target.value})}
                    placeholder="example@sakani.com"
                    className="w-full p-4 pl-12 bg-slate-50 dark:bg-white/[0.03] dark:text-white border-none rounded-2xl outline-none focus:ring-2 ring-neon-primary/20 font-bold"
                  />
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-2 text-right">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">
                  النوع {['bishop', 'priest'].includes(formData.role) && <span className="text-xs text-slate-400">(تلقائي)</span>}
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onChange({...formData, gender: 'male'})} disabled={['bishop', 'priest'].includes(formData.role)}
                    className={`flex-1 p-4 rounded-2xl font-black text-xs transition-all ${formData.gender === 'male' ? 'bg-neon-primary/15 text-neon-primary border-2 border-neon-primary/30' : 'bg-slate-50 dark:bg-white/[0.03] text-slate-400 border-2 border-transparent'}`}
                  >
                    ذكر
                  </button>
                  <button type="button" onClick={() => onChange({...formData, gender: 'female'})} disabled={['bishop', 'priest'].includes(formData.role)}
                    className={`flex-1 p-4 rounded-2xl font-black text-xs transition-all ${formData.gender === 'female' ? 'bg-rose-400/15 text-rose-500 border-2 border-rose-400/30' : 'bg-slate-50 dark:bg-white/[0.03] text-slate-400 border-2 border-transparent'}`}
                  >
                    أنثى
                  </button>
                </div>
              </div>

              {/* Password (Optional on edit) */}
              <div className="space-y-2 text-right">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">كلمة المرور {editingEmployee && '(اتركه فارغاً لعدم التغيير)'}</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    required={!editingEmployee}
                    type="password"
                    value={formData.password}
                    onChange={e => onChange({...formData, password: e.target.value})}
                    placeholder="********"
                    className="w-full p-4 pl-12 bg-slate-50 dark:bg-white/[0.03] dark:text-white border-none rounded-2xl outline-none focus:ring-2 ring-neon-primary/20 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Base Role */}
                <div className="space-y-2 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">الدور الأساسي</label>
                  <select
                    value={formData.role}
                    onChange={e => onChange({...formData, role: e.target.value})}
                    className="w-full p-4 bg-slate-50 dark:bg-white/[0.03] dark:text-white border-none rounded-2xl outline-none focus:ring-2 ring-neon-primary/20 font-bold"
                  >
                    {allowedRoleOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Custom Role Dropdown */}
                <div className="space-y-2 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1 flex items-center gap-1">
                    الدور المخصص <ShieldPlus size={10} className="text-neon-primary" />
                  </label>
                  <select
                    value={formData.custom_role_id}
                    onChange={e => onChange({...formData, custom_role_id: e.target.value})}
                    className="w-full p-4 bg-slate-50 dark:bg-white/[0.03] border-none rounded-2xl outline-none focus:ring-2 ring-neon-primary/20 font-bold text-neon-primary"
                  >
                    <option value="">بدون دور مخصص</option>
                    {customRoles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-500/5 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                  <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">التحكم في الخدمات</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">تمكين قراءة اليوم</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.daily_readings_enabled} onChange={e => onChange({...formData, daily_readings_enabled: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all rtl:peer-checked:after:-translate-x-full peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">تمكين راديو 5:14</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.radio_514_enabled} onChange={e => onChange({...formData, radio_514_enabled: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all rtl:peer-checked:after:-translate-x-full peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-4 font-black text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-3 px-12 py-4 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50"
                >
                  <Save size={20} />
                  {saving ? 'جاري الحفظ...' : (editingEmployee ? 'تحديث البيانات' : 'حفظ الموظف')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
