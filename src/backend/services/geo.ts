/**
 * Shared geolocation helpers.
 *
 * The server is the source of truth for every "inside/outside" decision: the UI
 * may show a preview, but only this module's verdict is authoritative. Kept tiny
 * and dependency-free so it can be unit-tested directly.
 */

/** Haversine distance between two WGS-84 points, in meters. */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GeofenceVerdict = 'inside' | 'outside' | 'uncertain';

/**
 * Decide inside/outside with GPS accuracy taken into account:
 *  - accuracy 0 (unknown): classic point-in-circle test.
 *  - accuracy > 0: use the error band [distance-accuracy, distance+accuracy].
 *    Fully inside → inside, fully outside → outside, straddling the boundary →
 *    "uncertain" (never treated as a confirmed absence).
 */
export function evaluateGeofence(distance: number, radius: number, accuracy: number): GeofenceVerdict {
  if (!(accuracy > 0)) return distance <= radius ? 'inside' : 'outside';
  if (distance + accuracy <= radius) return 'inside';
  if (distance - accuracy > radius) return 'outside';
  return 'uncertain';
}

/** Accepts a non-negative finite number; anything else becomes 0 (no margin). */
export function parseAccuracy(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

/** Are these a plausible WGS-84 coordinate pair? */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  return (
    lat !== undefined && lat !== null && lat !== '' &&
    lng !== undefined && lng !== null && lng !== '' &&
    Number.isFinite(latNum) && Number.isFinite(lngNum) &&
    latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180
  );
}
