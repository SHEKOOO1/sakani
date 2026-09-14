import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { kdb } from "../infrastructure/db.ts";
import { UserRole } from "../../types/permissions";
import { authenticate } from "./middleware";
import { validate } from "../validation/middleware";
import { loginSchema, registerSchema } from "../validation/schemas";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "محاولات دخول كتيرة لو سمحت استنى شوية قبل ما تعيد المحاولة." }
});

/**
 * @openapi
 * /auth/setup-status:
 *   get:
 *     tags: [المصادقة]
 *     summary: التحقق من حالة الإعداد الأولي
 *     responses:
 *       200:
 *         description: حالة النظام (مُعد أم لا)
 */
router.get("/setup-status", async (req, res) => {
  try {
    const result = await kdb('users').count<{ count: number }>('id as count').first();
    const userCount = Number(result?.count || 0);
    res.json({ success: true, needsSetup: userCount === 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [المصادقة]
 *     summary: تسجيل حساب جديد
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, gender]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               name: { type: string }
 *               gender: { type: string }
 *     responses:
 *       201:
 *         description: تم التسجيل بنجاح
 */
router.post("/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: { success: false, message: "كترت تسجيل يا باشا، استنى شوية." } }), validate(registerSchema), async (req, res) => {
  const { email, password, name, gender } = req.body;

  try {
    // في بيئة الإنتاج: التسجيل المفتوح قفل إلا إذا أُعدّ توكن إعداد HTML صريح واتمرر
    if (process.env.NODE_ENV === 'production') {
      const setupToken = process.env.SETUP_REGISTRATION_TOKEN;
      if (!setupToken) {
        return res.status(403).json({ success: false, message: 'التسجيل المفتوح مُعطّل. اضبط SETUP_REGISTRATION_TOKEN في .env لتفعيل الإعداد الأولي.' });
      }
      if (req.headers['x-setup-token'] !== setupToken) {
        return res.status(403).json({ success: false, message: 'الإعداد الأولي محمي بتوكن إعداد خاص.' });
      }
    }

    const result = await kdb('users').count<{ count: number }>('id as count').first();
    const userCount = Number(result?.count || 0);

    if (userCount > 0) {
      return res.status(403).json({ success: false, message: 'التطبيق تم تهيئته بالفعل. لا يمكن إنشاء حساب جديد عبر هذا المسار.' });
    }

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال البريد الإلكتروني واسم المستخدم وكلمة المرور.' });
    }

    const existingUser = await kdb('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({ success: false, message: '���� ����� ������. ������ ������ �� �������� ��������� ��� ����.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const role = 'admin';

    await kdb('users').insert({
      id,
      tenant_id: null,
      email,
      password: hashedPassword,
      role,
      name,
      gender: gender || 'male',
      daily_readings_enabled: 1,
      radio_514_enabled: 1
    });

    const token = jwt.sign(
      { id, tenantId: null, role, email, gender: gender || 'male', daily_readings_enabled: true, radio_514_enabled: true },
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

    res.status(201).json({
      success: true,
      message: "تم إنشاء حساب مدير التطبيق بنجاح.",
      data: {
        user: { id, tenantId: null, role, name, email, gender: gender || 'male', custom_permissions: null, custom_role_id: null, daily_readings_enabled: true, radio_514_enabled: true }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [المصادقة]
 *     summary: تسجيل الدخول
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: تم تسجيل الدخول بنجاح مع JWT token
 */
router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await kdb('users').where({ email }).first();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    // Auto-detect tenant from user record or assignments
    let effectiveTenantId = user.tenant_id;

    const isGlobalStaff = user.role === 'admin' || user.role === 'bishop';
    if (!effectiveTenantId && !isGlobalStaff) {
      const assignedTenant = await kdb('user_tenant_assignments')
        .where({ user_id: user.id })
        .first();
      if (assignedTenant) {
        effectiveTenantId = assignedTenant.tenant_id;
        if (!user.tenant_id) {
          await kdb('users').where({ id: user.id }).update({ tenant_id: effectiveTenantId });
        }
      }
    }

    if (!effectiveTenantId && !isGlobalStaff) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم العثور على سكن مرتبط بحسابك. يرجى التواصل مع المشرف.'
      });
    }

    // Resolve effective permissions: merge custom_permissions + custom_role permissions
    let effectiveCustomPermissions = user.custom_permissions ? JSON.parse(user.custom_permissions) : [];
    if (user.custom_role_id) {
      try {
        const customRole = await kdb('tenant_custom_roles').where({ id: user.custom_role_id }).first();
        if (customRole) {
          const rolePerms = JSON.parse(customRole.permissions);
          for (const perm of rolePerms) {
            if (!effectiveCustomPermissions.includes(perm)) effectiveCustomPermissions.push(perm);
          }
        }
      } catch {}
    }

    // The user record already reflects the cascaded tenant value,
    // so no separate tenant check is needed here.
    const dailyReadingsEnabled = user.daily_readings_enabled != 0;
    const radio514Enabled = user.radio_514_enabled != 0;
    const token = jwt.sign(
      { id: user.id, tenantId: effectiveTenantId, role: user.role, email: user.email, gender: user.gender || 'male', daily_readings_enabled: dailyReadingsEnabled, radio_514_enabled: radio514Enabled },
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

    res.json({
      success: true,
      message: "تم الدخول بنجاح",
      data: {
        user: {
          id: user.id,
          tenantId: effectiveTenantId,
          role: user.role,
          name: user.name,
          email: user.email,
          gender: user.gender || 'male',
          custom_permissions: effectiveCustomPermissions.length > 0 ? JSON.stringify(effectiveCustomPermissions) : null,
          custom_role_id: user.custom_role_id || null,
          daily_readings_enabled: dailyReadingsEnabled,
          radio_514_enabled: radio514Enabled
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [المصادقة]
 *     summary: تسجيل الخروج (إبطال التوكن)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم تسجيل الخروج
 */
/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [المصادقة]
 *     summary: التحقق من الجلسة الحالية
 *     responses:
 *       200:
 *         description: بيانات المستخدم
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await kdb('users').where({ id: req.user.id }).first();
    if (!user) {
      res.clearCookie("token", { path: "/" });
      return res.status(401).json({ success: false, message: "المستخدم غير موجود" });
    }

    let effectiveCustomPermissions = user.custom_permissions ? JSON.parse(user.custom_permissions) : [];
    if (user.custom_role_id) {
      try {
        const customRole = await kdb('tenant_custom_roles').where({ id: user.custom_role_id }).first();
        if (customRole) {
          const rolePerms = JSON.parse(customRole.permissions);
          for (const perm of rolePerms) {
            if (!effectiveCustomPermissions.includes(perm)) effectiveCustomPermissions.push(perm);
          }
        }
      } catch {}
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          tenantId: user.tenant_id,
          role: user.role,
          name: user.name,
          email: user.email,
          gender: user.gender || 'male',
          custom_permissions: effectiveCustomPermissions.length > 0 ? JSON.stringify(effectiveCustomPermissions) : null,
          custom_role_id: user.custom_role_id || null,
          daily_readings_enabled: user.daily_readings_enabled != 0,
          radio_514_enabled: user.radio_514_enabled != 0,
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ. لو سمحت كرر المحاولة." });
  }
});

// Logout - blacklist the current token
router.post("/logout", authenticate, async (req, res) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const token = authHeader?.split(" ")[1] || cookieToken;
  if (!token) return res.status(400).json({ success: false, message: "مفيش توكن" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const exp = decoded?.exp || Math.floor(Date.now() / 1000) + 86400;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await kdb('token_blacklist').insert({
      id: uuidv4(),
      token_hash: tokenHash,
      user_id: req.user.id,
      expires_at: new Date(exp * 1000),
    });

    res.clearCookie("token", { path: "/" });
    res.json({ success: true, message: "تم تسجيل الخروج بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "خطأ في تسجيل الخروج" });
  }
});

export default router;
