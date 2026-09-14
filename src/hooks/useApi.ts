import { useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useApi() {
  const { logout, user } = useAuth();

  const logoutRef = useRef(logout);
  const userRef = useRef(user);
  useEffect(() => { logoutRef.current = logout; }, [logout]);
  useEffect(() => { userRef.current = user; }, [user]);

  interface ApiOptions extends RequestInit {
    responseType?: 'json' | 'blob';
  }

  const request = useCallback(async (url: string, options: ApiOptions = {}) => {
    const headers = { ...options.headers } as any;

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (userRef.current?.tenantId) {
      headers['X-Tenant-Id'] = userRef.current.tenantId;
    }

    const controller = new AbortController();
    const TIMEOUT_MS = 15000;
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, headers, credentials: 'include', signal: controller.signal });
      
      let data;
      if (options.responseType === 'blob') {
          data = await response.blob();
      } else if (response.status !== 204) {
          const text = await response.text();
          if (typeof text === 'string' && text.trim().toLowerCase().startsWith('<!doctype html>')) {
            throw new Error('الخادم غير متاح حالياً');
          }
          try {
             data = text ? JSON.parse(text) : {};
          } catch (e) {
             throw new Error('استجابة غير صالحة من الخادم');
          }
      } else {
          data = {};
      }

      if (response.status === 401) {
        if (url.includes('/api/auth/login')) {
          throw new Error(data?.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }
        logoutRef.current();
        window.location.href = '/';
        throw new Error('انتهت الجلسة');
      }

      if (!response.ok) {
        throw new Error(data?.message || 'حدث خطأ في الخادم');
      }

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      if (error.name === 'TypeError') {
        throw new Error('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  return { request };
}
