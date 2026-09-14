import express from "express";
import path from "path";
import fs from "fs";
import { kdb } from "../infrastructure/db";
import { authenticate } from "./middleware";

const router = express.Router();

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

// تأمين ملفات /uploads — مفيش وصول من غير مصادقة
router.use(authenticate);

function resolveSafeFile(rawPath: string): string | null {
  const clean = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (clean.startsWith("..") || clean.includes("../") || clean.includes("/..")) return null;
  const resolved = path.resolve(UPLOADS_ROOT, clean);
  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) return null;
  return resolved;
}

async function canAccessDocument(user: any, studentId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const student = await kdb("students as s")
    .leftJoin("tenants as t", "s.tenant_id", "t.id")
    .select("s.user_id", "s.tenant_id", "t.bishop_id")
    .where("s.id", studentId)
    .first();
  if (!student) return false;

  if (user.role === "bishop") {
    return !!student.bishop_id && student.bishop_id === user.id;
  }
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
  // مشرف/كاهن/موظف/نائب مشرف — من نفس السكن
  if (["supervisor", "priest", "employee", "assistant_supervisor"].includes(user.role)) {
    return !!student.tenant_id && student.tenant_id === user.tenantId;
  }
  return false;
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
      // الملف غير مربوط بمستند طالب: نمنع الوصول لأي مستخدم مصادق إلا للأقسام المخصصة للجميع
      // (راديو 514 ومرفقات الإعلانات) أو لأعضاء الهيئة المشرفين
      const lowerPath = absPath.replace(/\\/g, "/").toLowerCase();
      const publicArea = lowerPath.includes("/uploads/radio/") || lowerPath.includes("/uploads/broadcasts/");
      const isStaff = ["admin", "bishop", "supervisor", "priest", "employee", "assistant_supervisor"].includes(req.user.role);
      if (!publicArea && !isStaff) {
        return res.status(403).json({ success: false, message: "ليس لديك صلاحية الوصول لهذا الملف" });
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