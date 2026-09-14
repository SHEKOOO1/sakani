import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export function useEventTargeting() {
  const { request } = useApi();
  const queryClient = useQueryClient();
  const [targeting, setTargeting] = useState<Record<string, any>>({});
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ['events', 'targeting-data'],
    queryFn: async () => {
      const [
        tenantsRes, collegesRes, govsRes, churchesRes,
        bishopsRes, priestsRes, supervisorsRes, employeesRes, guardianRelRes
      ] = await Promise.all([
        request('/api/broadcasts/targets/tenants'),
        request('/api/broadcasts/targets/colleges'),
        request('/api/broadcasts/targets/governorates'),
        request('/api/broadcasts/targets/churches'),
        request('/api/broadcasts/targets/bishops'),
        request('/api/broadcasts/targets/priests'),
        request('/api/broadcasts/targets/supervisors'),
        request('/api/broadcasts/targets/employees'),
        request('/api/broadcasts/targets/guardian-relations'),
      ]);
      return {
        tenants: tenantsRes.data || [],
        colleges: collegesRes.data || [],
        governorates: govsRes.data || [],
        churches: churchesRes.data || [],
        bishops: bishopsRes.data || [],
        priests: priestsRes.data || [],
        supervisors: supervisorsRes.data || [],
        employees: employeesRes.data || [],
        guardianRelations: guardianRelRes.data || [],
      };
    },
    enabled: false,
    staleTime: 120000,
  });

  const toggleTarget = (key: string, value: string) => {
    setTargeting(prev => {
      const current = prev[key] as string[] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: next.length > 0 ? next : undefined };
    });
  };

  const toggleExclude = (field: string, excludeField: string) => {
    setTargeting(prev => {
      const willExclude = !prev[excludeField];
      return { ...prev, [excludeField]: willExclude, ...(willExclude ? { [field]: undefined } : {}) };
    });
  };

  const searchStudentsTarget = useCallback(async (q: string) => {
    if (q.length < 2) return [];
    const res = await request(`/api/broadcasts/targets/students?search=${encodeURIComponent(q)}`);
    return res.data || [];
  }, [request]);

  const estimateRecipients = useCallback(async (t: any) => {
    try {
      const res = await request('/api/broadcasts/recipients-count', {
        method: 'POST', body: JSON.stringify({ targeting: t }),
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

  return {
    targeting, setTargeting,
    tenants: data?.tenants ?? [],
    colleges: data?.colleges ?? [],
    governorates: data?.governorates ?? [],
    churches: data?.churches ?? [],
    bishops: data?.bishops ?? [],
    priests: data?.priests ?? [],
    supervisors: data?.supervisors ?? [],
    employees: data?.employees ?? [],
    guardianRelations: data?.guardianRelations ?? [],
    recipientCount, toggleTarget, toggleExclude,
    searchStudentsTarget, estimateRecipients,
    loadTargetData: () => queryClient.invalidateQueries({ queryKey: ['events', 'targeting-data'] }),
    resetTargeting: () => { setTargeting({}); setRecipientCount(null); },
  };
}
