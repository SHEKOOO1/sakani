import React, { useState, useEffect, useCallback, useRef } from 'react';

import { Plus, Edit3, Trash2, Eye, EyeOff, Send } from 'lucide-react';
import { io } from 'socket.io-client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { BroadcastFormModal } from './broadcast/BroadcastFormModal';
import { PrivateMessageModal } from './broadcast/PrivateMessageModal';

interface Targeting {
  tenants?: string[];
  roles?: string[];
  bishops?: string[];
  priests?: string[];
  supervisors?: string[];
  employees?: string[];
  students?: string[];
  colleges?: string[];
  majors?: string[];
  governorates?: string[];
  churches?: string[];
  guardian_types?: string[];
  sibling_genders?: string[];
  parent_gender?: 'father' | 'mother' | null;
  graduates_only?: boolean;
  graduate_parents_only?: boolean;
  selected_student_parents?: boolean;
  exclude_tenants?: boolean;
  exclude_colleges?: boolean;
  exclude_governorates?: boolean;
  exclude_churches?: boolean;
  exclude_bishops?: boolean;
  exclude_priests?: boolean;
  exclude_supervisors?: boolean;
  exclude_employees?: boolean;
  exclude_students?: boolean;
  exclude_parents?: boolean;
}

export function BroadcastManagement() {
  const { request } = useApi();
  const { hasPermission } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const canSend = hasPermission(AppPermission.SEND_BROADCAST);

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [displayType, setDisplayType] = useState<'news' | 'messages' | 'both'>('both');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [targeting, setTargeting] = useState<Targeting>({});
  const [attachments, setAttachments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Target data
  const [tenants, setTenants] = useState<any[]>([]);
  const [colleges, setColleges] = useState<string[]>([]);
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [churches, setChurches] = useState<string[]>([]);
  const [bishops, setBishops] = useState<any[]>([]);
  const [priests, setPriests] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [guardianRelations, setGuardianRelations] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showPrivate, setShowPrivate] = useState(false);
  const [privateSaving, setPrivateSaving] = useState(false);

  const handleToggleVisibility = async (id: string, broadcast: any) => {
    try {
      const isHidden = broadcast.visible_in_ticker === 0 && broadcast.visible_in_messages === 0;
      const res = await request(`/api/broadcasts/${id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ hide_from: 'both' }),
      });
      if (res?.data) {
        setBroadcasts(prev => prev.map(b =>
          b.id === id ? { ...b, ...res.data } : b
        ));
        showSnackbar(isHidden ? 'تم إظهار الإعلان' : 'تم إخفاء الإعلان من العرض', 'success');
      }
    } catch (err: any) {
      showSnackbar(err?.message || 'فشل تحديث الرؤية', 'error');
    }
  };

  const mountedRef = useRef(true);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await request('/api/broadcasts');
      if (!mountedRef.current) return;
      setBroadcasts(res.data || []);
    } catch {} finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [request]);

  const loadTargetData = useCallback(async (tenantIds?: string[]) => {
    try {
      const tenantQuery = tenantIds?.length ? `?tenant_ids=${tenantIds.join(',')}` : '';

      const [tenantsRes, collegesRes, govsRes, churchesRes, bishopsRes, priestsRes, supervisorsRes, employeesRes, guardianRelRes] = await Promise.all([
        request('/api/broadcasts/targets/tenants'),
        request(`/api/broadcasts/targets/colleges${tenantQuery}`),
        request(`/api/broadcasts/targets/governorates${tenantQuery}`),
        request(`/api/broadcasts/targets/churches${tenantQuery}`),
        request(`/api/broadcasts/targets/bishops${tenantQuery}`),
        request(`/api/broadcasts/targets/priests${tenantQuery}`),
        request(`/api/broadcasts/targets/supervisors${tenantQuery}`),
        request(`/api/broadcasts/targets/employees${tenantQuery}`),
        request(`/api/broadcasts/targets/guardian-relations${tenantQuery}`),
      ]);
      if (!mountedRef.current) return;
      if (tenantsRes.data) setTenants(tenantsRes.data);
      if (collegesRes.data) setColleges(collegesRes.data);
      if (govsRes.data) setGovernorates(govsRes.data);
      if (churchesRes.data) setChurches(churchesRes.data);
      if (bishopsRes.data) setBishops(bishopsRes.data);
      if (priestsRes.data) setPriests(priestsRes.data);
      if (supervisorsRes.data) setSupervisors(supervisorsRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data);
      if (guardianRelRes.data) setGuardianRelations(guardianRelRes.data);
    } catch {}
  }, [request]);

  useEffect(() => {
    mountedRef.current = true;
    fetchBroadcasts();
    loadTargetData();
    return () => { mountedRef.current = false; };
  }, [fetchBroadcasts, loadTargetData]);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socket.on('broadcast-visibility-changed', () => {
      fetchBroadcasts();
    });
    return () => { socket.disconnect(); };
  }, [fetchBroadcasts]);

  // Re-fetch target data when tenant selection changes
  useEffect(() => {
    const selectedTenants = targeting.tenants;
    const timer = setTimeout(() => {
      loadTargetData(selectedTenants?.length ? selectedTenants : undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [targeting.tenants, loadTargetData]);

  // Filter items by selected tenants (cascading filter)
  const filterByTenant = useCallback((items: any[], tenantIdField: string = 'tenant_id') => {
    const selectedTenants = targeting.tenants;
    if (!selectedTenants || selectedTenants.length === 0) return items;
    return items.filter((item: any) => selectedTenants.includes(item[tenantIdField]));
  }, [targeting.tenants]);

  const filteredEmployees = filterByTenant(employees);
  const filteredSupervisors = filterByTenant(supervisors);
  const filteredPriests = filterByTenant(priests);

  const hasTenantFilter = (targeting.tenants?.length ?? 0) > 0;

  // Estimate recipients
  const estimateRecipients = useCallback(async (t: Targeting) => {
    try {
      const res = await request('/api/broadcasts/recipients-count', {
        method: 'POST',
        body: JSON.stringify({ targeting: t }),
      });
      setRecipientCount(res.data?.count ?? null);
    } catch { setRecipientCount(null); }
  }, [request]);

  useEffect(() => {
    if (Object.keys(targeting).length > 0) {
      const timer = setTimeout(() => estimateRecipients(targeting), 500);
      return () => clearTimeout(timer);
    }
  }, [targeting]);

  const BOOLEAN_TARGET_KEYS = new Set(['graduates_only', 'graduate_parents_only', 'selected_student_parents']);

  const toggleTarget = (key: keyof Targeting, value: string) => {
    if (BOOLEAN_TARGET_KEYS.has(key)) {
      setTargeting(prev => ({ ...prev, [key]: !(prev as any)[key] }));
      return;
    }
    setTargeting(prev => {
      const current = prev[key] as string[] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: next.length > 0 ? next : undefined };
    });
  };

  // عند الضغط على العين (exclude): نمسح القيم المختارة ونفعّل الاستثناء
  const toggleExclude = (field: string, excludeField: string) => {
    setTargeting(prev => {
      const willExclude = !(prev as any)[excludeField];
      return {
        ...prev,
        [excludeField]: willExclude,
        ...(willExclude ? { [field]: undefined } : {})
      };
    });
  };

  const searchStudents = useCallback(async (q: string) => {
    if (q.length < 2) return [];
    const tenants = targeting.tenants;
    let url = `/api/broadcasts/targets/students?search=${encodeURIComponent(q)}`;
    if (tenants?.length) {
      url += `&tenant_ids=${tenants.join(',')}`;
    }
    const res = await request(url);
    return res.data || [];
  }, [request, targeting.tenants]);

  const searchParents = useCallback(async (q: string) => {
    if (q.length < 2) return [];
    const tenants = targeting.tenants;
    let url = `/api/broadcasts/targets/parents?search=${encodeURIComponent(q)}`;
    if (tenants?.length) {
      url += `&tenant_ids=${tenants.join(',')}`;
    }
    const res = await request(url);
    return res.data || [];
  }, [request, targeting.tenants]);

  const handleSendPrivate = async (payload: { recipient_user_id: string; title: string; content: string; to_parents: boolean }) => {
    setPrivateSaving(true);
    try {
      const res = await request('/api/broadcasts/private', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showSnackbar(res?.message || 'تم إرسال الرسالة الخاصة', 'success');
      setShowPrivate(false);
      fetchBroadcasts();
    } catch (err: any) {
      showSnackbar(err?.message || 'فشل إرسال الرسالة الخاصة', 'error');
    } finally {
      setPrivateSaving(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setPriority('normal');
    setDisplayType('both');
    setStartAt('');
    setEndAt('');
    setTargeting({});
    setAttachments([]);
    setEditing(null);
    setRecipientCount(null);
  };

  const openEdit = (b: any) => {
    setEditing(b);
    setTitle(b.title);
    setContent(b.content);
    setPriority(b.priority);
    setDisplayType(b.display_type);
    setStartAt(b.start_at ? b.start_at.slice(0, 16) : '');
    setEndAt(b.end_at ? b.end_at.slice(0, 16) : '');
    setTargeting(b.targeting || {});
    setAttachments(b.attachments || []);
    setShowForm(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await request('/api/broadcasts/upload', {
        method: 'POST',
        body: formData,
        headers: {},
      });
      if (res.data) {
        setAttachments(prev => [...prev, {
          id: Date.now().toString(),
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'voice' : 'file',
          url: res.data.url,
          original_name: file.name,
          size: file.size,
        }]);
      }
    } catch {} finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      let broadcastId: string;

      if (editing) {
        await request(`/api/broadcasts/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title, content, priority, display_type: displayType,
            start_at: startAt || null, end_at: endAt || null, targeting,
          }),
        });
        broadcastId = editing.id;
      } else {
        const res = await request('/api/broadcasts', {
          method: 'POST',
          body: JSON.stringify({
            title, content, priority, display_type: displayType,
            start_at: startAt || null, end_at: endAt || null, targeting,
          }),
        });
        broadcastId = res.data?.id;
        if (!broadcastId) throw new Error('No id returned');
      }

      // Save new attachments
      for (const att of attachments) {
        if (!att.broadcast_id) {
          await request(`/api/broadcasts/${broadcastId}/attachments`, {
            method: 'POST',
            body: JSON.stringify({
              type: att.type,
              url: att.url,
              original_name: att.original_name,
              size: att.size,
            }),
          });
        }
      }

      resetForm();
      setShowForm(false);
      fetchBroadcasts();
    } catch {} finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ message: 'هل أنت متأكد من حذف هذا الإعلان؟', type: 'danger' })) return;
    try {
      await request(`/api/broadcasts/${id}`, { method: 'DELETE' });
      fetchBroadcasts();
    } catch {}
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    important: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    normal: 'bg-neon-primary/10 text-neon-primary border-neon-primary/20',
  };

  const priorityLabels: Record<string, string> = {
    urgent: 'عاجل', important: 'مهم', normal: 'عادي',
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">إدارة الإعلانات</h2>
          <p className="text-sm text-slate-400 mt-1">إرسال وإدارة الإعلانات والرسائل</p>
        </div>
        {canSend && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowPrivate(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm">
              <Send size={16} />
              رسالة خاصة
            </button>
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-neon-primary text-black font-bold rounded-xl hover:bg-neon-primary/90 transition-colors text-sm">
              <Plus size={16} />
              إعلان جديد
            </button>
          </div>
        )}
      </div>

      <BroadcastFormModal
        isOpen={showForm}
        onClose={() => { resetForm(); setShowForm(false); }}
        editing={editing}
        title={title}
        onTitleChange={setTitle}
        content={content}
        onContentChange={setContent}
        priority={priority}
        onPriorityChange={setPriority}
        displayType={displayType}
        onDisplayTypeChange={setDisplayType}
        startAt={startAt}
        onStartAtChange={setStartAt}
        endAt={endAt}
        onEndAtChange={setEndAt}
        targeting={targeting}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        recipientCount={recipientCount}
        saving={saving}
        onSave={handleSubmit}
        onFileUpload={handleFileUpload}
        tenants={tenants}
        colleges={colleges}
        governorates={governorates}
        churches={churches}
        bishops={bishops}
        supervisors={supervisors}
        employees={employees}
        guardianRelations={guardianRelations}
        filteredEmployees={filteredEmployees}
        filteredSupervisors={filteredSupervisors}
        filteredPriests={filteredPriests}
        hasTenantFilter={hasTenantFilter}
        toggleTarget={toggleTarget}
        toggleExclude={toggleExclude}
        searchStudents={searchStudents}
      />

      <PrivateMessageModal
        isOpen={showPrivate}
        onClose={() => setShowPrivate(false)}
        searchStudents={searchStudents}
        searchParents={searchParents}
        saving={privateSaving}
        onSend={handleSendPrivate}
      />

      {/* Broadcasts list */}
      <div className="space-y-3">
        {broadcasts.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            لا توجد إعلانات مسبقة
          </div>
        ) : (
          broadcasts.map(b => (
            <div key={b.id} className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColors[b.priority] || priorityColors.normal}`}>
                      {priorityLabels[b.priority] || 'عادي'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                      {b.display_type === 'both' ? 'شريط + رسائل' : b.display_type === 'news' ? 'شريط أخبار' : 'رسائل'}
                    </span>
                    {b.status === 'draft' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        مسودة
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{b.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{b.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="font-bold">{b.sender_name || 'أنت'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[9px]">
                      {b.sender_role === 'admin' ? 'مدير التطبيق' :
                       b.sender_role === 'bishop' ? 'أسقف' :
                       b.sender_role === 'priest' ? 'كاهن' :
                       b.sender_role === 'supervisor' ? 'مشرف' :
                       b.sender_role === 'employee' ? 'موظف' : b.sender_role}
                    </span>
                    <span>•</span>
                    <span>{new Date(b.created_at).toLocaleDateString('ar-SA')}</span>
                    {b.start_at && <span>من {new Date(b.start_at).toLocaleDateString('ar-SA')}</span>}
                    {b.end_at && <span>إلى {new Date(b.end_at).toLocaleDateString('ar-SA')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(b)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-neon-primary transition-colors">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleToggleVisibility(b.id, b)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      (b.visible_in_ticker == 0 && b.visible_in_messages == 0)
                        ? 'text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                    title={b.visible_in_ticker == 0 && b.visible_in_messages == 0 ? 'إظهار الإعلان' : 'إخفاء الإعلان من العرض'}>
                    {(b.visible_in_ticker == 0 && b.visible_in_messages == 0) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => handleDelete(b.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
