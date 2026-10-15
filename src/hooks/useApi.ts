import { useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Classified API failures. The UI must be able to tell a real network outage
 * apart from a down server, an expired session, a permission denial, a server
 * error, or a rejected request — instead of blaming the user's internet for
 * every failure.
 */
export type ApiErrorKind =
  | 'offline'          // browser reports no connectivity
  | 'unreachable'      // fetch failed while online: server down, DNS, CORS or TLS
  | 'timeout'          // request exceeded the client timeout
  | 'server_unavailable' // 502/503/504 (proxy or app not ready)
  | 'unauthorized'     // 401
  | 'forbidden'        // 403
  | 'not_found'        // 404
  | 'rate_limited'     // 429
  | 'client'           // other 4xx
  | 'server'           // other 5xx
  | 'malformed';       // response was not valid JSON / not an API response

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  requestId?: string;

  constructor(message: string, kind: ApiErrorKind, extra?: { status?: number; code?: string; requestId?: string }) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = extra?.status;
    this.code = extra?.code;
    this.requestId = extra?.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Errors that are safe to retry automatically — and only for idempotent reads. */
const TRANSIENT_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'offline',
  'unreachable',
  'timeout',
  'server_unavailable',
  'server',
]);

export function isTransientApiError(error: unknown): error is ApiError {
  return isApiError(error) && TRANSIENT_KINDS.has(error.kind);
}

/** Safe, user-facing message derived from the failure kind. */
export function getApiErrorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  if (!isApiError(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }
  switch (error.kind) {
    case 'offline':
      return 'لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى.';
    case 'unreachable':
      return 'تعذّر الوصول إلى الخادم. قد يكون الخادم متوقفًا مؤقتًا أو هناك مشكلة في الاتصال، وليس بالضرورة انقطاع الإنترنت.';
    case 'timeout':
      return 'استغرق الخادم وقتًا أطول من المتوقع. تحقق من الاتصال وحاول مرة أخرى.';
    case 'server_unavailable':
      return 'الخادم غير متاح مؤقتًا. حاول بعد قليل.';
    case 'unauthorized':
      return error.message || 'انتهت الجلسة. سجّل الدخول من جديد.';
    case 'forbidden':
      return 'لا تملك صلاحية تنفيذ هذا الإجراء.';
    case 'rate_limited':
      return 'محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.';
    case 'server':
      return error.message || 'حدث خطأ في الخادم. لو تكرر، تواصل مع الدعم.';
    case 'malformed':
      return 'استجابة غير صالحة من الخادم.';
    default:
      return error.message || fallback;
  }
}

function classifyStatus(status: number, message: string, code?: string, requestId?: string): ApiError {
  if (status === 401) return new ApiError(message || 'انتهت الجلسة', 'unauthorized', { status, code, requestId });
  if (status === 403) return new ApiError(message || 'ممنوع', 'forbidden', { status, code, requestId });
  if (status === 404) return new ApiError(message || 'غير موجود', 'not_found', { status, code, requestId });
  if (status === 429) return new ApiError(message || 'محاولات كثيرة', 'rate_limited', { status, code, requestId });
  if (status === 502 || status === 503 || status === 504) {
    return new ApiError(message || 'الخادم غير متاح مؤقتًا', 'server_unavailable', { status, code, requestId });
  }
  if (status >= 500) return new ApiError(message || 'حدث خطأ في الخادم', 'server', { status, code, requestId });
  return new ApiError(message || 'حدث خطأ في الطلب', 'client', { status, code, requestId });
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export interface ApiOptions extends RequestInit {
  responseType?: 'json' | 'blob';
  /** Max automatic retries. Defaults to 2 for idempotent reads, 0 for writes. */
  retry?: number;
  /** Client timeout in ms. Defaults to 15000. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_BACKOFF_MS = 400;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useApi() {
  const { logout, user } = useAuth();

  const logoutRef = useRef(logout);
  const userRef = useRef(user);
  useEffect(() => { logoutRef.current = logout; }, [logout]);
  useEffect(() => { userRef.current = user; }, [user]);

  const request = useCallback(async (url: string, options: ApiOptions = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    // Only idempotent requests may be retried automatically. Mutations
    // (payments, saves, financial operations) are NEVER retried by this layer
    // so a flaky connection can never double-charge or double-post.
    const idempotent = method === 'GET' || method === 'HEAD';
    const maxRetries = options.retry ?? (idempotent ? 2 : 0);

    const doFetch = async () => {
      const headers = { ...options.headers } as any;

      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      if (userRef.current?.tenantId) {
        headers['X-Tenant-Id'] = userRef.current.tenantId;
      }

      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      let timedOut = false;
      const onAbort = () => { timedOut = true; };
      // If the caller passed their own signal (e.g. component unmount), honour it.
      const externalSignal = options.signal as AbortSignal | undefined;
      const onExternalAbort = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
      controller.signal.addEventListener('abort', onAbort, { once: true });

      try {
        const response = await fetch(url, { ...options, headers, credentials: 'include', signal: controller.signal });

        let data: any;
        if (options.responseType === 'blob') {
          data = await response.blob();
        } else if (response.status !== 204) {
          const text = await response.text();
          if (typeof text === 'string' && text.trim().toLowerCase().startsWith('<!doctype html>')) {
            // The request reached *something* that answered with an HTML page
            // (a proxy error page or the SPA) — not our JSON API.
            throw new ApiError('الخادم غير متاح حاليًا', response.status >= 500 ? 'server_unavailable' : 'malformed', { status: response.status });
          }
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            throw new ApiError('استجابة غير صالحة من الخادم', 'malformed', { status: response.status });
          }
        } else {
          data = {};
        }

        if (response.status === 401) {
          if (url.includes('/api/auth/login')) {
            throw new ApiError(data?.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة', 'unauthorized', { status: 401, code: data?.code });
          }
          logoutRef.current();
          if (typeof window !== 'undefined') window.location.href = '/';
          throw new ApiError('انتهت الجلسة', 'unauthorized', { status: 401, code: data?.code });
        }

        if (!response.ok) {
          let message = data?.message;
          let requestId = data?.requestId;
          if (response.status >= 500 && requestId) {
            message = `${message || 'حدث خطأ في الخادم'} (رمز: ${requestId})`;
          }
          throw classifyStatus(response.status, message, data?.code, requestId);
        }

        return data;
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          // External abort (caller cancelled) must be distinguishable from our
          // own timeout so callers don't treat a deliberate cancel as failure.
          if (!timedOut && externalSignal?.aborted) {
            throw new ApiError('تم إلغاء الطلب', 'malformed', {});
          }
          throw new ApiError('استغرق الخادم وقتًا أطول من المتوقع', 'timeout', {});
        }
        if (error.name === 'TypeError') {
          // fetch only rejects with TypeError for transport-level failures:
          // server unreachable, DNS failure, CORS rejection, or blocked mixed
          // content. "no internet" is a different, detectable condition.
          if (isBrowserOffline()) {
            throw new ApiError('لا يوجد اتصال بالإنترنت', 'offline', {});
          }
          throw new ApiError('تعذّر الوصول إلى الخادم', 'unreachable', {});
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
        controller.signal.removeEventListener('abort', onAbort);
        if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
      }
    };

    let attempt = 0;
    let lastError: any;
    while (attempt <= maxRetries) {
      try {
        return await doFetch();
      } catch (err) {
        lastError = err;
        // Never auto-retry a cancelled request, an auth/permission error, or a
        // non-idempotent write.
        const retryable = idempotent && isTransientApiError(err) && err.kind !== 'malformed';
        if (!retryable || attempt >= maxRetries) throw err;
        await delay(RETRY_BACKOFF_MS * (attempt + 1));
        attempt++;
      }
    }
    throw lastError;
  }, []);

  return { request };
}
