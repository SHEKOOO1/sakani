import express from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { kdb, checkUserPermission } from "../infrastructure/db";
import { invalidateUserPermissionCache } from "../infrastructure/cache";
import { authenticate, authorizePermission, getAllowedAssignableRoles } from "./middleware";
import { AppPermission, UserRole, validatePermissionArray } from "../../types/permissions";
import { parsePagination, paginateQuery } from "../services/radio/pagination";

const router = express.Router();

async function resolveTenantIds(req: express.Request): Promise<string[]> {
  let ids = (req as any).user?.tenantIds || (req.user.tenantId ? [req.user.tenantId] : []);
  if (ids.length === 0 && req.user.role !== 'admin') {
    const byBishop = req.user.role === 'bishop'
      ? await kdb('tenants').select('id').where({ bishop_id: req.user.id })
      : [];
    const byAssignment = await kdb('user_tenant_assignments').select('tenant_id').where({ user_id: req.user.id });
    const byOwnTenant = req.user.tenantId ? [req.user.tenantId] : [];
    ids = [...new Set([
      ...byBishop.map((t: any) => t.id),
      ...byAssignment.map((t: any) => t.tenant_id),
      ...byOwnTenant,
    ])];
  }
  return ids;
}

/**
 * @openapi
 * /employees:
 *   get:
 *     tags: [الموظفين]
 *     summary: جلب قائمة الموظفين مع pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: قائمة الموظفين
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
// جلب قائمة الموظفين مع تفاصيل أدوارهم المخصصة
router.get("/", authenticate, authorizePermission(AppPermission.MANAGE_EMPLOYEES), async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const isAdmin = req.user.role === 'admin';
    let query = kdb("users as u")
      .leftJoin("tenants as t", "u.tenant_id", "t.id")
      .select("u.id", "u.name", "u.email", "u.role", "u.gender", "u.tenant_id", "t.name as tenant_name", "u.custom_role_id", "u.custom_permissions", kdb.raw(`CASE WHEN OBJECT_ID('tenant_custom_roles') IS NOT NULL THEN (SELECT name FROM tenant_custom_roles WHERE id = u.custom_role_id) ELSE NULL END as custom_role_name`), "u.daily_readings_enabled", "u.radio_514_enabled", "u.created_at")
      .orderBy("u.created_at", "desc");

    if (isAdmin) {
      query = query.whereIn("u.role", ["bishop", "priest", "supervisor", "employee", "assistant_supervisor"]);
    } else {
      const roleHierarchy: Record<string, string[]> = {
        bishop: ['priest', 'supervisor', 'assistant_supervisor', 'employee'],
        priest: ['supervisor', 'assistant_supervisor', 'employee'],
        supervisor: ['assistant_supervisor', 'employee'],
        assistant_supervisor: ['employee'],
        employee: [],
      };
      const visibleRoles = roleHierarchy[req.user.role] || [];
      const tenantIds = await resolveTenantIds(req);
      query = query.where(function () {
        this.whereIn("u.tenant_id", tenantIds)
            .orWhereIn("u.id", function () {
              this.select("user_id").from("user_tenant_assignments").whereIn("tenant_id", tenantIds);
            });
      }).whereIn("u.role", visibleRoles.length > 0 ? visibleRoles : ['___none___']);
    }

    const result = await paginateQuery<any>(query, { page, limit });

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Employees GET error:", error?.message || error);
    res.status(500).json({ success: false, message: "�� ��� ���. �� ���� ��� ��������." });
  }
});

// إضافة موظف جديد وربطه بدور (أساسي أو مخصص)
router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_EMPLOYEES), async (req, res) => {
  const { name, email, password, role, gender, custom_role_id, tenant_id, daily_readings_enabled, radio_514_enabled } = req.body;
  const creatorRole = req.user.role;
  const tenantIds = await resolveTenantIds(req);

  // تحديد السكن: للمدير يأخذ من البودي، للأسقف يأخذ من البودي مع التحقق من ملكيته
  let targetTenantId = tenant_id || req.user.tenantId;
  if (creatorRole !== 'admin') {
    if (!targetTenantId || !tenantIds.includes(targetTenantId)) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد سكن تابع لك'
      });
    }
  } else if (!targetTenantId) {
    return res.status(400).json({
      success: false,
      message: 'يجب تحديد السكن'
    });
  }

  // التحقق من أن المنشئ لديه صلاحية إنشاء هذا الدور
  const allowedRoles = getAllowedAssignableRoles(creatorRole);
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({
      success: false,
      message: `غير مسموح لك بإنشاء مستخدمين بدور "${role}". الأدوار المسموح بها: ${allowedRoles.join(', ')}`
    });
  }

  try {
    const id = uuidv4();
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'كلمة السر يجب أن تكون على الأقل 8 أحرف' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // التحقق من أن الدور المخصص يخص نفس السكن المستهدف (منع التصعيد عبر سكن آخر)
    if (custom_role_id) {
      const customRole = await kdb('tenant_custom_roles')
        .where({ id: custom_role_id, tenant_id: targetTenantId })
        .first();
      if (!customRole) {
        return res.status(400).json({ success: false, message: 'الدور المخصص غير موجود في السكن المستهدف' });
      }
    }

    await kdb.transaction(async (trx) => {
      await trx("users").insert({
        id,
        tenant_id: targetTenantId,
        name,
        email,
        password: hashedPassword,
        role,
        gender: gender || 'male',
        custom_role_id: custom_role_id || null,
        daily_readings_enabled: req.user.role === 'admin' && daily_readings_enabled !== undefined ? (daily_readings_enabled ? 1 : 0) : 1,
        radio_514_enabled: req.user.role === 'admin' && radio_514_enabled !== undefined ? (radio_514_enabled ? 1 : 0) : 1,
        created_at: new Date()
      });

      await trx("user_tenant_assignments").insert({
        user_id: id,
        tenant_id: targetTenantId,
        assigned_at: new Date()
      });
    });

    res.status(201).json({ success: true, data: { id, name, email } });
  } catch (error: any) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(400).json({ success: false, message: "البريد الإلكتروني مسجل مسبقاً" });
    }
    res.status(500).json({ success: false, message: "حدث خطأ. لم يتم إنشاء الموظف." });
  }
});

// تحديث بيانات موظف أو تغيير دوره المخصص
router.put("/:id", authenticate, authorizePermission(AppPermission.MANAGE_EMPLOYEES), async (req, res) => {
  const { id } = req.params;
  const { name, role, custom_role_id, custom_permissions, daily_readings_enabled, radio_514_enabled } = req.body;
  const creatorRole = req.user.role;
  const tenantIds = await resolveTenantIds(req);

  try {
    // جلب بيانات الموظف الحالية لمقارنة الدور
    let existingUserQuery = kdb("users").where({ id });
    if (creatorRole !== 'admin') {
      existingUserQuery = existingUserQuery.whereIn('tenant_id', tenantIds);
    }
    const existingUser = await existingUserQuery.first();
    
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "الموظف غير موجود" });
    }

    // منع المشرف من تعديل صلاحياته هو أو صلاحيات من فوقه في التسلسل الهرمي
    if (id === req.user.id && creatorRole !== 'admin') {
      return res.status(403).json({ success: false, message: "لا يمكنك تعديل صلاحيات حسابك بنفسه. اطلب من مديرك." });
    }

    // التحقق من أن المستخدم الحالي لديه صلاحية تعيين هذا الدور (فقط إذا تغير الدور)
    if (role && role !== existingUser.role) {
      const allowedRoles = getAllowedAssignableRoles(creatorRole);
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: `غير مسموح لك بتغيير دور المستخدم إلى "${role}". الأدوار المسموح بها: ${allowedRoles.join(', ')}`
        });
      }
    }

    // منع إعطاء صلاحيات غير صحيحة أو صلاحية ALL
    if (custom_permissions && custom_permissions.length > 0) {
      if (custom_permissions.includes('ALL') && creatorRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'صلاحية "ALL" غير مسموحة إلا لمدير التطبيق' });
      }
      const permValidation = validatePermissionArray(custom_permissions);
      if (!permValidation.valid) {
        return res.status(403).json({ success: false, message: `صلاحية غير معروفة: ${permValidation.invalidPermission}` });
      }
      // موانع التصعيد: لا يجوز للمشرف/الكاهن/الأسقف منح صلاحية استثنائية لا يملكها هو نفسه
      if (creatorRole !== 'admin') {
        for (const perm of custom_permissions) {
          if (!(await checkUserPermission(req.user.id, perm))) {
            return res.status(403).json({ success: false, message: `لا تملك صلاحية منح "الصلاحية ${perm}" لغيرك` });
          }
        }
      }
    }

    const updateData: any = { name };

    // إضافة الدور للتحديث فقط إذا تغير عن القيمة الحالية
    if (role && role !== existingUser.role) updateData.role = role;
    
    // إذا تم اختيار دور مخصص، نقوم بتحديثه
    if (custom_role_id !== undefined && custom_role_id !== null) {
      // التحقق من أن الدور المخصص يخص نفس سكنات المستخدم المستهدف
      const targetTenantId = existingUser.tenant_id || (tenantIds.length > 0 ? tenantIds[0] : null);
      if (!targetTenantId || !tenantIds.includes(targetTenantId)) {
        return res.status(403).json({ success: false, message: 'لا يمكنك ربط موظف بدور في سكن لا تديره' });
      }
      const customRole = await kdb('tenant_custom_roles')
        .where({ id: custom_role_id, tenant_id: targetTenantId })
        .first();
      if (!customRole) {
        return res.status(400).json({ success: false, message: 'الدور المخصص غير موجود في سكن المستخدم المستهدف' });
      }
      updateData.custom_role_id = custom_role_id;
    } else if (custom_role_id === null) {
      updateData.custom_role_id = null;
    }

    if (daily_readings_enabled !== undefined && req.user.role === 'admin') {
      updateData.daily_readings_enabled = daily_readings_enabled ? 1 : 0;
    }
    if (radio_514_enabled !== undefined && req.user.role === 'admin') {
      updateData.radio_514_enabled = radio_514_enabled ? 1 : 0;
    }
    
    // إمكانية إضافة صلاحيات استثنائية (Overriding) لهذا المستخدم تحديداً
    if (custom_permissions) updateData.custom_permissions = JSON.stringify(custom_permissions);

    let updateQuery = kdb("users").where({ id });
    if (creatorRole !== 'admin') {
      updateQuery = updateQuery.whereIn('tenant_id', tenantIds);
    }
    await updateQuery.update(updateData);
    invalidateUserPermissionCache(id);

    res.json({ success: true, message: "تم تحديث بيانات الموظف بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// جلب سجل التدقيق لموظف معين (آخر 50 عملية)
router.get("/:id/audit", authenticate, authorizePermission(AppPermission.MANAGE_EMPLOYEES), async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.role !== 'admin') {
      // المستخدم المستهدف يجب أن يكون ضمن سكنات المستخدم الحالي
      const targetUser = await kdb("users").select("id", "tenant_id").where({ id }).first().catch(() => null);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: "الموظف غير موجود" });
      }
      const tenantIds = await resolveTenantIds(req);
      const targetTenantIds = new Set<string>();
      if (targetUser.tenant_id) targetTenantIds.add(targetUser.tenant_id);
      const assignments: any[] = await kdb("user_tenant_assignments").select("tenant_id").where({ user_id: id });
      for (const a of assignments) targetTenantIds.add(a.tenant_id);
      if (![...targetTenantIds].some(t => tenantIds.includes(t))) {
        return res.status(403).json({ success: false, message: "لا يمكنك الاطلاع على سجل هذا الموظف" });
      }
    }

    const logs = await kdb("audit_logs")
      .where({ user_id: id })
      .select("id", "action as action_type", "method", "path as url", "status as status_code", "created_at")
      .orderBy("created_at", "desc")
      .limit(50);

    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
