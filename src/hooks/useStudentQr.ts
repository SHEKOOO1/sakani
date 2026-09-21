import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';

// جلب رمز QR مُوقّع من الخادم (لا يُعرض معرف الطالب الخام أبداً).
export function useStudentQr(studentId?: string | null) {
  const { request } = useApi();
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const data = await request(`/api/students/${studentId}/attendance/qr`);
      setQr((data as any)?.data?.qr || null);
    } catch {
      setQr(null);
    } finally {
      setLoading(false);
    }
  }, [studentId, request]);

  useEffect(() => { refresh(); }, [refresh]);

  return { qr, loading, refresh };
}