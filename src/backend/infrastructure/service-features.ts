import { NextFunction, Request, Response } from "express";
import { kdb } from "./db";
import { MemoryCache } from "./cache";
import { UserRole } from "../../types/permissions";

export type TenantService = "laundry" | "restaurant" | "canteen";

export const SERVICE_COLUMNS: Record<TenantService, string> = {
  laundry: "laundry_enabled",
  restaurant: "restaurant_enabled",
  canteen: "canteen_enabled",
};

export const SERVICE_DISPLAY: Record<TenantService, string> = {
  laundry: "المغسلة",
  restaurant: "المطعم",
  canteen: "الكانتين",
};

export type TenantServiceFlags = Record<TenantService, boolean>;

const DEFAULT_FLAGS: TenantServiceFlags = {
  laundry: true,
  restaurant: true,
  canteen: true,
};

const serviceFlagsCache = new MemoryCache<{ flags: TenantServiceFlags }>(30_000);

function normalizeFlag(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return value !== 0 && value !== "0" && value !== false && value !== "false";
}

export function invalidateServiceCache(tenantId: string): void {
  serviceFlagsCache.invalidate(`svc:${tenantId}`);
}

export async function getTenantServiceFlags(tenantId?: string | null): Promise<TenantServiceFlags> {
  if (!tenantId) return { ...DEFAULT_FLAGS };
  const cached = serviceFlagsCache.get(`svc:${tenantId}`);
  if (cached) return cached.flags;
  let flags: TenantServiceFlags = { ...DEFAULT_FLAGS };
  const row = await kdb("tenants").select("laundry_enabled", "restaurant_enabled", "canteen_enabled").where({ id: tenantId }).first();
  if (row) {
    flags = {
      laundry: normalizeFlag(row.laundry_enabled),
      restaurant: normalizeFlag(row.restaurant_enabled),
      canteen: normalizeFlag(row.canteen_enabled),
    };
  }
  serviceFlagsCache.set(`svc:${tenantId}`, { flags });
  return flags;
}

export async function getTenantServiceEnabled(
  tenantId: string | undefined | null,
  service: TenantService,
): Promise<boolean> {
  const flags = await getTenantServiceFlags(tenantId);
  return flags[service];
}

/**
 * Middleware for service-enabling: rejects NEW operations when the tenant has
 * disabled the service. Reads (history) remain allowed, operators/data stay
 * intact, and global admins always bypass. MUST be placed after `authenticate`
 * so that req.user.tenantId is available.
 */
export function requireServiceEnabled(service: TenantService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId || req.user?.role === UserRole.Admin) {
      next();
      return;
    }
    const enabled = await getTenantServiceEnabled(tenantId, service);
    if (!enabled) {
      res.status(403).json({
        success: false,
        message: `خدمة ال${SERVICE_DISPLAY[service]} غير مفعّلة في هذا السكن حاليًا`,
      });
      return;
    }
    next();
  };
}