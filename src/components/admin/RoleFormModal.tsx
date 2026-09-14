import { useState, useEffect } from 'react';
import { useMounted } from '../../hooks/useMounted';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldPlus, X, Save, Eye, EyeOff } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useSnackbar } from '../../contexts/SnackbarContext';

export interface CustomRole {
  id: string;
  name: string;
  permissions: string[];
  created_by_name?: string;
  tenant_name?: string;
  created_at: string;
}

interface RoleFormModalProps {
  open: boolean;
  onClose: () => void;
  editingRole: CustomRole | null;
  isAdmin: boolean;
  onSaved: () => void;
}

const PERMISSION_GROUPS: { label: string; perms: { key: string; label: string }[] }[] = [
  {
    label: 'الطلاب',
    perms: [
      { key: 'VIEW_STUDENT', label: 'عرض الطلاب' },
      { key: 'ADD_STUDENT', label: 'إضافة طلاب' },
      { key: 'EDIT_STUDENT', label: 'تعديل بيانات الطلاب' },
      { key: 'DELETE_STUDENT', label: 'حذف طلاب' },
      { key: 'ASSIGN_ROOM', label: 'توزيع الغرف' },
      { key: 'MOVE_STUDENT', label: 'نقل طلاب' },
    ],
  },
  {
    label: 'السكنات والغرف',
    perms: [
      { key: 'VIEW_HOUSING', label: 'عرض السكنات' },
      { key: 'MANAGE_HOUSING', label: 'إدارة السكنات' },
      { key: 'VIEW_ROOMS', label: 'عرض الغرف' },
      { key: 'ADD_ROOM', label: 'إضافة غرف' },
      { key: 'EDIT_ROOM', label: 'تعديل الغرف' },
      { key: 'DELETE_ROOM', label: 'حذف غرف' },
    ],
  },
  {
    label: 'الحضور والانصراف',
    perms: [
      { key: 'VIEW_ATTENDANCE', label: 'عرض الحضور' },
      { key: 'CHECKIN_ATTENDANCE', label: 'تسجيل حضور' },
      { key: 'MANAGE_ATTENDANCE', label: 'إدارة الحضور' },
    ],
  },
  {
    label: 'المغسلة',
    perms: [
      { key: 'JOIN_LAUNDRY', label: 'الاشتراك في المغسلة' },
      { key: 'VIEW_LAUNDRY_QUEUE', label: 'عرض طابور المغسلة' },
      { key: 'MANAGE_LAUNDRY', label: 'إدارة المغسلة' },
      { key: 'MANAGE_LAUNDRY_OPERATORS', label: 'إدارة مشغلي المغسلة' },
      { key: 'START_LAUNDRY_SESSION', label: 'بدء جلسة مغسلة' },
      { key: 'CLOSE_LAUNDRY_SESSION', label: 'إغلاق جلسة مغسلة' },
    ],
  },
  {
    label: 'الماليات',
    perms: [
      { key: 'VIEW_FINANCE', label: 'عرض الماليات' },
      { key: 'ADD_REVENUE', label: 'إضافة وارد' },
      { key: 'ADD_EXPENSE', label: 'إضافة مصروف' },
      { key: 'VIEW_FINANCE_REPORTS', label: 'تقارير مالية' },
    ],
  },
  {
    label: 'الصيانة',
    perms: [
      { key: 'REQUEST_MAINTENANCE', label: 'طلب صيانة' },
      { key: 'VIEW_MAINTENANCE', label: 'عرض الصيانة' },
      { key: 'HANDLE_MAINTENANCE', label: 'إدارة الصيانة' },
    ],
  },
  {
    label: 'المخازن',
    perms: [
      { key: 'VIEW_INVENTORY', label: 'عرض المخازن' },
      { key: 'MANAGE_INVENTORY', label: 'إدارة المخازن' },
    ],
  },
  {
    label: 'السلوك والنقاط',
    perms: [
      { key: 'VIEW_POINTS', label: 'عرض النقاط' },
      { key: 'MANAGE_POINTS', label: 'إدارة النقاط' },
      { key: 'MANAGE_REWARDS', label: 'إدارة المكافآت' },
      { key: 'MANAGE_PENALTIES', label: 'إدارة العقوبات' },
    ],
  },
  {
    label: 'الفعاليات',
    perms: [
      { key: 'VIEW_EVENTS', label: 'عرض الفعاليات' },
      { key: 'CREATE_EVENT', label: 'إنشاء فعاليات' },
      { key: 'EDIT_EVENT', label: 'تعديل فعاليات' },
      { key: 'DELETE_EVENT', label: 'حذف فعاليات' },
      { key: 'ATTEND_EVENT', label: 'حضور فعالية' },
      { key: 'MANAGE_EVENT_ATTENDANCE', label: 'إدارة حضور الفعاليات' },
      { key: 'MANAGE_EVENT_PAYMENTS', label: 'إدارة مدفوعات الفعاليات' },
    ],
  },
  {
    label: 'المسابقات',
    perms: [
      { key: 'VIEW_COMPETITIONS', label: 'عرض المسابقات' },
      { key: 'MANAGE_COMPETITIONS', label: 'إدارة المسابقات' },
      { key: 'JOIN_COMPETITIONS', label: 'المشاركة في المسابقات' },
    ],
  },
  {
    label: 'المستخدمين والأدوار',
    perms: [
      { key: 'VIEW_USERS', label: 'عرض المستخدمين' },
      { key: 'MANAGE_USERS', label: 'إدارة المستخدمين' },
      { key: 'MANAGE_EMPLOYEES', label: 'إدارة الموظفين' },
      { key: 'ASSIGN_ROLES', label: 'تعيين أدوار' },
    ],
  },
  {
    label: 'التقارير ولوحة البيانات',
    perms: [
      { key: 'VIEW_DASHBOARD', label: 'عرض لوحة البيانات' },
      { key: 'VIEW_REPORTS', label: 'عرض التقارير' },
      { key: 'VIEW_GLOBAL_REPORTS', label: 'تقارير شاملة' },
      { key: 'VIEW_PRIEST_DASHBOARD', label: 'لوحة الكاهن' },
      { key: 'MANAGE_PRIEST_REPORTS', label: 'تقارير الكاهن' },
    ],
  },
  {
    label: 'النظام والإعدادات',
    perms: [
      { key: 'VIEW_SETTINGS', label: 'عرض الإعدادات' },
      { key: 'MANAGE_SETTINGS', label: 'إدارة الإعدادات' },
      { key: 'VIEW_SYSTEM_LOGS', label: 'سجل النظام' },
      { key: 'MANAGE_SUPERVISORS', label: 'إدارة المشرفين' },
    ],
  },
  {
    label: 'الإشعارات والبث',
    perms: [
      { key: 'VIEW_NOTIFICATIONS', label: 'عرض الإشعارات' },
      { key: 'SEND_NOTIFICATIONS', label: 'إرسال إشعارات' },
      { key: 'SEND_BROADCAST', label: 'إرسال إعلانات' },
      { key: 'VIEW_BROADCASTS', label: 'عرض الإعلانات' },
    ],
  },
  {
    label: 'راديو 5:14',
    perms: [
      { key: 'VIEW_RADIO', label: 'عرض الراديو' },
      { key: 'MANAGE_RADIO_BROADCAST', label: 'إدارة البث' },
      { key: 'MANAGE_RADIO_VIDEO_LIBRARY', label: 'مكتبة الفيديو' },
      { key: 'MANAGE_RADIO_PLAYLISTS', label: 'قوائم التشغيل' },
      { key: 'MANAGE_RADIO_TICKERS', label: 'إدارة الشريط الإخباري' },
      { key: 'MODERATE_RADIO_CHAT', label: 'إدارة الدردشة' },
      { key: 'VIEW_RADIO_ANALYTICS', label: 'تحليلات الراديو' },
    ],
  },
  {
    label: 'سجل القرارات',
    perms: [
      { key: 'VIEW_DECISION_LOG', label: 'عرض سجل القرارات' },
      { key: 'UNDO_DECISION', label: 'التراجع عن قرار' },
    ],
  },
];

const ROLE_TEMPLATES: { label: string; name: string; perms: string[]; description: string }[] = [
  {
    label: 'مشرف سكن',
    name: 'مشرف سكن',
    description: 'صلاحيات كاملة لإدارة السكن: طلاب، غرف، حضور، مالية، صيانة، نقاط، فعاليات',
    perms: [
      'VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT',
      'ASSIGN_ROOM', 'MOVE_STUDENT',
      'VIEW_HOUSING', 'MANAGE_HOUSING',
      'VIEW_ROOMS', 'ADD_ROOM', 'EDIT_ROOM', 'DELETE_ROOM',
      'VIEW_ATTENDANCE', 'CHECKIN_ATTENDANCE', 'MANAGE_ATTENDANCE',
      'VIEW_FINANCE', 'VIEW_FINANCE_REPORTS', 'ADD_EXPENSE', 'ADD_REVENUE',
      'VIEW_MAINTENANCE', 'REQUEST_MAINTENANCE', 'HANDLE_MAINTENANCE',
      'VIEW_INVENTORY', 'MANAGE_INVENTORY',
      'VIEW_POINTS', 'MANAGE_POINTS', 'MANAGE_REWARDS', 'MANAGE_PENALTIES',
      'VIEW_EVENTS', 'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT',
      'ATTEND_EVENT', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS',
      'VIEW_COMPETITIONS', 'MANAGE_COMPETITIONS', 'JOIN_COMPETITIONS',
      'VIEW_DASHBOARD', 'VIEW_REPORTS',
      'VIEW_USERS',
      'VIEW_DECISION_LOG',
      'SEND_BROADCAST', 'VIEW_BROADCASTS',
      'VIEW_NOTIFICATIONS', 'SEND_NOTIFICATIONS',
      'VIEW_RADIO'
    ]
  },
  {
    label: 'كاهن',
    name: 'كاهن',
    description: 'صلاحيات شاملة للكاهن: إدارة الطلاب، السكنات، الفعاليات، النقاط',
    perms: [
      'VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT',
      'ASSIGN_ROOM', 'MOVE_STUDENT',
      'VIEW_HOUSING', 'MANAGE_HOUSING',
      'VIEW_ROOMS', 'ADD_ROOM', 'EDIT_ROOM', 'DELETE_ROOM',
      'VIEW_ATTENDANCE', 'CHECKIN_ATTENDANCE', 'MANAGE_ATTENDANCE',
      'VIEW_POINTS', 'MANAGE_POINTS', 'MANAGE_REWARDS', 'MANAGE_PENALTIES',
      'VIEW_EVENTS', 'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT',
      'ATTEND_EVENT', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS',
      'VIEW_COMPETITIONS', 'MANAGE_COMPETITIONS', 'JOIN_COMPETITIONS',
      'VIEW_FINANCE', 'VIEW_FINANCE_REPORTS', 'ADD_EXPENSE',
      'VIEW_DASHBOARD', 'VIEW_REPORTS',
      'VIEW_DECISION_LOG', 'UNDO_DECISION',
      'VIEW_USERS',
      'SEND_BROADCAST', 'VIEW_BROADCASTS',
      'VIEW_NOTIFICATIONS', 'SEND_NOTIFICATIONS',
      'VIEW_RADIO'
    ]
  },
  {
    label: 'مساعد مشرف',
    name: 'مساعد مشرف',
    description: 'مساعد المشرف: عرض الطلاب، إدارة الحضور، الصيانة، النقاط',
    perms: [
      'VIEW_STUDENT', 'ADD_STUDENT',
      'VIEW_ROOMS', 'VIEW_HOUSING',
      'VIEW_ATTENDANCE', 'CHECKIN_ATTENDANCE',
      'VIEW_MAINTENANCE', 'HANDLE_MAINTENANCE', 'REQUEST_MAINTENANCE',
      'VIEW_POINTS', 'MANAGE_POINTS',
      'VIEW_EVENTS', 'MANAGE_EVENT_ATTENDANCE',
      'VIEW_DASHBOARD', 'VIEW_REPORTS',
      'VIEW_RADIO'
    ]
  },
  {
    label: 'موظف',
    name: 'موظف',
    description: 'صلاحيات مشاهدة أساسية: طلاب، تقارير، حضور',
    perms: [
      'VIEW_DASHBOARD', 'VIEW_REPORTS',
      'VIEW_STUDENT',
      'VIEW_ATTENDANCE',
      'VIEW_FINANCE', 'VIEW_FINANCE_REPORTS'
    ]
  },
  {
    label: 'مسؤول الصيانة',
    name: 'مسؤول الصيانة',
    description: 'إدارة كاملة للصيانة والمخازن',
    perms: [
      'VIEW_MAINTENANCE', 'HANDLE_MAINTENANCE', 'REQUEST_MAINTENANCE',
      'VIEW_INVENTORY', 'MANAGE_INVENTORY',
      'VIEW_ROOMS',
      'VIEW_STUDENT',
      'VIEW_DASHBOARD', 'VIEW_REPORTS'
    ]
  },
  {
    label: 'مسؤول الحسابات',
    name: 'مسؤول الحسابات',
    description: 'إدارة الماليات: وارد، مصروفات، تقارير مالية',
    perms: [
      'VIEW_FINANCE', 'VIEW_FINANCE_REPORTS',
      'ADD_REVENUE', 'ADD_EXPENSE',
      'VIEW_DASHBOARD', 'VIEW_REPORTS'
    ]
  },
  {
    label: 'مسؤول النقاط',
    name: 'مسؤول النقاط',
    description: 'إدارة السلوك والنقاط والمكافآت والعقوبات',
    perms: [
      'VIEW_POINTS', 'MANAGE_POINTS', 'MANAGE_REWARDS', 'MANAGE_PENALTIES',
      'VIEW_STUDENT',
      'VIEW_DASHBOARD', 'VIEW_REPORTS'
    ]
  },
  {
    label: 'مسؤول الفعاليات',
    name: 'مسؤول الفعاليات',
    description: 'إنشاء وإدارة الفعاليات والمسابقات',
    perms: [
      'VIEW_EVENTS', 'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT',
      'ATTEND_EVENT', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS',
      'VIEW_COMPETITIONS', 'MANAGE_COMPETITIONS', 'JOIN_COMPETITIONS',
      'VIEW_STUDENT',
      'VIEW_DASHBOARD', 'VIEW_REPORTS'
    ]
  },
  {
    label: 'مسؤول المخازن',
    name: 'مسؤول المخازن',
    description: 'إدارة المخازن والمستلزمات',
    perms: [
      'VIEW_INVENTORY', 'MANAGE_INVENTORY',
      'VIEW_DASHBOARD', 'VIEW_REPORTS'
    ]
  },
  {
    label: 'مسؤول المغسلة',
    name: 'مسؤول المغسلة',
    description: 'إدارة كاملة للمغسلة وجلساتها',
    perms: [
      'JOIN_LAUNDRY', 'VIEW_LAUNDRY_QUEUE', 'MANAGE_LAUNDRY',
      'MANAGE_LAUNDRY_OPERATORS', 'START_LAUNDRY_SESSION', 'CLOSE_LAUNDRY_SESSION',
      'VIEW_STUDENT',
      'VIEW_DASHBOARD'
    ]
  },
  {
    label: 'مشرف راديو',
    name: 'مشرف راديو 5:14',
    description: 'إدارة الراديو بالكامل: بث، فيديو، قوائم تشغيل',
    perms: [
      'VIEW_RADIO',
      'MANAGE_RADIO_BROADCAST',
      'MANAGE_RADIO_VIDEO_LIBRARY',
      'MANAGE_RADIO_PLAYLISTS',
      'MANAGE_RADIO_TICKERS',
      'MODERATE_RADIO_CHAT',
      'VIEW_RADIO_ANALYTICS',
      'VIEW_DASHBOARD', 'VIEW_REPORTS'
    ]
  },
  {
    label: 'مشرف إعلانات',
    name: 'مشرف الإعلانات والبث',
    description: 'إرسال وإدارة الإعلانات والإشعارات',
    perms: [
      'SEND_BROADCAST', 'VIEW_BROADCASTS',
      'VIEW_NOTIFICATIONS', 'SEND_NOTIFICATIONS',
      'VIEW_DASHBOARD', 'VIEW_REPORTS',
      'VIEW_STUDENT'
    ]
  },
];

export { PERMISSION_GROUPS, ROLE_TEMPLATES };

export function RoleFormModal({ open, onClose, editingRole, isAdmin, onSaved }: RoleFormModalProps) {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();

  const [roleName, setRoleName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [saving, setSaving] = useState(false);
  const [tenantsList, setTenantsList] = useState<{ id: string; name: string }[]>([]);
  const [fetchingTenants, setFetchingTenants] = useState(false);
  const mounted = useMounted();

  

  useEffect(() => {
    if (open) {
      if (editingRole) {
        setRoleName(editingRole.name);
        setSelectedPerms(editingRole.permissions || []);
      } else {
        setRoleName('');
        setSelectedPerms([]);
      }
      setExpandedGroups({});
      setSaving(false);
    }
  }, [open, editingRole]);

  useEffect(() => {
    if (!open || !isAdmin || editingRole) return;
    setFetchingTenants(true);
    request('/api/admin/my-tenants').then(res => {
      if (res?.success && mounted.current) {
        setTenantsList(res.data || []);
        if (res.data?.length > 0) setSelectedTenantId(res.data[0].id);
      }
    }).catch(() => {}).finally(() => {
      if (mounted.current) setFetchingTenants(false);
    });
  }, [open, isAdmin, editingRole, request]);

  const togglePerm = (key: string) => {
    setSelectedPerms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !(prev[label] !== false) }));
  };

  const selectedCount = selectedPerms.length;

  const handleSave = async () => {
    if (!roleName.trim()) {
      showSnackbar('اسم الدور مطلوب', 'error');
      return;
    }
    if (isAdmin && !selectedTenantId && !editingRole) {
      showSnackbar('يجب اختيار السكن', 'error');
      return;
    }
    setSaving(true);
    try {
      const body: any = { name: roleName.trim(), permissions: selectedPerms };
      if (isAdmin && !editingRole) body.tenant_id = selectedTenantId;
      if (editingRole) {
        await request(`/api/admin/roles/${editingRole.id}`, { method: 'PUT', body: JSON.stringify(body) });
        showSnackbar('تم تحديث الدور بنجاح', 'success');
      } else {
        await request('/api/admin/roles', { method: 'POST', body: JSON.stringify(body) });
        showSnackbar('تم إنشاء الدور بنجاح', 'success');
      }
      onClose();
      onSaved();
    } catch (err: any) {
      showSnackbar(err.message || 'حدث خطأ', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-[3rem] shadow-2xl w-full max-w-2xl relative text-right max-h-[90vh] flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between sticky top-0 bg-white dark:bg-card-dark rounded-t-[3rem] z-10">
              <div className="flex items-center gap-3">
                <ShieldPlus className="text-indigo-500" size={24} />
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
                  {editingRole ? 'تعديل الدور' : 'إنشاء دور جديد'}
                </h3>
              </div>
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 px-2">اسم الدور *</label>
                <input
                  type="text"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-white/[0.03] dark:text-white rounded-2xl outline-none font-bold"
                  placeholder="مثال: مسؤول السكنات والكهنة"
                />
              </div>

              {isAdmin && !editingRole && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 px-2">السكن *</label>
                  <select
                    value={selectedTenantId}
                    onChange={e => setSelectedTenantId(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-white/[0.03] dark:text-white rounded-2xl outline-none font-bold"
                  >
                    {fetchingTenants ? (
                      <option>جاري التحميل...</option>
                    ) : tenantsList.length === 0 ? (
                      <option>لا توجد سكنات</option>
                    ) : (
                      tenantsList.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {!editingRole && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 px-2">ابدأ من قالب جاهز (اختياري)</label>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_TEMPLATES.map(t => (
                      <div key={t.label} className="relative group/btn">
                        <button
                          type="button"
                          onClick={() => { setRoleName(t.name); setSelectedPerms(t.perms); }}
                          className="px-4 py-2 bg-slate-50 dark:bg-white/[0.03] hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-[10px] font-bold transition-all border border-slate-100 dark:border-white/[0.05]"
                        >
                          {t.label}
                        </button>
                        <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl text-[8px] font-bold shadow-lg opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none z-10">
                          {t.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black text-slate-400">الصلاحيات</label>
                  <span className="text-[10px] font-black text-blue-600">{selectedCount} صلاحية مختارة</span>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {PERMISSION_GROUPS.map(group => {
                    const isOpen = expandedGroups[group.label] !== false;
                    const groupSelected = group.perms.filter(p => selectedPerms.includes(p.key)).length;
                    return (
                      <div key={group.label} className="bg-slate-50 dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/[0.05] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.label)}
                          className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
                        >
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200">{group.label}</span>
                          <div className="flex items-center gap-2">
                            {groupSelected > 0 && (
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-lg">{groupSelected}/{group.perms.length}</span>
                            )}
                            {isOpen ? <EyeOff size={14} className="text-slate-400" /> : <Eye size={14} className="text-slate-400" />}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.perms.map(p => (
                              <label
                                key={p.key}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedPerms.includes(p.key) ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-200' : 'bg-white dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1]'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPerms.includes(p.key)}
                                  onChange={() => togglePerm(p.key)}
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                                />
                                <span className="text-xs font-bold">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between sticky bottom-0 bg-white dark:bg-card-dark rounded-b-[3rem]">
              <button onClick={onClose} className="px-6 py-3 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all">
                إلغاء
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                {editingRole ? 'حفظ التعديلات' : 'إنشاء الدور'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
