import { registerPlugin } from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
  Location,
  StartOptions,
  CallbackError,
  BackgroundGeolocationPermissionStatus,
} from '@capgo/background-geolocation';
import { isNativeApp, GeoError } from './location';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface BackgroundTrackingOptions {
  /** POST target for presence pings. Defaults to the API presence endpoint. */
  endpoint?: string;
  /** Text shown in the Android foreground-service notification. */
  backgroundMessage?: string;
  /** Title of that notification. */
  backgroundTitle?: string;
  /** Minimum metres of movement between updates. Defaults to 15. */
  distanceFilter?: number;
  /** Auth header injected into the presence POST when available. */
  getAuthHeader?: () => string | undefined | null;
}

let running = false;

/** True while the background watcher is active. */
export function isBackgroundTracking(): boolean {
  return running;
}

async function ensureBackgroundPermission(): Promise<boolean> {
  try {
    const status: BackgroundGeolocationPermissionStatus = await BackgroundGeolocation.checkPermissions();
    if (status.backgroundLocation === 'granted' || status.backgroundLocation === 'always') {
      return true;
    }
    const requested = await BackgroundGeolocation.requestPermissions({
      permissions: ['location', 'backgroundLocation', 'notification'],
    });
    return requested.backgroundLocation === 'granted' || requested.backgroundLocation === 'always';
  } catch {
    return false;
  }
}

async function sendPresence(
  location: Location,
  endpoint: string,
  getAuthHeader?: () => string | undefined | null,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = getAuthHeader?.();
  if (auth) headers.Authorization = auth;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy,
      }),
    });
  } catch {
    // Best-effort: background pings are dropped when offline and retried on the
    // next provider update, mirroring the plugin's own delivery semantics.
  }
}

/**
 * Start native background location updates. No-op on web/PWA — the browser
 * cannot track reliably in the background, so foreground `watchFixes` is used
 * there instead.
 *
 * Returns true when tracking actually started.
 */
export async function startBackgroundTracking(options: BackgroundTrackingOptions = {}): Promise<boolean> {
  if (!isNativeApp()) return false;
  if (running) return true;

  const endpoint = options.endpoint ?? '/api/attendance/presence';
  const granted = await ensureBackgroundPermission();
  if (!granted) return false;

  const startOptions: StartOptions = {
    backgroundMessage: options.backgroundMessage ?? 'يستخدم التطبيق موقعك للتحقق من وجودك في السكن',
    backgroundTitle: options.backgroundTitle ?? 'خدمة الموقع',
    requestPermissions: false,
    stale: false,
    distanceFilter: options.distanceFilter ?? 15,
    networkFallback: true,
  };

  try {
    await BackgroundGeolocation.start(startOptions, (location?: Location, error?: CallbackError) => {
      if (error || !location) return;
      void sendPresence(location, endpoint, options.getAuthHeader);
    });
    running = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    throw new GeoError('UNAVAILABLE', message || 'تعذر تشغيل تتبع الموقع في الخلفية');
  }
}

/** Stop native background location updates. Safe to call when not running. */
export async function stopBackgroundTracking(): Promise<void> {
  if (!isNativeApp()) {
    running = false;
    return;
  }
  running = false;
  try {
    await BackgroundGeolocation.stop();
  } catch {
    // Already stopped or the plugin was never started.
  }
}
