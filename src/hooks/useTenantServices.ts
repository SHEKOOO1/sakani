import { useApiQuery } from './useApiQuery';

export interface TenantServices {
  laundry_enabled: boolean;
  restaurant_enabled: boolean;
  canteen_enabled: boolean;
}

const DEFAULT_SERVICES: TenantServices = {
  laundry_enabled: true,
  restaurant_enabled: true,
  canteen_enabled: true,
};

export function useTenantServices(): TenantServices {
  const { data } = useApiQuery<{ success: boolean; data: TenantServices }>(
    ['tenant-services'],
    '/api/tenants/services',
    {},
    { staleTime: 60_000, retry: 1 }
  );
  return data?.data ?? DEFAULT_SERVICES;
}
