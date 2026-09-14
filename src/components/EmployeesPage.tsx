import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
  Users,
  UserPlus,
  Building,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Pagination } from './Pagination';
import { EmployeeCard } from './employees/EmployeeCard';
import { EmployeeFormModal } from './employees/EmployeeFormModal';
import { AuditLogModal } from './employees/AuditLogModal';

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

interface AuditLog {
  id: string;
  action_type: string;
  method: string;
  url: string;
  status_code: number;
  created_at: string;
}

// الأدوار المسموح للمستخدم الحالي إنشاؤها بناءً على صلاحياته
const getAllowedRoleOptions = (userRole: string): { value: string; label: string }[] => {
  const allRoles: Record<string, { value: string; label: string }[]> = {
    admin: [
      { value: 'bishop', label: 'أسقف' },
      { value: 'priest', label: 'أب كاهن' },
      { value: 'supervisor', label: 'مشرف سكن' },
      { value: 'assistant_supervisor', label: 'مساعد مشرف' },
      { value: 'employee', label: 'موظف' },
    ],
    bishop: [
      { value: 'priest', label: 'أب كاهن' },
      { value: 'supervisor', label: 'مشرف سكن' },
      { value: 'assistant_supervisor', label: 'مساعد مشرف' },
      { value: 'employee', label: 'موظف' },
    ],
    priest: [
      { value: 'supervisor', label: 'مشرف سكن' },
      { value: 'assistant_supervisor', label: 'مساعد مشرف' },
      { value: 'employee', label: 'موظف' },
    ],
    supervisor: [
      { value: 'assistant_supervisor', label: 'مساعد مشرف' },
      { value: 'employee', label: 'موظف' },
    ],
  };

  return allRoles[userRole] || [];
};

export function EmployeesPage() {
  const { request } = useApi();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { showSnackbar, confirm } = useSnackbar();
  const [expandedTenantGroups, setExpandedTenantGroups] = useState<Record<string, boolean>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [grantingPermission, setGrantingPermission] = useState<string | null>(null); // employeeId being toggled
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const allowedRoleOptions = getAllowedRoleOptions(user?.role || '');
  const defaultRole = allowedRoleOptions.length > 0 ? allowedRoleOptions[0].value : 'employee';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: defaultRole,
    gender: 'male',
    custom_role_id: '',
    daily_readings_enabled: true,
    radio_514_enabled: true
  });
  const mounted = useMounted();

  // Auto-set gender to male when role is priest or bishop
  useEffect(() => {
    if (['bishop', 'priest'].includes(formData.role)) {
      setFormData(prev => ({ ...prev, gender: 'male' }));
    }
  }, [formData.role]);

  const fetchEmployees = useCallback(async () => {
    try {
      const resp = await request(`/api/employees?page=${page}&limit=20`);
      if (resp.success && mounted.current) {
        setEmployees(resp.data);
        setTotalPages(resp.totalPages || 1);
        setTotal(resp.total || 0);
      }
    } catch (err) { console.error('Failed to fetch employees'); }
  }, [request, page]);

  const fetchCustomRoles = useCallback(async () => {
    try {
      const resp = await request('/api/admin/roles');
      if (resp.success && mounted.current) setCustomRoles(resp.data);
    } catch (err) { console.error('Failed to fetch custom roles'); }
  }, [request]);

  

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchCustomRoles();
  }, [fetchCustomRoles]);

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormData({ name: '', email: '', password: '', role: 'employee', gender: 'male', custom_role_id: '', daily_readings_enabled: true, radio_514_enabled: true });
    setSearchQuery('');
    setSearchResults([]);
    setModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({ 
      name: emp.name, 
      email: emp.email, 
      password: '', 
      role: emp.role, 
      gender: emp.gender || 'male',
      custom_role_id: emp.custom_role_id || '',
      daily_readings_enabled: emp.daily_readings_enabled != 0,
      radio_514_enabled: emp.radio_514_enabled != 0
    });
    setModalOpen(true);
  };

  const handleOpenAuditModal = async (emp: Employee) => {
    setEditingEmployee(emp);
    setAuditModalOpen(true);
    setAuditLoading(true);
    try {
      const resp = await request(`/api/employees/${emp.id}/audit`);
      if (resp.success) setAuditLogs(resp.data);
    } catch (err) { console.error('Failed to fetch audit logs'); }
    finally { setAuditLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees';
      const method = editingEmployee ? 'PUT' : 'POST';
      
      const submitData = { ...formData } as any;
      if (!isAdmin) {
        delete submitData.daily_readings_enabled;
        delete submitData.radio_514_enabled;
      }
      const resp = await request(url, {
        method,
        body: JSON.stringify(submitData)
      });

      if (resp.success) {
        setModalOpen(false);
        fetchEmployees();
      }
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ message: 'هل أنت متأكد من حذف هذا الموظف؟', type: 'danger' })) return;
    try {
      await request(`/api/employees/${id}`, { method: 'DELETE' });
      fetchEmployees();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'bishop' || user?.role === 'priest';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await request(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (resp.success) setSearchResults(resp.data);
      } catch (err) { console.error('Search failed'); }
      finally { setSearching(false); }
    }, 400);
  };

  const handleAddToTenant = async (userId: string) => {
    try {
      const resp = await request('/api/users/add-to-tenant', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      if (resp.success) {
        showSnackbar('تم إضافة المستخدم إلى هذا السكن', 'success');
        setModalOpen(false);
        fetchEmployees();
      }
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleToggleStudentPermission = async (emp: Employee) => {
    setGrantingPermission(emp.id);
    try {
      const hasPerm = emp.custom_permissions?.includes('EDIT_STUDENT');
      const method = hasPerm ? 'DELETE' : 'POST';
      const url = hasPerm
        ? `/api/students/employee-permission/${emp.id}`
        : '/api/students/employee-permission';
      const body = hasPerm ? undefined : JSON.stringify({ employeeId: emp.id });
      await request(url, { method, body });
      fetchEmployees();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setGrantingPermission(null); }
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-700" dir="rtl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3">
            <Users className="text-neon-primary" size={36} /> فريق العمل
          </h1>
          <p className="text-slate-500 font-bold mt-1">إدارة طاقم المشرفين والموظفين وتعيين صلاحياتهم.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-black shadow-xl hover:scale-105 transition-all"
        >
          <UserPlus size={20} /> إضافة موظف جديد
        </button>
      </header>

      <div className="space-y-10">
        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-500">
            <Users size={56} className="mb-5 opacity-50" />
            <p className="text-lg font-black">لا يوجد موظفون مسجلون</p>
            <p className="text-sm font-medium mt-2">قم بإضافة الموظف الأول للنظام</p>
          </div>
        ) : (() => {
          const roleOrder = ['bishop', 'priest', 'supervisor', 'assistant_supervisor', 'employee'];
          const roleLabels: Record<string, string> = {
            bishop: 'أسقف',
            priest: 'كاهن',
            supervisor: 'مشرف سكن',
            assistant_supervisor: 'مساعد مشرف',
            employee: 'موظف',
          };
          const groups: Record<string, any[]> = {};
          employees.forEach(emp => {
            const key = emp.tenant_name || 'بدون سكن';
            if (!groups[key]) groups[key] = [];
            groups[key].push(emp);
          });

          Object.values(groups).forEach(group => {
            group.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
          });

          return Object.entries(groups).sort(([,a], [,b]) => b.length - a.length).map(([tenantName, group]) => {
            const isOpen = expandedTenantGroups[tenantName] !== false;
            const hierarchyLevels = group.reduce((acc: any, emp: any) => {
              const role = emp.role || 'employee';
              if (!acc[role]) acc[role] = [];
              acc[role].push(emp);
              return acc;
            }, {});

            return (
            <div key={tenantName}>
              <div className="flex items-center gap-3 mb-5 px-1 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] py-2 rounded-xl" onClick={() => setExpandedTenantGroups(prev => ({...prev, [tenantName]: !(prev[tenantName] !== false)}))}>
                {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                <Building size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-black text-base text-slate-800 dark:text-white">{tenantName}</span>
                <div className="flex items-center gap-2 mr-3">
                  {roleOrder.filter(r => hierarchyLevels[r]).map(r => (
                    <span key={r} className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                      {roleLabels[r]}: {hierarchyLevels[r].length}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full">{group.length} مستخدم</span>
              </div>
              {isOpen && (
                <div className="space-y-4 mr-6">
                  {roleOrder.filter(r => hierarchyLevels[r]).map(role => (
                    <div key={role}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
                        <span className="text-[11px] font-black text-slate-400 dark:text-slate-300 tracking-wider">{roleLabels[role]}</span>
                        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-400">({hierarchyLevels[role].length})</span>
                        <div className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {hierarchyLevels[role].map((emp: any) => (
                          <EmployeeCard
                            key={emp.id}
                            employee={emp}
                            isAdmin={isAdmin}
                            isSupervisor={isSupervisor}
                            grantingPermission={grantingPermission}
                            onToggleStudentPermission={handleToggleStudentPermission}
                            onOpenAudit={handleOpenAuditModal}
                            onEdit={handleOpenEditModal}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          });
        })()}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <EmployeeFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingEmployee={editingEmployee}
        formData={formData}
        onChange={setFormData}
        onSave={handleSubmit}
        saving={loading}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        searchResults={searchResults}
        searching={searching}
        onAddToTenant={handleAddToTenant}
        allowedRoleOptions={allowedRoleOptions}
        customRoles={customRoles}
        isAdmin={isAdmin}
      />

      <AuditLogModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        auditLogs={auditLogs}
        loading={auditLoading}
        employeeName={editingEmployee?.name}
      />
    </div>
  );
}