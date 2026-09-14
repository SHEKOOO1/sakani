import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb, checkUserPermission } from "../infrastructure/db.ts";
import { authenticate, authorizePermission, computeUserTenantIds } from "./middleware.ts";
import { AppPermission } from "../../types/permissions.ts";

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

// ���� ����� ������ ������� (�������� ���)
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
      return res.json({ success: true, message: "�� ���� �����ʺ ���� ������ ����� ������ ������ ?" });
    }

    await kdb.transaction(async (trx) => {
      for (const student of missingStudents) {
        const message = `����� ����: ������ ${student.name} �� ���� ������ �� ����� ��� ������ ${now.toLocaleTimeString('ar-EG')}. ���� ������� ��� �����.`;

        const parents = await trx("student_guardians as sg")
          .join("parents as p", "sg.guardian_id", "p.id")
          .where("sg.student_id", student.id)
          .select("p.user_id");

        for (const parent of parents) {
await trx("notifications").insert({
            id: uuidv4(),
            user_id: parent.user_id,
            tenant_id: tenantId,
            title: "������ ���� ����� ??",
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
          reason: `���� �� ����� �� ������ ������ (��� ����� ���) - ${now.toLocaleTimeString()}`,
          notify_parent: 1,
          status: 'active'
        });
      }
    });

    res.json({ success: true, message: `�� ����� ������� ������ �� ��� ������ �����.` });
  } catch (error: any) {
    console.error("Bulk Notification Error:", error);
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/check-in", authenticate, authorizePermission(AppPermission.CHECKIN_ATTENDANCE), async (req, res) => {
  const { lat, lng, type = 'check-in' } = req.body; // type: check-in (Entry) or check-out (Exit)
  const userId = req.user.id;

  try {
    await kdb.transaction(async (trx) => {
      // 1. ��� ������ ������ ��������� �����
      const student = await trx("students as s")
        .join("users as u", "s.user_id", "u.id")
        .join("tenants as t", "s.tenant_id", "t.id")
        .where("s.user_id", userId)
        .select(
          "s.id",
          "s.tenant_id",
          "s.curfew_time",
          "u.name as student_name",
          "s.is_traveling",
          "t.entry_lat",
          "t.entry_lng",
          "t.entry_radius",
          "t.exit_lat",
          "t.exit_lng",
          "t.exit_radius"
        )
        .first();

      if (!student) throw new Error("��� ������ ��� �����");
      if (student.is_traveling) throw new Error("�� ����� ����� ������/�������� ����� ���� �����.");
      // 2. ������ �������� ������ (Geofencing)
      const latNum = Number(lat);
      const lngNum = Number(lng);
      // منع تجاوز الموقع الجغرافي بإرسال قيم غير رقمية (NaN تتجاوز كل المقارنات)
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        throw new Error('إحداثيات الموقع غير صالحة');
      }
      const entryLat = Number(student.entry_lat);
      const entryLng = Number(student.entry_lng);
      if (!Number.isFinite(entryLat) || !Number.isFinite(entryLng)) {
        throw new Error('إحداثيات نقطة الدخول غير مضبوطة');
      }
      const distance = calculateDistance(
        latNum,
        lngNum,
        entryLat,
        entryLng
      );

      const exitDistance = student.exit_lat && student.exit_lng && student.exit_radius
        ? calculateDistance(
            latNum,
            lngNum,
            Number(student.exit_lat),
            Number(student.exit_lng)
          )
        : null;

      const entryRadius = Number(student.entry_radius) || 50;
      const exitRadius = Number(student.exit_radius) || 50;

      // If trying to check-in and far from entry point, reject
      if (type === 'check-in' && distance > entryRadius) {
        throw new Error(`��� ���� ��� �� ���� ������ (${Math.round(distance)} ���)`);
      }

      // ������ �� ��� ����� ��� ������� �� ��� ���� (Debounce 5 mins)
      const lastAction = await trx("attendance")
        .where({ student_id: student.id, type })
        .whereRaw("created_at > DATEADD(minute, -5, GETDATE())")
        .first();

      if (lastAction) {
        throw new Error("�� ����� ������ ������ ��������");
      }

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const curfewParts = student.curfew_time?.split(':') || [];
      const curfewH = parseInt(curfewParts[0] || '23', 10);
      const curfewM = parseInt(curfewParts[1] || '59', 10);
      const curfewMinutes = curfewH * 60 + curfewM;

      // 3. ����� ������ �������
      const attendanceId = uuidv4();
      await trx("attendance").insert({
        id: attendanceId,
        tenant_id: student.tenant_id,
        student_id: student.id,
        user_id: userId,
        status: (type === 'check-in' && currentTime > curfewMinutes) ? 'late' : 'present',
        type: type,
        location_lat: lat || null,
        location_lng: lng || null,
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
        notificationTitle = 'تأخير دخول الطالب ⚠️';
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
      const parents = await trx("student_guardians as sg")
        .join("parents as p", "sg.guardian_id", "p.id")
        .where("sg.student_id", student.id)
        .select("p.user_id");

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

    res.json({ success: true, message: "�� ����� ������ �����" });
  } catch (error: any) {
    const knownErrors = [
      "��� ������ ��� �����",
      "�� ����� ����� ������/�������� ����� ���� �����.",
      "�� ����� ������ ������ ��������"
    ];
    if (knownErrors.includes(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message?.includes("����")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message?.indexOf("إحداثيات") === 0 || error.message?.indexOf("الغرفة") === 0) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Attendance Error:", error);
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
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
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

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
      if (!allowedIds.includes(student.tenant_id)) {
        return res.status(403).json({ success: false, message: 'غير مصرح بالوصول لتاريخ هذا الطالب' });
      }
    }

    const history = await kdb('attendance')
      .where({ student_id: student.id })
      .orderBy('created_at', 'desc')
      .limit(50);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
