import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Shield, ShieldCheck, ShieldAlert, UserCog,
  Save, X, Loader2, CheckCircle, AlertCircle,
  Radio, Music, Film, List, BarChart3, MessageCircle,
  Ban, Users, Hash, Lock, User, GraduationCap, Briefcase
} from 'lucide-react';
import { RadioRole } from '../../types/permissions';

interface RadioStaffMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: RadioRole | string;
  permissions: RadioPermissions;
  created_at: string;
}

interface RadioPermissions {
  can_manage_audio_broadcast: boolean;
  can_manage_video_broadcast: boolean;
  can_manage_video_library: boolean;
  can_manage_playlists: boolean;
  can_manage_tickers: boolean;
  can_view_analytics: boolean;
  can_moderate_comments_chat: boolean;
  can_view_radio: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  email: string;
  role: string;
  national_id?: string;
}

const DEFAULT_PERMISSIONS: RadioPermissions = {
  can_manage_audio_broadcast: false,
  can_manage_video_broadcast: false,
  can_manage_video_library: false,
  can_manage_playlists: false,
  can_manage_tickers: false,
  can_view_analytics: false,
  can_moderate_comments_chat: false,
  can_view_radio: false,
};

const ROLE_PERMISSION_PRESETS: Record<string, Partial<RadioPermissions>> = {
  [RadioRole.RadioAdmin]: {
    can_manage_audio_broadcast: true,
    can_manage_video_broadcast: true,
    can_manage_video_library: true,
    can_manage_playlists: true,
    can_manage_tickers: true,
    can_view_analytics: true,
    can_moderate_comments_chat: true,
    can_view_radio: true,
  },
  [RadioRole.RadioAudioAdmin]: {
    can_manage_audio_broadcast: true,
    can_manage_tickers: true,
  },
  [RadioRole.RadioVideoAdmin]: {
    can_manage_video_broadcast: true,
  },
  [RadioRole.RadioLibraryAdmin]: {
    can_manage_video_library: true,
    can_manage_playlists: true,
  },
  [RadioRole.RadioOperator]: {
    can_view_analytics: true,
    can_moderate_comments_chat: true,
  },
};

const RADIO_ROLES = [
  { value: RadioRole.RadioAdmin, label: 'مدير كامل للراديو', icon: Shield, color: 'text-cyan-400', desc: 'صلاحية كاملة على الراديو والمكتبة والشات' },
  { value: RadioRole.RadioAudioAdmin, label: 'مسؤول البث الصوتي', icon: Music, color: 'text-blue-400', desc: 'إدارة البث الصوتي وتحديث التراتيل المباشرة' },
  { value: RadioRole.RadioVideoAdmin, label: 'مسؤول البث المرئي', icon: Film, color: 'text-purple-400', desc: 'إدارة البث المرئي المباشر' },
  { value: RadioRole.RadioLibraryAdmin, label: 'مسؤول المكتبة', icon: List, color: 'text-amber-400', desc: 'رفع وتصنيف الفيديوهات في المكتبة' },
  { value: RadioRole.RadioOperator, label: 'مشغل راديو', icon: Radio, color: 'text-emerald-400', desc: 'متابعة البث ومراقبة الشات' },
];

const PERMISSION_DEFINITIONS: { key: keyof RadioPermissions; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'can_manage_audio_broadcast', label: 'إدارة البث الإذاعي', icon: Music, desc: 'التحكم في البث الصوتي المباشر وتحديث التراتيل' },
  { key: 'can_manage_video_broadcast', label: 'إدارة البث المرئي', icon: Film, desc: 'التحكم في البث المرئي المباشر' },
  { key: 'can_manage_video_library', label: 'إدارة مكتبة الفيديو', icon: List, desc: 'رفع وتحرير وحذف فيديوهات المكتبة' },
  { key: 'can_manage_playlists', label: 'إدارة قوائم التشغيل', icon: Hash, desc: 'إنشاء وترتيب قوائم التشغيل' },
  { key: 'can_manage_tickers', label: 'إدارة شريط الأخبار', icon: AlertCircle, desc: 'التحكم في شريط التراتيل والإعلانات' },
  { key: 'can_view_analytics', label: 'مشاهدة التحليلات', icon: BarChart3, desc: 'عرض إحصائيات الاستماع والمشاهدة' },
  { key: 'can_moderate_comments_chat', label: 'التحكم في التعليقات والشات', icon: MessageCircle, desc: 'حذف التعليقات وحظر المستخدمين المسيئين في الشات وتعليقات الفيديو' },
  { key: 'can_view_radio', label: 'مشاهدة الراديو', icon: Radio, desc: 'الوصول إلى صفحة الراديو ومشاهدة المحتوى' },
];

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl animate-pulse">
      <div className="w-12 h-12 bg-slate-700/30 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-700/30 rounded-xl w-1/3" />
        <div className="h-3 bg-slate-700/30 rounded-xl w-1/2" />
      </div>
    </div>
  );
}

const STAFF_ROLES = ['employee', 'supervisor', 'assistant_supervisor', 'admin', 'bishop', 'priest'];

export function ManageRadioPermissions() {
  const { request } = useApi();
  const { user } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [staffList, setStaffList] = useState<RadioStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<RadioRole | ''>('');
  const [permissions, setPermissions] = useState<RadioPermissions>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('/api/radio/staff');
      if (res.success) setStaffList(res.data || []);
    } catch { }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchTerm(query);
    if (!query.trim()) { setSearchResults([]); setShowSearchResults(false); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await request(`/api/radio/staff/search?q=${encodeURIComponent(query.trim())}`);
        if (res.success) {
          setSearchResults(res.data || []);
          setShowSearchResults(true);
        }
      } catch { }
      finally { setSearching(false); }
    }, 400);
  }, [request]);

  const selectUser = (result: SearchResult) => {
    setSelectedUser(result);
    setSearchTerm(result.name);
    setShowSearchResults(false);
    setSelectedRole('');
    setPermissions(DEFAULT_PERMISSIONS);
    setEditingStaffId(null);
  };

  const handleRoleChange = (role: RadioRole) => {
    setSelectedRole(role);
    const preset = ROLE_PERMISSION_PRESETS[role];
    if (preset && !editingStaffId) {
      setPermissions(prev => ({ ...DEFAULT_PERMISSIONS, ...preset }));
    }
  };

  const togglePermission = (key: keyof RadioPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const editStaff = (member: RadioStaffMember) => {
    setEditingStaffId(member.id);
    setSelectedUser({ id: member.user_id, name: member.user_name, email: member.user_email, role: '' });
    setSearchTerm(member.user_name);
    setSelectedRole(member.role as RadioRole);
    setPermissions(member.permissions);
  };

  const resetForm = () => {
    setSelectedUser(null);
    setSearchTerm('');
    setSelectedRole('');
    setPermissions(DEFAULT_PERMISSIONS);
    setEditingStaffId(null);
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleSave = async () => {
    if (!selectedUser) { showSnackbar('يرجى اختيار مستخدم أولاً', 'error'); return; }
    if (!selectedRole) { showSnackbar('يرجى اختيار دور للراديو', 'error'); return; }
    setSaving(true);
    try {
      const payload = { user_id: selectedUser.id, role: selectedRole, permissions };
      if (editingStaffId) {
        await request(`/api/radio/staff/${editingStaffId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showSnackbar('تم تحديث الصلاحيات بنجاح', 'success');
      } else {
        await request('/api/radio/staff', { method: 'POST', body: JSON.stringify(payload) });
        showSnackbar('تم إضافة عضو الطاقم بنجاح', 'success');
      }
      resetForm();
      fetchStaff();
    } catch (err: any) { showSnackbar(err.message || 'فشل الحفظ', 'error'); }
    finally { setSaving(false); }
  };

  const handleRemoveStaff = async (memberId: string, name: string) => {
    try {
      await request(`/api/radio/staff/${memberId}`, { method: 'DELETE' });
      showSnackbar(`تم إزالة ${name} من طاقم الراديو`, 'success');
      fetchStaff();
    } catch { showSnackbar('فشل الإزالة', 'error'); }
  };

  const getRoleInfo = (role: string) => RADIO_ROLES.find(r => r.value === role);

  const roleDisplay = RADIO_ROLES.find(r => r.value === selectedRole);

  const getUserBadge = (result: SearchResult) => {
    const roleLower = result.role?.toLowerCase() || '';
    const isStaff = STAFF_ROLES.includes(roleLower);
    return { isStaff, label: isStaff ? 'موظف' : 'طالب', color: isStaff ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20' };
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white/5 dark:bg-white/[0.03] backdrop-blur-xl rounded-[2.5rem] border border-white/10 dark:border-white/[0.06] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-cyan-500/10 rounded-xl">
            <UserCog size={22} className="text-cyan-400" />
          </div>
          <h3 className="text-xl font-black text-white">
            {editingStaffId ? 'تعديل صلاحيات العضو' : 'إضافة عضو جديد لطاقم الراديو'}
          </h3>
        </div>

        <div className="space-y-6">
          <div ref={searchRef} className="relative space-y-2">
            <label className="text-[10px] font-black text-slate-400 px-2">البحث عن مستخدم</label>
            <div className="relative">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={searchTerm}
                onChange={e => handleSearch(e.target.value)}
                placeholder="ابحث بالاسم، البريد الإلكتروني، أو الرقم القومي..."
                className="w-full pr-12 pl-10 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm font-bold text-white placeholder:text-slate-500 focus:border-cyan-500/30 transition-all" />
              {searching && <Loader2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin" />}
            </div>

            <AnimatePresence>
              {showSearchResults && searchResults.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="absolute z-50 w-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                  {searchResults.map(result => {
                    const badge = getUserBadge(result);
                    return (
                      <button key={result.id} onClick={() => selectUser(result)}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-all text-right border-b border-white/[0.03] last:border-0">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-slate-300">
                          {result.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white truncate">{result.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{result.email}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {selectedUser && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl">
              <CheckCircle size={20} className="text-cyan-400" />
              <div className="flex-1">
                <p className="text-sm font-black text-white">{selectedUser.name}</p>
                <p className="text-xs text-slate-400">{selectedUser.email}</p>
              </div>
              {!editingStaffId && (
                <button onClick={resetForm} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
              )}
            </motion.div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 px-2">دور الراديو</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {RADIO_ROLES.map(role => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.value;
                return (
                  <button key={role.value} onClick={() => handleRoleChange(role.value)}
                    className={`relative p-5 rounded-2xl border-2 text-right transition-all ${
                      isSelected
                        ? 'border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-cyan-500/20' : 'bg-white/5 border border-white/10'}`}>
                        <Icon size={20} className={role.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                          {role.label}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{role.desc}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle size={18} className="text-cyan-400 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRole && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 overflow-hidden">
              <label className="text-[10px] font-black text-slate-400 px-2">الصلاحيات الدقيقة</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERMISSION_DEFINITIONS.map(p => {
                  const Icon = p.icon;
                  const isEnabled = permissions[p.key];
                  return (
                    <label key={p.key} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                      isEnabled
                        ? 'border-cyan-500/40 bg-cyan-500/10 shadow-lg shadow-cyan-500/5'
                        : 'border-transparent bg-white/5 hover:bg-white/[0.08]'
                    }`}>
                      <div className={`p-2 rounded-xl ${isEnabled ? 'bg-cyan-500/20' : 'bg-white/5 border border-white/10'}`}>
                        <Icon size={16} className={isEnabled ? 'text-cyan-400' : 'text-slate-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${isEnabled ? 'text-cyan-300' : 'text-slate-300'}`}>
                          {p.label}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{p.desc}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        isEnabled ? 'bg-cyan-500 border-cyan-500' : 'border-white/20 bg-transparent'
                      }`}>
                        {isEnabled && <CheckCircle size={14} className="text-black" />}
                      </div>
                    </label>
                  );
                })}
              </div>
            </motion.div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSave} disabled={!selectedUser || !selectedRole || saving}
              className="px-8 py-4 bg-cyan-500 text-black rounded-2xl text-sm font-bold hover:bg-cyan-400 hover:shadow-cyan-500/30 transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
              {editingStaffId ? 'تحديث الصلاحيات' : 'إضافة العضو'}
            </button>
            {editingStaffId && (
              <button onClick={resetForm} className="px-6 py-4 bg-white/5 border border-white/10 text-slate-300 rounded-2xl text-sm font-bold hover:bg-white/10 transition-all">
                إلغاء التعديل
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white/5 dark:bg-white/[0.03] backdrop-blur-xl rounded-[2.5rem] border border-white/10 dark:border-white/[0.06] p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl">
              <Users size={22} className="text-cyan-400" />
            </div>
            <h3 className="text-xl font-black text-white">طاقم الراديو</h3>
          </div>
          <span className="text-[10px] text-slate-500 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-bold">
            {staffList.length} عضو
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : staffList.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-[2rem] bg-white/5">
            <Users size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-sm font-bold text-slate-500">لا يوجد أعضاء في طاقم الراديو</p>
            <p className="text-[10px] text-slate-600 mt-2">قم بإضافة أول عضو من النموذج أعلاه</p>
          </div>
        ) : (
          <div className="space-y-3">
            {staffList.map(member => {
              const roleInfo = getRoleInfo(member.role);
              const RoleIcon = roleInfo?.icon || Shield;
              return (
                <motion.div key={member.id} layout
                  className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/[0.08] transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg font-black text-slate-400">
                    {member.user_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{member.user_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{member.user_email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${roleInfo?.color || 'text-slate-400'} bg-white/5 border border-white/10`}>
                        {roleInfo?.label || member.role}
                      </span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    {member.permissions.can_moderate_comments_chat && (
                      <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20" title="صلاحية الشات">
                        <MessageCircle size={12} />
                      </span>
                    )}
                    {member.permissions.can_manage_audio_broadcast && (
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="إدارة البث">
                        <Music size={12} />
                      </span>
                    )}
                    {member.permissions.can_manage_video_library && (
                      <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20" title="إدارة المكتبة">
                        <Film size={12} />
                      </span>
                    )}
                    {member.permissions.can_view_radio && (
                      <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" title="مشاهدة الراديو">
                        <Radio size={12} />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => editStaff(member)}
                      className="p-2 text-slate-400 hover:text-cyan-400 rounded-xl hover:bg-cyan-500/10 transition-all">
                      <ShieldCheck size={16} />
                    </button>
                    <button onClick={() => handleRemoveStaff(member.id, member.user_name)}
                      className="p-2 text-slate-500 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-all">
                      <X size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
