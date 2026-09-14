import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

export function useEventCrud() {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [formData, setFormData] = useState({
    title: '', description: '', event_date: '', location: '',
    price: 0, is_paid: false, is_competition: false, winning_threshold: 100, max_score: 200,
    responsibleIds: [] as any[], location_lat: '', location_lng: '', location_radius: 50,
    qr_code: '', type: 'event', registration_deadline: '',
    available_payment_methods: [] as string[], max_participants: '',
  });
  const pendingEventRef = { current: null as string | null };

  const { data: events = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const resp = await request('/api/events');
      return resp.data || [];
    },
    staleTime: 30000,
  });

  const fetchBaseData = async (user: any) => {
    try {
      const calls: any[] = [request('/api/students')];
      if (user?.role !== 'student' && user?.role !== 'parent') {
        calls.push(request('/api/users'));
      }
      const [sRes, eRes] = await Promise.all(calls);
      setStudentsList(sRes.data || []);
      setEmployeeList((eRes?.data || []).filter((u: any) => u.role !== 'student'));
    } catch (err) { console.error(err); showSnackbar('فشل تحميل البيانات الأساسية', 'error'); }
  };

  const saveMutation = useMutation({
    mutationFn: async (opts: { isEdit: boolean; targeting: Record<string, any>; data?: any }) => {
      const d = opts.data?.formData || formData;
      const tg = opts.data?.targeting || opts.targeting;
      const url = opts.isEdit ? `/api/events/${selectedEvent.id}` : '/api/events';
      const body: any = {
        ...d,
        targeting: Object.keys(tg).length > 0 ? tg : undefined,
        type: d.type !== 'event' ? d.type : undefined,
        registration_deadline: d.registration_deadline || undefined,
        responsibleIds: d.responsibleIds.map((r: any) => r.id),
        available_payment_methods: d.available_payment_methods,
        location_lat: d.location_lat ? parseFloat(d.location_lat) : undefined,
        location_lng: d.location_lng ? parseFloat(d.location_lng) : undefined,
        max_participants: d.max_participants ? parseInt(d.max_participants) : undefined,
      };
      if (!opts.isEdit) body.qr_code = `EVENT-${Date.now()}`;
      await request(url, { method: opts.isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
    },
    onSuccess: (_: any, opts: any) => {
      setModalOpen(false);
      setIsEditing(false);
      setFormData({
        title: '', description: '', event_date: '', location: '',
        price: 0, is_paid: false, is_competition: false, winning_threshold: 100, max_score: 200,
        responsibleIds: [], location_lat: '', location_lng: '', location_radius: 50,
        qr_code: '', type: 'event', registration_deadline: '',
        available_payment_methods: [], max_participants: '',
      });
      setSelectedEvent(null);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      showSnackbar(opts.isEdit ? 'تم تعديل الفعالية بنجاح' : 'تم إنشاء الفعالية بنجاح', 'success');
    },
    onError: (err: any) => { showSnackbar(err.message || 'حدث خطأ أثناء الحفظ', 'error'); },
    onSettled: () => { setSaving(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => request(`/api/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSelectedEvent(null);
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const handleAddEvent = async (e: React.FormEvent, targeting: Record<string, any>, selectedPaymentMethods: string[], resetTargeting: () => void, resetForm: () => void) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveMutation.mutateAsync({ isEdit: false, targeting, data: { formData } });
      resetForm();
      resetTargeting();
    } catch {}
  };

  const handleUpdateEvent = async (e: React.FormEvent, targeting: Record<string, any>, resetTargeting: () => void, resetForm: () => void) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync({ isEdit: true, targeting, data: { formData } });
      resetForm();
      resetTargeting();
    } catch {}
  };

  const handleSave = async (targeting: Record<string, any>, modalData: any, resetTargeting: () => void) => {
    setSaving(true);
    try {
      await saveMutation.mutateAsync({ isEdit: isEditing, targeting, data: modalData });
      resetTargeting();
    } catch {}
  };

  const handleDeleteEvent = async (id: string) => {
    if (!await confirm({ message: 'هل أنت متأكد من حذف الفعالية بالكامل؟ سيتم حذف كل الاشتراكات والحضور والجلسات والمسابقات والمدفوعات.', type: 'danger' })) return;
    try { await deleteMutation.mutateAsync(id); } catch {}
  };

  const resetForm = () => {
    setFormData({
      title: '', description: '', event_date: '', location: '',
      price: 0, is_paid: false, is_competition: false, winning_threshold: 100, max_score: 200,
      responsibleIds: [], location_lat: '', location_lng: '', location_radius: 50,
      qr_code: '', type: 'event', registration_deadline: '',
      available_payment_methods: [], max_participants: '',
    });
  };

  return {
    events, loading, modalOpen, setModalOpen,
    selectedEvent, setSelectedEvent, isEditing, setIsEditing,
    formData, setFormData, saving,
    studentsList, employeeList, eventSearch, setEventSearch,
    pendingEventRef,
    fetchBaseData, fetchEvents: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
    handleAddEvent, handleUpdateEvent, handleSave, handleDeleteEvent,
    resetForm,
  };
}
