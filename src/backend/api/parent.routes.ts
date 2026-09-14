import express from "express";
import bcrypt from 'bcryptjs';
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission, computeUserTenantIds } from "./middleware";
import { AppPermission, UserRole } from "../../types/permissions";
import { getStudentAccount } from "../services/student-account.service";

const router = express.Router();

// التحقق من أن المستخدم يملك صلاحية الوصول لسكن ولي الأمر
const canAccessParentTenant = async (req: any, tenantId: string | null | undefined): Promise<boolean> => {
  if (!tenantId) return false;
  if (req.user.role === UserRole.Admin) return true;
  const allowed = await computeUserTenantIds(req.user);
  return allowed.includes(tenantId);
};

// بحث عن ولي أمر موجود بالإيميل (for supervisors/admins only)
router.get("/search", authenticate, authorizePermission(AppPermission.ADD_STUDENT), async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.json({ success: true, data: [] });
    }
    const tenantId = req.user.tenantId;

    const parents = await kdb("users as u")
      .join("parents as p", "u.id", "p.user_id")
      .join("tenants as t", "p.tenant_id", "t.id")
      .select(
        "p.id as parent_id",
        "u.id as user_id",
        "u.name",
        "u.email",
        "p.phone",
        "p.whatsapp",
        "p.occupation",
        "t.name as tenant_name",
        "p.tenant_id"
      )
      .where("u.email", "LIKE", `%${email}%`)
      .andWhere("u.role", "parent")
      .andWhere("p.tenant_id", tenantId)
      .limit(10);

    // جلب عدد الأبناء لكل ولي أمر
    const parentsWithCount = await Promise.all(
      parents.map(async (p: any) => {
        const childCount = await kdb("student_guardians")
          .where({ guardian_id: p.parent_id })
          .count("id as total")
          .first();
        return { ...p, childCount: Number(childCount?.total || 0) };
      })
    );

    res.json({ success: true, data: parentsWithCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Get children overview for a parent
router.get("/children", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find ALL guardian records for this user (across tenants)
    const parents = await kdb("parents").select("id", "tenant_id").where({ user_id: userId });
    if (!parents || parents.length === 0) {
      return res.status(404).json({ success: false, message: "Parent profile not found" });
    }

    const guardianIds = parents.map((p: any) => p.id);

    // Find all students linked to this guardian across all tenants
    const children = await kdb("students as s")
      .join("users as u", "s.user_id", "u.id")
      .join("student_guardians as sg", "s.id", "sg.student_id")
      .leftJoin("rooms as r", "s.room_id", "r.id")
      .leftJoin("apartments as a", "r.apartment_id", "a.id")
      .join("tenants as t", "s.tenant_id", "t.id")
      .select("s.*", "u.name", "r.room_number", "a.name as apartment_name", "t.name as tenant_name", "t.bishop_id")
      .whereIn("sg.guardian_id", guardianIds);

    res.json({ success: true, data: children });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Get financial summary for a specific child (parent view)
router.get("/child/:id/finance", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const studentId = req.params.id;

    const parents = await kdb("parents").select("id").where({ user_id: userId });
    if (!parents || parents.length === 0) return res.status(403).json({ success: false, message: "Unauthorized" });

    const guardianIds = parents.map((p: any) => p.id);
    const isLink = await kdb("student_guardians").where({ student_id: studentId }).whereIn("guardian_id", guardianIds).first();
    if (!isLink) return res.status(403).json({ success: false, message: "Unauthorized access to student data" });

    const student = await kdb("students").select("id", "agreed_price", "billing_cycle").where({ id: studentId }).first();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const account = await getStudentAccount(studentId, { visibility: 'tenant' });

    const penalties = await kdb("finances")
      .where({ student_id: studentId, type: "expense" })
      .where(function () { this.whereNull('is_admin_only').orWhere('is_admin_only', 0); })
      .orderBy("date", "desc");

    const totalPenalties = penalties.reduce((sum, p) => sum + Number(p.amount), 0);

    res.json({
      success: true,
      data: {
        agreedPrice: account?.source === 'agreed' ? account?.invoice : Number(student.agreed_price || 0),
        roomPrice: account?.roomPrice || 0,
        invoice: account?.invoice || 0,
        source: account?.source || 'agreed',
        totalPaid: account?.totalPaid || 0,
        remaining: account?.remaining || 0,
        balance: account?.balance || 0,
        debtStatus: account?.debtStatus || 'paid',
        creditAmount: account?.creditAmount || 0,
        totalPenalties,
        paymentPercent: account?.paymentPercent || 0,
        billingCycle: account?.billingCycle || student.billing_cycle || null,
        penalties,
        payments: account?.payments || [],
        transactions: account?.transactions || [],
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Get detailed report for a specific child
router.get("/child/:id/report", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const studentId = req.params.id;

    const parents = await kdb("parents").select("id").where({ user_id: userId });
    if (!parents || parents.length === 0) return res.status(403).json({ success: false, message: "Unauthorized" });

    const guardianIds = parents.map((p: any) => p.id);
    const isLink = await kdb("student_guardians").where({ student_id: studentId }).whereIn("guardian_id", guardianIds).first();
    if (!isLink) return res.status(403).json({ success: false, message: "Unauthorized access to student data" });

    const attendance = await kdb("attendance").where({ student_id: studentId }).orderBy("created_at", "desc").limit(10);

    const finance = await kdb("finances").where({ student_id: studentId }).orderBy("date", "desc");

    const points = await kdb("student_points").where({ student_id: studentId }).orderBy("created_at", "desc");
    const warnings = await kdb("student_warnings").where({ student_id: studentId }).orderBy("created_at", "desc");

    const delays = await kdb("student_delays").where({ student_id: studentId }).orderBy("actual_entry_time", "desc");

    const student = await kdb("students").select("is_traveling", "travel_destination", "travel_start_time").where({ id: studentId }).first();

    res.json({
      success: true,
      data: {
        attendance,
        finance,
        behavior: { points, warnings },
        delays,
        travel: student
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Get student documents/files for a specific child (parent view)
router.get("/child/:id/documents", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const studentId = req.params.id;

    const parents = await kdb("parents").select("id").where({ user_id: userId });
    if (!parents || parents.length === 0) return res.status(403).json({ success: false, message: "Unauthorized" });

    const guardianIds = parents.map((p: any) => p.id);
    const isLink = await kdb("student_guardians").where({ student_id: studentId }).whereIn("guardian_id", guardianIds).first();
    if (!isLink) return res.status(403).json({ success: false, message: "Unauthorized access to student data" });

    const files = await kdb("StudentDocuments")
      .where({ student_id: studentId })
      .orderBy("upload_date", "desc");

    res.json({ success: true, data: files });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "تعذر تحميل الوثائق" });
  }
});

// Get parent profile by ID (for supervisors/admins)
router.get("/:id", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  try {
    const { id } = req.params;
    const parent = await kdb("parents as p")
      .join("users as u", "p.user_id", "u.id")
      .select(
        "p.id",
        "p.user_id",
        "p.tenant_id",
        "u.name",
        "u.email",
        "p.phone",
        "p.whatsapp",
        "p.occupation",
        "p.photo"
      )
      .where("p.id", id)
      .first();
    if (!parent) return res.status(404).json({ success: false, message: "ولي الأمر غير موجود" });
    if (!await canAccessParentTenant(req, parent.tenant_id)) {
      return res.status(403).json({ success: false, message: "غير مسموح لك بالاطلاع على بيانات هذا ولي الأمر" });
    }
    const { tenant_id, ...safeParent } = parent;
    res.json({ success: true, data: safeParent });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "فشل تحميل بيانات ولي الأمر" });
  }
});

// Update parent profile (for supervisors/admins)
router.put("/:id", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, whatsapp, occupation, password } = req.body;

    const parent = await kdb("parents").where({ id }).first();
    if (!parent) return res.status(404).json({ success: false, message: "ولي الأمر غير موجود" });
    if (!await canAccessParentTenant(req, parent.tenant_id)) {
      return res.status(403).json({ success: false, message: "غير مسموح لك بتعديل بيانات هذا ولي الأمر" });
    }

    const userUpdate: any = {};
    if (name !== undefined) userUpdate.name = name;
    // تغيير الإيميل وكلمة المرور (يُعتبران خطوا حساب) مقصور على مدير التطبيق / الأسقف
    const responsible = req.user.role === UserRole.Admin || req.user.role === UserRole.Bishop;
    if (email !== undefined) {
      if (!responsible) return res.status(403).json({ success: false, message: "تغيير البريد الإلكتروني يتطلب صلاحية مدير/أسقف" });
      userUpdate.email = email;
    }
    if (password) {
      if (!responsible) return res.status(403).json({ success: false, message: "إعادة تعيين كلمة المرور تتطلب صلاحية مدير/أسقف" });
      const hashedPassword = await bcrypt.hash(password, 10);
      userUpdate.password = hashedPassword;
    }
    if (Object.keys(userUpdate).length > 0) {
      await kdb("users").where({ id: parent.user_id }).update(userUpdate);
    }

    const parentUpdate: any = {};
    if (phone !== undefined) parentUpdate.phone = phone;
    if (whatsapp !== undefined) parentUpdate.whatsapp = whatsapp;
    if (occupation !== undefined) parentUpdate.occupation = occupation;
    if (Object.keys(parentUpdate).length > 0) {
      await kdb("parents").where({ id }).update(parentUpdate);
    }

    res.json({ success: true, message: "تم تحديث بيانات ولي الأمر بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "فشل تحديث بيانات ولي الأمر" });
  }
});

export default router;
