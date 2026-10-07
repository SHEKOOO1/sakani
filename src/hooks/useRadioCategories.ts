import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';
import type { Category } from '../components/radio/types';

export function useRadioCategories() {
  const { request } = useApi();

  return useQuery<Category[]>({
    queryKey: ['radio', 'categories'],
    queryFn: async () => {
      const res = await request('/api/radio/categories');
      return res.success ? (res.data || []) : [];
    },
    staleTime: 300000,
  });
}
