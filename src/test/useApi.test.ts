// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ───────────────────────────────────────────────────────────────
// useApi error handling:
//  - distinguish offline vs unreachable vs timeout vs server vs 401/403/5xx
//  - never present every failure as "check your internet"
//  - never silently swallow a timeout (was returning undefined)
//  - auto-retry idempotent reads only; NEVER retry writes (payments/saves)
// ───────────────────────────────────────────────────────────────

const logout = vi.hoisted(() => vi.fn());
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ logout, user: null }),
}));

import { useApi, isApiError, getApiErrorMessage, isTransientApiError, ApiError } from '../hooks/useApi';

const jsonResponse = (status: number, body: any) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  blob: async () => new Blob(),
});

// Mock fetch that rejects with AbortError when the request signal aborts.
const abortableFetch = () => vi.fn((_url: string, init: any) => new Promise((_resolve, reject) => {
  const signal: AbortSignal | undefined = init?.signal;
  const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  if (signal?.aborted) return fail();
  signal?.addEventListener('abort', fail, { once: true });
}));

const setup = () => renderHook(() => useApi());

let originalFetch: typeof fetch;
beforeEach(() => {
  logout.mockClear();
  originalFetch = global.fetch;
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => { global.fetch = originalFetch; });

describe('useApi error classification', () => {
  it('maps a transport TypeError while online to "unreachable" (not "no internet")', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as any;
    const { result } = setup();
    await act(async () => {
      await expect(result.current.request('/api/rooms', { retry: 0 })).rejects.toMatchObject({ kind: 'unreachable' });
    });
    const err = new ApiError('x', 'unreachable');
    expect(getApiErrorMessage(err)).not.toContain('تحقق من اتصالك بالإنترنت');
    expect(getApiErrorMessage(err)).toContain('الخادم');
  });

  it('maps a failure while offline to "offline"', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as any;
    const { result } = setup();
    await act(async () => {
      await expect(result.current.request('/api/rooms', { retry: 0 })).rejects.toMatchObject({ kind: 'offline' });
    });
  });

  it('throws a timeout error instead of silently returning undefined', async () => {
    global.fetch = abortableFetch() as any;
    const { result } = setup();
    let thrown: any;
    await act(async () => {
      try { await result.current.request('/api/rooms', { retry: 0, timeoutMs: 10 }); }
      catch (e) { thrown = e; }
    });
    expect(isApiError(thrown)).toBe(true);
    expect(thrown.kind).toBe('timeout');
    expect(getApiErrorMessage(thrown)).toContain('وقت');
  });

  it('maps 401 to "unauthorized" and triggers logout', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { success: false, message: 'no' })) as any;
    const { result } = setup();
    await act(async () => {
      await expect(result.current.request('/api/rooms', { retry: 0 })).rejects.toMatchObject({ kind: 'unauthorized' });
    });
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('maps 403 to "forbidden" and does not log out', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, { success: false, message: 'no' })) as any;
    const { result } = setup();
    await act(async () => {
      await expect(result.current.request('/api/rooms', { retry: 0 })).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
    });
    expect(logout).not.toHaveBeenCalled();
  });

  it('maps 503 to "server_unavailable" and 500 to "server"', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(503, { success: false })) as any;
    const a = setup();
    await act(async () => {
      await expect(a.result.current.request('/api/x', { retry: 0 })).rejects.toMatchObject({ kind: 'server_unavailable' });
    });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(500, { success: false, message: 'boom', requestId: 'r1' })) as any;
    const b = setup();
    await act(async () => {
      await expect(b.result.current.request('/api/x', { retry: 0 })).rejects.toMatchObject({ kind: 'server' });
    });
  });

  it('treats an HTML error page as "malformed"/server unavailable, not a JSON response', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, '<!doctype html><html></html>')) as any;
    const { result } = setup();
    await act(async () => {
      await expect(result.current.request('/api/x', { retry: 0 })).rejects.toMatchObject({ kind: 'malformed' });
    });
  });
});

describe('useApi retry policy', () => {
  it('retries an idempotent GET on a transient failure until it succeeds', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: [] }));
    global.fetch = fetchMock as any;
    const { result } = setup();
    let data: any;
    await act(async () => { data = await result.current.request('/api/rooms'); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data).toEqual({ success: true, data: [] });
  });

  it('NEVER retries a write (POST) — prevents duplicate payments/saves', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    global.fetch = fetchMock as any;
    const { result } = setup();
    await act(async () => {
      await expect(result.current.request('/api/payments', { method: 'POST', body: '{}' })).rejects.toMatchObject({ kind: 'unreachable' });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-transient errors (e.g. 403)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { success: false }));
    global.fetch = fetchMock as any;
    const { result } = setup();
    await act(async () => {
      await expect(result.current.request('/api/rooms')).rejects.toMatchObject({ kind: 'forbidden' });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies transient kinds correctly', () => {
    expect(isTransientApiError(new ApiError('x', 'unreachable'))).toBe(true);
    expect(isTransientApiError(new ApiError('x', 'timeout'))).toBe(true);
    expect(isTransientApiError(new ApiError('x', 'server_unavailable'))).toBe(true);
    expect(isTransientApiError(new ApiError('x', 'forbidden'))).toBe(false);
    expect(isTransientApiError(new Error('plain'))).toBe(false);
  });
});
