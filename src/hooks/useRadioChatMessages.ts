import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';
import type { ChatMessage } from '../components/radio/types';

export function useRadioChatMessages(refetchInterval = 60000) {
  const { request } = useApi();

  return useQuery<ChatMessage[]>({
    queryKey: ['radio', 'chat', 'messages'],
    queryFn: async () => {
      const res = await request('/api/radio/chat/messages');
      return res?.success ? (res.data || []) : [];
    },
    refetchInterval,
    staleTime: 30000,
  });
}
