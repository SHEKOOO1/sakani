import { useState, useRef } from 'react';
import { Camera, Save, Phone, Mail, Shield, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { getRolePermissionGroups, getRoleDescription } from './rolesConfig';

export function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    admin: 'مدير التطبيق',
    bishop: 'أسقف',
    priest: 'كاهن',
    supervisor: 'مشرف سكن',
    employee: 'موظف',
    parent: 'ولي أمر',
    student: 'طالب',
  };
  const colors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    bishop: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
    priest: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    supervisor: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    employee: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    parent: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
    student: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20',
  };
  return (
    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black border ${colors[role] || ''}`}>
      {labels[role] || role}
    </span>
  );
}

export function AvatarUpload({ currentUrl, name, onSave }: { currentUrl?: string; name: string; onSave: (url: string) => void }) {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onSave(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative group">
      <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-5xl font-black text-slate-400 dark:text-slate-500 overflow-hidden border-2 border-slate-200 dark:border-white/10">
        {currentUrl ? (
          <img src={currentUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          name?.[0] || '?'
        )}
      </div>
      <label className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-vibrant-600 text-white flex items-center justify-center cursor-pointer hover:brightness-110 transition-all shadow-lg">
        <Camera size={14} />
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </label>
    </div>
  );
}

export function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase">{label}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}

export function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl p-8 border border-slate-100 dark:border-white/[0.05] shadow-sm">
      <h2 className="font-black text-sm text-slate-800 dark:text-white mb-4 flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

export function PermissionsCard({ role }: { role: string }) {
  const [expanded, setExpanded] = useState(false);
  const groups = getRolePermissionGroups(role);
  const desc = getRoleDescription(role);

  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-8 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center">
            <Shield size={18} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-right">
            <p className="font-black text-sm text-slate-900 dark:text-white">الصلاحيات والخصوصية</p>
            <p className="text-[10px] text-slate-400 font-bold">ما يمكنك وما لا يمكنك فعله حسب دورك</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-8 pb-8 space-y-6">
          <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/10">
            <p className="text-xs font-bold text-blue-800 dark:text-blue-300">{desc.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-xs text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle size={14} /> يمكنك
              </h4>
              <ul className="space-y-2">
                {desc.can.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xs text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                <XCircle size={14} /> لا يمكنك
              </h4>
              <ul className="space-y-2">
                {desc.cannot.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-300 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {groups.length > 0 && (
            <div>
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-3">تفاصيل الصلاحيات</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groups.map((group, gi) => (
                  <div key={gi} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <group.icon size={14} className="text-slate-500" />
                      <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{group.label}</span>
                    </div>
                    <div className="space-y-1">
                      {group.permissions.map((perm, pi) => (
                        <div key={pi} className="flex items-center gap-1.5">
                          <CheckCircle size={10} className="text-emerald-400 shrink-0" />
                          <span className="text-[10px] text-slate-600 dark:text-slate-400">{perm.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-l from-primary-600 to-vibrant-600 text-white shadow-lg shadow-primary-500/20 hover:brightness-110 active:scale-95 disabled:opacity-50">
      {saving ? 'جاري الحفظ...' : <><Save size={16} /> حفظ التعديلات</>}
    </button>
  );
}

export function PhoneInput({ phone, onChange }: { phone: string; onChange: (v: string) => void }) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl p-8 border border-slate-100 dark:border-white/[0.05] shadow-sm">
      <h2 className="font-black text-sm text-slate-800 dark:text-white mb-4 flex items-center gap-2">
        <Phone size={16} /> بيانات الاتصال الشخصية
      </h2>
      <div className="max-w-sm">
        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">رقم الهاتف</label>
        <input value={phone} onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary-400"
          placeholder="رقم الهاتف (مع مفتاح الدولة)" />
      </div>
    </div>
  );
}
