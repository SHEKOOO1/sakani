import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";
import multer from "multer";
import path from "path";
import fs from "fs";
import { validateMagicBytes, BROADCAST_ALLOWED_EXTENSIONS } from "../middleware/upload";
import {
  getScopedTenants,
  getScopedColleges,
  getScopedGovernorates,
  getScopedChurches,
  getScopedBishops,
  getScopedPriests,
  getScopedSupervisors,
  getScopedEmployees,
  getScopedGuardianRelations,
  getScopedStudents,
  getScopedParents,
  getSenderTenantIds,
  clampTargetingTenants,
  applySenderTenantScope,
  estimateRecipientCount,
  getUserBroadcasts,
} from "./broadcast.service";

const router = express.Router();

const upload = multer({
  dest: path.resolve(process.cwd(), "uploads", "broadcasts"),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BROADCAST_ALLOWED_EXTENSIONS.includes(ext)) return cb(null, true);
    cb(new Error(`نوع الملف ${ext || '(بدون امتداد)'} غير مسموح به للإعلانات`));
  },
});

// ─── إعلانات التي تظهر للمستخدم (Ticker + Messages) ───

// شريط الأخبار (ticker)
router.get("/ticker", authenticate, async (req, res) => {
  try {
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const broadcasts = await getUserBroadcasts(user, "news");
    res.json({ success: true, data: broadcasts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// الرسائل (messages section)
router.get("/messages", authenticate, async (req, res) => {
  try {
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const broadcasts = await getUserBroadcasts(user, "messages");
    res.json({ success: true, data: broadcasts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// ─── إدارة الإعلانات (CRUD - كل مرسل يرى رسائله فقط) ───

// جلب إعلانات المرسل فقط (كل مستخدم يرى رسائله التي أرسلها فقط)
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_BROADCASTS), async (req, res) => {
  try {
    const broadcasts = await kdb("broadcasts as b")
      .join("users as u", "b.sender_id", "u.id")
      .select("b.*", "u.name as sender_name", "u.role as sender_user_role")
      .where("b.sender_id", req.user.id)
      .orderBy("b.created_at", "desc");

    const result: any[] = [];
    for (const b of broadcasts) {
      const attachments = await kdb("broadcast_attachments").where({ broadcast_id: b.id }).select("*");
      const targeting = typeof b.targeting === "string" ? JSON.parse(b.targeting) : (b.targeting || {});
      result.push({ ...b, visible_in_ticker: b.visible_in_ticker ? 1 : 0, visible_in_messages: b.visible_in_messages ? 1 : 0, attachments, targeting });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// إنشاء إعلان جديد
router.post("/", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const { title, content, message, priority, display_type, display_location, target_audience, start_at, end_at, targeting, link_action } = req.body;
    const id = uuidv4();
    const now = new Date();

    // دعم التوافق مع الإصدارات السابقة
    const finalContent = content || message || "";
    let finalDisplayType = display_type || "both";
    if (display_location === "ticker") finalDisplayType = "news";
    else if (display_location === "daily_message") finalDisplayType = "messages";

    let finalTargeting = targeting || {};
    if (target_audience === "students") finalTargeting.roles = ["student"];
    else if (target_audience === "parents") finalTargeting.roles = ["parent"];

    // قص السكنات المستهدفة إلى نطاق المرسل فقط (مشرف/كاهن/نائب مشرف/موظف/أسقف بلا تحديد = سكناته تلقائياً)
    const scoped = await applySenderTenantScope(req.user, finalTargeting);
    if (!scoped.ok) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية إرسال إعلان لهذه السكنات" });
    }
    finalTargeting = scoped.targeting;

    await kdb("broadcasts").insert({
      id,
      sender_id: req.user.id,
      sender_role: req.user.role,
      title,
      content: finalContent,
      display_type: finalDisplayType,
      priority: priority || "normal",
      status: "active",
      targeting: JSON.stringify(finalTargeting),
      visible_in_ticker: 1,
      visible_in_messages: 1,
      start_at: start_at ? new Date(start_at) : now,
      end_at: end_at ? new Date(end_at) : null,
      link_action: link_action ? JSON.stringify(link_action) : null,
      created_at: now,
      updated_at: now,
    });

    res.json({ success: true, message: "تم إرسال الإعلان بنجاح", data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// تعديل إعلان
router.put("/:id", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const { title, content, message, priority, display_type, display_location, target_audience, start_at, end_at, targeting, link_action } = req.body;
    const broadcast = await kdb("broadcasts as b")
      .join("users as u", "b.sender_id", "u.id")
      .select("b.*", "u.tenant_id as sender_tenant_id")
      .where("b.id", req.params.id)
      .first();
    if (!broadcast) return res.status(404).json({ success: false, message: "الإعلان غير موجود" });
    if (broadcast.sender_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: "لا تملك صلاحية تعديل هذا الإعلان" });

    const finalContent = content || message || broadcast.content;
    let finalDisplayType = display_type || broadcast.display_type;
    if (display_location === "ticker") finalDisplayType = "news";
    else if (display_location === "daily_message") finalDisplayType = "messages";

    let finalTargeting = targeting || {};
    if (target_audience === "students") finalTargeting.roles = ["student"];
    else if (target_audience === "parents") finalTargeting.roles = ["parent"];

    // قص السكنات المستهدفة إلى نطاق المرسل فقط
    const scoped = await applySenderTenantScope(req.user, finalTargeting);
    if (!scoped.ok) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية تعديل الإعلان لهذه السكنات" });
    }
    finalTargeting = scoped.targeting;

    await kdb("broadcasts").where({ id: req.params.id }).update({
      title: title || broadcast.title,
      content: finalContent,
      display_type: finalDisplayType,
      priority: priority || broadcast.priority,
      targeting: JSON.stringify(finalTargeting),
      start_at: start_at ? new Date(start_at) : broadcast.start_at,
      end_at: end_at ? new Date(end_at) : broadcast.end_at,
      link_action: link_action ? JSON.stringify(link_action) : broadcast.link_action,
      updated_at: new Date(),
    });

    res.json({ success: true, message: "تم تحديث الإعلان بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// ─── التحكم في الرؤية (إخفاء من شريط الأخبار / الرسائل / الاثنين) ───

router.patch("/:id/visibility", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const { hide_from } = req.body;
    const broadcast = await kdb("broadcasts as b")
      .join("users as u", "b.sender_id", "u.id")
      .select("b.*", "u.tenant_id as sender_tenant_id")
      .where("b.id", req.params.id)
      .first();
    if (!broadcast) return res.status(404).json({ success: false, message: "الإعلان غير موجود" });
    if (broadcast.sender_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: "لا تملك صلاحية تعديل هذا الإعلان" });

    let update: any = { updated_at: new Date() };

    if (hide_from === 'ticker') {
      update.visible_in_ticker = broadcast.visible_in_ticker ? 0 : 1;
    } else if (hide_from === 'messages') {
      update.visible_in_messages = broadcast.visible_in_messages ? 0 : 1;
    } else if (hide_from === 'both') {
      // إذا كان مخفياً من الاثنين نعيد إظهاره والعكس
      if (!broadcast.visible_in_ticker && !broadcast.visible_in_messages) {
        update.visible_in_ticker = 1;
        update.visible_in_messages = 1;
      } else {
        update.visible_in_ticker = 0;
        update.visible_in_messages = 0;
      }
    } else {
      return res.status(400).json({ success: false, message: "hide_from يجب أن يكون ticker أو messages أو both" });
    }

    await kdb("broadcasts").where({ id: req.params.id }).update(update);

    const updated = await kdb("broadcasts").where({ id: req.params.id }).first();

    // بث الحدث لجميع المتصلين لإخفاء/إظهار الإعلان فوراً
    try {
      const io = (global as any).__io;
      if (io) {
        io.emit('broadcast-visibility-changed', {
          id: req.params.id,
          visible_in_ticker: updated.visible_in_ticker ? 1 : 0,
          visible_in_messages: updated.visible_in_messages ? 1 : 0,
        });
      }
    } catch { /* socket may not be ready */ }

    res.json({
      success: true,
      message: "تم تحديث الرؤية بنجاح",
      data: {
        visible_in_ticker: updated.visible_in_ticker ? 1 : 0,
        visible_in_messages: updated.visible_in_messages ? 1 : 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// تبديل حالة الإعلان (نشط/مسودة)
router.patch("/:id/toggle", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const broadcast = await kdb("broadcasts as b")
      .join("users as u", "b.sender_id", "u.id")
      .select("b.*", "u.tenant_id as sender_tenant_id")
      .where("b.id", req.params.id)
      .first();
    if (!broadcast) return res.status(404).json({ success: false, message: "الإعلان غير موجود" });
    if (broadcast.sender_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: "لا تملك صلاحية تعديل هذا الإعلان" });

    const newStatus = broadcast.status === "active" ? "draft" : "active";
    await kdb("broadcasts").where({ id: req.params.id }).update({ status: newStatus, updated_at: new Date() });

    res.json({ success: true, message: newStatus === "active" ? "تم تفعيل الإعلان" : "تم إيقاف الإعلان", data: { status: newStatus } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// حذف إعلان
router.delete("/:id", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const broadcast = await kdb("broadcasts as b")
      .join("users as u", "b.sender_id", "u.id")
      .select("b.*", "u.tenant_id as sender_tenant_id")
      .where("b.id", req.params.id)
      .first();
    if (!broadcast) return res.status(404).json({ success: false, message: "الإعلان غير موجود" });
    if (broadcast.sender_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: "لا تملك صلاحية حذف هذا الإعلان" });
    await kdb("broadcasts").where({ id: req.params.id }).del();
    await kdb("broadcast_attachments").where({ broadcast_id: req.params.id }).del();
    res.json({ success: true, message: "تم حذف الإعلان نهائياً" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// ─── تسجيل قراءة الإعلان ───

router.post("/:id/read", authenticate, async (req, res) => {
  try {
    const existing = await kdb("broadcast_reads")
      .where({ broadcast_id: req.params.id, user_id: req.user.id })
      .first();
    if (!existing) {
      await kdb("broadcast_reads").insert({
        id: uuidv4(),
        broadcast_id: req.params.id,
        user_id: req.user.id,
        read_at: new Date(),
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// ─── نقاط النهاية لبيانات الاستهداف (محددة حسب صلاحية المستخدم) ───

// المساكن
router.get("/targets/tenants", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const tenants = await getScopedTenants(user);
    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// الكليات
router.get("/targets/colleges", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const colleges = await getScopedColleges(user, tenantIds);
    res.json({ success: true, data: colleges });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// المحافظات
router.get("/targets/governorates", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const governorates = await getScopedGovernorates(user, tenantIds);
    res.json({ success: true, data: governorates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// الكنائس
router.get("/targets/churches", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const churches = await getScopedChurches(user, tenantIds);
    res.json({ success: true, data: churches });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// الأساقفة
router.get("/targets/bishops", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const bishops = await getScopedBishops(user, tenantIds);
    res.json({ success: true, data: bishops });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// الآباء الكهنة
router.get("/targets/priests", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const priests = await getScopedPriests(user, tenantIds);
    res.json({ success: true, data: priests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// المشرفين
router.get("/targets/supervisors", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const supervisors = await getScopedSupervisors(user, tenantIds);
    res.json({ success: true, data: supervisors });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// الموظفين
router.get("/targets/employees", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const employees = await getScopedEmployees(user, tenantIds);
    res.json({ success: true, data: employees });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// أنواع صلة القرابة لأولياء الأمور (ديناميك من DB)
router.get("/targets/guardian-relations", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const relations = await getScopedGuardianRelations(user, tenantIds);
    res.json({ success: true, data: relations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// بحث الطلاب
router.get("/targets/students", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    if (search.length < 2) return res.json({ success: true, data: [] });
    const tenantIds = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const students = await getScopedStudents(user, search, tenantIds);
    res.json({ success: true, data: students });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// بحث أولياء الأمور (لاختيار مستلم رسالة خاصة)
router.get("/targets/parents", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    if (search.length < 2) return res.json({ success: true, data: [] });
    const user = { id: req.user.id, tenantId: req.user.tenantId, tenantIds: req.user.tenantIds, role: req.user.role };
    const parents = await getScopedParents(user, search);
    res.json({ success: true, data: parents });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// ─── رسالة خاصة ───
// يرسلها الأسقف / الكاهن / المشرف إلى طالب محدد أو ولي أمر محدد (لا تظهر في الشريط)
router.post("/private", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const { recipient_user_id, title, content, to_parents } = req.body;
    if (!recipient_user_id) return res.status(400).json({ success: false, message: "المستلم مطلوب" });
    if (!content || !String(content).trim()) return res.status(400).json({ success: false, message: "نص الرسالة مطلوب" });

    if (!["bishop", "priest", "supervisor", "assistant_supervisor"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية إرسال رسائل خاصة" });
    }

    const recipient = await kdb("users").where({ id: recipient_user_id }).select("id", "role", "tenant_id").first();
    if (!recipient) return res.status(404).json({ success: false, message: "المستلم غير موجود" });
    if (!["student", "parent"].includes(recipient.role)) {
      return res.status(400).json({ success: false, message: "المستلم يجب أن يكون طالباً أو ولي أمر" });
    }

    // عزل النطاق: المستلم يجب أن يكون ضمن نطاق المرسل
    const senderTenantIds = await getSenderTenantIds(req.user);
    if (!senderTenantIds.length) {
      return res.status(403).json({ success: false, message: "لا تملك نطاق سكن للتواصل مع هذا المستلم" });
    }
    if (recipient.tenant_id && !senderTenantIds.includes(recipient.tenant_id)) {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية مراسلة هذا المستلم" });
    }

    const targetStudent = recipient.role === "student"
      ? await kdb("students").where({ user_id: recipient_user_id }).select("id").first()
      : null;

    const recipientIds: string[] = [recipient_user_id];
    if (recipient.role === "student" && to_parents && targetStudent) {
      const parentUsers = await kdb("parents as p")
        .join("student_guardians as sg", "sg.guardian_id", "p.id")
        .join("users as u", "p.user_id", "u.id")
        .where("sg.student_id", targetStudent.id)
        .select("u.id");
      for (const pu of parentUsers) {
        if (!recipientIds.includes(pu.id)) recipientIds.push(pu.id);
      }
    }

    const now = new Date();
    const finalTitle = title || "رسالة خاصة";
    for (const rid of recipientIds) {
      await kdb("broadcasts").insert({
        id: uuidv4(),
        sender_id: req.user.id,
        sender_role: req.user.role,
        title: finalTitle,
        content: String(content).trim(),
        display_type: "messages",
        priority: "high",
        status: "active",
        targeting: JSON.stringify({ tenants: recipient.tenant_id ? [recipient.tenant_id] : [] }),
        visible_in_ticker: 0,
        visible_in_messages: 1,
        private_recipient_id: rid,
        parent_message_id: null,
        start_at: now,
        end_at: null,
        link_action: null,
        created_at: now,
        updated_at: now,
      });
    }

    res.json({ success: true, message: "تم إرسال الرسالة الخاصة بنجاح", data: { recipients: recipientIds.length } });
  } catch (error: any) {
    console.error("private message error:", error);
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// الرد على رسالة خاصة:
// يُسمح فقط عندما يكون المرسل الأصلي مشرفاً (الأسقف/الكاهن يرسلون ولا يستقبلون الردود)
router.post("/private/:id/reply", authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !String(content).trim()) return res.status(400).json({ success: false, message: "نص الرد مطلوب" });

    const parent = await kdb("broadcasts").where({ id: req.params.id }).first();
    if (!parent) return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });
    if (!parent.private_recipient_id) {
      return res.status(400).json({ success: false, message: "الرد مسموح على الرسائل الخاصة فقط" });
    }
    if (parent.sender_role !== "supervisor" && parent.sender_role !== "assistant_supervisor") {
      return res.status(403).json({ success: false, message: "لا يمكن الرد على هذه الرسالة" });
    }

    const isRecipient = parent.private_recipient_id === req.user.id;
    const isSender = parent.sender_id === req.user.id;
    if (!isRecipient && !isSender) {
      return res.status(403).json({ success: false, message: "لا تملك الإذن بالرد على هذه الرسالة" });
    }

    const otherId = isSender ? parent.private_recipient_id : parent.sender_id;
    if (!otherId) return res.status(400).json({ success: false, message: "تعذر تحديد الطرف الآخر" });

    const now = new Date();
    await kdb("broadcasts").insert({
      id: uuidv4(),
      sender_id: req.user.id,
      sender_role: req.user.role,
      title: parent.title,
      content: String(content).trim(),
      display_type: "messages",
      priority: "high",
      status: "active",
      targeting: JSON.stringify({ tenants: req.user.tenantId ? [req.user.tenantId] : [] }),
      visible_in_ticker: 0,
      visible_in_messages: 1,
      private_recipient_id: otherId,
      parent_message_id: parent.parent_message_id || parent.id,
      start_at: now,
      end_at: null,
      link_action: null,
      created_at: now,
      updated_at: now,
    });

    res.json({ success: true, message: "تم إرسال الرد" });
  } catch (error: any) {
    console.error("private reply error:", error);
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// ─── حساب عدد المستلمين ───

router.post("/recipients-count", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const { targeting } = req.body;
    const clamped = { ...targeting };
    if (clamped.tenants?.length) {
      clamped.tenants = await clampTargetingTenants(req.user, clamped.tenants);
    }
    const count = await estimateRecipientCount(clamped || {});
    res.json({ success: true, data: { count } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// ─── رفع الملفات للإعلانات ───

router.post("/upload", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), upload.single("file"), validateMagicBytes, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "الملف مطلوب" });
    const url = `/uploads/broadcasts/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url,
        original_name: req.file.originalname,
        size: req.file.size,
        mime_type: req.file.mimetype,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// ─── إضافة مرفق لإعلان ───

router.post("/:id/attachments", authenticate, authorizePermission(AppPermission.SEND_BROADCAST), async (req, res) => {
  try {
    const { type, url, original_name, size } = req.body;
    const broadcast = await kdb("broadcasts").where({ id: req.params.id }).select("id", "sender_id").first();
    if (!broadcast) return res.status(404).json({ success: false, message: "الإعلان غير موجود" });
    if (broadcast.sender_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "لا تملك صلاحية إضافة مرفقات لهذا الإعلان" });
    }
    await kdb("broadcast_attachments").insert({
      id: uuidv4(),
      broadcast_id: req.params.id,
      type: type || "file",
      url,
      name: original_name || "ملف",
      size: size || 0,
      created_at: new Date(),
    });
    res.json({ success: true, message: "تم إضافة المرفق" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
