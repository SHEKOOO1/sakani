import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ShieldPlus, Plus, Edit3, Trash2
} from 'lucide-react';
import { RoleFormModal, type CustomRole, PERMISSION_GROUPS } from './admin/RoleFormModal';

export function CustomRolesManager() {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const { user } = useAuth();

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const mounted = useMounted();
  const isAdmin = user?.role === 'admin';

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('/api/admin/roles');
      if (res?.success && mounted.current) setRoles(res.data || []);
    } catch { } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => {

    fetchRoles();
    
  }, [fetchRoles]);

  const openCreate = () => {
    setEditingRole(null);
    setModalOpen(true);
  };

  const openEdit = (role: CustomRole) => {
    setEditingRole(role);
    setModalOpen(true);
  };

  const handleDelete = async (role: CustomRole) => {
    if (!await confirm({ message: `هل أنت متأكد من حذف الدور "${role.name}"؟`, type: 'danger' })) return;
    try {
      await request(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
      showSnackbar('تم حذف الدور بنجاح', 'success');
      fetchRoles();
    } catch (err: any) {
      showSnackbar(err.message || 'حدث خطأ', 'error');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">الأدوار المخصصة</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 font-bold mt-1">إنشاء وتعديل الأدوار المخصصة بصلاحيات محددة للموظفين</p>
        </div>
        <button onClick={openCreate} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all shadow-md flex items-center gap-2">
          <Plus size={18} /> إنشاء دور جديد
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : roles.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[3rem]">
          <ShieldPlus size={48} className="mx-auto text-slate-200 dark:text-white/10 mb-4" />
          <p className="text-lg font-bold text-slate-300 dark:text-slate-500">لا توجد أدوار مخصصة بعد</p>
          <button onClick={openCreate} className="mt-4 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all">
            إنشاء أول دور
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {roles.map(role => (
            <div key={role.id} onClick={() => openEdit(role)} className="group cursor-pointer bg-white dark:bg-card-dark rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30">
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                      <ShieldPlus size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">{role.name}</h3>
                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                        {role.created_by_name && (
                          <span className="text-[10px] text-slate-400 font-bold">بواسطة: {role.created_by_name}</span>
                        )}
                        {role.tenant_name && (
                          <span className="text-[10px] text-indigo-400 dark:text-indigo-300 font-bold">السكن: {role.tenant_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(role); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100" title="حذف">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  {PERMISSION_GROUPS.map(group => {
                    const groupPerms = group.perms.filter(p => role.permissions?.includes(p.key));
                    if (groupPerms.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{group.label}</span>
                          <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600">({groupPerms.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {groupPerms.map(p => (
                            <span key={p.key} className="px-2 py-0.5 bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 rounded-md text-[8px] font-bold border border-slate-100 dark:border-white/[0.05]">
                              {p.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit3 size={12} className="text-indigo-400" />
                <span className="text-[10px] font-bold text-indigo-400">انقر للتعديل</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <RoleFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingRole={editingRole}
        isAdmin={isAdmin}
        onSaved={fetchRoles}
      />
    </div>
  );
}
