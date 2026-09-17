import express from "express";
import path from "path";
import fs from "fs";
import { kdb } from "../infrastructure/db";
import { authenticate, computeUserTenantIds } from "./middleware";

const router = express.Router();

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

type OrphanedOwner =
  | { kind: "event-receipt"; tenant_id: string | null; user_id: string; student_id: string | null }
  | { kind: "maintenance"; tenant_id: string; requester_id: string }
  | null;

// تأمين ملفات /uploads — مفيش وصول من غير مصادقة
router.use(authenticate);

function resolveSafeFile(rawPath: string): string | null {
  const clean = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (clean.startsWith("..") || clean.includes("../") || clean.includes("/..")) return null;
  const resolved = path.resolve(UPLOADS_ROOT, clean);
  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) return null;
  return resolved;
}

export async function canAccessDocument(user: any, studentId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const student = await kdb("students as s")
    .select("s.user_id", "s.tenant_id")
    .where("s.id", studentId)
    .first();
  if (!student) return false;

  if (user.role === "student") {
    return student.user_id === user.id;
  }
  if (user.role === "parent") {
    const linked = await kdb("student_guardians as sg")
      .join("parents as p", "p.id", "sg.guardian_id")
      .where("sg.student_id", studentId)
      .where("p.user_id", user.id)
      .first();
    return !!linked;
  }
  // كل أدوار الهيئة (أسقف/مشرف/كاهن/موظف/نائب مشرف): فقط ضمن سكناتهم المسموحة
  if (["bishop", "supervisor", "priest", "employee", "assistant_supervisor"].includes(user.role)) {
    if (!student.tenant_id) return false;
    const allowed = await computeUserTenantIds(user);
    return allowed.includes(student.tenant_id);
  }
  return false;
}

// ملفات /uploads/documents/ غير المرتبطة بسجل StudentDocuments (إيصالات فعاليات وصور صيانة)
export async function resolveOrphanedDocument(baseName: string): Promise<OrphanedOwner> {
  const sub = await kdb("event_subscriptions as es")
    .join("events as ev", "es.event_id", "ev.id")
    .select("ev.tenant_id", "es.user_id", "es.student_id")
    .where("es.receipt_image", "like", `%${baseName}`)
    .first();
  if (sub) return { kind: "event-receipt", tenant_id: sub.tenant_id ?? null, user_id: sub.user_id, student_id: sub.student_id ?? null };

  const mtn = await kdb("maintenance_requests")
    .select("tenant_id", "requester_id")
    .where("photo_url", "like", `%${baseName}`)
    .first();
  if (mtn) return { kind: "maintenance", tenant_id: mtn.tenant_id, requester_id: mtn.requester_id };

  return null;
}

// صلاحية الوصول لملف documents غير مرتبط بمستند طالب
export async function canAccessOrphanedDocument(user: any, owner: NonNullable<OrphanedOwner>): Promise<boolean> {
  if (user.role === "admin") return true;

  if (owner.kind === "event-receipt") {
    // صاحب الاشتراك يرى الإيصال الذي رفعه
    if (owner.user_id === user.id) return true;
    // ولي الأمر يرى إيصال طفله المَشترك
    if (user.role === "parent" && owner.student_id) {
      const child = await kdb("student_guardians as sg")
        .join("parents as p", "p.id", "sg.guardian_id")
        .where("sg.student_id", owner.student_id)
        .where("p.user_id", user.id)
        .first();
      if (child) return true;
    }
    if (owner.tenant_id == null) {
      // فعالية عامة (بلا سكن): للمشرف العام وأساقفة النظام فقط
      return user.role === "bishop";
    }
    const allowed = await computeUserTenantIds(user);
    return allowed.includes(owner.tenant_id);
  }

  // طلب صيانة: مقدّم الطلب يرى صورته
  if (owner.requester_id === user.id) return true;
  if (owner.tenant_id == null) return user.role === "bishop";
  const allowed = await computeUserTenantIds(user);
  return allowed.includes(owner.tenant_id);
}

router.get("/:path(*)", async (req, res) => {
  try {
    const absPath = resolveSafeFile(req.params.path || "");
    if (!absPath) return res.status(400).json({ success: false, message: "مسار غير صالح" });

    const baseName = path.basename(absPath);
    const row = await kdb("StudentDocuments")
      .select("student_id", "file_path")
      .where("file_path", "like", `%${baseName}`)
      .first();

    if (row) {
      if (!await canAccessDocument(req.user, row.student_id)) {
        return res.status(403).json({ success: false, message: "ليس لديك صلاحية الوصول لهذا الملف" });
      }
    } else {
      // الملف غير مربوط بمستند طالب:
      const lowerPath = absPath.replace(/\\/g, "/").toLowerCase();
      // راديو 514 ومرفقات الإعلانات: محتوى عام للنظام كاملاً (بحكم التصميم) — أي مستخدم مصادق
      const publicArea = lowerPath.includes("/uploads/radio/") || lowerPath.includes("/uploads/broadcasts/");
      if (!publicArea) {
        if (req.user.role === "admin") {
          // المشرف العام يرى أي ملف
        } else if (!lowerPath.includes("/uploads/documents/")) {
          // أي مجلد آخر داخل uploads غير docs/radio/broadcasts: مرفوض لغير admin
          return res.status(403).json({ success: false, message: "ليس لديك صلاحية الوصول لهذا الملف" });
        } else {
          const owner = await resolveOrphanedDocument(baseName);
          if (!owner || !await canAccessOrphanedDocument(req.user, owner)) {
            return res.status(403).json({ success: false, message: "ليس لديك صلاحية الوصول لهذا الملف" });
          }
        }
      }
    }

    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      return res.status(404).json({ success: false, message: "الملف غير موجود" });
    }
    res.sendFile(absPath);
  } catch (error: any) {
    res.status(500).json({ success: false, message: "فشل تحميل الملف" });
  }
});

export default router;