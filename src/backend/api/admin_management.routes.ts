import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { invalidateUserPermissionCache } from "../infrastructure/cache";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { validatePermissionsInput } from "../infrastructure/permission-parser";
import { canGrantSubset, getEffectivePermissionCodes } from "../infrastructure/permission-grants";

const router = express.Router();

function getTenantIds(req: express.Request): string[] {
  const ids = (req as any).user?.tenantIds || [];
  if (ids.length > 0) return ids;
  if (req.user?.tenantId) return [req.user.tenantId];
  return [];
}

function primaryTenantId(req: express.Request): string | null {
  const ids = getTenantIds(req);
  return ids.length > 0 ? ids[0] : req.user?.tenantId || null;
}

router.get("/roles", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), async (req, res) => {
  try {
    const tenantIds = getTenantIds(req);
    let query = kdb("tenant_custom_roles as r")
      .leftJoin("users as u", "r.created_by", "u.id")
      .leftJoin("tenants as t", "r.tenant_id", "t.id")
      .select("r.*", "u.name as created_by_name", "t.name as tenant_name")
      .orderBy("r.created_at", "desc");

    if (tenantIds.length > 0) {
      query = query.whereIn("r.tenant_id", tenantIds);
      if (req.user?.role === 'bishop') {
        query = query.where("r.created_by", req.user.id);
      }
    } else if (req.user?.role === 'admin') {
      // admin sees all roles
    } else {
      return res.json({ success: true, data: [] });
    }

    const roles = await query;
    const formattedRoles = roles.map(r => ({
      ...r,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions
    }));

    res.json({ success: true, data: formattedRoles });
  } catch (error: any) {
    console.error('GET /roles error:', error?.message);
    res.status(500).json({ success: false, message: "حدث خطأ في تحميل الأدوار." });
  }
});

router.post("/roles", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), async (req, res) => {
  const { name, permissions, tenant_id } = req.body;

  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({ success: false, message: "بيانات الدور غير مكتملة" });
  }

  // فحص شكلي FAIL-CLOSED موحّد: مصفوفة + قيم معروفة + ALL لغير مدير التطبيق
  const input = validatePermissionsInput(permissions, req.user?.role ?? '');
  if (!input.ok) {
    return res.status(input.status!).json({ success: false, message: input.message });
  }

  try {
    const id = uuidv4();
    const tenantIds = getTenantIds(req);
    const tenantId = tenant_id || (tenantIds.length > 0 ? tenantIds[0] : null);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: "يجب تحديد السكن للدور" });
    }

    if (req.user?.role !== 'admin' && !tenantIds.includes(tenantId)) {
      return res.status(403).json({ success: false, message: "غير مصرح لك بإنشاء دور لهذا السكن" });
    }

    // GRANTOR-SUBSET: لا يُنشأ دور إلا بصلاحياتٍ يملكها المنفِّذ فعليًا
    // (يمنع الأسقف/الكاهن/المشرف من إنشاء دور بصلاحيات لا يملكها — مثل MANAGE_BISHOPS).
    const grantor = await getEffectivePermissionCodes(req.user?.id as string);
    const subset = canGrantSubset(input.permissions!, grantor.codes, grantor.hasAll, grantor.isAppAdmin);
    if (!subset.ok) {
      return res.status(subset.status).json({ success: false, message: subset.message });
    }

    await kdb("tenant_custom_roles").insert({
      id,
      tenant_id: tenantId,
      name,
      permissions: JSON.stringify([...new Set(input.permissions!)]),
      created_by: req.user?.id,
      created_at: new Date()
    });

    res.status(201).json({ success: true, data: { id, name } });
  } catch (error: any) {
    console.error('POST /roles error:', error?.message);
    res.status(500).json({ success: false, message: "حدث خطأ في إنشاء الدور." });
  }
});

router.put("/roles/:id", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), async (req, res) => {
  const { id } = req.params;
  const { name, permissions } = req.body;

  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({ success: false, message: "بيانات الدور غير مكتملة" });
  }

  // فحص شكلي FAIL-CLOSED موحّد
  const input = validatePermissionsInput(permissions, req.user?.role ?? '');
  if (!input.ok) {
    return res.status(input.status!).json({ success: false, message: input.message });
  }

  try {
    const tenantIds = getTenantIds(req);
    let roleQuery = kdb("tenant_custom_roles").where({ id });
    if (tenantIds.length > 0) {
      roleQuery = roleQuery.whereIn('tenant_id', tenantIds);
    }
    const role = await roleQuery.first();

    if (!role) {
      return res.status(404).json({ success: false, message: "الدور غير موجود" });
    }

    if (role.created_by && role.created_by !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: "لا يمكنك تعديل هذا الدور. فقط منشئ الدور أو مدير التطبيق يمكنه التعديل." });
    }

    // GRANTOR-SUBSET: لا يُعدَّل دورٌ إلى صلاحياتٍ لا يملكها المنفِّذ
    const grantor = await getEffectivePermissionCodes(req.user?.id as string);
    const subset = canGrantSubset(input.permissions!, grantor.codes, grantor.hasAll, grantor.isAppAdmin);
    if (!subset.ok) {
      return res.status(subset.status).json({ success: false, message: subset.message });
    }

    await kdb("tenant_custom_roles").where({ id }).update({
      name,
      permissions: JSON.stringify([...new Set(input.permissions!)])
    });

    const affectedUsers = await kdb("users").where({ custom_role_id: id }).select("id");
    for (const u of affectedUsers) invalidateUserPermissionCache(u.id);

    res.json({ success: true, message: "تم تحديث الدور بنجاح" });
  } catch (error: any) {
    console.error('PUT /roles error:', error?.message);
    res.status(500).json({ success: false, message: "حدث خطأ في تحديث الدور." });
  }
});

router.delete("/roles/:id", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), async (req, res) => {
  const { id } = req.params;

  try {
    const tenantIds = getTenantIds(req);
    let roleQuery = kdb("tenant_custom_roles").where({ id });
    if (tenantIds.length > 0) {
      roleQuery = roleQuery.whereIn('tenant_id', tenantIds);
    }
    const role = await roleQuery.first();

    if (!role) {
      return res.status(404).json({ success: false, message: "الدور غير موجود" });
    }

    if (role.created_by && role.created_by !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: "لا يمكنك حذف هذا الدور. فقط منشئ الدور أو مدير التطبيق يمكنه الحذف." });
    }

    const linkedUsers = await kdb("users").where({ custom_role_id: id }).first();
    if (linkedUsers) {
      return res.status(400).json({ success: false, message: "لا يمكن حذف الدور لوجود موظفين معينين عليه" });
    }

    await kdb("tenant_custom_roles").where({ id }).del();
    res.json({ success: true, message: "تم حذف الدور بنجاح" });
  } catch (error: any) {
    console.error('DELETE /roles error:', error?.message);
    res.status(500).json({ success: false, message: "حدث خطأ في حذف الدور." });
  }
});

router.get("/my-tenants", authenticate, async (req, res) => {
  try {
    let tenants;
    if (req.user?.role === 'admin') {
      tenants = await kdb("tenants").select("id", "name").orderBy("name", "asc");
    } else if (req.user?.role === 'bishop') {
      tenants = await kdb("tenants").where({ bishop_id: req.user.id }).select("id", "name").orderBy("name", "asc");
    } else {
      tenants = await kdb("tenants as t")
        .join("user_tenant_assignments as uta", "t.id", "uta.tenant_id")
        .where("uta.user_id", req.user?.id)
        .select("t.id", "t.name")
        .orderBy("t.name", "asc");
    }

    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ في تحميل السكنات." });
  }
});

router.get("/tenants", authenticate, authorizePermission(AppPermission.MANAGE_GLOBAL_TENANTS), async (req, res) => {
  try {
    const tenantIds = getTenantIds(req);
    let query = kdb("tenants as t")
      .leftJoin("users as b", "t.bishop_id", "b.id")
      .select("t.*", "b.name as bishop_name")
      .orderBy("t.created_at", "desc");

    if (tenantIds.length > 0) {
      query = query.whereIn("t.id", tenantIds);
    }

    const tenants = await query;
    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ في تحميل السكنات." });
  }
});

router.get("/bishops", authenticate, authorizePermission(AppPermission.MANAGE_BISHOPS), async (req, res) => {
  try {
    const tenantIds = getTenantIds(req);
    let query = kdb("users")
      .where({ role: 'bishop' })
      .select("id", "name", "email", "created_at");

    // For non-admin users with tenant scope, only return themselves
    if (tenantIds.length > 0 && req.user?.role !== 'admin') {
      query = query.where("id", req.user?.id);
    }

    const bishops = await query;
    res.json({ success: true, data: bishops });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ في تحميل الأساقفة." });
  }
});

router.get("/all-staff", authenticate, authorizePermission(AppPermission.MANAGE_GLOBAL_TENANTS), async (req, res) => {
  try {
    const tenantIds = getTenantIds(req);
    let query = kdb("users as u")
      .leftJoin("tenants as t", "u.tenant_id", "t.id")
      .whereIn("u.role", ["supervisor", "priest", "assistant_supervisor", "employee"])
      .select("u.id", "u.name", "u.email", "u.role", "t.name as tenant_name")
      .orderBy("u.created_at", "desc");

    if (tenantIds.length > 0) {
      query = query.whereIn("u.tenant_id", tenantIds);
    }

    const staff = await query;
    res.json({ success: true, data: staff });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ في تحميل الموظفين." });
  }
});

router.get("/stats/documents", authenticate, authorizePermission(AppPermission.MANAGE_GLOBAL_TENANTS), async (req, res) => {
  try {
    const requiredDocs = ['id_front', 'id_back', 'parent_id', 'recommendation_letter'];
    const tenantIds = getTenantIds(req);

    let query = kdb("students as s")
      .leftJoin("StudentDocuments as sd", "s.id", "sd.student_id")
      .join("users as u", "s.user_id", "u.id")
      .join("tenants as t", "s.tenant_id", "t.id")
      .select(
        "s.id",
        "u.name as student_name",
        "t.name as tenant_name",
        kdb.raw("STRING_AGG(COALESCE(sd.doc_type, ''), ',') WITHIN GROUP (ORDER BY sd.doc_type) as uploaded_types")
      );

    if (tenantIds.length > 0) {
      query = query.whereIn("s.tenant_id", tenantIds);
    }

    const studentsWithMissingDocs = await query.groupBy("s.id", "u.name", "t.name").catch(() => []);

    const report = (studentsWithMissingDocs || []).map(s => {
      const uploaded = s.uploaded_types ? s.uploaded_types.split(',') : [];
      const missing = requiredDocs.filter(d => !uploaded.includes(d));
      return { ...s, missing_docs: missing, is_complete: missing.length === 0 };
    }).filter(s => !s.is_complete);

    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('documents stats error:', error?.message);
    res.status(500).json({ success: false, message: "حدث خطأ في تحميل إحصائيات الوثائق." });
  }
});

export default router;
