import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { kdb, logAuditEvent } from "../infrastructure/db";
import { invalidateUserPermissionCache } from "../infrastructure/cache.ts";
import { authenticate, authorizePermission, getAllowedAssignableRoles, computeUserTenantIds } from "./middleware";
import { validate } from "../validation/middleware";
import { createUserSchema, updateUserSchema, addToTenantSchema } from "../validation/schemas";
import { AppPermission, UserRole, validatePermissionArray } from "../../types/permissions";
import { parsePagination, paginateQuery } from "../services/radio/pagination.ts";

const router = express.Router();

// إزالة حقل كلمة المرور قبل إرسال أي كائن مستخدم للعميل
const safeUser = (u: any) => {
  if (!u) return u;
  const { password, ...rest } = u;
  return rest;
};

// التحقق من أن المستخدم الحالي يملك صلاحية إدارة المستخدم المستهدف (عزل تام بين السكنات)
// FAIL-CLOSED: حساب الرقم العام (tenant_id = NULL) بلا أي رابطة لا يعني "كل السكنات".
export const canManageTargetUser = async (req: any, target: any): Promise<boolean> => {
  if (!target) return false;
  if (req.user.role === UserRole.Admin) return true;
  // لا يجوز لغير مدير التطبيق التعديل/الحذف على حسابات مدير/أسقف خارج ولايته
  if (target.role === UserRole.Admin || target.role === UserRole.Bishop) return false;
  const allowedIds = await computeUserTenantIds(req.user);
  if (allowedIds.length === 0) return false;
  // نطاق المستخدم المستهدف = tenant_id + كل روابط user_tenant_assignments (من قاعدة البيانات)
  const targetScope = new Set<string>();
  if (target.tenant_id) targetScope.add(target.tenant_id);
  const assignments = await kdb('user_tenant_assignments')
    .where({ user_id: target.id })
    .select('tenant_id');
  for (const a of assignments) if (a.tenant_id) targetScope.add(a.tenant_id);
  if (targetScope.size === 0) return false;
  for (const id of targetScope) if (allowedIds.includes(id)) return true;
  return false;
};

// استيراد حساب عام (add-to-tenant): الحسابات غير المرابطة بأي سكن بعد تستحق الإستيراد بواسطة أي
// مدير سكن معتمد — هذه الحالة وحدها تمارس نفس سلوك استيراد الحساب العالمي السابق، بينما تُقيّد
// عمليات الإدارة (تحديث/حذف/صلاحيات/كلمة مرور) بواسطة canManageTargetUser (FAIL-CLOSED).
export const canImportTargetUser = async (req: any, target: any): Promise<boolean> => {
  if (!target) return false;
  if (req.user.role === UserRole.Admin) return true;
  if (target.role === UserRole.Admin || target.role === UserRole.Bishop) return false;
  // حسابات عامة غير مرابطة بسكن بعد — يستطيع أي مدير سكن معتمد استيرادها
  if (!target.tenant_id) return true;
  const allowedIds = await computeUserTenantIds(req.user);
  if (allowedIds.length === 0) return false;
  if (allowedIds.includes(target.tenant_id)) return true;
  const assignments = await kdb('user_tenant_assignments')
    .where({ user_id: target.id })
    .select('tenant_id');
  return assignments.some((a: any) => allowedIds.includes(a.tenant_id));
};

// منع منح صلاحية "ALL" لأي مستخدم غير مدير التطبيق + التحقق من أن كل صلاحية قيمة صحيحة
const validatePermissionsArray = (permissions: any, role: string): string | null => {
  if (!Array.isArray(permissions)) return null;
  const upper = permissions.map((p: any) => String(p || '').toUpperCase().trim());
  if (upper.includes('ALL') && role !== UserRole.Admin) {
    return 'صلاحية "ALL" (كل الصلاحيات) غير مسموحة إلا لمدير التطبيق';
  }
  // منع إدخال قيم صلاحيات غير معروفة (منع التصعيد بصلاحيات خيالية مثل MANAGE_BISHOPS للمشرف)
  const result = validatePermissionArray(permissions);
  if (!result.valid) {
    return `صلاحية غير معروفة: ${result.invalidPermission}`;
  }
  return null;
};

// Get all users in tenant (including those assigned via user_tenant_assignments)
/**
 * @openapi
 * /users:
 *   get:
 *     tags: [المستخدمين]
 *     summary: جلب قائمة المستخدمين مع pagination
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
 *         description: قائمة المستخدمين
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get("/", authenticate, authorizePermission(AppPermission.MANAGE_USERS), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { page, limit } = parsePagination(req.query);
  try {
    const query = kdb("users as u")
      .leftJoin("user_tenant_assignments as uta", "u.id", "uta.user_id")
      .select("u.id", "u.tenant_id as tenantId", "u.email", "u.name", "u.role", "u.custom_role_id as customRoleId", "u.created_at")
      .where(function () {
        this.where("u.tenant_id", tenantId).orWhere("uta.tenant_id", tenantId);
      })
      .distinct();
    const result = await paginateQuery<any>(query, { page, limit });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "تعذر تحميل البيانات. من فضلك حاول مرة أخرى." });
  }
});

// Search existing users by name or email (for adding to tenant)
router.get("/search", authenticate, authorizePermission(AppPermission.MANAGE_USERS), async (req, res) => {
  const { q } = req.query;
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  if (!q || String(q).length < 2) return res.json({ success: true, data: [] });
  const isAdmin = req.user.role === UserRole.Admin;
  const allowedRoles = getAllowedAssignableRoles(req.user.role);
  try {
    const searchTerm = `%${q}%`;
    const query = kdb("users as u")
      .leftJoin("user_tenant_assignments as uta", (join: any) => {
        join.on("u.id", "=", "uta.user_id").andOn("uta.tenant_id", "=", kdb.raw("?", [tenantId]));
      })
      .select("u.id", "u.name", "u.email", "u.role", "u.tenant_id as homeTenantId")
      .where(function () {
        this.where("u.name", "like", searchTerm).orWhere("u.email", "like", searchTerm);
      })
      .whereNull("uta.tenant_id") // exclude users already in this tenant
      .whereIn("u.role", allowedRoles);

    let users;
    if (isAdmin) {
      users = await query.limit(20);
    } else {
      // غير مدير التطبيق: يقتصر البحث على السكنات التي يديرها + أدوار يمكن تعيينها فقط
      const allowedTenantIds = await computeUserTenantIds(req.user);
      users = await query
        .where(function () {
          this.whereIn("u.tenant_id", allowedTenantIds).orWhereNull("u.tenant_id");
        })
        .limit(20);
    }
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "تعذر البحث. من فضلك حاول مرة أخرى." });
  }
});

// Add existing user to current tenant
router.post("/add-to-tenant", authenticate, authorizePermission(AppPermission.MANAGE_USERS), validate(addToTenantSchema), async (req, res) => {
  const { userId, role } = req.body;
  const tenantId = req.user.tenantId;
  const creatorRole = req.user.role;
  if (!userId) return res.status(400).json({ success: false, message: "معرف المستخدم مطلوب" });
  try {
    const user = await kdb("users").where({ id: userId }).first();
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    const newRole = role || user.role;
    const allowedRoles = getAllowedAssignableRoles(creatorRole);
    if (!allowedRoles.includes(newRole)) {
      return res.status(403).json({ success: false, message: `غير مسموح لك بتعيين دور "${newRole}".` });
    }
    // المستخدم المستهدف يجب أن يكون غير مرابط بأي سكن آخر (نفس منطق /search) أو ضمن سكنات المدير
    if (!(await canImportTargetUser(req, user))) {
      return res.status(403).json({ success: false, message: "لا يمكنك استيراد مستخدم مسجل في سكن آخر" });
    }
    const existing = await kdb("user_tenant_assignments").where({ user_id: userId, tenant_id: tenantId }).first();
    if (existing) return res.status(400).json({ success: false, message: "المستخدم مضاف بالفعل لهذا السكن" });
    await kdb("user_tenant_assignments").insert({ user_id: userId, tenant_id: tenantId, assigned_at: new Date() });
    res.status(201).json({ success: true, message: "تم إضافة المستخدم إلى السكن بنجاح", data: { id: userId, name: user.name, role: newRole } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "فشل إضافة المستخدم. يرجى المحاولة مرة أخرى." });
  }
});

// Create user (Admin/Supervisor Only)
router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_USERS), validate(createUserSchema), async (req, res) => {
  const { email, password, name, role } = req.body;
  const tenantId = req.user.tenantId;
  const creatorRole = req.user.role;

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
    const defaultPwUser = process.env.DEFAULT_USER_PASSWORD;
    if (!defaultPwUser || defaultPwUser.length < 8) {
      return res.status(500).json({ success: false, message: 'DEFAULT_USER_PASSWORD must be set in .env (min 8 chars)' });
    }
    const hashedPassword = await bcrypt.hash(password || defaultPwUser, 10);

    await kdb.transaction(async trx => {
      await trx("users").insert({
        id,
        tenant_id: tenantId,
        email,
        password: hashedPassword,
        role,
        name
      });

      if (tenantId) {
        const existingAssignment = await trx('user_tenant_assignments')
          .where({ user_id: id, tenant_id: tenantId })
          .first();
        
        if (!existingAssignment) {
          await trx('user_tenant_assignments').insert({ user_id: id, tenant_id: tenantId });
        }
      }
    });

    res.status(201).json({ success: true, data: { id, email, name, role } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Update user details
router.put("/:id", authenticate, authorizePermission(AppPermission.MANAGE_USERS), validate(updateUserSchema), async (req, res) => {
  const { name, email, role } = req.body;
  const { id } = req.params;
  const creatorRole = req.user.role;

  try {
    const existingUser = await kdb("users").where({ id }).first();
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!(await canManageTargetUser(req, existingUser))) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية تعديل هذا المستخدم" });
    }

    if (role && role !== existingUser.role) {
      const allowedRoles = getAllowedAssignableRoles(creatorRole);
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: `غير مسموح لك بتغيير دور المستخدم إلى "${role}". الأدوار المسموح بها: ${allowedRoles.join(', ')}`
        });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role && role !== existingUser.role) updateData.role = role;

    await kdb("users").where({ id }).update(updateData);

    // الدور من الحقول الحساسة أمنيًا: تغييره يؤثر على الجلسات المفعّلة والصلاحيات،
    // لذا نمسح كاش المستخدم/الصلاحيات لهذا المستخدم فقط
    if (role && role !== existingUser.role) {
      invalidateUserPermissionCache(id);
    }

    res.json({ success: true, message: "User updated successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل تحديث المستخدم. يرجى المحاولة مرة أخرى." });
  }
});

// تغيير كلمة مرور المستخدم الحالي (self-service)
// حد معدل منفصل: يمنع تخمين كلمة المرور الحالية مع الحفاظ على إمكانية الاستخدام المشروع
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "محاولات تغيير كلمة السر كتيرة. لو سمحت استنى شوية." }
});

// ملاحظة تحديد المسار: يجب أن يُسجّل قبل "/:id/password" وإلا سيطابقه
// (حيث :id = 'me') ويُحال إلى مسار إعادة تعيين كلمة مرور المشرف
router.put("/me/password", changePasswordLimiter, authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    return res.status(400).json({ success: false, message: "كلمة المرور الحالية مطلوبة" });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 ||
      !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "كلمة المرور الجديدة يجب أن تكون بين 8 و128 حرفًا وتضم حروفًا إنجليزية ورقمًا على الأقل"
    });
  }

  try {
    const user = await kdb("users").where({ id: req.user.id }).first();
    if (!user) return res.status(401).json({ success: false, message: "المستخدم غير موجود" });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ success: false, message: "كلمة المرور الحالية غير صحيحة" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const nextVersion = (Number(user.token_version) || 0) + 1;
    await kdb("users").where({ id: user.id }).update({ password: hashedPassword, token_version: nextVersion });
    invalidateUserPermissionCache(user.id);

    // إصدار جلسة جديدة فقط للجلسة الحالية (كل الجلسات القديمة أُلغيت برفع token_version)
    const token = jwt.sign(
      { id: user.id, tenantId: user.tenant_id ?? null, role: user.role, email: user.email, gender: user.gender || 'male', daily_readings_enabled: user.daily_readings_enabled != 0, radio_514_enabled: user.radio_514_enabled != 0, tokenVersion: nextVersion },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح.", data: { user: safeUser(user) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "فشل تغيير كلمة المرور" });
  }
});

// Reset user password (Admin/Supervisor only)
router.put("/:id/password", authenticate, authorizePermission(AppPermission.MANAGE_USERS), async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
  }

  try {
    const user = await kdb("users").where({ id }).first();
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    if (!(await canManageTargetUser(req, user))) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية إعادة تعيين كلمة مرور هذا المستخدم" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nextVersion = (Number(user.token_version) || 0) + 1;
    await kdb("users").where({ id }).update({ password: hashedPassword, token_version: nextVersion });
    // رفع token_version يُبطل كل الجلسات الصادرة سابقًا لهذا المستخدم فورًا (بدون الاعتماد على
    // حذف الكوكي من العميل)، كما يُمسح كاش المستخدم/الصلاحيات حتى يحدث التغيير حالًا
    invalidateUserPermissionCache(id);

    res.json({ success: true, message: "تم إعادة تعيين كلمة المرور بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "فشل إعادة تعيين كلمة المرور" });
  }
});

// Update user role
router.patch("/:id/role", authenticate, authorizePermission(AppPermission.ASSIGN_ROLES), async (req, res) => {
  const { id } = req.params;

  // منع المستخدم من تغيير دوره بنفسه
  if (id === req.user.id) {
    return res.status(403).json({ success: false, message: "لا يمكنك تغيير دورك بنفسك. اطلب من مديرك أو من مدير التطبيق." });
  }

  const { role } = req.body;

  if (!Object.values(UserRole).includes(role as UserRole)) {
    return res.status(400).json({ success: false, message: "Invalid role" });
  }

  const creatorRole = req.user.role;
  const allowedRoles = getAllowedAssignableRoles(creatorRole);
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({
      success: false,
      message: `غير مسموح لك بتعيين دور "${role}". الأدوار المسموح بها: ${allowedRoles.join(', ')}`
    });
  }

  try {
    const target = await kdb("users").where({ id }).first();
    if (!target) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    if (!(await canManageTargetUser(req, target))) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية تغيير دور هذا المستخدم" });
    }

    await kdb("users").where({ id }).update({ role });
    invalidateUserPermissionCache(id);
    res.json({ success: true, message: "User role updated successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل تحديث دور المستخدم. يرجى المحاولة مرة أخرى." });
  }
});

// Delete user (with confirmation needed in frontend)
router.delete("/:id", authenticate, authorizePermission(AppPermission.MANAGE_USERS), async (req, res) => {
  const { id } = req.params;
  try {
    // منع المستخدم من حذف حسابه بنفسه
    if (id === req.user.id) {
      return res.status(403).json({ success: false, message: "لا يمكنك حذف حسابك بنفسك" });
    }
    const target = await kdb("users").where({ id }).first();
    if (!target) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    if (!(await canManageTargetUser(req, target))) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية حذف هذا المستخدم" });
    }

    await kdb("users").where({ id }).del();
    invalidateUserPermissionCache(id);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل حذف المستخدم. يرجى المحاولة مرة أخرى." });
  }
});

// --- مسارات إدارة الصلاحيات المخصصة (للمشرفين) ---

// 1. جلب كافة الأدوار المخصصة للسكن الحالي (للمسؤولين المحليين)
router.get("/custom-roles", authenticate, authorizePermission(AppPermission.MANAGE_USERS), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const roles = await kdb("tenant_custom_roles").where({ tenant_id: tenantId });
    // تحويل السلسلة النصية JSON إلى مصفوفة قبل الإرسال
    const formattedRoles = roles.map(r => ({ ...r, permissions: JSON.parse(r.permissions) }));
    res.json({ success: true, data: formattedRoles });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// 2. إنشاء أو تحديث دور مخصص
router.post("/custom-roles", authenticate, authorizePermission(AppPermission.MANAGE_USERS), async (req, res) => {
  const { id, name, permissions } = req.body;
  const tenantId = req.user.tenantId;

  try {
    const permError = validatePermissionsArray(permissions, req.user.role);
    if (permError) {
      return res.status(403).json({ success: false, message: permError });
    }
    const permissionsJson = JSON.stringify(permissions || []);
    if (id) {
      // تحديث دور موجود — فقط المنشئ أو مدير التطبيق
      const role = await kdb("tenant_custom_roles").where({ id, tenant_id: tenantId }).first();
      if (!role) {
        return res.status(404).json({ success: false, message: "الدور غير موجود" });
      }
      if (role.created_by && role.created_by !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "لا يمكنك تعديل هذا الدور. فقط منشئ الدور أو مدير التطبيق يمكنه التعديل." });
      }
      await kdb("tenant_custom_roles")
        .where({ id, tenant_id: tenantId })
        .update({ name, permissions: permissionsJson });
      // مسح كاش الصلاحيات لكل المستخدمين المرتبطين بهذا الدور المخصص
      const linked = await kdb("users").where({ custom_role_id: id, tenant_id: tenantId }).select("id");
      for (const u of linked) invalidateUserPermissionCache(u.id);
      res.json({ success: true, message: "تم تحديث الدور بنجاح" });
    } else {
      // إنشاء دور جديد
      const newId = uuidv4();
      await kdb("tenant_custom_roles").insert({
        id: newId, tenant_id: tenantId, name, permissions: permissionsJson,
        created_by: req.user.id,
        created_at: new Date()
      });
      res.json({ success: true, data: { id: newId }, message: "تم إنشاء الدور بنجاح" });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// 3. تعيين صلاحيات أو دور مخصص لمستخدم (طالب أو موظف)
router.put("/:id/permissions", authenticate, authorizePermission(AppPermission.MANAGE_USERS), async (req, res) => {
  const { id } = req.params;
  const { permissions, customRoleId } = req.body;
  const { role } = req.user;

  try {
    const target = await kdb("users").where({ id }).first();
    if (!target) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    if (!(await canManageTargetUser(req, target))) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية تعديل صلاحيات هذا المستخدم" });
    }

    const permError = validatePermissionsArray(permissions, role);
    if (permError) {
      return res.status(403).json({ success: false, message: permError });
    }

    if (customRoleId !== undefined && customRoleId !== null) {
      const customRole = await kdb("tenant_custom_roles")
        .where({ id: customRoleId, tenant_id: req.user.tenantId })
        .first();
      if (!customRole) {
        return res.status(404).json({ success: false, message: "الدور المخصص غير موجود في سكنك" });
      }
    }

    const updateData: any = {};
    if (permissions) updateData.custom_permissions = JSON.stringify(permissions);
    if (customRoleId !== undefined) updateData.custom_role_id = customRoleId;

    await kdb("users").where({ id }).update(updateData);
    invalidateUserPermissionCache(id);

    res.json({ success: true, message: "تم تحديث صلاحيات المستخدم بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل تحديث الصلاحيات. يرجى المحاولة مرة أخرى." });
  }
});

// مسار موحد للطلاب لجلب الأنشطة والمسابقات والفعاليات في قائمة واحدة
router.get("/student/activities-and-competitions", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  const userId = req.user.id;
  const role = req.user.role?.toLowerCase();
  const isStaff = ['admin', 'supervisor', 'priest'].includes(role);

  try {
    // Parent: filter events to only those their children are in or open for enrollment
    if (role === 'parent') {
      const parent = await kdb('parents').select('id').where({ user_id: userId }).first();
      if (!parent) return res.json({ success: true, data: [] });

      const children = await kdb('student_guardians')
        .select('student_id')
        .where({ guardian_id: parent.id });
      const childIds = children.map((c: any) => c.student_id);

      let eventsQuery: any;
      if (childIds.length > 0) {
        eventsQuery = kdb("events as e")
          .distinct()
          .select("e.id", "e.title", "e.description", "e.event_date as date")
          .leftJoin("event_attendance as ea", "e.id", "ea.event_id")
          .where(function () {
            this.whereIn("ea.student_id", childIds)
                .orWhere("e.parent_can_enroll", 1);
          })
          .andWhere("e.tenant_id", tenantId);
      } else {
        eventsQuery = kdb("events").select("id", "title", "description", "event_date as date")
          .where({ tenant_id: tenantId, parent_can_enroll: 1 });
      }

      const [activities, competitions, events] = await Promise.all([
      Promise.resolve([] as any[]),
        kdb("competitions").select("id", "title", "description", "start_date as date").where({ tenant_id: tenantId }).catch(() => []),
        eventsQuery.catch(() => [])
      ]);

      const managedItems = await kdb("item_managers")
        .where({ user_id: userId })
        .select("item_id");

      const managedIds = new Set(managedItems.map((m: any) => m.item_id));

      const unified = [
        ...activities.map((a: any) => ({ ...a, type: 'activity', canManage: isStaff || managedIds.has(a.id) })),
        ...competitions.map((c: any) => ({ ...c, type: 'competition', canManage: isStaff || managedIds.has(c.id) })),
        ...events.map((e: any) => ({ ...e, type: 'event', canManage: isStaff || managedIds.has(e.id) }))
      ];

      unified.sort((a: any, b: any) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      return res.json({ success: true, data: unified });
    }

    // 1. جلب البيانات من الجداول الثلاثة بالتوازي لسرعة الأداء
    const [activities, competitions, events] = await Promise.all([
      Promise.resolve([] as any[]),
      kdb("competitions").select("id", "title", "description", "start_date as date").where({ tenant_id: tenantId }).catch(() => []),
      kdb("events").select("id", "title", "description", "event_date as date").where({ tenant_id: tenantId }).catch(() => [])
    ]);

    // 2. التحقق من صلاحيات الإدارة المنفردة للطالب من جدول item_managers
    const managedItems = await kdb("item_managers")
      .where({ user_id: userId })
      .select("item_id");

    const managedIds = new Set(managedItems.map(m => m.item_id));

    // 3. دمج النتائج وتنسيقها لتناسب واجهة UnifiedActivitiesPage
    const unified = [
      ...activities.map(a => ({
        ...a,
        type: 'activity',
        canManage: isStaff || managedIds.has(a.id)
      })),
      ...competitions.map(c => ({
        ...c,
        type: 'competition',
        canManage: isStaff || managedIds.has(c.id)
      })),
      ...events.map(e => ({
        ...e,
        type: 'event',
        canManage: isStaff || managedIds.has(e.id)
      }))
    ];

    // 4. ترتيب تنازلي حسب التاريخ (الأحدث أولاً)
    unified.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    res.json({ success: true, data: unified });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// التحقق من صلاحية الطالب لإدارة نشاط/مسابقة معينة (Per-item permission)
router.get("/check-item-management/:itemId", authenticate, async (req, res) => {
  const userId = req.user.id;
  const { itemId } = req.params;
  const role = req.user.role?.toLowerCase();

  try {
    // المشرف والمسؤولين لديهم صلاحية دائمة
    if (['admin', 'supervisor', 'priest'].includes(role)) {
      return res.json({ success: true, canManage: true });
    }

    const management = await kdb("item_managers")
      .where({ user_id: userId, item_id: itemId })
      .first();

    res.json({ success: true, canManage: !!management });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// 4. حذف دور مخصص
router.delete("/custom-roles/:id", authenticate, authorizePermission(AppPermission.MANAGE_USERS), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  try {
    const role = await kdb("tenant_custom_roles").where({ id, tenant_id: tenantId }).first();
    if (!role) {
      return res.status(404).json({ success: false, message: "الدور غير موجود" });
    }

    // فقط المنشئ أو مدير التطبيق يمكنه الحذف
    if (role.created_by && role.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "لا يمكنك حذف هذا الدور. فقط منشئ الدور أو مدير التطبيق يمكنه الحذف." });
    }

    // التحقق مما إذا كان هناك مستخدمون مرتبطون بهذا الدور حالياً
    const usersWithRole = await kdb("users").where({ custom_role_id: id }).count({ count: '*' }).first();
    const usageCount = usersWithRole ? Object.values(usersWithRole)[0] : 0;

    if (Number(usageCount) > 0) {
      return res.status(400).json({ success: false, message: "لا يمكن حذف هذا الدور لوجود مستخدمين مرتبطين به حالياً" });
    }

    await kdb("tenant_custom_roles").where({ id, tenant_id: tenantId }).del();
    res.json({ success: true, message: "تم حذف الدور بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// 8. جلب قائمة المكافآت المتاحة في المتجر للسكن الحالي

// Refresh effective permissions from DB (merges custom_permissions + custom_role)
router.get("/refresh-permissions", authenticate, async (req, res) => {
  try {
    const user = await kdb('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ success: false });

    let effectivePermissions: string[] = [];
    if (user.custom_permissions) {
      try { effectivePermissions = JSON.parse(user.custom_permissions); } catch {}
    }
    if (user.custom_role_id) {
      try {
        const customRole = await kdb('tenant_custom_roles')
          .where({ id: user.custom_role_id })
          .andWhere(function () {
            if (user.tenant_id) this.where({ tenant_id: user.tenant_id });
            else this.whereNotNull('tenant_id');
          })
          .first();
        if (customRole) {
          const rolePerms = JSON.parse(customRole.permissions);
          for (const perm of rolePerms) {
            if (!effectivePermissions.includes(perm)) effectivePermissions.push(perm);
          }
        }
      } catch {}
    }
    // The user record already reflects the cascaded tenant value,
    // so no separate tenant check is needed here.
    let dailyReadingsEnabled = user.daily_readings_enabled != 0;
    let radio514Enabled = user.radio_514_enabled != 0;
    res.json({ success: true, data: {
      custom_permissions: effectivePermissions.length > 0 ? JSON.stringify(effectivePermissions) : null,
      custom_role_id: user.custom_role_id,
      daily_readings_enabled: dailyReadingsEnabled,
      radio_514_enabled: radio514Enabled
    } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Get current user profile with role-specific data
router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await kdb('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const profileData: any = { user: safeUser(user) };

    if (user.role === 'student') {
      const student = await kdb('students').where({ user_id: user.id }).first();
      if (student) {
        profileData.student = student;
        const room = await kdb('rooms').where({ id: student.room_id }).first();
        if (room) {
          profileData.room = room;
          const apartment = await kdb('apartments').where({ id: room.apartment_id }).first();
          if (apartment) profileData.apartment = apartment;
        }
        const tenant = await kdb('tenants').where({ id: student.tenant_id }).first();
        if (tenant) profileData.tenant = tenant;
      }
      const points = await kdb('student_points').where({ student_id: student?.id }).orderBy('created_at', 'desc').limit(10);
      profileData.points = points;
      const warnings = await kdb('student_warnings').where({ student_id: student?.id, status: 'active' });
      profileData.warnings = warnings;
    }

    if (user.role === 'supervisor') {
      const tenant = await kdb('tenants').where({ id: user.tenant_id }).first();
      if (tenant) profileData.tenant = tenant;
      let contact = await kdb('supervisor_contacts').where({ user_id: user.id, tenant_id: user.tenant_id }).first();
      if (contact) {
        if (typeof contact.phone_numbers === 'string') contact.phone_numbers = JSON.parse(contact.phone_numbers);
        profileData.contactSettings = contact;
      } else {
        profileData.contactSettings = null;
      }
    }

    if (user.role === 'priest') {
      const tenants = await kdb('tenants')
        .join('user_tenant_assignments', 'tenants.id', 'user_tenant_assignments.tenant_id')
        .where('user_tenant_assignments.user_id', user.id)
        .select('tenants.id', 'tenants.name');
      profileData.tenants = tenants;
    }

    if (user.role === 'bishop') {
      const tenants = await kdb('tenants').where({ bishop_id: user.id }).select('id', 'name');
      profileData.tenants = tenants;
      const priests = await kdb('users').where({ role: 'priest', tenant_id: user.tenant_id }).select('id', 'name');
      profileData.priests = priests;
    }

    if (user.role === 'admin') {
      const tenantsCount = await kdb('tenants').count('id as total').first();
      const usersCount = await kdb('users').count('id as total').first();
      const studentsCount = await kdb('students').count('id as total').first();
      profileData.stats = {
        tenants: Number(tenantsCount?.total || 0),
        users: Number(usersCount?.total || 0),
        students: Number(studentsCount?.total || 0),
      };
    }

    if (user.role === 'parent') {
      const parent = await kdb('parents').where({ user_id: user.id }).first();
      if (parent) profileData.parent = parent;
      const guardianIds = parent ? [parent.id] : [];
      if (guardianIds.length > 0) {
        const children = await kdb('students as s')
          .join('users as u', 's.user_id', 'u.id')
          .join('student_guardians as sg', 's.id', 'sg.student_id')
          .select('s.id', 'u.name', 's.tenant_id')
          .whereIn('sg.guardian_id', guardianIds);
        profileData.children = children;
      }
    }

    if (user.role === 'employee') {
      const tenant = await kdb('tenants').where({ id: user.tenant_id }).first();
      if (tenant) profileData.tenant = tenant;
    }

    res.json({ success: true, data: profileData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Update current user profile (phone, photo)
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { phone, photo_url } = req.body;
    const updateData: any = {};
    if (phone !== undefined) {
      const p = String(phone).trim();
      if (p.length > 50) return res.status(400).json({ success: false, message: "رقم الهاتف غير صالح" });
      updateData.phone = p;
    }
    if (photo_url !== undefined) {
      const u = String(photo_url).trim();
      if (u.length > 1000) return res.status(400).json({ success: false, message: "رابط الصورة غير صالح" });
      // السماح فقط بروابط نسبية داخل التطبيق أو روابط بيانات آمنة (لا روابط خارجية تنفيذية)
      if (u && !u.startsWith('/uploads/') && !/^https:\/\/[a-z0-9.-]+/i.test(u)) {
        return res.status(400).json({ success: false, message: "رابط الصورة غير صالح" });
      }
      updateData.photo_url = u;
    }

    if (Object.keys(updateData).length > 0) {
      await kdb('users').where({ id: req.user.id }).update(updateData);
    }

    const user = await kdb('users').where({ id: req.user.id }).first();
    res.json({ success: true, data: { user: safeUser(user) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.get("/rewards-store", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const rewards = await kdb("rewards_definitions").where({ tenant_id: tenantId });
    res.json({ success: true, data: rewards });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// ����� ������ ����� ������
router.post("/rewards-store", authenticate, authorizePermission(AppPermission.MANAGE_REWARDS), async (req, res) => {
  const { title, description, cost, category, stock } = req.body;
  const tenantId = req.user.tenantId;
  if (!title || !cost) return res.status(400).json({ success: false, message: "������� �������� �������" });
  try {
    const id = uuidv4();
    await kdb("rewards_definitions").insert({
      id, tenant_id: tenantId, title, description: description || '',
      points_cost: cost, category: category || 'general', stock: stock || 99
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// 5. استبدال مكافأة (خصم نقاط فعلي من MSSQL)
router.post("/redeem-reward", authenticate, async (req, res) => {
  const userId = req.user.id;
  const { rewardId } = req.body;
  const tenantId = req.user.tenantId;

  if (!rewardId) return res.status(400).json({ success: false, message: "معرف المكافأة مطلوب" });

  try {
    await kdb.transaction(async (trx) => {
      // جلب بيانات الطالب المرتبطة بالمستخدم
      const student = await trx('students').where({ user_id: userId, tenant_id: tenantId }).first();
      if (!student) throw new Error("لم يتم العثور على ملف طالب لهذا المستخدم");

      // جلب بيانات المكافأة من جدول التعريفات
      const reward = await trx('rewards_definitions').where({ id: rewardId, tenant_id: tenantId }).first();
      if (!reward) throw new Error("المكافأة المطلوبة غير موجودة حالياً");

      // حساب إجمالي النقاط الحالي للطالب
      const pointsResult = await trx('student_points')
        .where({ student_id: student.id })
        .sum('amount as total')
        .first();
      
      const totalPoints = Number(pointsResult?.total || 0);

      if (totalPoints < reward.points_cost) {
        throw new Error(`رصيدك الحالي (${totalPoints}) غير كافٍ لاستبدال هذه المكافأة (${reward.points_cost})`);
      }

      // تسجيل طلب الاستبدال في جدول المكافآت
      await trx('student_rewards').insert({
        id: uuidv4(),
        tenant_id: tenantId,
        student_id: student.id,
        reward_id: reward.id,
        status: 'pending',
        created_by: userId,
        created_at: new Date()
      });

      // إدراج سجل خصم النقاط (سالب) في جدول النقاط
      await trx('student_points').insert({
        id: uuidv4(),
        tenant_id: tenantId,
        student_id: student.id,
        amount: -reward.points_cost,
        reason: `استبدال مكافأة: ${reward.title}`,
        category: 'reward_spend',
        created_by: userId,
        created_at: new Date()
      });

      // تسجيل العملية في سجل التدقيق (Audit Log)
      logAuditEvent({
        tenantId,
        userId,
        action: 'REDEEM_REWARD',
        entityType: 'reward',
        entityId: reward.id,
        method: 'POST',
        path: req.originalUrl,
        details: { rewardTitle: reward.title, cost: reward.points_cost }
      });
    });

    res.json({ success: true, message: "تم تقديم طلب الاستبدال وخصم النقاط بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// 6. جلب طلبات الاستبدال (للمشرف أو الطالب نفسه أو ولي الأمر لأبنائه)
router.get("/reward-requests", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    let query = kdb('student_rewards as sr')
      .join('students as s', 'sr.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .join('rewards_definitions as rd', 'sr.reward_id', 'rd.id')
      .select('sr.*', 'u.name as student_name', 'rd.title as reward_title', 'rd.points_cost')
      .where('sr.tenant_id', tenantId);

    if (role === 'student') {
      query = query.andWhere('u.id', userId);
    } else if (role === 'parent') {
      const parent = await kdb('parents').select('id').where({ user_id: userId }).first();
      if (!parent) return res.json({ success: true, data: [] });
      const childLinks = await kdb('student_guardians').where({ guardian_id: parent.id }).select('student_id');
      const childIds = childLinks.map((c: any) => c.student_id);
      if (childIds.length === 0) return res.json({ success: true, data: [] });
      query = query.whereIn('sr.student_id', childIds);
    } else if (!['admin', 'bishop', 'supervisor', 'assistant_supervisor', 'priest'].includes(role)) {
      return res.status(403).json({ success: false, message: "غير مصرح لك بالاطلاع على طلبات الاستبدال" });
    }

    const data = await query.orderBy('sr.created_at', 'desc');
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// 7. معالجة طلب الاستبدال (موافقة/رفض) من قبل المشرف
router.patch("/process-reward/:requestId", authenticate, authorizePermission(AppPermission.MANAGE_REWARDS), async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'
  const tenantId = req.user.tenantId;
  const userId = req.user.id;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: "حالة غير صالحة" });
  }

  try {
    await kdb.transaction(async (trx) => {
      const requestRecord = await trx('student_rewards').where({ id: requestId, tenant_id: tenantId }).first();
      if (!requestRecord) throw new Error("طلب المكافأة غير موجود");
      if (requestRecord.status !== 'pending') throw new Error("تمت معالجة هذا الطلب مسبقاً");

      await trx('student_rewards')
        .where({ id: requestId })
        .update({
          status,
          processed_by: userId,
          processed_at: new Date()
        });

      // في حالة الرفض، نعيد النقاط للطالب
      if (status === 'rejected') {
        const reward = await trx('rewards_definitions').where({ id: requestRecord.reward_id }).first();
        await trx('student_points').insert({
          id: uuidv4(),
          tenant_id: tenantId,
          student_id: requestRecord.student_id,
          amount: reward.points_cost,
          reason: `إرجاع نقاط: رفض طلب استبدال ${reward.title}`,
          category: 'manual',
          created_by: userId,
          created_at: new Date()
        });
      }
      
      logAuditEvent({
        tenantId,
        userId,
        action: status === 'approved' ? 'APPROVE_REWARD' : 'REJECT_REWARD',
        entityType: 'reward_request',
        entityId: requestId,
        method: 'PATCH',
        path: req.originalUrl,
        details: { status }
      });
    });

    res.json({ success: true, message: `تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب بنجاح` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

export default router;
