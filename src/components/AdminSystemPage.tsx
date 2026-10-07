import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
  Building, Plus, Edit3, Trash2, X, Play, Pause,
  Users, Church, MapPin,
  AlertCircle, CheckCircle, Shield, ShieldPlus
} from 'lucide-react';
import { CustomRolesManager } from './CustomRolesManager';
import { TenantFormModal } from './admin/TenantFormModal';

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

export const AdminSystemPage: React.FC = () => {
  const { request } = useApi();
  const { user } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [priests, setPriests] = useState<any[]>([]);
  const [bishops, setBishops] = useState<any[]>([]);
  const [bishopSearchTerm, setBishopSearchTerm] = useState('');
  const [supervisorSearchTerm, setSupervisorSearchTerm] = useState('');
  const [priestSearchTerm, setPriestSearchTerm] = useState('');
  const [togglingTenantId, setTogglingTenantId] = useState<string | null>(null); // New state for toggle loading
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'admin';
  const canManage = isAdmin || user?.role === 'bishop';
  const [tab, setTab] = useState<'tenants' | 'roles'>('tenants');

  const [form, setForm] = useState({
    name: '',
    location: '',
    bishop_id: '',
    supervisor_ids: [] as string[],
    priest_ids: [] as string[],
    is_active: true,
    location_lat: '',
    location_lng: '',
    location_radius: '50',
    entry_lat: '',
    entry_lng: '',
    entry_radius: '50',
    exit_lat: '',
    exit_lng: '',
    exit_radius: '50',
    open_time: '',
    curfew_time: '',
    semester1_start: '',
    semester1_end: '',
    semester2_start: '',
    semester2_end: '',
    daily_readings_enabled: true,
    radio_514_enabled: true
  });

  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantsRes, usersRes] = await Promise.all([
        request('/api/tenants'),
        request('/api/tenants/available-users/list?roles=supervisor,priest'),
      ]);
      if (!mountedRef.current) return;
      if (tenantsRes.success) {
        if (mountedRef.current) setTenants(tenantsRes.data || []);
      }
      if (usersRes.success) {
        if (mountedRef.current) {
          setSupervisors((usersRes.data || []).filter((u: any) => u.role === 'supervisor'));
          setPriests((usersRes.data || []).filter((u: any) => u.role === 'priest'));
        }
      }
    } catch (e) { console.error('Fetch admin system data failed:', e); } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    if (isAdmin) {
      request('/api/tenants/bishops/list').then(res => {
        if (res.success && mountedRef.current) setBishops(res.data || []);
      }).catch(e => { console.error('Load bishops failed:', e); showSnackbar('فشل تحميل قائمة الأساقفة', 'error'); });
    }
    return () => { mountedRef.current = false; };
  }, [fetchData, isAdmin]);

  // Effect to auto-hide messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000); // تختفي الرسالة بعد 5 ثوانٍ
      return () => clearTimeout(timer); // تنظيف المؤقت إذا تغيرت الرسالة أو تم إلغاء تحميل المكون
    }
  }, [message]);

  const filteredBishops = React.useMemo(() => {
    if (!bishopSearchTerm) return bishops;
    return bishops.filter(b =>
      b.name.toLowerCase().includes(bishopSearchTerm.toLowerCase())
    );
  }, [bishops, bishopSearchTerm]);

  const filteredSupervisors = React.useMemo(() => {
    if (!supervisorSearchTerm) return supervisors;
    return supervisors.filter(s =>
      s.name.toLowerCase().includes(supervisorSearchTerm.toLowerCase())
    );
  }, [supervisors, supervisorSearchTerm]);

  const filteredPriests = React.useMemo(() => {
    if (!priestSearchTerm) return priests;
    return priests.filter(p =>
      p.name.toLowerCase().includes(priestSearchTerm.toLowerCase())
    );
  }, [priests, priestSearchTerm]);


  const resetForm = () => {
    setForm({
      name: '', location: '', bishop_id: '', supervisor_ids: [], priest_ids: [],
      is_active: true, location_lat: '', location_lng: '', location_radius: '50',
      entry_lat: '', entry_lng: '', entry_radius: '50',
      exit_lat: '', exit_lng: '', exit_radius: '50',
      open_time: '', curfew_time: '', semester1_start: '', semester1_end: '', semester2_start: '', semester2_end: '',
      daily_readings_enabled: true,
      radio_514_enabled: true
    });
    setEditingTenant(null);
  };

  const sendUpdateNotifications = async (tenantName: string, actionText: string, supervisorIds: string[] = [], priestIds: string[] = []) => {
    // يتم إرسال الإشعارات فقط إذا كان القائم بالعمل أسقف أو مدير نظام
    if (user?.role !== 'bishop' && user?.role !== 'admin') return;
    
    // جمع كل المسؤولين في قائمة واحدة فريدة واستبعاد المستخدم الحالي (الذي قام بالتعديل)
    const recipients = Array.from(new Set([...(supervisorIds || []), ...(priestIds || [])]))
      .filter(id => id && id !== user?.id);
      
    if (recipients.length === 0) return;

    const roleLabel = user.role === 'bishop' ? 'نيافة الأنبا' : 'مدير النظام';
    const notificationMessage = `تنبيه إداري: قام ${roleLabel} ${user.name} بـ ${actionText} لسكن: ${tenantName}`;

    try {
      // إرسال إشعار لكل مسؤول على حدة عبر الـ API
      await Promise.all(recipients.map(targetId => 
        request('/api/notifications', {
          method: 'POST',
          body: JSON.stringify({
            userId: targetId,
            title: 'تحديث في إدارة السكن',
            message: notificationMessage,
            type: 'warning'
          })
        })
      ));
    } catch (err) {
      console.error('Failed to notify team about housing update:', err);
    }
  };

  const openCreate = () => {
    resetForm();
    // إذا كان المستخدم أسقف، نقوم بتعيينه تلقائياً كمسؤول عن السكن الجديد
    if (user?.role === 'bishop' && user?.id) {
      setForm(prev => ({ ...prev, bishop_id: user.id, daily_readings_enabled: true, radio_514_enabled: true }));
    }
    setShowForm(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setForm({
      name: tenant.name || '',
      location: tenant.location || '',
      bishop_id: tenant.bishop_id || '',
      supervisor_ids: tenant.supervisor_ids || [],
      priest_ids: tenant.priest_ids || [],
      is_active: Number(tenant.is_active) === 1,
      location_lat: tenant.location_lat?.toString() || '',
      location_lng: tenant.location_lng?.toString() || '',
      location_radius: tenant.location_radius?.toString() || '50',
      entry_lat: tenant.entry_lat?.toString() || '',
      entry_lng: tenant.entry_lng?.toString() || '',
      entry_radius: tenant.entry_radius?.toString() || '50',
      exit_lat: tenant.exit_lat?.toString() || '',
      exit_lng: tenant.exit_lng?.toString() || '',
      exit_radius: tenant.exit_radius?.toString() || '50',
      open_time: tenant.open_time || '',
      curfew_time: tenant.curfew_time || '',
      semester1_start: tenant.semester1_start ? tenant.semester1_start.split('T')[0] : '',
      semester1_end: tenant.semester1_end ? tenant.semester1_end.split('T')[0] : '',
      semester2_start: tenant.semester2_start ? tenant.semester2_start.split('T')[0] : '',
      semester2_end: tenant.semester2_end ? tenant.semester2_end.split('T')[0] : '',
      daily_readings_enabled: tenant.daily_readings_enabled != 0,
      radio_514_enabled: tenant.radio_514_enabled != 0
    });
    setShowForm(true); // Ensure form is shown for editing
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setMessage({ type: 'error', text: 'اسم السكن مطلوب' }); showSnackbar('اسم السكن مطلوب', 'error');
      return;
    }
    if (form.supervisor_ids.length === 0) {
      setMessage({ type: 'error', text: 'يجب اختيار مشرف واحد على الأقل' }); showSnackbar('يجب اختيار مشرف واحد على الأقل', 'error');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const body: any = {
        name: form.name.trim(),
        supervisor_ids: form.supervisor_ids,
        priest_ids: form.priest_ids,
        is_active: form.is_active ? 1 : 0,
        location_radius: 50,
      };
      if (form.location.trim()) body.location = form.location.trim();
      if (form.location_lat) body.location_lat = parseFloat(form.location_lat);
      if (form.location_lng) body.location_lng = parseFloat(form.location_lng);
      if (form.location_radius) body.location_radius = parseFloat(form.location_radius);
      if (form.entry_lat) body.entry_lat = parseFloat(form.entry_lat);
      if (form.entry_lng) body.entry_lng = parseFloat(form.entry_lng);
      if (form.entry_radius) body.entry_radius = parseFloat(form.entry_radius);
      if (form.exit_lat) body.exit_lat = parseFloat(form.exit_lat);
      if (form.exit_lng) body.exit_lng = parseFloat(form.exit_lng);
      if (form.exit_radius) body.exit_radius = parseFloat(form.exit_radius);
      if (form.open_time) body.open_time = form.open_time;
      if (form.curfew_time) body.curfew_time = form.curfew_time;
      if (form.semester1_start) body.semester1_start = form.semester1_start;
      if (form.semester1_end) body.semester1_end = form.semester1_end;
      if (form.semester2_start) body.semester2_start = form.semester2_start;
      if (form.semester2_end) body.semester2_end = form.semester2_end;
      if (isAdmin && form.bishop_id) body.bishop_id = form.bishop_id;
      if (isAdmin) {
        body.daily_readings_enabled = form.daily_readings_enabled ? 1 : 0;
        body.radio_514_enabled = form.radio_514_enabled ? 1 : 0;
      }

      if (editingTenant) {
        await request(`/api/tenants/${editingTenant.id}`, { method: 'PUT', body: JSON.stringify(body) });
        setMessage({ type: 'success', text: 'تم تحديث السكن بنجاح' }); showSnackbar('تم تحديث السكن بنجاح', 'success');
        await sendUpdateNotifications(form.name, 'تعديل بيانات السكن', form.supervisor_ids, form.priest_ids);
      } else {
        await request('/api/tenants', { method: 'POST', body: JSON.stringify(body) });
        setMessage({ type: 'success', text: 'تم إنشاء السكن بنجاح' }); showSnackbar('تم إنشاء السكن بنجاح', 'success');
        await sendUpdateNotifications(form.name, 'إنشاء السكن وتعيينكم كفريق مسؤول', form.supervisor_ids, form.priest_ids);
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ' }); showSnackbar(err.message || 'حدث خطأ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tenant: Tenant) => {
    setTogglingTenantId(tenant.id); // بدء حالة التحميل للزر
    try {
      const newStatus = Number(tenant.is_active) === 1 ? 0 : 1;
      const body: any = {
        ...tenant,
        supervisor_ids: tenant.supervisor_ids || [],
        priest_ids: tenant.priest_ids || [],
        is_active: newStatus,
      };
      // Remove null/undefined values (Zod .optional() only accepts undefined, not null)
      Object.keys(body).forEach(k => { if (body[k] === null || body[k] === undefined) delete body[k]; });

      const res = await request(`/api/tenants/${tenant.id}`, { 
        method: 'PUT', 
        body: JSON.stringify(body) 
      });

      if (res.success) {
        const actionLabel = newStatus === 1 ? 'تفعيل وتنشيط السكن' : 'إيقاف وتعطيل السكن';
        setMessage({ type: 'success', text: `تم ${newStatus === 1 ? 'تفعيل' : 'تعطيل'} السكن بنجاح.` }); showSnackbar(`تم ${newStatus === 1 ? 'تفعيل' : 'تعطيل'} السكن بنجاح`, 'success');
        
        // إرسال إشعار للفريق المسؤول عن الحالة الجديدة للسكن
        await sendUpdateNotifications(tenant.name, actionLabel, tenant.supervisor_ids, tenant.priest_ids);

        // تحديث الحالة محلياً فوراً لضمان تغير شكل الزر والكلمة مباشرة في الواجهة
        setTenants(prev => prev.map(t => 
          t.id === tenant.id ? { ...t, is_active: newStatus } : t
        ));
      }
      await fetchData();
    } catch (err: any) { // Catch and display error messages
      setMessage({ type: 'error', text: 'فشل تحديث حالة السكن' }); showSnackbar('فشل تحديث حالة السكن', 'error');
    } finally {
      setTogglingTenantId(null); // Reset loading state
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!await confirm({ message: `هل أنت متأكد من حذف السكن "${tenant.name}" بالكامل؟ هذا سيحذف كل البيانات المرتبطة به.`, type: 'danger' })) return;
    try {
      await request(`/api/tenants/${tenant.id}/force`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'تم حذف السكن وجميع بياناته' }); showSnackbar('تم حذف السكن وجميع بياناته', 'success');
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'فشل الحذف' }); showSnackbar('فشل الحذف', 'error');
    }
  };

  const toggleSelect = (arr: string[], id: string): string[] => {
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lg font-black text-slate-400">غير مصرح بالوصول</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Message */}
      {message && (
        <div className={`px-6 py-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
          <button onClick={() => setMessage(null)} className="mr-auto opacity-50 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab('tenants')}
          className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${
            tab === 'tenants' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.1]'
          }`}
        >
          <Building size={18} /> إدارة السكنات
        </button>
        {canManage && (
          <button
            onClick={() => setTab('roles')}
            className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${
              tab === 'roles' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.1]'
            }`}
          >
            <ShieldPlus size={18} /> الأدوار المخصصة
          </button>
        )}
      </div>

      {tab === 'roles' ? (
        <CustomRolesManager />
      ) : (
        <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">إدارة السكنات</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 font-bold mt-1">إنشاء وتعديل وتفعيل السكنات وتعيين المشرفين والكهنة</p>
        </div>
        <button onClick={openCreate} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all shadow-md flex items-center gap-2">
          <Plus size={18} /> إضافة سكن
        </button>
      </div>

      {/* Tenant Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
          <Building size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-lg font-bold text-slate-300">لا توجد سكنات بعد</p>
          <button onClick={openCreate} className="mt-4 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all">
            إضافة أول سكن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {tenants.map(tenant => (
            <div key={tenant.id} className={`bg-white dark:bg-card-dark rounded-[2.5rem] border shadow-sm overflow-hidden transition-all hover:shadow-md ${
              Number(tenant.is_active) === 1 ? 'border-slate-100 dark:border-white/10' : 'border-red-100 dark:border-red-500/30 opacity-75'
            }`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${Number(tenant.is_active) === 1 ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-red-100 dark:bg-red-500/10 text-red-500 dark:text-red-400'}`}>
                      <Building size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">{tenant.name}</h3>
                      {tenant.location && <p className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 mt-0.5"><MapPin size={12} />{tenant.location}</p>}
                    </div>
                  </div>
                  <button
                    disabled={togglingTenantId === tenant.id} // Disable button while toggling
                    onClick={() => handleToggleActive(tenant)}
                    className={`p-2 rounded-xl transition-all ${
                      Number(tenant.is_active) === 1 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' : 'text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}
                    title={Number(tenant.is_active) === 1 ? 'إيقاف السكن (Pause)' : 'تشغيل السكن (Play)'}
                  >
                    {Number(tenant.is_active) === 1 ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${
                    Number(tenant.is_active) === 1 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    {Number(tenant.is_active) === 1 ? 'مفعل' : 'معطل'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {new Date(tenant.created_at).toLocaleDateString('ar-EG')}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl">
                    <Shield size={14} className="text-emerald-500" />
                    <span>{tenant.supervisor_ids?.length || 0} مشرف</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl">
                    <Church size={14} className="text-indigo-500" />
                    <span>{tenant.priest_ids?.length || 0} كاهن</span>
                  </div>
                </div>

                {(tenant.apartment_count !== undefined || tenant.room_count !== undefined) && (
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300 mt-3">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl">
                      <Building size={14} className="text-amber-500" />
                      <span>{tenant.apartment_count ?? 0} شقة</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl">
                      <Users size={14} className="text-blue-500" />
                      <span>{tenant.room_count ?? 0} غرفة</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                      (tenant.total_capacity ?? 0) > 0
                        ? ((tenant.total_occupancy ?? 0) >= (tenant.total_capacity ?? 0) ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')
                        : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                    }`}>
                      <span>
                        {tenant.total_capacity ?? 0 > 0
                          ? `${tenant.total_occupancy ?? 0}/${tenant.total_capacity ?? 0} سرير`
                          : 'لا يوجد أسرة'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <button onClick={() => openEdit(tenant)} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-all">
                  <Edit3 size={14} /> تعديل
                </button>
                {isAdmin && (
                  <button onClick={() => handleDelete(tenant)} className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 transition-all">
                    <Trash2 size={14} /> حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TenantFormModal
        showForm={showForm}
        onClose={() => setShowForm(false)}
        form={form}
        onFormChange={(f) => setForm(f)}
        editingTenant={editingTenant}
        isAdmin={isAdmin}
        user={user}
        bishopSearchTerm={bishopSearchTerm}
        onBishopSearchChange={setBishopSearchTerm}
        supervisorSearchTerm={supervisorSearchTerm}
        onSupervisorSearchChange={setSupervisorSearchTerm}
        priestSearchTerm={priestSearchTerm}
        onPriestSearchChange={setPriestSearchTerm}
        filteredBishops={filteredBishops}
        filteredSupervisors={filteredSupervisors}
        filteredPriests={filteredPriests}
        saving={saving}
        onSave={handleSave}
        toggleSelect={toggleSelect}
      />
        </>
      )}
    </div>
  );
};
