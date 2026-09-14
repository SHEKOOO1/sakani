import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export function useRadioBroadcasts() {
  const { request } = useApi();

  return useQuery<any[]>({
    queryKey: ['radio', 'broadcasts', 'public'],
    queryFn: async () => {
      const res = await request('/api/radio/broadcasts/public');
      return res.success ? (res.data || []) : [];
    },
    staleTime: 120000,
  });
}

export function useRadioReminders() {
  const { request } = useApi();

  return useQuery<Set<string>>({
    queryKey: ['radio', 'broadcasts', 'reminders'],
    queryFn: async () => {
      const res = await request('/api/radio/broadcasts/reminders');
      return new Set(res.success ? (res.data || []) : []);
    },
    staleTime: 120000,
  });
}

export function useToggleReminder() {
  const { request } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (broadcastId: string) => {
      const res = await request(`/api/radio/broadcasts/${broadcastId}/reminder`, { method: 'POST' });
      return { broadcastId, active: res.data?.active ?? false };
    },
    onSuccess: ({ broadcastId, active }) => {
      queryClient.setQueryData<Set<string>>(['radio', 'broadcasts', 'reminders'], (prev) => {
        const next = new Set(prev);
        if (active) next.add(broadcastId);
        else next.delete(broadcastId);
        return next;
      });
    },
  });
}

export function useLiveNotification() {
  const { request } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await request('/api/radio/live/subscribe', { method: 'POST' });
      return res?.success ? res.data?.active ?? false : false;
    },
    onSuccess: (active) => {
      queryClient.setQueryData(['radio', 'live-notification'], active);
    },
  });
}

export function useLiveNotificationStatus(enabled: boolean) {
  const { request } = useApi();

  return useQuery({
    queryKey: ['radio', 'live-notification'],
    queryFn: async () => {
      const res = await request('/api/radio/live/subscribe');
      return res?.success ? res.data?.active ?? false : false;
    },
    enabled,
    staleTime: 60000,
  });
}
