import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Single source of truth for device location.
 *
 * On the web this wraps the browser Geolocation API; inside the Capacitor
 * native app it uses the OS fused provider (real GPS), which is dramatically
 * more accurate — the browser API frequently falls back to IP/Wi-Fi estimates
 * that can be hundreds of metres off. Callers never touch `navigator.geolocation`
 * or the plugin directly, so the same code is correct in both runtimes.
 */

export interface GeoFix {
  lat: number;
  lng: number;
  /** Horizontal uncertainty in metres (0 when the provider doesn't report it). */
  accuracy: number;
  /** Unix epoch milliseconds when the fix was produced. */
  timestamp: number;
  source: 'native' | 'web';
}

export interface GetFixOptions {
  /** Overall budget for obtaining a fix. Defaults to 15s. */
  timeoutMs?: number;
  /** Stop early once a fix at least this accurate is found. Defaults to 30m. */
  desiredAccuracyM?: number;
  /** Ask the provider for the most accurate fix (GPS). Defaults to true. */
  highAccuracy?: boolean;
  /** Reuse cached fixes no older than this. Defaults to 0 (fresh). */
  maximumAgeMs?: number;
}

export interface WatchOptions {
  highAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}

export type GeoErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message?: string) {
    super(message || code);
    this.code = code;
  }
}

/**
 * Must match the server's `MAX_TRUSTWORTHY_ACCURACY_M`. A fix coarser than this
 * is a network/IP fallback (often kilometres off) and must not be reported as a
 * real position.
 */
export const MAX_TRUSTWORTHY_ACCURACY_M = 200;

/** True when a reading is precise enough to be trusted for a dorm geofence. */
export function isTrustworthyFix(fix: Pick<GeoFix, 'accuracy'>, maxM: number = MAX_TRUSTWORTHY_ACCURACY_M): boolean {
  return Number.isFinite(fix.accuracy) && fix.accuracy <= maxM;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_DESIRED_ACCURACY_M = 30;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

let cachedNative: boolean | null = null;

/** True when running inside the Capacitor native shell (not the browser/PWA). */
export function isNativeApp(): boolean {
  if (cachedNative !== null) return cachedNative;
  try {
    cachedNative = Capacitor.isNativePlatform();
  } catch {
    cachedNative = false;
  }
  return cachedNative;
}

function webErrorCode(error: GeolocationPositionError | undefined): GeoErrorCode {
  switch (error?.code) {
    case 1: return 'PERMISSION_DENIED';
    case 2: return 'POSITION_UNAVAILABLE';
    case 3: return 'TIMEOUT';
    default: return 'UNKNOWN';
  }
}

function parseTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const ms = ISO_DATE_PATTERN.test(value) ? Date.parse(value) : NaN;
    if (Number.isFinite(ms)) return ms;
  }
  return Date.now();
}

function parseAccuracy(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

interface RawFix {
  latitude: number;
  longitude: number;
  accuracy: unknown;
  timestamp: unknown;
}

function toFix(raw: RawFix, source: 'native' | 'web'): GeoFix {
  return {
    lat: raw.latitude,
    lng: raw.longitude,
    accuracy: parseAccuracy(raw.accuracy),
    timestamp: parseTimestamp(raw.timestamp),
    source,
  };
}

/** Ask for foreground location permission (no-op / best-effort on web). */
export async function ensureForegroundPermission(): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === 'granted') return true;
    const requested = await Geolocation.requestPermissions();
    return requested.location === 'granted';
  } catch {
    return false;
  }
}

/** One-shot position, preferring a fresh high-accuracy fix. */
export async function getCurrentFix(options: GetFixOptions = {}): Promise<GeoFix> {
  const {
    highAccuracy = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maximumAgeMs = 0,
  } = options;

  if (isNativeApp()) {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: highAccuracy,
      timeout: timeoutMs,
      maximumAge: maximumAgeMs,
    });
    return toFix(
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      },
      'native',
    );
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new GeoError('UNAVAILABLE', 'متصفحك لا يدعم تحديد الموقع');
  }

  return new Promise<GeoFix>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(
        toFix(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          },
          'web',
        ),
      ),
      (error) => reject(new GeoError(webErrorCode(error), error?.message)),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
    );
  });
}

/**
 * Best fix within a short budget: subscribes to updates, keeps the reading with
 * the smallest accuracy radius, and resolves early as soon as `desiredAccuracyM`
 * is met. This is what fixes "wrong coordinates" — the first browser reading is
 * often coarse, while a GPS lock arrives a second or two later.
 */
export async function getBestFix(options: GetFixOptions = {}): Promise<GeoFix> {
  const {
    highAccuracy = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maximumAgeMs = 0,
    desiredAccuracyM = DEFAULT_DESIRED_ACCURACY_M,
  } = options;

  return new Promise<GeoFix>((resolve, reject) => {
    let best: GeoFix | null = null;
    let settled = false;
    let subscription: { clear: () => void } | null = null;

    const finish = (error?: GeoError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.clear();
      if (best) resolve(best);
      else reject(error || new GeoError('TIMEOUT'));
    };

    const timer = setTimeout(() => finish(), timeoutMs);

    subscription = createWatch(
      (fix) => {
        if (!best || (fix.accuracy > 0 && (best.accuracy === 0 || fix.accuracy < best.accuracy))) {
          best = fix;
        }
        if (best && best.accuracy > 0 && best.accuracy <= desiredAccuracyM) finish();
      },
      (error) => { if (!best) finish(error); },
      { highAccuracy, timeoutMs, maximumAgeMs },
    );
  });
}

/** Continuous position updates. Returns a handle whose `clear()` stops them. */
export function watchFixes(
  onFix: (fix: GeoFix) => void,
  onError: (error: GeoError) => void,
  options: WatchOptions = {},
): { clear: () => void } {
  return createWatch(onFix, onError, options);
}

function createWatch(
  onFix: (fix: GeoFix) => void,
  onError: (error: GeoError) => void,
  options: WatchOptions,
): { clear: () => void } {
  const { highAccuracy = true, timeoutMs = DEFAULT_TIMEOUT_MS, maximumAgeMs = 0 } = options;

  if (isNativeApp()) {
    let watchId: string | null = null;
    let cleared = false;
    Geolocation.watchPosition(
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
      (position, error) => {
        if (error) {
          onError(new GeoError('POSITION_UNAVAILABLE', typeof error === 'string' ? error : error?.message));
          return;
        }
        if (position) {
          onFix(
            toFix(
              {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
              },
              'native',
            ),
          );
        }
      },
    )
      .then((id) => { if (cleared) Geolocation.clearWatch({ id }).catch(() => undefined); else watchId = id; })
      .catch((error) => onError(new GeoError('UNAVAILABLE', error?.message)));

    return {
      clear: () => {
        cleared = true;
        if (watchId) Geolocation.clearWatch({ id: watchId }).catch(() => undefined);
      },
    };
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    queueMicrotask(() => onError(new GeoError('UNAVAILABLE', 'متصفحك لا يدعم تحديد الموقع')));
    return { clear: () => undefined };
  }

  const id = navigator.geolocation.watchPosition(
    (position) => onFix(
      toFix(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        },
        'web',
      ),
    ),
    (error) => onError(new GeoError(webErrorCode(error), error?.message)),
    { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
  );

  return { clear: () => navigator.geolocation.clearWatch(id) };
}
