import { useQuery } from '@tanstack/react-query';

export function useStreamStatus() {
  const { data, isFetching } = useQuery({
    queryKey: ['radio', 'stream-status'],
    queryFn: async () => {
      try {
        await fetch('https://stream.radiojar.com/ps7z45v12k8uv', { method: 'HEAD', mode: 'no-cors' });
        return true;
      } catch {
        return false;
      }
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  return {
    streamOnline: data ?? false,
    streamChecking: isFetching,
    checkStream: () => {},
  };
}
