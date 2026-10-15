import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { calculateDistance, evaluateGeofence, parseAccuracy } from "./geo";

/**
 * Last-known presence per student.
 *
 * One row per student, upserted by the PWA presence ping. `inside` is tri-state:
 * true = confirmed inside the dorm circle, false = confirmed outside, null =
 * unknown (never reported, straddling the boundary, or the reading is too old).
 * The lock-time check only ever confirms an absence from an explicit `false`.
 */

/** A presence reading older than this is treated as unknown. */
export const PRESENCE_STALE_MINUTES = 30;

export interface Gate {
  lat: number;
  lng: number;
  radius: number;
  label: string;
}

/** The single authoritative circle for a dorm: the central location only. */
export function resolveDormGate(tenant: any): Gate | null {
  if (!tenant) return null;
  const locLat = tenant.location_lat;
  const locLng = tenant.location_lng;
  if (locLat != null && locLng != null && Number.isFinite(Number(locLat)) && Number.isFinite(Number(locLng))) {
    return { lat: Number(locLat), lng: Number(locLng), radius: Number(tenant.location_radius) || 50, label: "موقع السكن" };
  }
  return null;
}

export interface PresenceRecord {
  studentId: string;
  tenantId: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  inside: boolean | null;
  updatedAt: Date | null;
}

export interface RecordedPresence {
  inside: boolean | null;
  distance: number | null;
  verdict: "inside" | "outside" | "uncertain" | "no-gate";
}

/**
 * Record a student's position and derive the tri-state `inside` value.
 * A "no-gate" result (dorm has no circle configured) stores NULL — never an
 * absence signal, because there is nothing to be absent from.
 */
export async function recordPresence(input: {
  studentId: string;
  tenantId: string;
  lat: number;
  lng: number;
  accuracy?: unknown;
  source?: string;
}): Promise<RecordedPresence> {
  const accuracy = parseAccuracy(input.accuracy);
  const tenant = await kdb("tenants").where({ id: input.tenantId }).first();
  const gate = resolveDormGate(tenant);

  let inside: boolean | null = null;
  let distance: number | null = null;
  let verdict: RecordedPresence["verdict"] = "no-gate";

  if (gate) {
    distance = calculateDistance(input.lat, input.lng, gate.lat, gate.lng);
    const decision = evaluateGeofence(distance, gate.radius, accuracy);
    if (decision === "inside") inside = true;
    else if (decision === "outside") inside = false;
    verdict = inside === null ? "uncertain" : decision;
  }

  const now = new Date();
  const payload = {
    tenant_id: input.tenantId,
    last_lat: input.lat,
    last_lng: input.lng,
    accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    inside: inside === null ? null : (inside ? 1 : 0),
    source: (input.source || "ping").slice(0, 20),
    updated_at: now,
  };

  const updated = await kdb("student_presence").where({ student_id: input.studentId }).update(payload);
  if (!updated) {
    try {
      await kdb("student_presence").insert({ id: uuidv4(), student_id: input.studentId, ...payload });
    } catch (e: any) {
      // Unique-index race: another request inserted the row just now → update it.
      if (e?.number === 2601 || e?.number === 2627) {
        await kdb("student_presence").where({ student_id: input.studentId }).update(payload);
      } else {
        throw e;
      }
    }
  }

  return { inside, distance, verdict };
}

export async function getPresence(studentId: string): Promise<PresenceRecord | null> {
  const row = await kdb("student_presence").where({ student_id: studentId }).first();
  if (!row) return null;
  return {
    studentId: row.student_id,
    tenantId: row.tenant_id,
    lat: row.last_lat != null ? Number(row.last_lat) : null,
    lng: row.last_lng != null ? Number(row.last_lng) : null,
    accuracy: row.accuracy != null ? Number(row.accuracy) : null,
    inside: row.inside === null || row.inside === undefined ? null : !!row.inside,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

export type PresenceStatus = "inside" | "outside" | "unknown";

/** Collapse a stored record into a status, treating stale readings as unknown. */
export function presenceStatus(record: PresenceRecord | null, now: Date = new Date()): PresenceStatus {
  if (!record || record.updatedAt === null || record.inside === null) return "unknown";
  const ageMinutes = (now.getTime() - record.updatedAt.getTime()) / 60000;
  if (ageMinutes > PRESENCE_STALE_MINUTES) return "unknown";
  return record.inside ? "inside" : "outside";
}

/** Whether this record proves an absence right now (fresh, explicit outside). */
export function isConfirmedAbsence(record: PresenceRecord | null, now: Date = new Date()): boolean {
  return presenceStatus(record, now) === "outside";
}

/**
 * Presence board for a dorm: every active student with their current status.
 * Traveling students are flagged so the supervisor can see why they are exempt.
 */
export async function getTenantPresenceBoard(tenantId: string, now: Date = new Date()) {
  const rows = await kdb("students as s")
    .join("users as u", "s.user_id", "u.id")
    .leftJoin("student_presence as p", "p.student_id", "s.id")
    .where("s.tenant_id", tenantId)
    .where((qb) => qb.whereNull("s.status").orWhereNot("s.status", "archived"))
    .select(
      "s.id as student_id",
      "u.name as student_name",
      "s.is_traveling",
      "p.last_lat", "p.last_lng", "p.accuracy", "p.inside", "p.updated_at"
    );

  return rows.map((row: any) => {
    const record: PresenceRecord | null = row.updated_at
      ? {
          studentId: row.student_id,
          tenantId,
          lat: row.last_lat != null ? Number(row.last_lat) : null,
          lng: row.last_lng != null ? Number(row.last_lng) : null,
          accuracy: row.accuracy != null ? Number(row.accuracy) : null,
          inside: row.inside === null || row.inside === undefined ? null : !!row.inside,
          updatedAt: new Date(row.updated_at),
        }
      : null;
    return {
      student_id: row.student_id,
      student_name: row.student_name,
      is_traveling: !!row.is_traveling,
      status: row.is_traveling ? "traveling" : presenceStatus(record, now),
      lat: record?.lat ?? null,
      lng: record?.lng ?? null,
      accuracy: record?.accuracy ?? null,
      updated_at: record?.updatedAt ?? null,
    };
  });
}
