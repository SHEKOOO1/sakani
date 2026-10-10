import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useApi } from './useApi';

export function useApiQuery<T = any>(
  queryKey: QueryKey,
  url: string,
  options: RequestInit = {},
  queryOptions: Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'> = {}
) {
  const { request } = useApi();

  return useQuery<T, Error, T, QueryKey>({
    queryKey,
    queryFn: () => request(url, options) as unknown as Promise<T>,
    ...queryOptions,
  });
}
