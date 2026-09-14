import React from 'react';
import { Building, X, Save, Shield, Clock, LogIn, LogOut } from 'lucide-react';

export interface TenantFormData {
  name: string;
  location: string;
  bishop_id: string;
  supervisor_ids: string[];
  priest_ids: string[];
  is_active: boolean;
  location_lat: string;
  location_lng: string;
  location_radius: string;
  entry_lat: string;
  entry_lng: string;
  entry_radius: string;
  exit_lat: string;
  exit_lng: string;
  exit_radius: string;
  open_time: string;
  curfew_time: string;
  semester1_start: string;
  semester1_end: string;
  semester2_start: string;
  semester2_end: string;
  daily_readings_enabled: boolean;
  radio_514_enabled: boolean;
}

interface Tenant {
  id: string;
  name: string;
  location: string;
  is_active: number;
  bishop_id: string;
  created_at: string;
  supervisor_ids?: string[];
  priest_ids?: string[];
  location_lat?: number;
  location_lng?: number;
  location_radius?: number;
  entry_lat?: number;
  entry_lng?: number;
  entry_radius?: number;
  exit_lat?: number;
  exit_lng?: number;
  exit_radius?: number;
  open_time?: string;
  curfew_time?: string;
  semester1_start?: string;
  semester1_end?: string;
  semester2_start?: string;
  semester2_end?: string;
  daily_readings_enabled?: number;
  radio_514_enabled?: number;
  apartment_count?: number;
  room_count?: number;
  total_capacity?: number;
  total_occupancy?: number;
}

interface TenantFormModalProps {
  showForm: boolean;
  onClose: () => void;
  form: TenantFormData;
  onFormChange: (form: TenantFormData) => void;
  editingTenant: Tenant | null;
  isAdmin: boolean;
  user: { id?: string; name?: string; role?: string } | null;
  bishopSearchTerm: string;
  onBishopSearchChange: (value: string) => void;
  supervisorSearchTerm: string;
  onSupervisorSearchChange: (value: string) => void;
  priestSearchTerm: string;
  onPriestSearchChange: (value: string) => void;
  filteredBishops: any[];
  filteredSupervisors: any[];
  filteredPriests: any[];
  saving: boolean;
  onSave: () => void;
  toggleSelect: (arr: string[], id: string) => string[];
}

export const TenantFormModal: React.FC<TenantFormModalProps> = ({
  showForm,
  onClose,
  form,
  onFormChange,
  editingTenant,
  isAdmin,
  user,
  bishopSearchTerm,
  onBishopSearchChange,
  supervisorSearchTerm,
  onSupervisorSearchChange,
  priestSearchTerm,
  onPriestSearchChange,
  filteredBishops,
  filteredSupervisors,
  filteredPriests,
  saving,
  onSave,
  toggleSelect,
}) => {
  if (!showForm) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="bg-white dark:bg-card-dark rounded-[3rem] shadow-2xl w-full max-w-2xl relative text-right max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark rounded-t-[3rem] z-10">
          <div className="flex items-center gap-3">
            <Building className="text-blue-500" size={24} />
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
              {editingTenant ? 'تعديل السكن' : 'إضافة سكن جديد'}
            </h3>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-10 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">اسم السكن *</label>
              <input type="text" value={form.name} onChange={e => onFormChange({...form, name: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="مثال: سكن مارمرقس" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الموقع</label>
              <input type="text" value={form.location} onChange={e => onFormChange({...form, location: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold dark:text-white" placeholder="مثال: محافظة كذا" />
            </div>
          </div>

          {/* Bishop Section */}
          {isAdmin ? (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الأسقف المسؤول (بحث واختيار)</label>
              <input
                type="text"
                placeholder="ابحث عن أسقف بالاسم..."
                value={bishopSearchTerm}
                onChange={e => onBishopSearchChange(e.target.value)}
                className="w-full p-3 bg-slate-100 dark:bg-white/5 rounded-xl outline-none font-bold text-sm mb-2 dark:text-white"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                {filteredBishops.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-300 font-bold col-span-full text-center py-4">لا يوجد أساقفة متاحون</p>}
                {filteredBishops.map(b => (
                  <label key={b.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    form.bishop_id === b.id ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400' : 'bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}>
                    <input type="radio" name="bishop_id" checked={form.bishop_id === b.id}
                      onChange={() => onFormChange({...form, bishop_id: b.id})}
                      className="w-4 h-4 rounded-full border-slate-300 text-blue-600 focus:ring-blue-400" />
                    <span className="text-sm font-bold">{b.name}</span>
                  </label>
                ))}
              </div>
            </div>
           ) : user?.role === 'bishop' ? (
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الأسقف المسؤول</label>
               <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl flex items-center gap-3 text-blue-800 dark:text-blue-400">
                  <Shield size={20} className="text-blue-500" />
                  <span className="font-black">نيافة الأنبا {user.name}</span>
               </div>
               <p className="text-[9px] text-slate-400 dark:text-slate-300 font-bold px-2 italic">يتم ربط السكن الجديد بإدارة نيافتكم تلقائياً ولا يمكن تغييره.</p>
            </div>
          ) : null}

          {/* Supervisors */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">المشرفون *</label>
            <input
              type="text"
              placeholder="ابحث عن مشرف بالاسم..."
              value={supervisorSearchTerm}
              onChange={e => onSupervisorSearchChange(e.target.value)}
              className="w-full p-3 bg-slate-100 dark:bg-white/5 rounded-xl outline-none font-bold text-sm mb-2 dark:text-white"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
              {filteredSupervisors.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-300 font-bold col-span-full text-center py-4">لا يوجد مشرفون متاحون</p>}
              {filteredSupervisors.map(s => (
                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  form.supervisor_ids.includes(s.id) ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400' : 'bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}>
                  <input type="checkbox" checked={form.supervisor_ids.includes(s.id)}
                    onChange={() => onFormChange({...form, supervisor_ids: toggleSelect(form.supervisor_ids, s.id)})}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                  <span className="text-sm font-bold dark:text-white">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Priests */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">الآباء الكهنة</label>
            <input
              type="text"
              placeholder="ابحث عن كاهن بالاسم..."
              value={priestSearchTerm}
              onChange={e => onPriestSearchChange(e.target.value)}
              className="w-full p-3 bg-slate-100 dark:bg-white/5 rounded-xl outline-none font-bold text-sm mb-2 dark:text-white"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
              {filteredPriests.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-300 font-bold col-span-full text-center py-4">لا يوجد كهنة متاحون</p>}
              {filteredPriests.map(p => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  form.priest_ids.includes(p.id) ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-400' : 'bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}>
                  <input type="checkbox" checked={form.priest_ids.includes(p.id)}
                    onChange={() => onFormChange({...form, priest_ids: toggleSelect(form.priest_ids, p.id)})}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                  <span className="text-sm font-bold">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">السكن نشط</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => onFormChange({...form, is_active: e.target.checked})} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all rtl:peer-checked:after:-translate-x-full peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            {isAdmin && (
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">تمكين قراءة اليوم للسكن</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={form.daily_readings_enabled} onChange={e => onFormChange({...form, daily_readings_enabled: e.target.checked})} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all rtl:peer-checked:after:-translate-x-full peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            )}
            {isAdmin && (
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">تمكين راديو 5:14 للسكن</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={form.radio_514_enabled} onChange={e => onFormChange({...form, radio_514_enabled: e.target.checked})} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all rtl:peer-checked:after:-translate-x-full peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            )}
          </div>

          {/* Advanced Settings — hidden from admin */}
          {!isAdmin && (
          <details className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
            <summary className="text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">إعدادات متقدمة</summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">خط العرض (Lat)</label>
                  <input type="text" value={form.location_lat} onChange={e => onFormChange({...form, location_lat: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">خط الطول (Lng)</label>
                  <input type="text" value={form.location_lng} onChange={e => onFormChange({...form, location_lng: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">نطاق الموقع (متر)</label>
                  <input type="number" value={form.location_radius} onChange={e => onFormChange({...form, location_radius: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
              </div>
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-500/20 p-3 space-y-3 bg-emerald-50/30 dark:bg-emerald-500/5">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><LogIn size={12} /> نقطة الدخول</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">خط العرض (Lat)</label>
                    <input type="text" value={form.entry_lat} onChange={e => onFormChange({...form, entry_lat: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">خط الطول (Lng)</label>
                    <input type="text" value={form.entry_lng} onChange={e => onFormChange({...form, entry_lng: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">نطاق الدخول (متر)</label>
                    <input type="number" value={form.entry_radius} onChange={e => onFormChange({...form, entry_radius: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-red-100 dark:border-red-500/20 p-3 space-y-3 bg-red-50/30 dark:bg-red-500/5">
                <p className="text-[10px] font-black text-red-600 dark:text-red-400 flex items-center gap-1"><LogOut size={12} /> نقطة الخروج</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">خط العرض (Lat)</label>
                    <input type="text" value={form.exit_lat} onChange={e => onFormChange({...form, exit_lat: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">خط الطول (Lng)</label>
                    <input type="text" value={form.exit_lng} onChange={e => onFormChange({...form, exit_lng: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">نطاق الخروج (متر)</label>
                    <input type="number" value={form.exit_radius} onChange={e => onFormChange({...form, exit_radius: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300 flex items-center gap-1"><Clock size={12} /> وقت فتح الباب</label>
                  <input type="time" value={form.open_time} onChange={e => onFormChange({...form, open_time: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300 flex items-center gap-1"><Clock size={12} /> وقت حظر التجوال</label>
                  <input type="time" value={form.curfew_time} onChange={e => onFormChange({...form, curfew_time: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">بداية الترم 1</label>
                  <input type="date" value={form.semester1_start} onChange={e => onFormChange({...form, semester1_start: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">نهاية الترم 1</label>
                  <input type="date" value={form.semester1_end} onChange={e => onFormChange({...form, semester1_end: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">بداية الترم 2</label>
                  <input type="date" value={form.semester2_start} onChange={e => onFormChange({...form, semester2_start: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-300">نهاية الترم 2</label>
                  <input type="date" value={form.semester2_end} onChange={e => onFormChange({...form, semester2_end: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none text-xs font-bold dark:text-white" />
                </div>
              </div>
            </div>
          </details>)}
        </div>

        <div className="p-4 sm:p-8 border-t border-slate-100 dark:border-white/10 flex items-center justify-between sticky bottom-0 bg-white dark:bg-slate-900 rounded-b-[3rem]">
          <button onClick={onClose} className="px-6 py-3 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all">
            إلغاء
          </button>
          <button onClick={onSave} disabled={saving}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
            {editingTenant ? 'حفظ التعديلات' : 'إنشاء السكن'}
          </button>
        </div>
      </div>
    </div>
  );
};
