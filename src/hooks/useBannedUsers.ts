import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

interface BannedUser {
  id: string; user_id: string; user_name: string; user_email: string;
  user_role: string; banned_by: string; created_at: string; hidden_messages_count: number;
}

export function useBannedUsers() {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const queryClient = useQueryClient();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [bannedUserMessages, setBannedUserMessages] = useState<any[]>([]);
  const [loadingBannedMessages, setLoadingBannedMessages] = useState(false);

  const { data } = useQuery({
    queryKey: ['radio', 'admin', 'banned-users'],
    queryFn: async () => {
      const res = await request('/api/radio/chat/banned-users');
      if (res?.success) {
        return { users: res.data || [], canUnban: !!res.can_unban };
      }
      return { users: [], canUnban: false };
    },
    staleTime: 30000,
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await request(`/api/radio/chat/users/${userId}/unban`, { method: 'POST' });
      return res;
    },
    onSuccess: (res) => {
      if (res?.success) {
        showSnackbar(res.message || 'تم إلغاء الحظر واستعادة التعليقات', 'success');
        queryClient.invalidateQueries({ queryKey: ['radio', 'admin', 'banned-users'] });
        setExpandedUserId(null);
        setBannedUserMessages([]);
      } else {
        showSnackbar(res?.message || 'فشل إلغاء الحظر', 'error');
      }
    },
    onError: (err: any) => {
      showSnackbar(err.message || 'فشل إلغاء الحظر', 'error');
    },
  });

  const fetchBannedUserMessages = useCallback(async (userId: string) => {
    setLoadingBannedMessages(true);
    try {
      const res = await request(`/api/radio/chat/banned-users/${userId}/messages`);
      if (res?.success) setBannedUserMessages(res.data || []);
    } catch { }
    finally { setLoadingBannedMessages(false); }
  }, [request]);

  const handleUnban = useCallback(async (userId: string) => {
    const confirmed = await confirm({ message: 'هل أنت متأكد من إلغاء حظر هذا المستخدم؟ سيتم استعادة جميع تعليقاته.', type: 'danger' });
    if (!confirmed) return;
    unbanMutation.mutate(userId);
  }, [confirm, unbanMutation]);

  return {
    bannedUsers: data?.users ?? [],
    canUnban: data?.canUnban ?? false,
    expandedUserId, setExpandedUserId,
    bannedUserMessages, loadingBannedMessages,
    fetchBannedUsers: () => queryClient.invalidateQueries({ queryKey: ['radio', 'admin', 'banned-users'] }),
    fetchBannedUserMessages, handleUnban, setBannedUserMessages,
  };
}
