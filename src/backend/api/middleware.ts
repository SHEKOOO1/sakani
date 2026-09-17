import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { kdb, logAuditEvent, hasPermission, checkUserPermission } from "../infrastructure/db";
import { logger } from "../infrastructure/logger.ts";
import { AppPermission, UserRole } from "../../types/permissions";
import { userCache, tenantCache } from "../infrastructure/cache.ts";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// حساب معرفات السكن المسموحة للمستخدم من قاعدة البيانات (مضاعفة لكل من HTTP و Socket.io)
export async function computeUserTenantIds(user: { id: string; role: string; tenantId?: string | null }): Promise<string[]> {
  const byBishop = user.role === 'bishop'
    ? await kdb('tenants').select('id').where({ bishop_id: user.id })
    : [];
  const byAssignment = await kdb('user_tenant_assignments').select('tenant_id').where({ user_id: user.id });
  const byOwnTenant = user.tenantId ? [user.tenantId] : [];
  return [...new Set([
    ...byBishop.map((t: any) => t.id),
    ...byAssignment.map((t: any) => t.tenant_id),
    ...byOwnTenant
  ])];
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  let token: string | undefined;

  if (authHeader) {
    token = authHeader.split(" ")[1];
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: "Server configuration error: JWT_SECRET not set" });
    }
    const decoded = jwt.verify(token, secret) as any;
    req.user = decoded;
    const user = req.user!;

    // Check token blacklist
    const tokenHash = hashToken(token);
    const blacklisted = await kdb('token_blacklist').where({ token_hash: tokenHash }).first();
    if (blacklisted) {
      return res.status(401).json({ success: false, message: "تم تسجيل الخروج. برجاء تسجيل الدخول مرة أخرى." });
    }

    // Verify user still exists (cached)
    let userExists = userCache.get(`user:${user.id}`);
    if (userExists === undefined) {
      const freshUser = await kdb('users').where({ id: user.id }).first();
      // نسخة دفاعية: نخزّن نسخة وليس المرجع ذاته حتى لا تتلوث ذاكرة الكاش بأي تعديل لاحق
      userExists = freshUser ? { ...freshUser } : freshUser;
      userCache.set(`user:${user.id}`, userExists);
    }
    if (!userExists) {
      return res.status(401).json({ success: false, message: "Session expired: User no longer exists" });
    }

    // Verify the token's session version still matches the DB.
    // A password change (admin reset or self-service) bumps token_version,
    // invalidating every JWT issued with an older version.
    const dbTokenVersion = Number(userExists.token_version ?? 0);
    const tokenVersion = Number(decoded.tokenVersion ?? 0);
    if (tokenVersion !== dbTokenVersion) {
      return res.status(401).json({ success: false, message: "Session expired: تم تغيير كلمة المرور. برجاء تسجيل الدخول مرة أخرى." });
    }

    // Verify role/tenant still match DB (detect role changes / demotion before token expiry)
    const dbRole = userExists.role;
    const dbTenantId = userExists.tenant_id ?? null;
    if (user.role !== dbRole || (user.tenantId ?? null) !== dbTenantId) {
      return res.status(401).json({ success: false, message: "Session expired: تم تغيير صلاحياتك. برجاء تسجيل الدخول مرة أخرى." });
    }
    req.user!.role = dbRole;
    req.user!.tenantId = dbTenantId;

    // Populate tenant IDs for multi-tenant users (bishops, priests, etc.)
    if (user.role !== 'admin') {
      const tenantIdsCacheKey = `tenantIds:${user.id}`;
      let allIds = userCache.get(tenantIdsCacheKey) as string[] | undefined;
      if (allIds === undefined) {
        allIds = await computeUserTenantIds(user);
        userCache.set(tenantIdsCacheKey, allIds, 60_000);
      }
      if (allIds.length > 0) {
        (req as any).user.tenantIds = allIds;
      }
    }

    // Check for X-Tenant-Id override
    const tenantOverride = req.headers['x-tenant-id'] as string;
    if (tenantOverride && tenantOverride !== user.tenantId) {
      logger.info(`Tenant Override detected: ${tenantOverride}`);
      // If it's a super admin, they can access any tenant
      if (user.role === 'admin') {
        req.user!.tenantId = tenantOverride;
      } 
      // If it's a Bishop, check if they own the tenant
      else if (user.role === 'bishop') {
        const tenantKey = `bishop_tenant:${user.id}:${tenantOverride}`;
        let tenant = tenantCache.get(tenantKey);
        if (tenant === undefined) {
          tenant = await kdb('tenants').where({ id: tenantOverride, bishop_id: user.id }).first();
          tenantCache.set(tenantKey, tenant);
        }
        if (tenant) req.user!.tenantId = tenantOverride;
      }
      // For Others (Priest/Supervisor), check user_tenant_assignments
      else {
        const assignKey = `assignment:${user.id}:${tenantOverride}`;
        let assignment = userCache.get(assignKey);
        if (assignment === undefined) {
          assignment = await kdb('user_tenant_assignments').where({ user_id: user.id, tenant_id: tenantOverride }).first();
          userCache.set(assignKey, assignment);
        }
        if (assignment) {
          req.user!.tenantId = tenantOverride;
        }
      }
    }

    // Verify tenant still exists (after applying any valid overrides) — cached
    const effectiveUser = req.user!;
    if (effectiveUser.tenantId) {
      let tenantExists = tenantCache.get(`tenant:${effectiveUser.tenantId}`);
      if (tenantExists === undefined) {
        tenantExists = await kdb('tenants').where({ id: effectiveUser.tenantId }).first();
        tenantCache.set(`tenant:${effectiveUser.tenantId}`, tenantExists, 60_000);
      }
      if (!tenantExists) {
        return res.status(401).json({ success: false, message: "Session expired: Tenant no longer exists" });
      }
    }

    logger.info(`Authenticated user: ${effectiveUser.email} (${effectiveUser.role}) for Tenant: ${effectiveUser.tenantId}`);
    next();
  } catch (err: any) {
    logger.error("JWT Verification Error for URL:", req.originalUrl, "Error:", err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "Session expired" });
    }
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
  }
};

// Socket.io auth — mirrors the HTTP authenticate checks (blacklist + user existence + role/tenant recheck)
export async function resolveSocketUser(token: string): Promise<any> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  const decoded = jwt.verify(token, secret) as any;
  const tokenHash = hashToken(token);
  const blacklisted = await kdb('token_blacklist').where({ token_hash: tokenHash }).first();
  if (blacklisted) throw new Error("Token revoked");
  const userExists = await kdb('users').where({ id: decoded.id }).first();
  if (!userExists) throw new Error("User no longer exists");
  const dbTokenVersion = Number(userExists.token_version ?? 0);
  const tokenVersion = Number(decoded.tokenVersion ?? 0);
  if (tokenVersion !== dbTokenVersion) throw new Error("Session stale");
  const dbRole = userExists.role;
  const dbTenantId = userExists.tenant_id ?? null;
  if (decoded.role !== dbRole || (decoded.tenantId ?? null) !== dbTenantId) {
    throw new Error("Session stale");
  }
  const user = { ...decoded, id: userExists.id, role: dbRole, tenantId: dbTenantId };
  if (user.role !== 'admin') {
    user.tenantIds = await computeUserTenantIds(user);
  }
  return user;
}

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!(req as any).user || !roles.includes(((req as any).user as any).role)) {
      return res.status(403).json({ success: false, message: "Forbidden: Insufficient permissions" });
    }
    next();
  };
};

export const authorizePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!(req as any).user) {
      logger.warn(`[Permission Denied] No user in request for ${req.method} ${req.url}`);
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // قائمة صلاحيات الأسقف: مطابقة لـ role_permissions seed — لا تشمل إدارة الإعدادات (MANAGE_SETTINGS/VIEW_SETTINGS)
    // لأن الأسقف لا يظهر له قسم الإعدادات إطلاقاً في الواجهة (Layout.tsx)
    const bishopFallbackPermissions = [
      AppPermission.VIEW_DASHBOARD,
      AppPermission.VIEW_GLOBAL_REPORTS,
      AppPermission.VIEW_STUDENT,
      AppPermission.VIEW_ATTENDANCE,
      AppPermission.MANAGE_GLOBAL_TENANTS,
      AppPermission.ASSIGN_GLOBAL_STAFF,
      AppPermission.MANAGE_EMPLOYEES,
      AppPermission.VIEW_USERS,
      AppPermission.MANAGE_USERS,
    ];

    if (req.user.role === UserRole.Bishop && bishopFallbackPermissions.includes(permission as AppPermission)) {
      return next();
    }

    if (!await checkUserPermission(req.user.id, permission)) {
      logger.warn(`[Permission Denied] User ${req.user.email} (${req.user.role}) missing [${permission}] for ${req.method} ${req.url}`);
      return res.status(403).json({ success: false, message: `Forbidden: Missing required permission [${permission}]` });
    }
    next();
  };
};

export type ItemAccessType = 'event' | 'competition';

const ITEM_TABLE: Record<ItemAccessType, string> = {
  event: 'events',
  competition: 'competitions',
};

// Per-item management check: an assigned manager (item_managers) or tenant-scoped overseer
export async function canManageItem(
  user: { id: string; role: string; tenantId?: string | null },
  itemType: ItemAccessType,
  itemId: string
): Promise<boolean> {
  try {
    if (user.role === 'admin') return true;
    const item = await kdb(ITEM_TABLE[itemType]).where({ id: itemId }).first();
    if (!item) return false;
    // الأسقف: فقط للعناصر داخل سكناته التي يديرها (أو عناصر المؤسسة العامة)
    if (user.role === 'bishop') {
      if (!item.tenant_id) return true;
      const ids = await computeUserTenantIds(user);
      return ids.includes(item.tenant_id);
    }
    const manager = await kdb('item_managers')
      .where({ item_id: itemId, item_type: itemType, user_id: user.id })
      .first();
    return !!manager;
  } catch (e) {
    logger.error('[canManageItem] error:', e);
    return false;
  }
}

// Allow when the user has the global permission OR is an assigned manager of this specific item
export function requireItemAccess(
  itemType: ItemAccessType,
  fallbackPermission: AppPermission,
  resolveItemId?: (req: AuthRequest) => string | null | Promise<string | null>
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const itemId = resolveItemId ? await resolveItemId(req) : (req.params as any).id;
    if (!itemId) {
      return res.status(400).json({ success: false, message: "Missing item id" });
    }
    const hasPerm = await checkUserPermission(req.user.id, fallbackPermission);
    if (hasPerm) {
      // حتى مع امتلاك الصلاحية، يجب أن يقع العنصر ضمن سكنات المستخدم (منع العبور بين السكنات)
      if (req.user.role !== 'admin') {
        const item = await kdb(ITEM_TABLE[itemType]).where({ id: itemId }).first();
        if (!item) {
          return res.status(404).json({ success: false, message: "العنصر غير موجود" });
        }
        if (item.tenant_id) {
          const ids = await computeUserTenantIds(req.user);
          if (!ids.includes(item.tenant_id)) {
            return res.status(403).json({ success: false, message: "العنصر ليس ضمن سكناتك" });
          }
        } else if (!['admin', 'bishop'].includes(req.user.role)) {
          // عناصر المؤسسة العامة يحررها مدير التطبيق أو الأسقف فقط
          return res.status(403).json({ success: false, message: "لا تملك صلاحية هذا العنصر" });
        }
      }
      return next();
    }
    if (await canManageItem(req.user, itemType, String(itemId))) return next();
    return res.status(403).json({ success: false, message: "ليس لديك صلاحية إدارة هذا العنصر" });
  };
}

export const auditLogger = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Skip audit logging for read-only GET requests to reduce DB load
  if (req.method === 'GET') return next();

  const start = Date.now();
  const filteredBody = { ...req.body };
  [
    'password', 'confirmPassword', 'currentPassword', 'newPassword', 'token',
    'phone', 'phoneNumbers', 'phoneNumber', 'phone_number',
    'address', 'studentPhoto', 'student_photo', 'idCardNumber', 'id_card_number',
    'birthDate', 'birth_date', 'governorate', 'village', 'churchName', 'church_name',
    'confessionFatherName', 'confession_father_name',
    'parentName', 'parentEmail', 'parentPassword', 'parentPhone', 'parentPhone',
    'studentIdNumber', 'student_id_number', 'idCardNumber', 'id_card_number',
  ].forEach((key) => {
    if (key in filteredBody) delete filteredBody[key];
  });

  const entityType = req.baseUrl ? req.baseUrl.replace(/^\/api\//, '').split('/')[0] : undefined;
  const entityId = req.params?.id ? String(req.params.id) : undefined;
  const userEmail = req.user?.email || (typeof req.body?.email === 'string' ? req.body.email : undefined) || undefined;

  res.on('finish', () => {
    try {
      logAuditEvent({
        tenantId: req.user?.tenantId,
        userId: req.user?.id,
        userEmail,
        userRole: req.user?.role,
        action: `${req.method} ${req.originalUrl}`,
        entityType,
        entityId,
        method: req.method,
        path: req.originalUrl,
        status: String(res.statusCode),
        details: {
          body: filteredBody,
          query: Object.fromEntries(Object.entries(req.query).filter(([k]) => !['token','access_token','authorization','secret'].includes(k.toLowerCase()))),
          durationMs: Date.now() - start,
        },
      });
    } catch (error) {
      logger.error("Failed to write audit log:", error);
    }
  });

  next();
};

export const tenantGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
  // If the request has a tenantId in params or body, ensure it matches the user's tenantId 
  // (unless user is global admin, though in this multi-tenant spec usually users are restricted to one tenant)
  const requestedTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  
  if (requestedTenantId && req.user.tenantId !== requestedTenantId && req.user.role !== UserRole.Admin) {
    return res.status(403).json({ success: false, message: "Forbidden: Tenant isolation breach attempted" });
  }
  
  next();
};

export function sanitizeError(error: any, defaultMessage = "حصل خطأ فني. لو سمحت كرر المحاولة.") {
  console.error('Error:', error?.message || error);
  return defaultMessage;
}

function stripXSS(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/data\s*:\s*(?:image\/svg\+xml|image\/svg)/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<svg\b[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .replace(/<path\b[^>]*>/gi, '')
    .replace(/<circle\b[^>]*>/gi, '')
    .replace(/<rect\b[^>]*>/gi, '')
    .replace(/<polygon\b[^>]*>/gi, '')
    .replace(/<polyline\b[^>]*>/gi, '')
    .replace(/<line\b[^>]*>/gi, '')
    .replace(/<ellipse\b[^>]*>/gi, '')
    .replace(/<g\b[^>]*>/gi, '')
    .replace(/<defs\b[^>]*>/gi, '')
    .replace(/<foreignObject\b[^>]*>/gi, '')
    .replace(/<use\b[^>]*>/gi, '')
    .replace(/<style\b[^>]*>/gi, '')
    .replace(/@keyframes/gi, '')
    .replace(/<a\b[^>]*>/gi, '')
    .replace(/<\/a>/gi, '')
    .replace(/xlink\s*:/gi, '')
    .replace(/xmlns\s*:/gi, '')
    .replace(/<animate\b[^>]*>/gi, '')
    .replace(/<animateTransform\b[^>]*>/gi, '')
    .replace(/<set\b[^>]*>/gi, '')
    .replace(/<script\b/g, '')
    .replace(/<style\b/g, '');
}

function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    return stripXSS(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query) as any;
  }
  if (req.params && typeof req.params === 'object') {
    for (const [key, val] of Object.entries(req.params)) {
      (req.params as any)[key] = typeof val === 'string' ? stripXSS(val) : val;
    }
  }
  next();
};

/**
 * طھط­ط¯ظٹط¯ ط§ظ„ط£ط¯ظˆط§ط± ط§ظ„ظ…ط³ظ…ظˆط­ ظ„ظ„ظ…ط³طھط®ط¯ظ… ط§ظ„ط­ط§ظ„ظٹ ط¥ظ†ط´ط§ط¤ظ‡ط§/طھط¹ظٹظٹظ†ظ‡ط§
 * ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط¯ظˆط±ظ‡ ظپظٹ ط§ظ„ظ†ط¸ط§ظ… (ظ…ظ†ط¹ ط§ظ„طھطµط¹ظٹط¯ ط؛ظٹط± ط§ظ„ظ…طµط±ط­ ط¨ظ‡)
 * ط§ظ„ظ‚ط§ط¹ط¯ط©: ظƒظ„ ط¯ظˆط± ظ„ط§ ظٹظ†ط´ط¦ ظ…ظ† ظ‡ظˆ ط£ط¹ظ„ظ‰ ظ…ظ†ظ‡طŒ ظٹظ†ط´ط¦ ط§ظ„ط£ط¯ظˆط§ط± ط§ظ„ط£ظ‚ظ„ ظپظ‚ط·
 */
export function getAllowedAssignableRoles(userRole: string): string[] {
  switch (userRole) {
    case UserRole.Admin:
      return [UserRole.Bishop, UserRole.Priest, UserRole.Supervisor, UserRole.AssistantSupervisor, UserRole.Employee];
    case UserRole.Bishop:
      return [UserRole.Priest, UserRole.Supervisor, UserRole.AssistantSupervisor, UserRole.Employee];
    case UserRole.Priest:
      return [UserRole.Supervisor, UserRole.AssistantSupervisor, UserRole.Employee];
    case UserRole.Supervisor:
      return [UserRole.AssistantSupervisor, UserRole.Employee];
    default:
      return [];
  }
}
