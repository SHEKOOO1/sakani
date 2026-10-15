/**
 * Pure geofence / auto-crossing logic for the dorm attendance page.
 *
 * The dorm is now represented by a single official centre circle (centre point
 * + radius). Auto mode is driven entirely by that circle:
 *   • entering the circle  → check-in
 *   • leaving the circle   → check-out
 *
 * Kept framework-free so it can be unit-tested directly and so the component
 * decides "check-in / check-out" through exactly the logic the tests pin.
 * The server re-validates every request regardless (it is the source of truth);
 * this only decides when the client should *offer* a crossing.
 */

export interface Gate {
  lat: number | null | undefined;
  lng: number | null | undefined;
  radius: number;
}

export interface CrossingInput {
  latitude: number;
  longitude: number;
  center: Gate;
  wasInside: boolean;
}

export interface CrossingResult {
  inside: boolean;
  checkIn: boolean;
  checkOut: boolean;
}

/** Haversine distance in meters. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInsideGate(latitude: number, longitude: number, gate: Gate | null | undefined): boolean {
  if (!gate || gate.lat == null || gate.lng == null) return false;
  return haversineMeters(latitude, longitude, gate.lat, gate.lng) <= gate.radius;
}

/**
 * Auto-crossing rule (single centre circle):
 *   • outside → inside  → check-in
 *   • inside  → outside → check-out
 * A missing/unconfigured centre never produces a crossing.
 */
export function evaluateAutoCrossing(input: CrossingInput): CrossingResult {
  const configured = input.center?.lat != null && input.center?.lng != null;
  const inside = isInsideGate(input.latitude, input.longitude, input.center);
  return {
    inside,
    checkIn: configured && inside && !input.wasInside,
    checkOut: configured && !inside && input.wasInside,
  };
}
