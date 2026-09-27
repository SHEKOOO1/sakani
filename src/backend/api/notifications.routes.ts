import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { logger } from "../infrastructure/logger.ts";
import webpush from "web-push";
import { validate } from "../validation/middleware";
import { pushSubscriptionSchema } from "../validation/schemas";
import { parsePagination } from "../services/radio/pagination.ts";

const router = express.Router();

// إعداد تفاصيل VAPID - تأكد من إضافة هذه المفاتيح في ملف .env الخاص بالسيرفر
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:support@sakani.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (e) {
    console.warn('⚠️ Invalid VAPID keys. Push notifications disabled.', (e as Error).message);
  }
} else {
  console.warn('⚠️ Web-Push VAPID keys are missing. Push notifications will be disabled until VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are added to .env');
}

// Get recent notifications for the logged-in user
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit } = parsePagination(req.query);
    const offset = (page - 1) * limit;

    const [countResult, notifications] = await Promise.all([
      kdb("notifications").where("user_id", userId).count("* as total").first(),
      kdb("notifications")
        .leftJoin("tenants", "notifications.tenant_id", "tenants.id")
        .where("notifications.user_id", userId)
        .select("notifications.*", "tenants.name as tenant_name")
        .orderBy("notifications.created_at", "desc")
        .offset(offset)
        .limit(limit),
    ]);

    const total = Number((countResult as any)?.total || 0);
    res.json({
      success: true,
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

// Mark a single notification as read
router.post("/:id/read", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await kdb("notifications").where({ id, user_id: userId }).update({ is_read: 1 });
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ success: false, message: "Failed to mark notification as read" });
  }
});

// Mark all as read
router.post("/read-all", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    await kdb("notifications").where("user_id", userId).update({ is_read: 1 });
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ success: false, message: "Failed to mark notifications as read" });
  }
});

// تسجيل اشتراك Push Notification جديد للمستخدم
router.post("/subscribe", authenticate, validate(pushSubscriptionSchema), async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;

    // نستخدم الـ endpoint كمعرف فريد للجهاز لمنع تكرار الاشتراكات لنفس المستخدم
    const existing = await kdb("user_push_subscriptions")
      .where({ endpoint: subscription.endpoint })
      .first();

    if (existing) {
      // منع "الاستيلاء" على اشتراك جهاز لمستخدم آخر (نفس الـ endpoint)
      if (existing.user_id !== userId) {
        return res.status(403).json({ success: false, message: "الاشتراك مرتبط بمستخدم آخر" });
      }
      await kdb("user_push_subscriptions")
        .where({ id: existing.id })
        .update({ user_id: userId, subscription_json: JSON.stringify(subscription) });
    } else {
      await kdb("user_push_subscriptions").insert({
        id: uuidv4(),
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription_json: JSON.stringify(subscription)
      });
    }

    res.json({ success: true, message: "Subscribed for push notifications" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
  }
});

// Create notification via API
router.post("/", authenticate, authorizePermission(AppPermission.SEND_NOTIFICATIONS), async (req, res) => {
  try {
    const { userId, title, message, type, event_id } = req.body;
    if (!userId || !title || !message) {
      return res.status(400).json({ success: false, message: "userId, title, and message are required" });
    }
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });

    // منع إرسال الإشعارات لمستخدمين من سكنات أخرى (IDOR)
    const targetUser = await kdb('users').select('tenant_id').where({ id: userId }).first();
    if (!targetUser) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    if (targetUser.tenant_id !== tenantId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "لا يمكنك إرسال إشعار لمستخدم من سكن آخر" });
    }

    await createNotification({ userId, tenantId, title, message, type, event_id });
    res.json({ success: true, message: "Notification sent" });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ success: false, message: "Failed to create notification" });
  }
});

// Create notification (internal helper used by other routes)
export const createNotification = async (data: {
  userId: string;
  tenantId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  metadata?: string;
  event_id?: string;
}) => {
  const id = uuidv4();
  let metaJson: string | null = data.metadata || null;
  if (data.event_id) {
    let metaObj: Record<string, any> = {};
    if (metaJson) {
      try { metaObj = JSON.parse(metaJson); } catch { metaObj = {}; }
    }
    metaObj.event_id = data.event_id;
    metaJson = JSON.stringify(metaObj);
  }
  // 1. Save in database for in-app display
  const insertData: any = {
    id,
    user_id: data.userId,
    tenant_id: data.tenantId,
    title: data.title,
    message: data.message,
    type: data.type || 'info'
  };
  if (metaJson) insertData.metadata = metaJson;
  await kdb("notifications").insert(insertData);

  // 2. إرسال إشعار Push حقيقي للمشتركين (جميع أجهزة المستخدم)
  try {
    const subscriptions = await kdb("user_push_subscriptions")
      .where({ user_id: data.userId });

    const payload = JSON.stringify({
      title: data.title,
      body: data.message,
      icon: '/img/pwa-192x192.png',
      badge: '/img/pwa-192x192.png',
      data: {
        url: '/notifications'
      }
    });

    subscriptions.forEach((sub: { id: string; subscription_json: string }) => {
      const pushConfig = JSON.parse(sub.subscription_json);
      webpush.sendNotification(pushConfig, payload).catch(async (err: any) => {
        // إذا انتهت صلاحية الاشتراك (410 Gone) أو لم يعد متاحاً، نحذفه من قاعدة البيانات
        if (err.statusCode === 410 || err.statusCode === 404) {
          logger.info(`Removing expired subscription: ${sub.id}`);
          await kdb("user_push_subscriptions").where({ id: sub.id }).del().catch(() => {});
        }
      });
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

// إرسال إشعار لجميع المعنيين عند تسجيل مكافأة أو جزاء للطالب:
// الطالب + أولياء الأمور + مشرف السكن (ومساعده) + الأب الكاهن المسؤول
export const notifyBehaviorAction = async (data: {
  kind: 'reward' | 'penalty';
  studentId: string;
  tenantId: string;
  details: { amount?: number; level?: string; reason?: string; deductPoints?: number };
}) => {
  try {
    const student = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .select('s.id', 's.user_id', 'u.name')
      .where('s.id', data.studentId)
      .first();
    if (!student) return;

    const levelLabels: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'شديد', critical: 'خطير' };
    const isReward = data.kind === 'reward';
    const amountText = `مقدار ${data.details.amount ?? 0} نقطة`;
    const levelText = levelLabels[data.details.level || ''] || 'متوسط';
    const reasonText = data.details.reason ? ` السبب: ${data.details.reason}.` : '';
    const deductText = data.details.deductPoints ? ` وتم خصم ${data.details.deductPoints} نقطة.` : '';
    const pageMeta = JSON.stringify({ page: 'behavior' });

    // 1) الطالب نفسه
    await createNotification({
      userId: student.user_id,
      tenantId: data.tenantId,
      title: isReward ? '🎉 مكافأة جديدة!' : '⚠️ إنذار سلوكي',
      message: isReward
        ? `تم تسجيل مكافأة لك ${amountText}.${reasonText}`
        : `تم تسجيل إنذار سلوكي بمستوى (${levelText}).${reasonText}${deductText}`,
      type: isReward ? 'success' : 'warning',
      metadata: pageMeta
    });

    // 2) أولياء الأمور (ولي الأمر)
    const guardians = await kdb('student_guardians as sg')
      .join('parents as p', 'sg.guardian_id', 'p.id')
      .select('p.user_id')
      .where('sg.student_id', data.studentId);
    for (const g of guardians) {
      await createNotification({
        userId: g.user_id,
        tenantId: data.tenantId,
        title: isReward ? `مكافأة للابن/الابنة: ${student.name}` : `تنبيه إداري بخصوص: ${student.name}`,
        message: isReward
          ? `نحيطكم علماً بأن ${student.name} حصل على مكافأة ${amountText}.${reasonText}`
          : `نحيطكم علماً بأنه تم إصدار إنذار سلوكي لـ ${student.name} بمستوى (${levelText}).${reasonText}${deductText}`,
        type: isReward ? 'success' : 'error',
        metadata: pageMeta
      });
    }

    // 3) مشرف السكن + مساعد المشرف + الأب الكاهن المسؤول
    const staff = await kdb('users as u')
      .leftJoin('user_tenant_assignments as uta', 'uta.user_id', 'u.id')
      .distinct('u.id', 'u.role')
      .where(function () {
        this.where('u.tenant_id', data.tenantId).orWhere('uta.tenant_id', data.tenantId);
      })
      .whereIn('u.role', ['supervisor', 'assistant_supervisor', 'priest']);
    for (const st of staff) {
      await createNotification({
        userId: st.id,
        tenantId: data.tenantId,
        title: isReward ? `مكافأة للطالب: ${student.name}` : `إنذار للطالب: ${student.name}`,
        message: isReward
          ? `تم تسجيل مكافأة للطالب ${student.name} ${amountText}.${reasonText}`
          : `تم إصدار إنذار سلوكي للطالب ${student.name} بمستوى (${levelText}).${reasonText}${deductText}`,
        type: isReward ? 'success' : 'warning',
        metadata: pageMeta
      });
    }
  } catch (error) {
    console.error("Error in notifyBehaviorAction:", error);
  }
};

// إرسال إنذار سلوكي للطالب وأولياء أموره والأب الكاهن تلقائياً
// يتم استدعاء هذه الدالة من مسار /api/behavior/warnings عند حفظ الإنذار في قاعدة البيانات
export const notifyBehaviorWarning = async (data: {
  studentId: string;
  tenantId: string;
  level: string;
  reason: string;
  notifyParent?: boolean;
  notifyPriest?: boolean;
}) => {
  try {
    const student = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .select('s.id', 's.user_id', 'u.name')
      .where('s.id', data.studentId)
      .first();
    if (!student) return;

    await createNotification({
      userId: student.user_id,
      tenantId: data.tenantId,
      title: 'إنذار سلوكي جديد ⚠️',
      message: `تم تسجيل إنذار بمستوى (${data.level}) بسبب: ${data.reason}`,
      type: 'warning',
      metadata: JSON.stringify({ page: 'behavior' })
    });

    if (data.notifyParent) {
      const guardians = await kdb('student_guardians as sg')
        .join('parents as p', 'sg.guardian_id', 'p.id')
        .select('p.user_id')
        .where('sg.student_id', data.studentId);

      for (const g of guardians) {
        await createNotification({
          userId: g.user_id,
          tenantId: data.tenantId,
          title: `تنبيه إداري بخصوص: ${student.name}`,
          message: `نحيطكم علماً بأنه تم إصدار إنذار سلوكي للابن. السبب: ${data.reason}. مستوى الإنذار: ${data.level}`,
          type: 'error',
          metadata: JSON.stringify({ page: 'behavior' })
        });
      }
    }

    if (data.notifyPriest) {
      const priests = await kdb('user_tenant_assignments as uta')
        .join('users as u', 'uta.user_id', 'u.id')
        .select('u.id')
        .where('uta.tenant_id', data.tenantId)
        .where('u.role', 'priest');

      for (const p of priests) {
        await createNotification({
          userId: p.id,
          tenantId: data.tenantId,
          title: `تقرير سلوكي: ${student.name}`,
          message: `تم إخطاركم بصدور إنذار للطالب ${student.name}. مستوى الإنذار: ${data.level}`,
          type: 'info',
          metadata: JSON.stringify({ page: 'behavior' })
        });
      }
    }
  } catch (error) {
    console.error("Error in notifyBehaviorWarning sequence:", error);
  }
};

// ────────────────────────────── Event excuses / penalties ──────────────────────────────

export const getStudentAndGuardiansUserIds = async (studentId: string): Promise<{ student: any; guardianUserIds: string[] }> => {
  const student = await kdb('students as s')
    .leftJoin('users as u', 's.user_id', 'u.id')
    .select('s.id', 's.user_id', 'u.name as user_name')
    .where('s.id', studentId)
    .first();
  if (!student) return { student: null, guardianUserIds: [] };
  const guardians = await kdb('student_guardians as sg')
    .join('parents as p', 'sg.guardian_id', 'p.id')
    .select('p.user_id')
    .where('sg.student_id', studentId);
  return { student, guardianUserIds: (guardians as any[]).map((g) => g.user_id).filter(Boolean) };
};

// مشرف السكن + مساعده + الأب الكاهن المسؤول عن السكن
export const getTenantStaffUserIds = async (tenantId: string): Promise<string[]> => {
  const staff = await kdb('users as u')
    .leftJoin('user_tenant_assignments as uta', 'uta.user_id', 'u.id')
    .distinct('u.id')
    .where(function () {
      this.where('u.tenant_id', tenantId).orWhere('uta.tenant_id', tenantId);
    })
    .whereIn('u.role', ['supervisor', 'assistant_supervisor', 'priest']);
  return (staff as any[]).map((s) => s.id);
};

// إشعار للمشرف/الكاهن عند تقديم طالب عذراً قبل الموعد النهائي — يحوي زرّي القبول والرفض
export const notifyExcuseSubmitted = async (data: {
  tenantId: string;
  studentId: string;
  eventId: string;
  eventTitle: string;
  reason: string;
  excuseId: string;
  submittedByRole?: string | null;
}) => {
  try {
    const { student } = await getStudentAndGuardiansUserIds(data.studentId);
    if (!student) return;
    const name = student.user_name || student.name || 'أحد الطلاب';
    const dateText = new Date().toLocaleString('ar-EG');
    const tenant = await kdb('tenants').select('name').where({ id: data.tenantId }).first();
    const tenantName = tenant?.name ? ` — ${tenant.name}` : '';
    const staffIds = await getTenantStaffUserIds(data.tenantId);
    const meta = JSON.stringify({
      kind: 'excuse_review',
      excuse_id: data.excuseId,
      event_id: data.eventId,
      studentName: name,
    });
    const message = `تقدّم الطالب «${name}» بعذر عن حضور «${data.eventTitle}»${tenantName} (${dateText}).\nالرسالة: ${data.reason}`;
    for (const userId of staffIds) {
      await createNotification({
        userId, tenantId: data.tenantId,
        title: 'عذر حضور جديد ⏳',
        message,
        type: 'warning',
        metadata: meta,
        event_id: data.eventId,
      });
    }
  } catch (error) {
    console.error('Error in notifyExcuseSubmitted:', error);
  }
};

// إشعار للطالب + ولي أمره عند قبول أو رفض العذر (في كل الحالات)
export const notifyExcuseDecided = async (data: {
  tenantId: string;
  studentId: string;
  eventId: string;
  eventTitle: string;
  decision: 'APPROVED' | 'REJECTED';
  notes?: string | null;
}) => {
  try {
    const { student, guardianUserIds } = await getStudentAndGuardiansUserIds(data.studentId);
    if (!student) return;
    const isApproved = data.decision === 'APPROVED';
    const outcome = isApproved ? 'قبول' : 'رفض';
    const notesText = data.notes ? ` ملاحظة: ${data.notes}` : '';
    const studentMsg = `تم ${outcome} عذرك عن «${data.eventTitle}».${notesText}`;
    const guardianMsg = `نحيطكم علماً بأنه تم ${outcome} عذر ${student.user_name || student.name} عن «${data.eventTitle}».${notesText}`;

    await createNotification({
      userId: student.user_id,
      tenantId: data.tenantId,
      title: isApproved ? 'تم قبول العذر ✅' : 'تم رفض العذر ❌',
      message: studentMsg,
      type: isApproved ? 'success' : 'error',
      metadata: JSON.stringify({ kind: 'excuse_decision', event_id: data.eventId }),
      event_id: data.eventId,
    });
    for (const userId of guardianUserIds) {
      await createNotification({
        userId, tenantId: data.tenantId,
        title: isApproved ? `قبول عذر الابن/الابنة: ${student.user_name || student.name}` : `رفض عذر الابن/الابنة: ${student.user_name || student.name}`,
        message: guardianMsg,
        type: isApproved ? 'success' : 'error',
        metadata: JSON.stringify({ kind: 'excuse_decision', event_id: data.eventId }),
        event_id: data.eventId,
      });
    }
  } catch (error) {
    console.error('Error in notifyExcuseDecided:', error);
  }
};

// إشعار للطالب + ولي أمره عند توقيع أي عقوبة أو غرامة مالية، مع السبب
export const notifyPenaltyApplied = async (data: {
  tenantId: string;
  studentId: string;
  eventId: string;
  eventTitle: string;
  sessionTitle?: string | null;
  financial?: number;
  points?: number;
  reason?: string;
}) => {
  try {
    const { student, guardianUserIds } = await getStudentAndGuardiansUserIds(data.studentId);
    if (!student) return;
    const financial = Number(data.financial || 0);
    const points = Number(data.points || 0);
    if (financial + points <= 0) return;
    const parts: string[] = [];
    if (financial > 0) parts.push(`${financial} جنيه`);
    if (points > 0) parts.push(`${points} نقطة`);
    const penaltyText = parts.join(' + ');
    const whereText = data.sessionTitle ? `${data.eventTitle} — ${data.sessionTitle}` : data.eventTitle;
    const reasonText = data.reason ? ` السبب: ${data.reason}` : '';
    const studentMsg = `تم توقيع عقوبة عليك (${penaltyText}) في «${whereText}».${reasonText}`;
    const guardianMsg = `نحيطكم علماً بأنه تم توقيع عقوبة (${penaltyText}) على ${student.user_name || student.name} في «${whereText}».${reasonText}`;

    await createNotification({
      userId: student.user_id,
      tenantId: data.tenantId,
      title: 'غرامة أو عقوبة ⚠️',
      message: studentMsg,
      type: 'warning',
      metadata: JSON.stringify({ page: 'behavior', event_id: data.eventId }),
      event_id: data.eventId,
    });
    for (const userId of guardianUserIds) {
      await createNotification({
        userId, tenantId: data.tenantId,
        title: `عقوبة على الابن/الابنة: ${student.user_name || student.name}`,
        message: guardianMsg,
        type: 'error',
        metadata: JSON.stringify({ page: 'behavior', event_id: data.eventId }),
        event_id: data.eventId,
      });
    }
  } catch (error) {
    console.error('Error in notifyPenaltyApplied:', error);
  }
};

export default router;
