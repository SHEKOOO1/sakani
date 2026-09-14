import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb, checkUserPermission } from "../infrastructure/db";
import { authenticate, authorizePermission, requireItemAccess, canManageItem, computeUserTenantIds, sanitizeInput } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { validate } from "../validation/middleware";
import {
  createEventSchema,
  updateEventSchema,
  eventAttendanceSchema,
  attendanceBulkSchema,
  createEventSessionSchema,
  eventAttendanceDetailedSchema,
  attendanceDetailedBatchSchema,
  createEventTeamSchema,
  createEventCriterionSchema,
  eventScoreSchema,
  parentEnrollSchema,
} from "../validation/schemas";
import { createNotification } from "./notifications.routes";
import { upload, UPLOADS_BASE, validateMagicBytes } from "../middleware/upload";

const router = express.Router();

// تحقق من وصول المستخدم لفعالية (فعالية عامة أو فعالية تابعة لسكن يملكه)
const canAccessEvent = async (req: any, event: any): Promise<boolean> => {
  if (req.user.role === 'admin') return true;
  if (!event?.tenant_id) return true;
  const allowed = await computeUserTenantIds(req.user);
  return allowed.includes(event.tenant_id);
};

// Get all events
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_EVENTS), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { role, id: userId } = req.user;
  const isAdmin = role === 'admin';

  try {
    // Admin: only see global events (tenant_id IS NULL) — never tenant-level events
    if (isAdmin) {
      const events = await kdb('events').whereNull('tenant_id').orderBy('created_at', 'desc');
      // Add subscription count
      const eventIds = events.map((ev: any) => ev.id);
      if (eventIds.length > 0) {
        const subCounts = await kdb('event_subscriptions')
          .whereIn('event_id', eventIds)
          .where({ status: 'approved' })
          .groupBy('event_id')
          .select('event_id')
          .count('id as count');
        const subCountMap: Record<string, number> = {};
        subCounts.forEach((row: any) => { subCountMap[row.event_id] = parseInt(row.count); });
        const data = events.map((ev: any) => ({ ...ev, _subscription_count: subCountMap[ev.id] || 0 }));
        return res.json({ success: true, data });
      }
      return res.json({ success: true, data: events });
    }

    // Parent: only see events their children are in + global events targeting their tenant
    if (role === 'parent') {
      const parent = await kdb('parents').select('id').where({ user_id: userId }).first();
      if (!parent) return res.json({ success: true, data: [] });
      const children = await kdb('student_guardians').select('student_id').where({ guardian_id: parent.id });
      const childIds = children.map((c: any) => c.student_id);

      const childTenants = childIds.length > 0
        ? await kdb('students').whereIn('id', childIds).select('tenant_id')
        : [];
      const childTenantIds = [...new Set(childTenants.map((s: any) => s.tenant_id).filter(Boolean))];

      const events = await kdb('events as e')
        .distinct()
        .leftJoin('event_attendance as ea', 'e.id', 'ea.event_id')
        .where(function () {
          this.whereIn('ea.student_id', childIds)
              .orWhere('e.parent_can_enroll', 1);
        })
        .andWhere(function () {
          this.where('e.tenant_id', tenantId);
          if (childTenantIds.length > 0) {
            this.orWhere(function () {
              this.whereNull('e.tenant_id');
              childTenantIds.forEach((tid: string) => {
                this.orWhereRaw("JSON_VALUE(e.targeting, '$.tenants') LIKE ?", [`%"${tid}"%`]);
              });
            });
          }
        })
        .select('e.*');

      const eventIds = events.map((ev: any) => ev.id);
      let attendanceRecords: any[] = [];
      if (eventIds.length > 0 && childIds.length > 0) {
        attendanceRecords = await kdb('event_attendance')
          .whereIn('event_id', eventIds)
          .whereIn('student_id', childIds)
          .select('event_id', 'student_id', 'status');
      }

      const data = events.map((ev: any) => ({
        ...ev,
        attendance_records: attendanceRecords.filter((a: any) => a.event_id === ev.id),
      }));

      // Add subscription counts + user subscription status
      const parentEventIds = data.map((ev: any) => ev.id);
      if (parentEventIds.length > 0) {
        const subCounts = await kdb('event_subscriptions')
          .whereIn('event_id', parentEventIds)
          .where({ status: 'approved' })
          .groupBy('event_id')
          .select('event_id')
          .count('id as count');
        const subCountMap: Record<string, number> = {};
        subCounts.forEach((row: any) => { subCountMap[row.event_id] = parseInt(row.count); });
        // Get user subscription status
        const userSubs = await kdb('event_subscriptions')
          .whereIn('event_id', parentEventIds)
          .where({ user_id: userId })
          .select('event_id', 'status', 'payment_status');
        const userSubMap: Record<string, { status: string, payment_status: string }> = {};
        userSubs.forEach((sub: any) => { userSubMap[sub.event_id] = { status: sub.status, payment_status: sub.payment_status }; });
        const enrichedData = data.map((ev: any) => ({
          ...ev,
          _subscription_count: subCountMap[ev.id] || 0,
          _user_subscription: userSubMap[ev.id] || null,
        }));
        return res.json({ success: true, data: enrichedData });
      }

      return res.json({ success: true, data });
    }

    // Tenant-level staff (supervisor, priest, employee): see their tenant events + global events targeting their tenants
    let resultEvents: any[] = [];
    const tenantId = req.user.tenantId;

    if (tenantId) {
      const tenantEvents = await kdb('events').where('tenant_id', tenantId).orderBy('created_at', 'desc');
      const globalEvents = await kdb('events').whereNull('tenant_id').orderBy('created_at', 'desc');

      // Filter global events: show if targeting is empty (all tenants) or includes selected tenant
      const targetedGlobals = globalEvents.filter((ev: any) => {
        if (!ev.targeting) return true;
        try {
          const t = typeof ev.targeting === 'string' ? JSON.parse(ev.targeting) : ev.targeting;
          if (t.tenants && t.tenants.length > 0) {
            return t.tenants.includes(tenantId);
          }
          return true;
        } catch { return true; }
      });

      resultEvents = [...tenantEvents, ...targetedGlobals].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      resultEvents = [];
    }

    // Student: filter by targeting + include attendance info
    if (role === 'student') {
      const student = await kdb('students').select('id').where({ user_id: userId }).first();
      if (student) {
        const studentId = student.id;
        const filtered: any[] = [];
        for (const ev of resultEvents) {
          if (ev.targeting) {
            try {
              const targeting = typeof ev.targeting === 'string' ? JSON.parse(ev.targeting) : ev.targeting;
              if (targeting.tenants && targeting.tenants.length > 0) {
                const s = await kdb('students').where({ id: studentId }).first();
                if (s && !targeting.tenants.includes(s.tenant_id)) continue;
              }
              if (targeting.students && targeting.students.length > 0) {
                if (!targeting.students.includes(studentId)) continue;
              }
            } catch { /* empty targeting - show to all */ }
          }
          filtered.push(ev);
        }
        resultEvents = filtered;
        const eventIds = resultEvents.map((ev: any) => ev.id);
        let attendanceRecords: any[] = [];
        if (eventIds.length > 0) {
          attendanceRecords = await kdb('event_attendance')
            .whereIn('event_id', eventIds)
            .where({ student_id: studentId })
            .select('event_id', 'student_id', 'status');
        }
        resultEvents = resultEvents.map((ev: any) => ({
          ...ev,
          attendance_records: attendanceRecords.filter((a: any) => a.event_id === ev.id)
        }));
      }
    }

    // Add subscription count for all roles
    const allEventIds = resultEvents.map((ev: any) => ev.id);
    if (allEventIds.length > 0) {
      const subCounts = await kdb('event_subscriptions')
        .whereIn('event_id', allEventIds)
        .where({ status: 'approved' })
        .groupBy('event_id')
        .select('event_id')
        .count('id as count');
      const subCountMap: Record<string, number> = {};
      subCounts.forEach((row: any) => { subCountMap[row.event_id] = parseInt(row.count); });
      resultEvents = resultEvents.map((ev: any) => ({
        ...ev,
        _subscription_count: subCountMap[ev.id] || 0,
      }));
    }

    // Add user's subscription status for students and parents
    if (['student', 'parent'].includes(role) && allEventIds.length > 0) {
      const userSubs = await kdb('event_subscriptions')
        .whereIn('event_id', allEventIds)
        .where({ user_id: userId })
        .select('event_id', 'status', 'payment_status');
      const userSubMap: Record<string, { status: string, payment_status: string }> = {};
      userSubs.forEach((sub: any) => { userSubMap[sub.event_id] = { status: sub.status, payment_status: sub.payment_status }; });
      resultEvents = resultEvents.map((ev: any) => ({
        ...ev,
        _user_subscription: userSubMap[ev.id] || null,
      }));
    }

    // Per-item manager flag (assigned managers get full control over this event)
    resultEvents = await Promise.all(resultEvents.map(async (ev: any) => ({
      ...ev,
      canManage: await canManageItem(req.user, 'event', ev.id),
    })));

    res.json({ success: true, data: resultEvents });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Create an event
router.post("/", authenticate, authorizePermission(AppPermission.CREATE_EVENT), validate(createEventSchema), async (req, res) => {
  const { title, description, event_date, location, location_lat, location_lng, location_radius, is_paid = false, price = 0, is_competition = false, winning_threshold = 100, max_score = 200, responsibleIds = [], targeting, type: eventType, registration_deadline, available_payment_methods, max_participants } = req.body;
  const tenantId = req.user.tenantId || (req.user.tenantIds && req.user.tenantIds[0]);
  const id = uuidv4();
  const qrCode = `event-${id}`; 

  try {
    await kdb.transaction(async trx => {
      const insertData: any = {
        id, tenant_id: tenantId, title, description, event_date, location, 
        location_lat, location_lng, location_radius, qr_code: qrCode, is_paid: is_paid ? 1 : 0, price,
        is_competition: is_competition ? 1 : 0, winning_threshold, max_score, created_by: req.user.id
      };
      if (event_date) insertData.event_date = new Date(event_date);
      if (targeting) insertData.targeting = JSON.stringify(targeting);
      if (eventType) insertData.type = eventType;
      if (registration_deadline) insertData.registration_deadline = new Date(registration_deadline);
      if (available_payment_methods && available_payment_methods.length > 0) {
        insertData.available_payment_methods = JSON.stringify(available_payment_methods);
      }
      if (max_participants) insertData.max_participants = max_participants;
      await trx('events').insert(insertData);

      // Event competitions use their own tables (competition_teams, event_criteria, event_scores)
      // No link to the standalone competitions system

      if (responsibleIds && responsibleIds.length > 0) {
        const users = await trx('users').select('id', 'role as type').whereIn('id', responsibleIds);
        for (const user of users) {
          await trx('event_responsible').insert({
              id: uuidv4(),
              event_id: id,
              user_id: user.id,
              type: user.type
          });
        }
      }
    });

    res.status(201).json({ success: true, data: { id, title, qrCode }, message: "تم إنشاء الفعالية بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// Update an event (full edit)
router.put("/:id", authenticate, requireItemAccess('event', AppPermission.EDIT_EVENT), validate(updateEventSchema), async (req, res) => {
  const { id } = req.params;
  const { title, description, event_date, location, location_lat, location_lng, location_radius, is_paid, price, is_competition, winning_threshold, max_score, responsibleIds = [], targeting, type: eventType, registration_deadline, available_payment_methods, max_participants } = req.body;
  const tenantId = req.user.tenantId;

  try {
    const event = await kdb('events').where({ id }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (event.tenant_id && event.tenant_id !== tenantId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية لتعديل هذه الفعالية" });
    }

    // Check if max_participants is being lowered below current approved count
    if (max_participants !== undefined && max_participants !== null) {
      const currentApproved = await kdb('event_subscriptions')
        .where({ event_id: id, status: 'approved' })
        .count('id as count')
        .first();
      const approvedCount = Number(currentApproved?.count) || 0;
      if (max_participants < approvedCount) {
        return res.status(400).json({
          success: false,
          message: `لا يمكنك تقليل العدد الأقصى إلى ${max_participants} بينما يوجد ${approvedCount} مشترك معتمد بالفعل`
        });
      }
    }

    await kdb.transaction(async trx => {
      const updateData: any = {
        title, description, location,
        location_lat, location_lng, location_radius,
        is_paid: is_paid ? 1 : 0, price,
        is_competition: is_competition ? 1 : 0, winning_threshold, max_score,
      };
      if (event_date) updateData.event_date = new Date(event_date);
      if (targeting) updateData.targeting = JSON.stringify(targeting);
      if (eventType) updateData.type = eventType;
      if (registration_deadline) updateData.registration_deadline = new Date(registration_deadline);
      if (available_payment_methods && available_payment_methods.length > 0) {
        updateData.available_payment_methods = JSON.stringify(available_payment_methods);
      } else {
        updateData.available_payment_methods = null;
      }
      if (max_participants !== undefined && max_participants !== null) {
        updateData.max_participants = max_participants;
      } else {
        updateData.max_participants = null;
      }

      await trx('events').where({ id }).update(updateData);

      await trx('event_responsible').where({ event_id: id }).del();
      if (responsibleIds && responsibleIds.length > 0) {
        const users = await trx('users').select('id', 'role as type').whereIn('id', responsibleIds);
        for (const user of users) {
          await trx('event_responsible').insert({
            id: uuidv4(), event_id: id, user_id: user.id, type: user.type
          });
        }
      }
    });

    res.json({ success: true, message: "تم تعديل الفعالية بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل التعديل. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// Get event payment status (all registered students + their payment status)
router.get("/:id/payments", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_PAYMENTS), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  try {
    const event = await kdb('events').where({ id }).select('is_paid', 'price', 'available_payment_methods', 'tenant_id').first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (event.tenant_id && event.tenant_id !== tenantId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية للاطلاع على مدفوعات هذه الفعالية" });
    }

    // Get all students connected to this event (registrations + attendance + approved subscriptions) with payment status
    const registered = (await kdb.raw(`
      SELECT DISTINCT s.id as student_id, u.name as student_name, s.student_id_number,
        ep.id as payment_id, ep.status as payment_status, ep.amount as paid_amount,
        ep.paid_at, ep.payment_method_id
      FROM (
        SELECT student_id FROM event_registrations WHERE event_id = ?
        UNION
        SELECT student_id FROM event_attendance WHERE event_id = ?
        UNION
        SELECT student_id FROM event_subscriptions WHERE event_id = ? AND status = 'approved'
      ) AS participants
      JOIN students s ON participants.student_id = s.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN event_payments ep ON ep.event_id = ? AND ep.student_id = s.id
      ORDER BY u.name
    `, [id, id, id, id])).recordset || [];

    res.json({
      success: true,
      data: {
        event: { is_paid: event.is_paid, price: event.price, available_payment_methods: event.available_payment_methods },
        registrations: registered,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Send payment reminder to a student
router.post("/:id/payments/remind/:studentId", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_PAYMENTS), async (req, res) => {
  const { id, studentId } = req.params;
  const tenantId = req.user.tenantId;

  try {
    const event = await kdb('events').where({ id }).select('title', 'price', 'tenant_id').first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (event.tenant_id && event.tenant_id !== tenantId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية لإرسال تذكير لهذه الفعالية" });
    }

    const student = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .select('s.id', 'u.id as user_id', 'u.name')
      .where('s.id', studentId)
      .first();
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

    if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
    await createNotification({
      userId: student.user_id,
      tenantId,
      title: `تذكير بدفع رسوم الفعالية`,
      message: `عزيزي ${student.name}، تذكر دفع رسوم فعالية "${event.title}" بمبلغ ${event.price} ج.م.`,
      type: 'warning',
      event_id: id
    });

    res.json({ success: true, message: "تم إرسال التذكير بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Delete an event (cascade to all related data)
router.delete("/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const event = await kdb('events').where({ id }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });

    // منع الحذف عبر السكنات: لابد من ملكية السكن (أو مدير التطبيق للفعاليات العامة)
    const isAdmin = req.user.role === 'admin';
    if (event.tenant_id) {
      if (!isAdmin) {
        const allowed = await computeUserTenantIds(req.user);
        if (!allowed.includes(event.tenant_id)) {
          return res.status(403).json({ success: false, message: "ليس لديك صلاحية حذف هذه الفعالية" });
        }
      }
    } else if (!isAdmin) {
      return res.status(403).json({ success: false, message: "لا يمكن حذف الفعاليات العامة إلا لمدير التطبيق" });
    }

    const isCreator = event.created_by && event.created_by.toLowerCase() === req.user.id.toLowerCase();
    if (!isCreator) {
      const hasPerm = await checkUserPermission(req.user.id, AppPermission.DELETE_EVENT);
      if (!hasPerm) {
        return res.status(403).json({ success: false, message: "ليس لديك صلاحية حذف هذه الفعالية" });
      }
    }

    const eventTables = [
      'event_attendance_detailed', 'event_attendance',
      'event_scores', 'event_criteria', 'event_sessions',
      'event_registrations', 'event_subscriptions',
      'event_payments', 'event_responsible',
      'competition_teams', 'notifications'
    ];
    await kdb.transaction(async trx => {
      const teamIds = await trx('event_teams').where({ event_id: id }).select('id');
      if (teamIds.length > 0) {
        await trx('event_team_members').whereIn('event_team_id', teamIds.map((t: any) => t.id)).del();
        await trx('event_scores').whereIn('team_id', teamIds.map((t: any) => t.id)).del();
      }
      await trx('event_teams').where({ event_id: id }).del();
      await trx('item_managers').where({ item_id: id, item_type: 'event' }).del();
      for (const table of eventTables) {
        try {
          const column = table === 'competition_teams' ? 'competition_id' : table === 'notifications' ? 'event_id' : 'event_id';
          await trx(table).where({ [column]: id }).del();
        } catch (e: any) {
          console.warn(`[DeleteEvent] Skipping table "${table}": ${e?.message}`);
        }
      }
      await trx('events').where({ id }).del();
    });
    res.json({ success: true, message: "تم حذف الفعالية وكل بياناتها واشتراكاتها بالكامل" });
  } catch (error: any) {
    console.error('Delete event error:', error);
    res.status(400).json({ success: false, message: "فشل الحذف. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// Mark attendance via QR (Student scanning or Supervisor scanning student)
router.post("/attendance", authenticate, authorizePermission(AppPermission.ATTEND_EVENT), validate(eventAttendanceSchema), async (req, res) => {
  const { eventId, studentId: bodyStudentId, status = 'present', checkInMethod = 'qr', excuseReason = null } = req.body;
  const { role, id: userId } = req.user;
  const id = uuidv4();

  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });

    let studentId = bodyStudentId;

    if (role === 'student') {
      const student = await kdb('students').select('id').where({ user_id: userId }).first();
      if (!student) return res.status(403).json({ success: false, message: "ليس لديك ملف طالب" });
      studentId = student.id;
    }

    // Parent: self-enroll or child enroll
    if (role === 'parent') {
      const event = await kdb('events').select('parent_can_enroll').where({ id: eventId }).first();
      if (!event || !event.parent_can_enroll) {
        return res.status(403).json({ success: false, message: "هذه الفعالية لا تسمح بتسجيل أولياء الأمور" });
      }
      // If no studentId provided, parent is enrolling themselves
      if (!bodyStudentId) {
        const existing = await kdb('event_attendance')
          .where({ event_id: eventId, parent_user_id: userId })
          .first();
        if (existing) {
          return res.status(400).json({ success: false, message: "أنت مسجل بالفعل في هذه الفعالية" });
        }
            await kdb('event_attendance').insert({
              id, event_id: eventId, parent_user_id: userId, status: 'present', check_in_method: checkInMethod, attended_at: kdb.fn.now()
            });
        return res.json({ success: true, message: "تم تسجيلك في الفعالية", data: { id } });
      }
      // Legacy: parent enrolling child
      const parent = await kdb('parents').select('id').where({ user_id: userId }).first();
      if (!parent) return res.status(403).json({ success: false, message: "ليس لديك حساب ولي أمر" });
      const isChild = await kdb('student_guardians')
        .where({ guardian_id: parent.id, student_id: studentId })
        .first();
      if (!isChild) return res.status(403).json({ success: false, message: "هذا الطالب ليس ابنك" });
    }

if (!studentId) return res.status(400).json({ success: false, message: "معرف الطالب مطلوب" });

    // الطالب يجب أن ينتمي لسكن الفعالية (أو تكون الفعالية عامة)
    const studentRow = await kdb('students').select('tenant_id').where({ id: studentId }).first();
    if (!studentRow) return res.status(404).json({ success: false, message: "الطالب غير موجود" });
    if (event.tenant_id && studentRow.tenant_id !== event.tenant_id) {
      return res.status(403).json({ success: false, message: "الطالب ليس ضمن هذه الفعالية" });
    }

    // تصحيح لمسار MSSQL: التحقق من وجود السجل أولاً
    const existing = await kdb('event_attendance')
      .where({ event_id: eventId, student_id: studentId })
      .first();

    if (existing) {
      await kdb('event_attendance')
        .where({ id: existing.id })
        .update({
          status,
          check_in_method: checkInMethod,
          excuse_reason: excuseReason,
          attended_at: kdb.fn.now()
        });
    } else {
      await kdb('event_attendance')
        .insert({
          id, event_id: eventId, student_id: studentId, status, check_in_method: checkInMethod, excuse_reason: excuseReason, attended_at: kdb.fn.now()
        });
    }

    // If status is 'absent' or 'unexcused', record as notification logic (simplified)
    if (status === 'unexcused' || status === 'absent') {
       const studentData = await kdb('students').select('user_id').where({ id: studentId }).first();
       if (studentData) {
         const reasonSuffix = excuseReason ? ` (السبب: ${excuseReason})` : "";
         await kdb('notifications').insert({
             id: uuidv4(), user_id: studentData.user_id, tenant_id: req.user.tenantId, 
             title: "تنبيه غياب", message: `تنبيه: لقد تغيبت عن الفعالية بدون عذر مقبول.${reasonSuffix}`, type: 'warning'
         });
         
         const guardians = await kdb('student_guardians as sg')
           .join('parents as p', 'sg.guardian_id', 'p.id')
           .select('p.user_id')
           .where('sg.student_id', studentId);
         
         for (const g of guardians) {
           await kdb('notifications').insert({
               id: uuidv4(), user_id: g.user_id, tenant_id: req.user.tenantId, 
               title: "تنبيه غياب طالب", message: `تنبيه: تغيب ابنكم عن فعالية رسمية بدون عذر مقبول.${reasonSuffix}`, type: 'warning'
           });
         }
       }
    }

    res.json({ success: true, message: "تم تسجيل الحضور بنجاح" });
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ success: false, message: "خطأ في تسجيل الحضور" });
  }
});

// Get attendance for an event (includes approved subscribers who haven't checked in)
router.get("/:id/attendance", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), async (req, res) => {
  const { id } = req.params;
  try {
      const event = await kdb('events').where({ id }).first();
      if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
      if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
      const attendance = await kdb.raw(`
        SELECT DISTINCT s.id as student_id, s.name as student_name, ea.status, ea.check_in_method,
          ea.excuse_reason, ea.attended_at, ea.id as attendance_id
        FROM (
          SELECT student_id FROM event_subscriptions WHERE event_id = ? AND status = 'approved'
          UNION
          SELECT student_id FROM event_attendance WHERE event_id = ?
        ) AS participants
        JOIN students s ON participants.student_id = s.id
        LEFT JOIN event_attendance ea ON ea.event_id = ? AND ea.student_id = s.id
        ORDER BY s.name
      `, [id, id, id]);
      const rows = attendance.recordset || [];
      const mapped = rows.map((r: any) => ({
        student_id: r.student_id,
        student_name: r.student_name,
        status: r.status || 'absent',
        check_in_method: r.check_in_method || null,
        excuse_reason: r.excuse_reason || null,
        attended_at: r.attended_at || null,
        id: r.attendance_id || null,
      }));
      res.json({ success: true, data: mapped });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Bulk Manual Attendance (Supervisor)
router.post("/:id/attendance-bulk", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), validate(attendanceBulkSchema), async (req, res) => {
    const { id: eventId } = req.params;
    const { records } = req.body; // array of { studentId, status, excuseReason }

    try {
        const event = await kdb('events').where({ id: eventId }).first();
        if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
        if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });

        await kdb.transaction(async trx => {
            for (const r of records) {
                // التحقق من أن الطالب ينتمي لسكن الفعالية
                const enrolledStudent = await trx('students').select('tenant_id').where({ id: r.studentId }).first();
                if (!enrolledStudent || (event.tenant_id && enrolledStudent.tenant_id !== event.tenant_id)) {
                  throw new Error('أحد الطلاب ليس ضمن سكن هذه الفعالية');
                }
                // تصحيح لمسار MSSQL في العمليات الجماعية
                const existing = await trx('event_attendance')
                    .where({ event_id: eventId, student_id: r.studentId })
                    .first();

                if (existing) {
                    await trx('event_attendance')
                        .where({ id: existing.id })
                        .update({
                            status: r.status,
                            check_in_method: 'manual',
                            excuse_reason: r.excuseReason || null,
                            attended_at: kdb.fn.now()
                        });
                } else {
                    await trx('event_attendance')
                        .insert({
                            id: uuidv4(), event_id: eventId, student_id: r.studentId, status: r.status, check_in_method: 'manual', excuse_reason: r.excuseReason || null, attended_at: kdb.fn.now()
                        });
                }
            }
        });
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
    }
});

// Get responsible persons
router.get("/:id/responsible", authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const event = await kdb('events').where({ id }).first();
        if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
        if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
        const responsible = await kdb('event_responsible as er')
            .join('users as u', 'er.user_id', 'u.id')
            .select('er.*', 'u.name', 'u.role')
            .where('er.event_id', id);
        res.json({ success: true, data: responsible });
    } catch (err: any) {
        res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
    }
});

// --- NEW ADVANCED ATTENDANCE & SESSIONS ROUTES ---

// Get all sessions for an event
router.get("/:id/sessions", authenticate, async (req, res) => {
    const { id: eventId } = req.params;
    try {
        const event = await kdb('events').where({ id: eventId }).first();
        if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
        if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
        const sessions = await kdb('event_sessions').where({ event_id: eventId });
        res.json({ success: true, data: sessions });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل الجلسات." });
    }
});

// Create a session within an event
router.post("/:id/sessions", authenticate, requireItemAccess('event', AppPermission.CREATE_EVENT), validate(createEventSessionSchema), async (req, res) => {
    const { id: eventId } = req.params;
    const { title, description, start_time, type } = req.body;
  const tenantId = req.user.tenantId || (req.user.tenantIds && req.user.tenantIds[0]);
  const id = uuidv4();

    try {
        await kdb('event_sessions').insert({
            id, tenant_id: tenantId, event_id: eventId, title, description, start_time: new Date(start_time), type
        });
    res.status(201).json({ success: true, data: { id, title }, message: "تم إنشاء معيار التقييم بنجاح" });
    } catch (error: any) {
        res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
    }
});

// Register detailed attendance (QR or Manual)
router.post("/attendance-detailed", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), validate(eventAttendanceDetailedSchema), async (req, res) => {
    const { eventId, sessionId, studentId, status, absenceReason, notifiedParent, notifiedPriest, isPaid } = req.body;
    const tenantId = req.user.tenantId;
    const adminId = req.user.id;
    const id = uuidv4();

    if (!sessionId || !studentId) {
        return res.status(400).json({ success: false, message: "session_id and student_id are required" });
    }

    try {
        if (!eventId) return res.status(400).json({ success: false, message: "معرف الفعالية مطلوب" });
        const event = await kdb('events').where({ id: eventId }).first();
        if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
        if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });

        // منع تسجيل حضور لطالب ليس ضمن نطاق سكن الفعالية (عزل البيانات بين السكنات)
        const student = await kdb('students').where({ id: studentId }).first();
        if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });
        if (event.tenant_id && student.tenant_id !== event.tenant_id) {
          return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكن هذه الفعالية" });
        }
        if (!event.tenant_id && req.user.role !== 'admin') {
          const myTenants = await computeUserTenantIds(req.user);
          if (!myTenants.includes(student.tenant_id)) {
            return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكنك" });
          }
        }
        const existing = await kdb('event_attendance_detailed')
            .where({ session_id: sessionId, student_id: studentId })
            .first();

        if (existing) {
            await kdb('event_attendance_detailed')
                .where({ id: existing.id })
                .update({
                    status: status || 'present',
                    absence_reason: absenceReason || null,
                    notified_parent: notifiedParent ? 1 : 0,
                    notified_priest: notifiedPriest ? 1 : 0,
                    is_paid: isPaid !== undefined ? (isPaid ? 1 : 0) : existing.is_paid,
                    created_at: kdb.fn.now()
                });
        } else {
            await kdb('event_attendance_detailed').insert({
                id, tenant_id: tenantId, event_id: eventId || null, session_id: sessionId, student_id: studentId,
                status: status || 'present', absence_reason: absenceReason || null, 
                notified_parent: notifiedParent ? 1 : 0,
                notified_priest: notifiedPriest ? 1 : 0, created_by: adminId,
                is_paid: isPaid !== undefined ? (isPaid ? 1 : 0) : 0
            });
        }
        res.json({ success: true, message: "تم تسجيل الحالة بنجاح" });
    } catch (error: any) {
        console.error("Attendance Error:", error);
        res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
    }
});

// Batch update detailed attendance (Absence Management)
router.post("/attendance-detailed-batch", authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), validate(attendanceDetailedBatchSchema), async (req, res) => {
    const { records } = req.body;
    const tenantId = req.user.tenantId;
    const adminId = req.user.id;

    try {
        // التحقق من كل الفعاليات (وليست الأولى فقط) والطلاب في كل سجل
        const eventIds: string[] = [...new Set<string>(records.map((r: any) => String((r && r.eventId) || '').trim()).filter((x: string) => !!x))];
        const eventsMap = new Map<string, any>();
        for (const eid of eventIds) {
          const ev = await kdb('events').where({ id: eid }).first();
          if (!ev) return res.status(404).json({ success: false, message: `الفعالية غير موجودة: ${eid}` });
          if (!await canAccessEvent(req, ev)) return res.status(403).json({ success: false, message: `غير مصرح بالوصول إلى الفعالية: ${eid}` });
          eventsMap.set(eid, ev);
        }
        // الطلاب الذين ليسوا ضمن نطاق السكنات المسموحة للمستخدم
        const myTenants = req.user.role === 'admin' ? null : await computeUserTenantIds(req.user);
        const studentIds: string[] = [...new Set<string>(records.map((r: any) => String((r && r.studentId) || '').trim()).filter((x: string) => !!x))];
        let outOfScopeStudent = false;
        if (studentIds.length > 0 && (!eventsMap.size || myTenants !== null)) {
          const studRows = await kdb('students').whereIn('id', studentIds).select('id', 'tenant_id');
          const studById = new Map(studRows.map((s: any) => [s.id, s]));
          for (const r of records) {
            const stud = studById.get(r.studentId);
            if (!stud) { outOfScopeStudent = true; break; }
            const ev = r.eventId ? eventsMap.get(r.eventId) : null;
            if (ev?.tenant_id) {
              if (stud.tenant_id !== ev.tenant_id) { outOfScopeStudent = true; break; }
            } else if (myTenants !== null && !myTenants.includes(stud.tenant_id)) {
              outOfScopeStudent = true; break;
            }
          }
        }
        if (outOfScopeStudent) {
          return res.status(403).json({ success: false, message: "أحد الطلاب ليس ضمن نطاق سكنك" });
        }

        await kdb.transaction(async trx => {
            for (const r of records) {
                const existing = await trx('event_attendance_detailed')
                    .where({ session_id: r.sessionId, student_id: r.studentId })
                    .first();

                if (existing) {
                    await trx('event_attendance_detailed')
                        .where({ id: existing.id })
                        .update({
                            status: r.status,
                            absence_reason: r.reason || null, 
                            notified_parent: r.notifyParent ? 1 : 0,
                            notified_priest: r.notifyPriest ? 1 : 0,
                            is_paid: r.isPaid !== undefined ? (r.isPaid ? 1 : 0) : existing.is_paid,
                            created_at: kdb.fn.now()
                        });
                } else {
                    await trx('event_attendance_detailed').insert({
                        id: uuidv4(), tenant_id: tenantId, event_id: r.eventId || null, session_id: r.sessionId || null,
                        student_id: r.studentId, status: r.status, absence_reason: r.reason || null, 
                        notified_parent: r.notifyParent ? 1 : 0, notified_priest: r.notifyPriest ? 1 : 0, created_by: adminId,
                        is_paid: r.isPaid !== undefined ? (r.isPaid ? 1 : 0) : 0
                    });
                }
            }
        });
        res.json({ success: true, message: "تم تحديث الحضور الجماعي بنجاح" });
    } catch (err: any) {
        res.status(400).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
    }
});

// Full detailed report for an event
router.get("/:id/comprehensive-report", authenticate, authorizePermission(AppPermission.VIEW_REPORTS), async (req, res) => {
    const { id: eventId } = req.params;

    try {
        const event = await kdb('events').where({ id: eventId }).first();
        if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
        if (!await canAccessEvent(req, event)) {
          return res.status(403).json({ success: false, message: "ليس لديك صلاحية الاطلاع على تقرير هذه الفعالية" });
        }
        const sessions = await kdb('event_sessions').where({ event_id: eventId });
        
        const attendance = await kdb.raw(`
          SELECT DISTINCT
            s.id as student_id, u.name as student_name, s.student_id_number,
            ea.status, ea.check_in_method, ea.excuse_reason as absence_reason, ea.attended_at,
            ? as event_id, NULL as session_id,
          	ea.is_paid
          FROM (
            SELECT student_id FROM event_subscriptions WHERE event_id = ? AND status = 'approved'
            UNION
            SELECT student_id FROM event_attendance WHERE event_id = ?
          ) AS participants
          JOIN students s ON participants.student_id = s.id
          JOIN users u ON s.user_id = u.id
          LEFT JOIN event_attendance ea ON ea.event_id = ? AND ea.student_id = s.id
          ORDER BY u.name
        `, [eventId, eventId, eventId, eventId]);
        let attendanceRows = attendance.recordset || [];

        // Get detailed attendance records (with session info)
        const detailedAtt = await kdb('event_attendance_detailed as ead')
          .join('students as s', 'ead.student_id', 's.id')
          .join('users as u', 's.user_id', 'u.id')
          .select(
            's.id as student_id',
            'u.name as student_name',
            's.student_id_number',
            'ead.status',
            'ead.absence_reason',
            'ead.created_at as attended_at',
            'ead.event_id',
            'ead.session_id',
            'ead.is_paid'
          )
          .where('ead.event_id', eventId);

        // Merge detailed records into attendance (detailed overrides basic)
        const detailedMap = new Map<string, any>();
        for (const d of detailedAtt) {
          const key = `${d.student_id}`;
          const existing = detailedMap.get(key);
          if (!existing || d.is_paid || d.absence_reason) {
            detailedMap.set(key, d);
          }
        }
        attendanceRows = attendanceRows.map((a: any) => {
          const key = `${a.student_id}`;
          const detailed = detailedMap.get(key);
          return detailed || a;
        });

        res.json({ 
            success: true, 
            message: "تم تحميل التقرير الشامل",
            data: {
                event: { ...event, is_paid: event.is_paid },
                sessions,
                attendance: attendanceRows
            } 
        });
    } catch (error: any) {
        console.error("Comprehensive report error:", error);
        res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل التقرير." });
    }
});

// --- Competition inside Event ---

// Create a competition team inside an event
router.post("/:id/teams", authenticate, requireItemAccess('event', AppPermission.MANAGE_COMPETITIONS), validate(createEventTeamSchema), async (req, res) => {
  const { id: eventId } = req.params;
  const { name, responsibleId, memberIds = [] } = req.body;
  const tenantId = req.user.tenantId;
  const teamId = uuidv4();

  try {
    await kdb.transaction(async (trx) => {
      const event = await trx('events').where({ id: eventId, is_competition: true }).first();
      if (!event) {
        return res.status(400).json({ success: false, message: "هذه الفعالية ليست مسابقة" });
      }
      // منع إضافة طلاب من سكنات أخرى للفريق (عزل البيانات بين السكنات)
      if (memberIds.length > 0) {
        const members = await trx('students').whereIn('id', memberIds).select('id', 'tenant_id');
        if (members.length !== memberIds.length) {
          return res.status(400).json({ success: false, message: "أحد الطلاب غير موجود" });
        }
        for (const m of members) {
          if (event.tenant_id && m.tenant_id !== event.tenant_id) {
            return res.status(403).json({ success: false, message: `الطالب ${m.id} ليس ضمن سكن هذه الفعالية` });
          }
          if (!event.tenant_id && tenantId && m.tenant_id !== tenantId) {
            return res.status(403).json({ success: false, message: `الطالب ${m.id} ليس ضمن سكنك` });
          }
        }
      }
      await trx('event_teams').insert({
        id: teamId,
        event_id: eventId,
        tenant_id: tenantId,
        name,
        responsible_id: responsibleId || null
      });

      for (const sid of memberIds) {
        await trx('event_team_members').insert({ event_team_id: teamId, student_id: sid });
      }
    });

    return res.status(201).json({ success: true, data: { id: teamId }, message: "تم إنشاء الفريق بنجاح" });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Get teams for an event
router.get("/:id/teams", authenticate, async (req, res) => {
  const { id: eventId } = req.params;
  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
    const teams = await kdb('event_teams as et')
      .leftJoin('users as u', 'et.responsible_id', 'u.id')
      .select('et.*', 'u.name as responsible_name')
      .where('et.event_id', eventId);

    const enriched = await Promise.all(teams.map(async (t: any) => {
      const members = await kdb('event_team_members as tm')
        .join('students as s', 'tm.student_id', 's.id')
        .join('users as u', 's.user_id', 'u.id')
        .select('tm.*', 'u.name as member_name')
        .where('tm.event_team_id', t.id);
      return { ...t, members };
    }));

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Get criteria for an event
router.get("/:id/criteria", authenticate, async (req, res) => {
  const { id: eventId } = req.params;
  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
    const criteria = await kdb('event_criteria').where({ event_id: eventId });
    res.json({ success: true, data: criteria });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Create a criterion for an event
router.post("/:id/criteria", authenticate, requireItemAccess('event', AppPermission.MANAGE_COMPETITIONS), validate(createEventCriterionSchema), async (req, res) => {
  const { id: eventId } = req.params;
  const { title, max_score } = req.body;
  const id = uuidv4();

  try {
    await kdb('event_criteria').insert({ id, event_id: eventId, title, max_score: max_score || 10 });
    res.status(201).json({ success: true, data: { id, title } });
  } catch (err: any) {
    res.status(400).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Delete a criterion for an event
router.delete("/:id/criteria/:criterionId", authenticate, requireItemAccess('event', AppPermission.MANAGE_COMPETITIONS), async (req, res) => {
  const { id: eventId, criterionId } = req.params;
  try {
    const deleted = await kdb('event_criteria')
      .where({ id: criterionId, event_id: eventId })
      .del();
    if (!deleted) return res.status(404).json({ success: false, message: "المعيار غير موجود" });
    await kdb('event_scores').where({ event_id: eventId, criterion_id: criterionId }).del();
    res.json({ success: true, message: "تم حذف المعيار" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من حذف المعيار." });
  }
});

// Get competition activity status of an event
router.get("/:id/status", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const event = await kdb('events').select('is_competition', 'competition_active', 'tenant_id').where({ id }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
    res.json({ success: true, data: { active: !!event.competition_active } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "حدث خطأ." });
  }
});

// Score a team for a criterion
router.post(
  "/:id/teams/:teamId/scores",
  authenticate,
  requireItemAccess('event', AppPermission.MANAGE_COMPETITIONS, async (req) => {
    const team = await kdb('event_teams').where({ id: (req.params as any).teamId }).first();
    return team ? team.event_id : null;
  }),
  validate(eventScoreSchema),
  async (req, res) => {
  const { id: eventId, teamId } = req.params;
  const { scores } = req.body;
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async (trx) => {
      for (const s of scores) {
        await trx('event_scores').insert({
          id: uuidv4(),
          event_id: eventId,
          team_id: teamId,
          student_id: s.studentId || null,
          criterion_id: s.criterionId,
          score: s.score,
          scored_by: req.user.id
        });
      }
    });
    res.json({ success: true, message: "تم تسجيل الدرجات بنجاح" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Activate competition mode for an event
router.post("/:id/activate-competition", authenticate, requireItemAccess('event', AppPermission.MANAGE_COMPETITIONS), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  try {
    const event = await kdb('events').where({ id }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (event.tenant_id && event.tenant_id !== tenantId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية لتفعيل المسابقة لهذه الفعالية" });
    }

    await kdb('events').where({ id }).update({ is_competition: 1, competition_active: 1 });
    res.json({ success: true, message: "تم تفعيل المسابقة" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تفعيل المسابقة." });
  }
});

// Toggle parent enrollment permission for an event
router.patch("/:id/parent-enroll", authenticate, requireItemAccess('event', AppPermission.EDIT_EVENT), validate(parentEnrollSchema), async (req, res) => {
  const { id } = req.params;
  const { parent_can_enroll } = req.body;
  const tenantId = req.user.tenantId;

  try {
    const event = await kdb('events').where({ id }).first();
    if (!event) {
      return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    }
    if (event.tenant_id && event.tenant_id !== tenantId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية لتعديل هذه الفعالية" });
    }

    await kdb('events').where({ id }).update({ parent_can_enroll: parent_can_enroll ? 1 : 0 });
    res.json({ success: true, message: "تم تحديث صلاحية اشتراك ولي الأمر" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحديث صلاحية الاشتراك." });
  }
});

// Get single event by ID
router.get("/:id", authenticate, authorizePermission(AppPermission.VIEW_EVENTS), async (req, res) => {
  const { id } = req.params;
  try {
const event = await kdb('events').where({ id }).first();
        if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!await canAccessEvent(req, event)) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية لعرض هذه الفعالية" });
    }
    event.canManage = await canManageItem(req.user, 'event', id);
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// --- Event Subscriptions (الاشتراكات) ---
// Upload receipt image
router.post("/upload-receipt", authenticate, upload.single("receipt"), validateMagicBytes, sanitizeInput, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "لم يتم رفع أي ملف" });
    const url = `${UPLOADS_BASE}/documents/${req.file.filename}`;
    res.json({ success: true, data: { url } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Get current user's subscription for an event
router.get("/:id/my-subscription", authenticate, async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  try {
    const sub = await kdb('event_subscriptions')
      .where({ event_id: eventId, user_id: userId })
      .orderBy('created_at', 'desc')
      .first();
    res.json({ success: true, data: sub || null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Student/parent subscribes to an event
router.post("/:id/subscribe", authenticate, async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  const { student_id, payment_method_id, receipt_image, notes } = req.body;
  const role = req.user.role;

  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });

    // Check max_participants
    if (event.max_participants) {
      const approvedCount = await kdb('event_subscriptions')
        .where({ event_id: eventId, status: 'approved' })
        .count('id as count')
        .first();
      if (approvedCount && Number(approvedCount.count) >= event.max_participants) {
        return res.status(400).json({ success: false, message: "لا يمكن الاشتراك لقد بلغ الحد الأقصى للمشاركين" });
      }
    }

    // Check existing active subscription
    const existing = await kdb('event_subscriptions')
      .where({ event_id: eventId, user_id: userId })
      .whereIn('status', ['pending', 'approved'])
      .first();
    if (existing) return res.status(400).json({ success: false, message: "لديك اشتراك فعال بالفعل في هذه الفعالية" });

    // If parent, verify student_id belongs to their children
    let targetStudentId = student_id || null;
    if (role === 'parent' && targetStudentId) {
      const parent = await kdb('parents').select('id').where({ user_id: userId }).first();
      const child = await kdb('student_guardians')
        .where({ guardian_id: parent.id, student_id: targetStudentId })
        .first();
      if (!child) return res.status(403).json({ success: false, message: "هذا الطالب ليس من أبنائك" });
    }

    // If student, use their own student record
    if (role === 'student') {
      const student = await kdb('students').select('id').where({ user_id: userId }).first();
      targetStudentId = student?.id || null;
    }

    const id = uuidv4();
    await kdb('event_subscriptions').insert({
      id,
      event_id: eventId,
      user_id: userId,
      student_id: targetStudentId,
      status: 'pending',
      payment_method_id: payment_method_id || null,
      payment_status: event.is_paid && payment_method_id ? 'pending' : 'unpaid',
      receipt_image: receipt_image || null,
      notes: notes || null,
      updated_at: kdb.fn.now(),
    });

    // Notify event creator + supervisors/admins + responsible persons + housing supervisors
    const eventCreator = event.created_by;
    const usersToNotify: string[] = [];
    if (eventCreator) usersToNotify.push(eventCreator);

    // Notify supervisors and admins in the tenant
    const supervisors = await kdb('users')
      .where({ tenant_id: event.tenant_id })
      .whereIn('role', ['supervisor', 'admin', 'priest'])
      .select('id');
    supervisors.forEach((u: any) => {
      if (!usersToNotify.includes(u.id)) usersToNotify.push(u.id);
    });

    // Notify responsible persons for this event
    const responsible = await kdb('event_responsible')
      .where({ event_id: eventId })
      .select('user_id');
    responsible.forEach((r: any) => {
      if (!usersToNotify.includes(r.user_id)) usersToNotify.push(r.user_id);
    });

    // Also notify housing-related staff (users with housing permissions in same tenant)
    const housingStaff = await kdb('users')
      .join('role_permissions', 'users.role', 'role_permissions.role')
      .where('users.tenant_id', event.tenant_id)
      .whereIn('role_permissions.permission', ['VIEW_HOUSING', 'MANAGE_HOUSING'])
      .whereNotIn('users.id', usersToNotify)
      .select('users.id')
      .distinct();
    housingStaff.forEach((u: any) => {
      if (!usersToNotify.includes(u.id)) usersToNotify.push(u.id);
    });

    const subscriberName = req.user.name || 'مستخدم غير';
    const subscriberEmail = req.user.email || '';
    const metadataObj: any = { event_id: eventId, type: 'subscription_request', subscriberName, subscriberEmail };
    if (receipt_image) metadataObj.receipt_image = receipt_image;
    if (targetStudentId) metadataObj.student_id = targetStudentId;

    for (const notifyUserId of usersToNotify) {
      await createNotification({
        userId: notifyUserId,
        tenantId: event.tenant_id,
        title: 'طلب اشتراك جديد',
        message: `${subscriberName} يريد الاشتراك في "${event.title}"`,
        type: 'info',
        metadata: JSON.stringify(metadataObj),
        event_id: eventId,
      });
    }

    res.status(201).json({ success: true, data: { id }, message: "تم تقديم طلب الاشتراك. في انتظار موافقة المشرف." });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// List all subscriptions for an event (event creator, supervisor, admin)
router.get("/:id/subscriptions", authenticate, async (req, res) => {
  const { id: eventId } = req.params;
  const tenantId = req.user.tenantId;
  const role = req.user.role;
  const userId = req.user.id;

  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });

    // Check access: admin, supervisor of same tenant, creator, or responsible
    const isResponsible = !!(await kdb('event_responsible')
      .where({ event_id: eventId, user_id: userId })
      .first());
    const isCreator = event.created_by === userId;
    const isStaffTier = ['admin', 'bishop', 'supervisor', 'priest', 'assistant_supervisor'].includes(role);
    const isSupervisorOrAdmin = isStaffTier && await canAccessEvent(req, event);

    if (!isCreator && !isSupervisorOrAdmin && !isResponsible) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية لإدارة الاشتراكات" });
    }

    const subscriptions = await kdb('event_subscriptions as es')
      .join('users as u', 'es.user_id', 'u.id')
      .leftJoin('students as s', 'es.student_id', 's.id')
      .leftJoin('users as su', 's.user_id', 'su.id')
      .leftJoin('payment_methods as pm', 'es.payment_method_id', 'pm.id')
      .select(
        'es.*',
        'u.name as user_name',
        'su.name as student_name',
        's.student_id_number',
        'pm.name as payment_method_name',
        'pm.phone_number as payment_method_phone'
      )
      .where('es.event_id', eventId)
      .orderBy('es.created_at', 'desc');

    res.json({ success: true, data: subscriptions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// Approve/reject subscription
router.patch("/:id/subscriptions/:subId", authenticate, async (req, res) => {
  const { id: eventId, subId } = req.params;
  const { status } = req.body;
  const tenantId = req.user.tenantId;
  const role = req.user.role;
  const userId = req.user.id;

  if (!['approved', 'rejected', 'cancelled', 'pending', 'removed'].includes(status)) {
    return res.status(400).json({ success: false, message: "حالة غير صحيحة" });
  }

  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });

    // Check access
    const isResponsible = await kdb('event_responsible')
      .where({ event_id: eventId, user_id: userId })
      .first();
    const isCreator = event.created_by === userId;
    const isStaffTier = ['admin', 'bishop', 'supervisor', 'priest', 'assistant_supervisor'].includes(role);
    const isSupervisorOrAdmin = isStaffTier && await canAccessEvent(req, event);

    if (!isCreator && !isSupervisorOrAdmin && !isResponsible) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية لإدارة الاشتراكات" });
    }

    // Check max_participants when approving
    if (status === 'approved' && event.max_participants) {
      const approvedCount = await kdb('event_subscriptions')
        .where({ event_id: eventId, status: 'approved' })
        .count('id as count')
        .first();
      if (approvedCount && Number(approvedCount.count) >= event.max_participants) {
        return res.status(400).json({ success: false, message: "لا يمكن الاشتراك لقد بلغ الحد الأقصى" });
      }
    }

    await kdb('event_subscriptions')
      .where({ id: subId, event_id: eventId })
      .update({ status, updated_at: kdb.fn.now() });

    // Auto-create or remove event_registrations based on status
    const subRecord = await kdb('event_subscriptions').where({ id: subId }).first();
    if (status === 'approved') {
      if (subRecord && !event.is_paid) {
        await kdb('event_subscriptions')
          .where({ id: subId })
          .update({ payment_status: 'paid', updated_at: kdb.fn.now() });
      }
      if (subRecord && subRecord.student_id) {
        const existingReg = await kdb('event_registrations')
          .where({ event_id: eventId, student_id: subRecord.student_id })
          .first();
        if (!existingReg) {
          await kdb('event_registrations').insert({
            id: uuidv4(),
            event_id: eventId,
            student_id: subRecord.student_id,
            status: 'registered',
            registered_at: kdb.fn.now(),
          });
        }
      }
    } else if (subRecord && subRecord.student_id && (status === 'pending' || status === 'removed' || status === 'rejected')) {
      await kdb('event_registrations').where({ event_id: eventId, student_id: subRecord.student_id }).del();
    }

    // Notify the subscriber
    if (subRecord) {
      let notifTitle: string, notifMsg: string, notifType: 'error' | 'success' | 'info' | 'warning', metaType: string;
      switch (status) {
        case 'approved':
          notifTitle = 'تم الموافقة على اشتراكك';
          notifMsg = `تمت الموافقة على اشتراكك في "${event.title}"`;
          notifType = 'success';
          metaType = 'subscription_approved';
          break;
        case 'rejected':
          notifTitle = 'تم رفض الاشتراك';
          notifMsg = `تم رفض اشتراكك في "${event.title}"`;
          notifType = 'error';
          metaType = 'subscription_rejected';
          break;
        case 'pending':
          notifTitle = 'تم إعادة فتح طلب الاشتراك';
          notifMsg = `تم إعادة فتح طلب اشتراكك في "${event.title}"`;
          notifType = 'info';
          metaType = 'subscription_reopened';
          break;
        case 'removed':
          notifTitle = 'تم إزالة الاشتراك من الفعالية';
          notifMsg = `تم إزالة اشتراكك من "${event.title}"`;
          notifType = 'error';
          metaType = 'subscription_removed';
          break;
        default:
          notifTitle = 'تم تحديث الاشتراك';
          notifMsg = `فعالية "${event.title}"`;
          notifType = 'info';
          metaType = 'subscription_updated';
      }
      const subMetadata: any = { event_id: eventId, type: metaType };
      if (subRecord.receipt_image) subMetadata.receipt_image = subRecord.receipt_image;
      await createNotification({
        userId: subRecord.user_id,
        tenantId: event.tenant_id,
        title: notifTitle,
        message: notifMsg,
        type: notifType,
        metadata: JSON.stringify(subMetadata),
        event_id: eventId,
      });
    }

    res.json({ success: true, message: status === 'approved' ? 'تم الموافقة على الاشتراك' : 'تم رفض الاشتراك' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// Submit payment with receipt for a subscription
router.post("/:id/subscriptions/:subId/payment", authenticate, async (req, res) => {
  const { id: eventId, subId } = req.params;
  const { payment_method_id, receipt_image } = req.body;
  const userId = req.user.id;

  try {
    const sub = await kdb('event_subscriptions')
      .where({ id: subId, event_id: eventId, user_id: userId })
      .first();
    if (!sub) return res.status(404).json({ success: false, message: "الاشتراك غير موجود" });
    if (sub.status !== 'approved') return res.status(400).json({ success: false, message: "الاشتراك لم يتم الموافقة عليه بعد" });
    if (!payment_method_id) return res.status(400).json({ success: false, message: "طريقة الدفع مطلوبة" });

    const method = await kdb('payment_methods').where({ id: payment_method_id, is_active: 1 }).first();
    if (!method) return res.status(404).json({ success: false, message: "طريقة الدفع غير متاحة" });

    await kdb('event_subscriptions')
      .where({ id: subId })
      .update({
        payment_method_id,
        receipt_image: receipt_image || null,
        payment_status: 'pending',
        updated_at: kdb.fn.now(),
      });

    // Notify supervisors/admins/responsible about payment receipt
    const event = await kdb('events').where({ id: eventId }).first();
    if (event) {
      const paymentUsers: string[] = [];
      if (event.created_by) paymentUsers.push(event.created_by);
      const paySupervisors = await kdb('users')
        .where({ tenant_id: event.tenant_id })
        .whereIn('role', ['supervisor', 'admin', 'priest'])
        .select('id');
      paySupervisors.forEach((u: any) => { if (!paymentUsers.includes(u.id)) paymentUsers.push(u.id); });
      const payResponsible = await kdb('event_responsible')
        .where({ event_id: eventId })
        .select('user_id');
      payResponsible.forEach((r: any) => { if (!paymentUsers.includes(r.user_id)) paymentUsers.push(r.user_id); });
      const payMetadata: any = { event_id: eventId, type: 'payment_receipt_uploaded', subscriberName: req.user.name };
      if (receipt_image) payMetadata.receipt_image = receipt_image;
      for (const uid of paymentUsers) {
        await createNotification({
          userId: uid,
          tenantId: event.tenant_id,
          title: 'رفع إيصال دفع',
          message: `${req.user.name || 'مستخدم'} قام برفع إيصال دفع "${event.title}"`,
          type: 'info',
          metadata: JSON.stringify(payMetadata),
          event_id: eventId,
        });
      }
    }

    res.json({ success: true, message: "تم استلام إيصال الدفع. في انتظار التأكيد." });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// Confirm payment (by supervisor/admin/responsible)
router.patch("/:id/subscriptions/:subId/confirm-payment", authenticate, async (req, res) => {
  const { id: eventId, subId } = req.params;
  const userId = req.user.id;
  const tenantId = req.user.tenantId;

  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });

    const isResponsible = await kdb('event_responsible')
      .where({ event_id: eventId, user_id: userId })
      .first();
    const isCreator = event.created_by === userId;
    const isStaffTier = ['admin', 'bishop', 'supervisor', 'priest', 'assistant_supervisor'].includes(req.user.role);
    const isSupervisorOrAdmin = isStaffTier && await canAccessEvent(req, event);

    if (!isCreator && !isSupervisorOrAdmin && !isResponsible) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية تأكيد الدفع" });
    }

    const sub = await kdb('event_subscriptions').where({ id: subId, event_id: eventId }).first();
    if (!sub) return res.status(404).json({ success: false, message: "الاشتراك غير موجود" });
    if (sub.payment_status !== 'pending') return res.status(400).json({ success: false, message: "الدفع ليس في حالة انتظار" });

    await kdb('event_subscriptions')
      .where({ id: subId })
      .update({ payment_status: 'paid', updated_at: kdb.fn.now() });

    // Notify subscriber that payment is confirmed
    const confirmMetadata: any = { event_id: eventId, type: 'payment_confirmed' };
    if (sub.receipt_image) confirmMetadata.receipt_image = sub.receipt_image;
    await createNotification({
      userId: sub.user_id,
      tenantId: event.tenant_id,
      title: 'تم تأكيد الدفع',
      message: `تم تأكيد دفع "${event.title}" بنجاح`,
      type: 'success',
      metadata: JSON.stringify(confirmMetadata),
      event_id: eventId,
    });

    res.json({ success: true, message: "تم تأكيد الدفع" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل تأكيد الدفع. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// Cancel own subscription (by the subscriber)
router.delete("/:id/subscriptions/:subId", authenticate, async (req, res) => {
  const { id: eventId, subId } = req.params;
  const userId = req.user.id;
  try {
    const sub = await kdb('event_subscriptions')
      .where({ id: subId, event_id: eventId, user_id: userId })
      .first();
    if (!sub) return res.status(404).json({ success: false, message: "الاشتراك غير موجود" });
    await kdb('event_subscriptions')
      .where({ id: subId })
      .update({ status: 'cancelled', updated_at: kdb.fn.now() });
    res.json({ success: true, message: "تم إلغاء الاشتراك" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// --- Event Registration (for conferences, trips) ---
// Student registers for an event
router.post("/:id/register", authenticate, async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!await canAccessEvent(req, event)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
    if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
      return res.status(400).json({ success: false, message: "انتهى موعد التسجيل" });
    }
    const student = await kdb('students').select('id').where({ user_id: userId }).first();
    if (!student) return res.status(403).json({ success: false, message: "فقط الطلاب يمكنهم التسجيل" });
    const existing = await kdb('event_registrations')
      .where({ event_id: eventId, student_id: student.id }).first();
    if (existing) return res.status(400).json({ success: false, message: "مسجل مسبقاً" });
    await kdb('event_registrations').insert({ id: uuidv4(), event_id: eventId, student_id: student.id });
    res.json({ success: true, message: "تم التسجيل بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// Cancel registration
router.delete("/:id/register", authenticate, async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  try {
    const student = await kdb('students').select('id').where({ user_id: userId }).first();
    if (!student) return res.status(403).json({ success: false, message: "ليس لديك ملف طالب" });
    await kdb('event_registrations').where({ event_id: eventId, student_id: student.id }).del();
    res.json({ success: true, message: "تم إلغاء التسجيل" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. ربما لا تملك صلاحية أو أن الفعالية غير موجودة." });
  }
});

// Get registrations for an event
router.get("/:id/registrations", authenticate, async (req, res) => {
  const { id: eventId } = req.params;
  try {
    const event = await kdb('events').where({ id: eventId }).first();
    if (!event) return res.status(404).json({ success: false, message: "الفعالية غير موجودة" });
    if (!await canAccessEvent(req, event)) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية الاطلاع على تسجيلات هذه الفعالية" });
    }
    const registrations = await kdb('event_registrations as er')
      .join('students as s', 'er.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .select('er.*', 'u.name as student_name', 's.student_id_number')
      .where('er.event_id', eventId);
    res.json({ success: true, data: registrations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

export default router;
