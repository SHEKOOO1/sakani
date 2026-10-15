import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb, checkUserPermission } from "../infrastructure/db.ts";
import { authenticate, authorizePermission, computeUserTenantIds } from "./middleware.ts";
import { AppPermission } from "../../types/permissions.ts";
import { includesId } from '../infrastructure/id-match';

const router = express.Router();

/**
 * Haversine formula to calculate distance between two points in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * قرار البوابة الجغرافية مع مراعاة دقة الـ GPS:
 * - بدون دقة (0) → القرار النقطي الكلاسيكي.
 * - مع دقة: نستخدم شريط الخطأ [distance-accuracy, distance+accuracy].
 *   إن وقع بالكامل داخل النطاق → داخل، وبالكامل خارجه → خارج،
 *   وإن قطع الحدود → "غير محسوم" (يُرفض بأمان بدل تمريره).
 */
function evaluateGeofence(distance: number, radius: number, accuracy: number): 'inside' | 'outside' | 'uncertain' {
  if (!(accuracy > 0)) return distance <= radius ? 'inside' : 'outside';
  if (distance + accuracy <= radius) return 'inside';
  if (distance - accuracy > radius) return 'outside';
  return 'uncertain';
}

/** يقبل الدقة كرقم غير سالب؛ أي قيمة أخرى تعتبر 0 (لا هامش). */
function parseAccuracy(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

// إشعار أولياء الأمور بالطلاب المتأخرين عن تسجيل الحضور
router.post("/notify-missing", authenticate, authorizePermission(AppPermission.MANAGE_ATTENDANCE), async (req, res) => {
  const tenantId = req.user.tenantId;
  const now = new Date();

  try {
    const missingStudents = await kdb("students as s")
      .join("users as u", "s.user_id", "u.id")
      .where("s.tenant_id", tenantId)
      .where("s.is_traveling", 0)
      .whereNotExists(function() {
        this.select('*').from('attendance as a')
          .whereRaw('a.student_id = s.id')
          .whereRaw("CAST(a.created_at AS DATE) = CAST(GETDATE() AS DATE)")
          .where('a.type', 'check-in');
      })
      .select("s.id", "u.name", "s.tenant_id");

    if (missingStudents.length === 0) {
      return res.json({ success: true, message: "لا يوجد طلاب متأخرون عن تسجيل الحضور اليوم" });
    }

    let notifiedCount = 0;
    await kdb.transaction(async (trx) => {
      // منع التكرار: تجاهل الطلاب الذين سُجّل لهم تنبيه اليوم بالفعل (نقرة مزدوجة/إعادة تشغيل)
      const existingWarnings = await trx("student_warnings")
        .where({ tenant_id: tenantId, warning_type: "DAILY_MISSING_CHECKIN" })
        .whereRaw("CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)")
        .select("student_id");
      const alreadyWarned = new Set((existingWarnings as any[]).map((w) => w.student_id));

      for (const student of missingStudents) {
        if (alreadyWarned.has(student.id)) continue;
        notifiedCount += 1;
        const message = `تنبيه تأخر: الطالب ${student.name} لم يسجل حضوراً حتى الساعة ${now.toLocaleTimeString('ar-EG')}. برجاء التواصل مع المشرف.`;

        const parents = await trx("student_guardians as sg")
          .join("parents as p", "sg.guardian_id", "p.id")
          .where("sg.student_id", student.id)
          .select("p.user_id");

        for (const parent of parents) {
await trx("notifications").insert({
            id: uuidv4(),
            user_id: parent.user_id,
            tenant_id: tenantId,
            title: "تنبيه تأخر الطالب عن الحضور",
            message,
            type: "error",
            metadata: JSON.stringify({ page: 'attendance' }),
            created_at: now
          });
        }

        await trx("student_warnings").insert({
          id: uuidv4(),
          tenant_id: tenantId,
          student_id: student.id,
          level: 'high',
          reason: `لم يقم الطالب بتسجيل الحضور اليوم (حالة غياب) - ${now.toLocaleTimeString()}`,
          notify_parent: 1,
          status: 'active',
          warning_type: 'DAILY_MISSING_CHECKIN',
          is_attendance_warning: 1,
          created_by: req.user.id,
          created_at: now
        });
      }
    });

    const message2 = notifiedCount > 0
      ? `تم إرسال الإشعارات بنجاح لأولياء أمور ${notifiedCount} طالباً`
      : "تم إرسال الإشعارات لهذا اليوم مسبقاً";
    res.json({ success: true, message: message2 });
  } catch (error: any) {
    console.error("Bulk Notification Error:", error);
    res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
  }
});

const ATTENDANCE_TYPES = ['check-in', 'check-out'] as const;

router.post("/check-in", authenticate, authorizePermission(AppPermission.CHECKIN_ATTENDANCE), async (req, res) => {
  const { lat, lng, type = 'check-in' } = req.body; // type: check-in (Entry) or check-out (Exit)
  const userId = req.user.id;

  // النوع مُتحكَّم فيه من العميل: قيّده قبل أي استخدام (وإلا انتهى الأمر بخطأ قاعدة بيانات 500).
  if (!ATTENDANCE_TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: 'نوع تسجيل الحضور غير صالح' });
  }

  try {
    await kdb.transaction(async (trx) => {
      // 1. التحقق من أن الطالب مرتبط بالمستخدم
      const student = await trx("students as s")
        .join("users as u", "s.user_id", "u.id")
        .join("tenants as t", "s.tenant_id", "t.id")
        .where("s.user_id", userId)
        .select(
          "s.id",
          "s.tenant_id",
          "s.curfew_time",
          "u.name as student_name",
          "t.location_lat",
          "t.location_lng",
          "t.location_radius",
          "t.notify_guardian_on_exit"
        )
        .first();

      if (!student) throw new Error("لم يتم العثور على حساب الطالب");
      if (student.is_traveling) throw new Error("لا يمكن تسجيل الحضور/الانصراف خلال مدة السفر الحالية");
      // 2. التحقق من الموقع الجغرافي (Geofencing) — الخادم هو مصدر الحقيقة،
      //    فلا يُعتمد إطلاقاً على قرار الواجهة (حتى في وضع العبور التلقائي).
      const latRaw = lat;
      const lngRaw = lng;
      const latNum = Number(latRaw);
      const lngNum = Number(lngRaw);
      if (
        latRaw === undefined || latRaw === null || latRaw === '' ||
        lngRaw === undefined || lngRaw === null || lngRaw === '' ||
        !Number.isFinite(latNum) || !Number.isFinite(lngNum)
      ) {
        throw new Error('إحداثيات الموقع غير صالحة');
      }
      // نطاقات خطوط الطول/العرض الصحيحة (قيمة خارج النطاق = إحداثيات ملفقة)
      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        throw new Error('إحداثيات الموقع خارج النطاق المسموح');
      }
      const accuracy = parseAccuracy(req.body?.accuracy);

      // البوابة المطلوبة — سياسة موحّدة للدخول والخروج على دائرة السكن المركزية:
      //   · الموقع المركزي (location_*) هو المرجع الرسمي الوحيد لتسجيل الحضور/
      //     الانصراف وفحص الوجود.
      // الأحداث تخزّن إحداثياتها لحظة التسجيل، فلا يتغيّر أي سجل تاريخي.
      const locLat = Number(student.location_lat);
      const locLng = Number(student.location_lng);
      // Number(null) === 0، لذا نتحقق من العدم قبل الاعتماد على isFinite
      const hasCentral = student.location_lat != null && student.location_lng != null
        && Number.isFinite(locLat) && Number.isFinite(locLng);

      let gateLat: number;
      let gateLng: number;
      let gateRadius: number;
      let gateLabel: string;

      if (hasCentral) {
        gateLat = locLat;
        gateLng = locLng;
        gateRadius = Number(student.location_radius) || 50;
        gateLabel = 'موقع السكن';
      } else {
        throw new Error('إحداثيات موقع السكن غير مضبوطة');
      }

      const distance = calculateDistance(latNum, lngNum, gateLat, gateLng);
      const decision = evaluateGeofence(distance, gateRadius, accuracy);
      if (decision === 'outside') {
        throw new Error(`أنت بعيد جداً عن ${gateLabel} (${Math.round(distance)} متر)`);
      }
      if (decision === 'uncertain') {
        throw new Error('دقة تحديد الموقع غير كافية للتحقق من موقعك. اقترب من النقطة وأعد المحاولة.');
      }

      // حماية من التكرار على مستوى قاعدة البيانات (Race-safe):
      // قفل تطبيقي حصري لكل (طالب + نوع) بملكية المعاملة. لا يُحرَّر القفل إلا عند
      // انتهاء المعاملة (commit/rollback)، لذا ينتظر أي طلب متزامن لنفس الطالب
      // والنوع حتى تُلتزم المعاملة الأولى، ثم يرى السطر المدرج ويُرفض. المفتاح يتضمن
      // النوع، فلا يتأثر تسلسل الدخول ثم الخروج. هذا يكمّل قيد الـ 5 دقائق أدناه
      // ويمنع التسجيل المزدوج عند وصول طلبين في نفس اللحظة.
      await trx.raw(
        "DECLARE @lockResult int; EXEC @lockResult = sp_getapplock @Resource = ?, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;",
        [`attendance:${student.id}:${type}`]
      );

      // منع تكرار تسجيل نفس النوع خلال 5 دقائق (Debounce 5 mins)
      const lastAction = await trx("attendance")
        .where({ student_id: student.id, type })
        .whereRaw("created_at > DATEADD(minute, -5, GETDATE())")
        .first();

      if (lastAction) {
        throw new Error("تم تسجيل الحضور بالفعل خلال الخمس دقائق الأخيرة");
      }

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const curfewParts = student.curfew_time?.split(':') || [];
      const curfewH = parseInt(curfewParts[0] || '23', 10);
      const curfewM = parseInt(curfewParts[1] || '59', 10);
      const curfewMinutes = curfewH * 60 + curfewM;

      // 3. تسجيل الحضور في قاعدة البيانات
      const attendanceId = uuidv4();
      await trx("attendance").insert({
        id: attendanceId,
        tenant_id: student.tenant_id,
        student_id: student.id,
        user_id: userId,
        status: (type === 'check-in' && currentTime > curfewMinutes) ? 'late' : 'present',
        type: type,
        location_lat: latNum,
        location_lng: lngNum,
        created_at: now
      });

      // 4. منطق التنبيهات الذكية (تأخير دخول أو خروج غير مسموح)
      const isLateCheckIn = type === 'check-in' && currentTime > curfewMinutes; // Student checks in after curfew
      const isForbiddenExit = type === 'check-out' && currentTime < curfewMinutes; // Student checks out before curfew (e.g., trying to leave early) - this might need clarification from user. Assuming curfew is for *entry*. Let's re-evaluate.

      // User's request: "و لو اتاخر عن ميعاد السكن و مدخلش في نقطة الدخول بيبعت اشعارات لاهله و لمشرف السكن ان الطالب اتاخر عن ميعاد دخوله السكن"
      // Exclude traveling students from late notifications
      // This implies curfew is primarily for check-in.
      // For check-out, the main concern is just recording the exit.

      // Let's simplify the notification logic for now:
      // 1. Always notify for successful check-in/check-out.
      // 2. Add specific notification for late check-in.

      let notificationTitle = type === 'check-in' ? 'تم تسجيل دخول الطالب' : 'تم تسجيل خروج الطالب';
      let notificationMessage = `الطالب ${student.student_name} سجل ${type === 'check-in' ? 'دخولاً' : 'خروجاً'} في تمام الساعة ${now.toLocaleTimeString('ar-EG')}.`;
      let notificationType: 'success' | 'warning' | 'error' = 'success';

      if (isLateCheckIn && !student.is_traveling) { // Only send late notification if not traveling
        notificationTitle = 'تأخير دخول الطالب ⛠️';
        notificationMessage = `تنبيه: سجل الطالب ${student.student_name} دخولاً متأخراً في تمام الساعة ${now.toLocaleTimeString('ar-EG')}. موعد الإغلاق الرسمي: ${student.curfew_time}.`;
        notificationType = 'warning';
      }

      // Notify Supervisors
      const supervisors = await trx("user_tenant_assignments as uta")
        .join("users as u", "uta.user_id", "u.id")
        .where("uta.tenant_id", student.tenant_id)
        .where("u.role", "supervisor")
        .select("u.id");

      for (const sup of supervisors) {
        await trx("notifications").insert({
          id: uuidv4(),
          user_id: sup.id,
          tenant_id: student.tenant_id,
          title: notificationTitle,
          message: notificationMessage,
          type: notificationType,
          metadata: JSON.stringify({ page: 'attendance' }),
          created_at: now
        });
      }

      // Notify Parents
      // إشعار ولي الأمر بالخروج العادي اختياري من إعدادات السكن (افتراضياً مغلق
      // حتى تبقى الحركة اليومية هادئة). الدخول يبقى مُشعِراً دائماً.
      const shouldNotifyParents = type === 'check-in' || !!student.notify_guardian_on_exit;
      const parents = shouldNotifyParents
        ? await trx("student_guardians as sg")
            .join("parents as p", "sg.guardian_id", "p.id")
            .where("sg.student_id", student.id)
            .select("p.user_id")
        : [];

      for (const parent of parents) {
        await trx("notifications").insert({
          id: uuidv4(),
          user_id: parent.user_id,
          tenant_id: student.tenant_id,
          title: notificationTitle,
          message: notificationMessage,
          type: notificationType,
          metadata: JSON.stringify({ page: 'attendance' }),
          created_at: now
        });
      }

      // If late check-in, record delay and warning
      if (isLateCheckIn) {
        const delayMinutes = currentTime - curfewMinutes;
        const delayId = uuidv4();
        await trx("student_delays").insert({
          id: delayId,
          tenant_id: student.tenant_id,
          student_id: student.id,
          curfew_time: student.curfew_time,
          actual_entry_time: now,
          delay_minutes: delayMinutes,
          status: 'pending'
        });

        await trx("student_warnings").insert({
          id: uuidv4(),
          tenant_id: student.tenant_id,
          student_id: student.id,
          level: 'medium',
          reason: `تجاوز موعد إغلاق السكن (تأخير تلقائي) - ${now.toLocaleDateString()}`,
          notify_parent: 1,
          status: 'active'
        });
      }
    });

    res.json({ success: true, message: "تم تسجيل الحضور بنجاح" });
  } catch (error: any) {
    const knownErrors = [
      "لم يتم العثور على حساب الطالب",
      "لا يمكن تسجيل الحضور/الانصراف خلال مدة السفر الحالية",
      "تم تسجيل الحضور بالفعل خلال الخمس دقائق الأخيرة"
    ];
    if (knownErrors.includes(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message?.includes("بعيد")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message?.indexOf("إحداثيات") === 0 || error.message?.indexOf("الغرفة") === 0 || error.message?.indexOf("دقة") === 0) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Attendance Error:", error);
    res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
  }
});

// 6. جلب إحصائيات الحضور والانصراف حسب الساعة (للمشرفين)
router.get("/hourly-stats", authenticate, authorizePermission(AppPermission.MANAGE_ATTENDANCE), async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    const hourlyData = await kdb("attendance")
      .where({ tenant_id: tenantId })
      .whereRaw("CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)")
      .select(
        kdb.raw("DATEPART(HOUR, created_at) as hour"),
        kdb.raw("SUM(CASE WHEN type = 'check-in' THEN 1 ELSE 0 END) as check_ins"),
        kdb.raw("SUM(CASE WHEN type = 'check-out' THEN 1 ELSE 0 END) as check_outs")
      )
      .groupByRaw("DATEPART(HOUR, created_at)")
      .orderBy("hour", "asc");

    // تهيئة البيانات لضمان وجود جميع الساعات من 0 إلى 23 في الرسم البياني
    const hourlyRows = hourlyData as any[];
    const fullHourlyData = Array.from({ length: 24 }, (_, i) => {
      const existing = hourlyRows.find((d: any) => d.hour === i);
      return {
        hour: `${i}:00`,
        "دخول": existing ? existing.check_ins : 0,
        "خروج": existing ? existing.check_outs : 0,
      };
    });

    res.json({ success: true, data: fullHourlyData });
  } catch (error: any) {
    console.error("Hourly Stats Error:", error);
    res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
  }
});

/** Query the check-in/out movement log for a student with optional filters. */
function movementHistoryQuery(studentId: string, query: any) {
  const q = kdb('attendance').where({ student_id: studentId });

  const type = query.type;
  if (type === 'check-in' || type === 'check-out') q.andWhere('type', type);

  const status = query.status;
  if (status === 'late' || status === 'present') q.andWhere('status', status);

  if (query.lateOnly === 'true' || query.lateOnly === '1') q.andWhere('status', 'late');

  const from = query.from ? new Date(String(query.from)) : null;
  if (from && !Number.isNaN(from.getTime())) q.andWhere('created_at', '>=', from);

  const to = query.to ? new Date(String(query.to)) : null;
  if (to && !Number.isNaN(to.getTime())) {
    // date-only ("YYYY-MM-DD") is inclusive of that whole day
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.to))) to.setHours(23, 59, 59, 999);
    q.andWhere('created_at', '<=', to);
  }

  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500);
  return q.orderBy('created_at', 'desc').limit(limit);
}

router.get("/history/:userId", authenticate, authorizePermission(AppPermission.VIEW_ATTENDANCE), async (req, res) => {
  try {
    const isOwn = req.user.id === req.params.userId;
    const hasManage = await checkUserPermission(req.user.id, AppPermission.MANAGE_ATTENDANCE);
    if (!isOwn && !hasManage) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول لتاريخ هذا الطالب' });
    }
    const student = await kdb('students').where({ user_id: req.params.userId }).first();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // حتى حارس الحضور لا يجوز أن يرى طالب سكن آخر
    if (!isOwn && student.tenant_id && req.user.role !== 'admin') {
      const allowedIds = await computeUserTenantIds(req.user);
      if (!includesId(allowedIds, student.tenant_id)) {
        return res.status(403).json({ success: false, message: 'غير مصرح بالوصول لتاريخ هذا الطالب' });
      }
    }

    const history = await movementHistoryQuery(student.id, req.query);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
  }
});

// Movement log addressed by student id (used by profile/guardian views). Own
// student, or a supervisor/admin with a tenant scope that covers the student.
router.get("/movement/:studentId", authenticate, authorizePermission(AppPermission.VIEW_ATTENDANCE), async (req, res) => {
  try {
    const student = await kdb('students').where({ id: req.params.studentId }).first();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const isOwn = student.user_id === req.user.id;
    const hasManage = await checkUserPermission(req.user.id, AppPermission.MANAGE_ATTENDANCE);
    if (!isOwn && !hasManage) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول لتاريخ هذا الطالب' });
    }
    if (!isOwn && student.tenant_id && req.user.role !== 'admin') {
      const allowedIds = await computeUserTenantIds(req.user);
      if (!includesId(allowedIds, student.tenant_id)) {
        return res.status(403).json({ success: false, message: 'غير مصرح بالوصول لتاريخ هذا الطالب' });
      }
    }

    const history = await movementHistoryQuery(student.id, req.query);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
  }
});

export default router;
