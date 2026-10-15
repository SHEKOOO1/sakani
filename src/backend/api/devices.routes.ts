import express from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

/**
 * Trusted-device binding.
 *
 * Browsers and PWAs on Android/iOS cannot read a real MAC address, so a device
 * cannot be identified by hardware id. Instead the SERVER issues a random opaque
 * token at registration and stores only its SHA-256 hash. A freshly registered
 * device is `pending`; an administrator must approve it before it is trusted.
 * Revoking a lost device is a single call. None of this is a location proof:
 * device trust is an ADDITIONAL signal and never replaces the geofence.
 */

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function publicDevice(row: any) {
  // Never expose the stored hash or any token.
  return {
    id: row.id,
    student_id: row.student_id,
    label: row.label ?? null,
    platform: row.platform ?? null,
    status: row.status,
    created_at: row.created_at ?? null,
    approved_at: row.approved_at ?? null,
    revoked_at: row.revoked_at ?? null,
    last_seen_at: row.last_seen_at ?? null,
  };
}

async function findOwnStudent(userId: string, tenantId?: string | null) {
  const q = kdb("students").where({ user_id: userId });
  if (tenantId) q.andWhere({ tenant_id: tenantId });
  return (await q.first()) as any;
}

// Register the current student's device. The client cannot choose the device
// identity: the server mints it and returns the token exactly once.
router.post("/register", authenticate, async (req, res) => {
  const userId = req.user.id;
  const { label, platform } = req.body || {};
  try {
    const student = await findOwnStudent(userId, req.user.tenantId);
    if (!student) {
      return res.status(403).json({ success: false, message: "غير مسموح بتسجيل جهاز لهذا الحساب" });
    }

    const token = newToken();
    const id = uuidv4();
    await kdb("student_devices").insert({
      id,
      tenant_id: student.tenant_id,
      student_id: student.id,
      device_token_hash: hashToken(token),
      label: typeof label === "string" ? label.slice(0, 100) : null,
      platform: typeof platform === "string" ? platform.slice(0, 40) : null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 400) : null,
      status: "pending",
      created_at: new Date(),
    });

    // The raw token is returned ONCE and never stored in cleartext.
    res.status(201).json({ success: true, data: { id, device_token: token, status: "pending" } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر تسجيل الجهاز. حاول مرة أخرى." });
  }
});

// List devices: a student sees their own; supervisors/admin see the tenant list.
router.get("/", authenticate, async (req, res) => {
  try {
    const isPrivileged = req.user.role === "supervisor" || req.user.role === "admin" || req.user.role === "bishop";
    const q = kdb("student_devices").select("*");
    if (isPrivileged) {
      if (req.user.tenantId) q.where({ tenant_id: req.user.tenantId });
    } else {
      const student = await findOwnStudent(req.user.id, req.user.tenantId);
      if (!student) return res.json({ success: true, data: [] });
      q.where({ student_id: student.id });
    }
    const rows = await q.orderBy("created_at", "desc");
    res.json({ success: true, data: (rows as any[]).map(publicDevice) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر جلب الأجهزة. حاول مرة أخرى." });
  }
});

// Approve a pending device (administrative). Tenant-scoped.
router.post("/:id/approve", authenticate, authorizePermission(AppPermission.MANAGE_ATTENDANCE), async (req, res) => {
  try {
    const q = kdb("student_devices").where({ id: req.params.id });
    if (req.user.tenantId) q.andWhere({ tenant_id: req.user.tenantId });
    const device = await q.first();
    if (!device) return res.status(404).json({ success: false, message: "الجهاز غير موجود" });
    if (device.status === "revoked") {
      return res.status(400).json({ success: false, message: "لا يمكن الموافقة على جهاز ملغي" });
    }
    await kdb("student_devices").where({ id: device.id }).update({
      status: "approved",
      approved_by: req.user.id,
      approved_at: new Date(),
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر اعتماد الجهاز. حاول مرة أخرى." });
  }
});

// Revoke a device (lost/stolen or owner request). Tenant-scoped.
router.post("/:id/revoke", authenticate, authorizePermission(AppPermission.MANAGE_ATTENDANCE), async (req, res) => {
  try {
    const q = kdb("student_devices").where({ id: req.params.id });
    if (req.user.tenantId) q.andWhere({ tenant_id: req.user.tenantId });
    const device = await q.first();
    if (!device) return res.status(404).json({ success: false, message: "الجهاز غير موجود" });
    await kdb("student_devices").where({ id: device.id }).update({
      status: "revoked",
      revoked_at: new Date(),
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "تعذر إلغاء الجهاز. حاول مرة أخرى." });
  }
});

/**
 * Is this (student, token) an approved, non-revoked device? Exposed for callers
 * that want to record device trust alongside a check-in. Never a substitute for
 * the server-side geofence.
 */
export async function isTrustedDevice(studentId: string, token: string | null | undefined): Promise<boolean> {
  if (!studentId || !token) return false;
  const row = await kdb("student_devices")
    .where({ student_id: studentId, device_token_hash: hashToken(token), status: "approved" })
    .first();
  return !!row;
}

export default router;
