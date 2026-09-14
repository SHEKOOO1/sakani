import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

export function useEventSubscriptions(selectedEvent: any, fetchEvents: () => void, onEventUpdated?: (updated: any) => void) {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const queryClient = useQueryClient();
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [detailEvent, setDetailEvent] = useState<any>(null);
  const [mySubscription, setMySubscription] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscribePaymentMethods, setSubscribePaymentMethods] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [parentChildren, setParentChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [eventPayments, setEventPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery<any[]>({
    queryKey: ['events', selectedEvent?.id, 'subscriptions'],
    queryFn: async () => {
      const res = await request(`/api/events/${selectedEvent.id}/subscriptions`);
      return res.data || [];
    },
    enabled: !!selectedEvent,
    staleTime: 15000,
  });

  const fetchEventPayments = async (eventId: string) => {
    setPaymentsLoading(true);
    try {
      const res = await request(`/api/events/${eventId}/payments`);
      if (res.success) setEventPayments(res.data?.registrations || []);
    } catch (e) { console.error('Fetch event payments failed:', e); showSnackbar('فشل تحميل بيانات الدفع', 'error'); } finally {
      setPaymentsLoading(false);
    }
  };

  const sendPaymentReminderMutation = useMutation({
    mutationFn: (studentId: string) =>
      request(`/api/events/${selectedEvent.id}/payments/remind/${studentId}`, { method: 'POST' }),
    onSuccess: () => { showSnackbar('تم إرسال التذكير', 'success'); },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const toggleParentEnrollMutation = useMutation({
    mutationFn: () => {
      const newValue = !selectedEvent.parent_can_enroll;
      return request(`/api/events/${selectedEvent.id}/parent-enroll`, {
        method: 'PATCH',
        body: JSON.stringify({ parent_can_enroll: newValue }),
      }).then(() => newValue);
    },
    onSuccess: (newValue) => {
      onEventUpdated?.({ ...selectedEvent, parent_can_enroll: newValue ? 1 : 0 });
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      let receiptUrl = '';
      if (receiptFile) {
        setReceiptUploading(true);
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        const uploadRes = await request('/api/events/upload-receipt', {
          method: 'POST', body: formData, headers: {},
        });
        receiptUrl = uploadRes.data?.url || '';
        setReceiptUploading(false);
      }
      await request(`/api/events/${detailEvent.id}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({
          student_id: selectedChildId || undefined,
          payment_method_id: selectedPaymentMethod || undefined,
          receipt_image: receiptUrl || undefined,
        }),
      });
      const res = await request(`/api/events/${detailEvent.id}/my-subscription`);
      return res.data;
    },
    onSuccess: (data) => {
      showSnackbar('تم إرسال طلب الاشتراك بنجاح وسيتم إشعار المسؤولين', 'success');
      if (data) setMySubscription(data);
      setSelectedPaymentMethod('');
      setReceiptFile(null);
      setReceiptPreview('');
      fetchEvents();
    },
    onError: (err: any) => { showSnackbar(err.message || 'فشل إرسال طلب الاشتراك', 'error'); },
    onSettled: () => { setSubscriptionLoading(false); },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: () =>
      request(`/api/events/${detailEvent.id}/subscriptions/${mySubscription.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSnackbar('تم إلغاء الاشتراك', 'warning');
      setMySubscription(null);
      fetchEvents();
    },
    onError: (err: any) => { showSnackbar(err.message || 'فشل إلغاء الاشتراك', 'error'); },
  });

  const uploadPaymentMutation = useMutation({
    mutationFn: async () => {
      let receiptUrl = '';
      if (receiptFile) {
        setReceiptUploading(true);
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        const uploadRes = await request('/api/events/upload-receipt', {
          method: 'POST', body: formData, headers: {},
        });
        receiptUrl = uploadRes.data?.url || '';
        setReceiptUploading(false);
      }
      await request(`/api/events/${detailEvent.id}/subscriptions/${mySubscription.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          payment_method_id: selectedPaymentMethod,
          receipt_image: receiptUrl || undefined,
        }),
      });
      const res = await request(`/api/events/${detailEvent.id}/my-subscription`);
      return res.data;
    },
    onSuccess: (data) => {
      showSnackbar('تم إرسال إيصال الدفع', 'success');
      if (data) setMySubscription(data);
    },
    onError: (err: any) => { showSnackbar(err.message || 'فشل إرسال الدفع', 'error'); },
  });

  const handleSendPaymentReminder = (studentId: string) => {
    sendPaymentReminderMutation.mutate(studentId);
  };

  const handleToggleParentEnroll = () => {
    toggleParentEnrollMutation.mutate();
  };

  const handleSubscribeEvent = async () => {
    setSubscriptionLoading(true);
    try { await subscribeMutation.mutateAsync(); } catch {}
  };

  const handleCancelSubscription = async () => {
    if (!await confirm({ message: 'هل أنت متأكد من إلغاء الاشتراك في هذه الفعالية؟', type: 'danger' })) return;
    try { await cancelSubscriptionMutation.mutateAsync(); } catch {}
  };

  const handleUploadPayment = async () => {
    try { await uploadPaymentMutation.mutateAsync(); } catch {}
  };

  return {
    subscriptions, subscriptionsLoading,
    showEventDetail, setShowEventDetail,
    detailEvent, setDetailEvent,
    mySubscription, setMySubscription,
    subscriptionLoading,
    subscribePaymentMethods, setSubscribePaymentMethods,
    selectedPaymentMethod, setSelectedPaymentMethod,
    receiptFile, setReceiptFile,
    receiptPreview, setReceiptPreview,
    receiptUploading,
    parentChildren, setParentChildren,
    selectedChildId, setSelectedChildId,
    eventPayments, setEventPayments,
    paymentsLoading,
    fetchSubscriptions: (_eventId?: string) => queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'subscriptions'] }),
    fetchEventPayments,
    handleSendPaymentReminder,
    handleToggleParentEnroll,
    handleSubscribeEvent,
    handleCancelSubscription,
    handleUploadPayment,
  };
}
