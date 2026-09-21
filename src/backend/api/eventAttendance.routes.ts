import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { kdb, checkUserPermission } from '../infrastructure/db';
import { authenticate, authorizePermission, computeUserTenantIds } from './middleware';
import { validate } from '../validation/middleware';
import {
  attendanceCorrectionSchema,
  attendanceReviewBodySchema,
  attendanceRuleSchema,
  attendanceRulesBodySchema,
  manualScanSchema,
  penaltyReverseSchema,
  qrScanSchema,
} from '../validation/schemas';
import { AppPermission } from '../../types/permissions';
import {
  classifyAbsence,
  correctAttendance,
  closeSession,
  getEffectiveRule,
  getEventOverview,
  getEventReport,
  getPendingReviewRows,
  getSessionAttendance,
  isStudentEligibleForAttendance,
  mapRuleRow,
  normalizeEventRules,
  openSession,
  recordCheckIn,
  reversePenalty,
  verifyStudentQr,
} from '../services/attendance.service';

const router = express.Router();

// نفس منطق الوصول للفعالية المستخدم في event.routes.ts
export const canAccessEvent = async (req: any, event: any): Promise<boolean> => {
  if (req.user.role === 'admin') return true;
  if (!event?.tenant_id) return true;
  const allowed = await computeUserTenantIds(req.user);
  return allowed.includes(event.tenant_id);
};

// بوابة تشغيل الحضور: مدير التطبيق، أو مرتبط بـ event_responsible كمسؤول حضور،
// أو يملك صلاحية تشغيل الحضور (كاهن/مشرف/مساعدة مشرف) مع الوصول للفعالية.
// لا تُستخدم صلاحيات/معرفات من الواجهة إطلاقاً - كل التحقق من قاعدة البيانات.
export const canOperateAttendance = async (req: any, event: any): Promise<boolean> => {
  if (req.user.role === 'admin') return true;
  if (!await canAccessEvent(req, event)) return false;
  const [assigned, hasPerm] = await Promise.all([
    kdb('event_responsible').where({ event_id: event.id, user_id: req.user.id }).first(),
    checkUserPermission(req.user.id, AppPermission.OPERATE_EVENT_ATTENDANCE),
  ]);
  if (assigned && assigned.attendance_operator !== 0) return true;
  return !!hasPerm;
};

const loadEvent = async (req: any, res: any): Promise<any | null> => {
  const event = await kdb('events').where({ id: req.params.id }).first();
  if (!event) { res.status(404).json({ success: false, message: 'الفعالية غير موجودة' }); return null; }
  if (!await canAccessEvent(req, event)) { res.status(403).json({ success: false, message: 'غير مصرح بالوصول' }); return null; }
  return event;
};

const loadSession = async (eventId: string, sessionId: string): Promise<any | null> => {
  if (!sessionId) return null;
  return (await kdb('event_sessions').where({ id: sessionId, event_id: eventId }).first()) || null;
};

// ─────────────────────────── Rules configuration ───────────────────────────

// GET /api/events/:id/attendance/rules  → event-level rule + session-level rules + event_rules
router.get('/:id/attendance/rules', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const [rows, eventRulesRows] = await Promise.all([
      kdb('event_attendance_rules').where({ event_id: event.id }),
      kdb('event_rules').where({ event_id: event.id }).orderBy('sort_order', 'asc'),
    ]);
    const eventRule = mapRuleRow(rows.find((r: any) => !r.session_id) || null);
    const sessionRules = rows.filter((r: any) => r.session_id).map((r: any) => ({ session_id: r.session_id, ...mapRuleRow(r) }));
    res.json({
      success: true,
      data: {
        eventRule,
        sessionRules,
        eventRules: normalizeEventRules(eventRulesRows as any[]),
        evaluationMode: event.rule_evaluation_mode || 'ALL_APPLICABLE',
        excuseDeadlineMinutes: event.excuse_deadline_minutes ?? null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل قواعد الحضور' });
  }
});

// PUT /api/events/:id/attendance/rules  → upsert event-level tier rule AND/OR
// the independent event_rules list + evaluation mode. Backward-compatible: the
// legacy flat tier body still works alone.
router.put('/:id/attendance/rules', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), validate(attendanceRulesBodySchema), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const body = req.body as any;
    const tierBody = body.rule && typeof body.rule === 'object' ? body.rule : body;
    const hasTierFields = ['grace_period_minutes', 'penalty_mode', 'base_penalty', 'base_points', 'additional_penalty', 'additional_penalty_unit', 'additional_penalty_block_minutes', 'maximum_penalty', 'maximum_points_deduction', 'absent_after_minutes', 'auto_apply_penalty', 'enabled', 'tiers', 'required_attendance', 'counts_toward_absence_limit', 'attendance_weight'].some((k) => tierBody[k] !== undefined);

    await kdb.transaction(async (trx) => {
      if (hasTierFields) {
        const existing = await trx('event_attendance_rules').where({ event_id: event.id }).whereNull('session_id').first();
        const data: any = {
          event_id: event.id,
          session_id: null,
          tenant_id: event.tenant_id || req.user.tenantId || null,
          grace_period_minutes: tierBody.grace_period_minutes ?? 0,
          penalty_mode: tierBody.penalty_mode ?? 'NONE',
          base_penalty: tierBody.base_penalty ?? 0,
          base_points: tierBody.base_points ?? 0,
          additional_penalty: tierBody.additional_penalty ?? 0,
          additional_penalty_unit: tierBody.additional_penalty_unit ?? 'PER_MINUTE',
          additional_penalty_block_minutes: tierBody.additional_penalty_block_minutes ?? 1,
          maximum_penalty: tierBody.maximum_penalty ?? null,
          maximum_points_deduction: tierBody.maximum_points_deduction ?? null,
          absent_after_minutes: tierBody.absent_after_minutes ?? null,
          auto_apply_penalty: tierBody.auto_apply_penalty ?? true,
          enabled: tierBody.enabled ?? true,
          tiers: tierBody.tiers ? JSON.stringify(tierBody.tiers) : null,
          required_attendance: tierBody.required_attendance ?? true,
          counts_toward_absence_limit: tierBody.counts_toward_absence_limit ?? true,
          attendance_weight: tierBody.attendance_weight ?? 1,
          updated_by: req.user.id,
          updated_at: new Date(),
        };
        if (existing) {
          await trx('event_attendance_rules').where({ id: existing.id }).update(data);
        } else {
          await trx('event_attendance_rules').insert({ id: uuidv4(), created_by: req.user.id, created_at: new Date(), ...data });
        }
      }

      // Independent event rules: replace-all (ids preserved by the client keep
      // applied_rules_snapshot references valid).
      if (body.rules !== undefined && body.rules !== null) {
        const incoming = normalizeEventRules(body.rules as any[]);
        const now = new Date();
        await trx('event_rules').where({ event_id: event.id }).del();
        for (const rule of incoming) {
          await trx('event_rules').insert({
            id: rule.id || uuidv4(),
            event_id: event.id,
            session_id: null,
            tenant_id: event.tenant_id || req.user.tenantId || null,
            condition_status: rule.condition_status,
            condition_min_late_minutes: rule.condition_min_late_minutes,
            condition_max_late_minutes: rule.condition_max_late_minutes,
            action_type: rule.action_type,
            points_amount: rule.points_amount,
            fee_amount: rule.fee_amount,
            notification_message: rule.notification_message,
            enabled: rule.enabled ? 1 : 0,
            sort_order: rule.sort_order,
            created_by: req.user.id,
            updated_by: req.user.id,
            created_at: now,
            updated_at: now,
          });
        }
      }

      if (body.evaluation_mode) {
        await trx('events').where({ id: event.id }).update({
          rule_evaluation_mode: body.evaluation_mode === 'FIRST_APPLICABLE' ? 'FIRST_APPLICABLE' : 'ALL_APPLICABLE',
        });
      }

      // الموعد النهائي لقبول الأعذار (دقيقة قبل بدء الفعالية / تاريخها).
      if (body.excuseDeadlineMinutes !== undefined) {
        const value = body.excuseDeadlineMinutes === null || body.excuseDeadlineMinutes === '' || Number.isNaN(Number(body.excuseDeadlineMinutes))
          ? null
          : Math.max(0, Math.round(Number(body.excuseDeadlineMinutes)));
        await trx('events').where({ id: event.id }).update({ excuse_deadline_minutes: value });
      }
    });
    res.json({ success: true, message: 'تم حفظ قواعد الحضور' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر حفظ قواعد الحضور' });
  }
});

// PUT /api/events/:id/sessions/:sessionId/rules → upsert session-level override
router.put('/:id/sessions/:sessionId/rules', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), validate(attendanceRuleSchema), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const session = await loadSession(event.id, req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    const body = req.body as any;
    const existing = await kdb('event_attendance_rules').where({ event_id: event.id, session_id: session.id }).first();
    const data: any = {
      event_id: event.id,
      session_id: session.id,
      tenant_id: event.tenant_id || req.user.tenantId || null,
      grace_period_minutes: body.grace_period_minutes ?? 0,
      penalty_mode: body.penalty_mode ?? 'NONE',
      base_penalty: body.base_penalty ?? 0,
      base_points: body.base_points ?? 0,
      additional_penalty: body.additional_penalty ?? 0,
      additional_penalty_unit: body.additional_penalty_unit ?? 'PER_MINUTE',
      additional_penalty_block_minutes: body.additional_penalty_block_minutes ?? 1,
      maximum_penalty: body.maximum_penalty ?? null,
      maximum_points_deduction: body.maximum_points_deduction ?? null,
      absent_after_minutes: body.absent_after_minutes ?? null,
      auto_apply_penalty: body.auto_apply_penalty ?? true,
      enabled: body.enabled ?? true,
      tiers: body.tiers ? JSON.stringify(body.tiers) : null,
      required_attendance: body.required_attendance ?? true,
      counts_toward_absence_limit: body.counts_toward_absence_limit ?? true,
      attendance_weight: body.attendance_weight ?? 1,
      updated_by: req.user.id,
      updated_at: new Date(),
    };
    if (existing) {
      await kdb('event_attendance_rules').where({ id: existing.id }).update(data);
    } else {
      await kdb('event_attendance_rules').insert({ id: uuidv4(), created_by: req.user.id, created_at: new Date(), ...data });
    }
    res.json({ success: true, message: 'تم حفظ قواعد الجلسة' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر حفظ قواعد الجلسة' });
  }
});

// ─────────────────────────── Operator: sessions ───────────────────────────

// GET /api/events/operator/events → الفعاليات التي يتولى المستخدم تشغيل حضورها
router.get('/operator/events', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const events = await kdb('events').orderBy('created_at', 'desc').limit(500);
      return res.json({ success: true, data: events, assignedOnly: false });
    }
    const assigned = await kdb('event_responsible as er')
      .join('events as e', 'er.event_id', 'e.id')
      .where('er.user_id', req.user.id)
      .where('er.attendance_operator', 1)
      .select('e.*')
      .orderBy('e.created_at', 'desc');
    const hasPerm = await checkUserPermission(req.user.id, AppPermission.OPERATE_EVENT_ATTENDANCE);
    if (hasPerm) {
      const myTenants = await computeUserTenantIds(req.user);
      const permEvents = await kdb('events').where(function () {
        this.whereNull('tenant_id').orWhereIn('tenant_id', myTenants);
      }).orderBy('created_at', 'desc');
      const ids = new Set((assigned as any[]).map((e: any) => e.id));
      res.json({ success: true, data: [...assigned, ...(permEvents as any[]).filter((e: any) => !ids.has(e.id))], assignedOnly: false });
    } else {
      res.json({ success: true, data: assigned, assignedOnly: true });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل فعالياتك' });
  }
});

// GET /api/events/:id/attendance-scan/sessions
router.get('/:id/attendance-scan/sessions', authenticate, async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    if (!await canOperateAttendance(req, event)) return res.status(403).json({ success: false, message: 'غير مصرح بتشغيل الحضور لهذه الفعالية' });
    const sessions = await kdb('event_sessions').where({ event_id: event.id }).orderBy('start_time', 'desc');
    const sessionIds = sessions.map((s: any) => s.id);
    let counts: Record<string, { present: number; late: number; absent: number; total: number }> = {};
    if (sessionIds.length > 0) {
      const rows = await kdb('event_attendance_detailed')
        .whereIn('session_id', sessionIds)
        .select('session_id', 'status');
      counts = {};
      for (const r of rows as any[]) {
        const c = counts[r.session_id] || { present: 0, late: 0, absent: 0, total: 0 };
        c.total += 1;
        if (r.status === 'present') c.present += 1;
        else if (r.status === 'late') c.late += 1;
        else if (r.status === 'absent') c.absent += 1;
        counts[r.session_id] = c;
      }
    }
    const rule = await getEffectiveRule(kdb, event.id, null);
    res.json({ success: true, data: sessions.map((s: any) => ({ ...s, _attendance: counts[s.id] || { present: 0, late: 0, absent: 0, total: 0 }, _eventRule: mapRuleRow(rule as any) })) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل الجلسات' });
  }
});

// GET /api/events/:id/attendance-scan/sessions/:sessionId
router.get('/:id/attendance-scan/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    if (!await canOperateAttendance(req, event)) return res.status(403).json({ success: false, message: 'غير مصرح بتشغيل الحضور لهذه الفعالية' });
    const session = await loadSession(event.id, req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    const rows = await getSessionAttendance(event, session);
    const sessionRule = await kdb('event_attendance_rules').where({ event_id: event.id, session_id: session.id }).first();
    const eventRule = await kdb('event_attendance_rules').where({ event_id: event.id }).whereNull('session_id').first();
    res.json({
      success: true,
      data: {
        session,
        rows,
        counts: {
          present: rows.filter((r: any) => r.status === 'present').length,
          late: rows.filter((r: any) => r.status === 'late').length,
          absent: rows.filter((r: any) => r.status === 'absent').length,
          total: rows.length,
        },
        rules: { eventRule: mapRuleRow(eventRule), sessionRule: mapRuleRow(sessionRule) },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل حضور الجلسة' });
  }
});

// POST /api/events/:id/attendance-scan/sessions/:sessionId/open
router.post('/:id/attendance-scan/sessions/:sessionId/open', authenticate, async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    if (!await canOperateAttendance(req, event)) return res.status(403).json({ success: false, message: 'غير مصرح بتشغيل الحضور لهذه الفعالية' });
    const session = await loadSession(event.id, req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    if (session.status === 'closed') return res.status(400).json({ success: false, message: 'الجلسة مغلقة ولا يمكن فتحها مرة أخرى' });
    if (session.status !== 'open') await openSession(event, session, req.user.id);
    res.json({ success: true, message: 'تم فتح الجلسة' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر فتح الجلسة' });
  }
});

// POST /api/events/:id/attendance-scan/sessions/:sessionId/close
router.post('/:id/attendance-scan/sessions/:sessionId/close', authenticate, async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    if (!await canOperateAttendance(req, event)) return res.status(403).json({ success: false, message: 'غير مصرح بتشغيل الحضور لهذه الفعالية' });
    const session = await loadSession(event.id, req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    if (session.status !== 'closed') {
      const result = await closeSession(event, session, req.user.id);
      res.json({ success: true, message: 'تم إغلاق الجلسة وترحيل الغياب', data: result });
    } else {
      res.json({ success: true, message: 'الجلسة مغلقة بالفعل', data: { finalized: 0, escalated: 0 } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر إغلاق الجلسة' });
  }
});

// ─────────────────────────── Scanning ───────────────────────────

function resolveStudentFromQr(qr: string): { studentId: string } | null {
  const decoded = verifyStudentQr(qr);
  return decoded ? { studentId: decoded.studentId } : null;
}

// POST /api/events/:id/attendance-scan/sessions/:sessionId/scan
router.post('/:id/attendance-scan/sessions/:sessionId/scan', authenticate, async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    if (!await canOperateAttendance(req, event)) return res.status(403).json({ success: false, message: 'غير مصرح بتشغيل الحضور لهذه الفعالية' });
    const session = await loadSession(event.id, req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    if (session.status !== 'open') return res.status(400).json({ success: false, message: 'الجلسة ليست مفتوحة للتسجيل' });

    // Student identity: signed QR or explicit manual id (both server-validated).
    let studentId: string | null = null;
    let method: 'qr' | 'manual' = 'qr';
    if (req.body && req.body.qr) {
      const parsed = qrScanSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, message: 'رمز QR غير صالح' });
      const decoded = resolveStudentFromQr(parsed.data.qr);
      if (!decoded) return res.status(400).json({ success: false, message: 'رمز QR غير صالح أو منتهي الصلاحية' });
      studentId = decoded.studentId;
      method = 'qr';
    } else if (req.body && req.body.studentId) {
      if (!await checkUserPermission(req.user.id, AppPermission.MANAGE_EVENT_ATTENDANCE)) {
        return res.status(403).json({ success: false, message: 'الإدخال اليدوي يتطلب صلاحية إدارة الحضور' });
      }
      const parsed = manualScanSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, message: 'معرف الطالب غير صالح' });
      studentId = parsed.data.studentId;
      method = 'manual';
    } else {
      return res.status(400).json({ success: false, message: 'رمز QR أو معرف الطالب مطلوب' });
    }

    const student = await kdb('students').where({ id: studentId }).first();
    if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    // عزل البيانات: الطالب يجب أن يقع ضمن نطاق سكن الفعالية (مشتق من قاعدة البيانات فقط)
    if (event.tenant_id) {
      if (student.tenant_id && student.tenant_id !== event.tenant_id) {
        return res.status(403).json({ success: false, message: 'الطالب ليس ضمن سكن هذه الفعالية' });
      }
    } else if (req.user.role !== 'admin') {
      const myTenants = await computeUserTenantIds(req.user);
      if (student.tenant_id && !myTenants.includes(student.tenant_id)) {
        return res.status(403).json({ success: false, message: 'الطالب ليس ضمن سكنك' });
      }
    }

    // بوابة الاستهداف: النشاط مخصص للفئة المستهدفة فقط (إلا بوجود عضوية/تسجيل
    // معتمد). يُتحقق خادماً من targeting الفعالية، لا من الواجهة.
    const eligibility = await isStudentEligibleForAttendance(event, student);
    if (!eligibility.eligible) {
      return res.status(403).json({ success: false, message: eligibility.reason || 'هذا النشاط مخصص للفئة المستهدفة فقط' });
    }

    const result = await recordCheckIn({ event, session, student, userId: req.user.id, method });
    res.json({
      success: true,
      message: result.attendance.status === 'absent'
        ? 'تم تسجيل الغياب (وصل بعد الوقت الأقصى)'
        : result.evaluation.within_grace ? 'تم تسجيل الحضور بنجاح' : 'تم تسجيل الحضور متأخراً',
      data: {
        student: { id: student.id, name: student.name },
        status: result.attendance.status,
        firstCheckIn: result.firstCheckIn,
        lateMinutes: result.attendance.late_minutes,
        penalty: result.penalty,
        ruleSnapshot: result.snapshot,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تسجيل الحضور' });
  }
});

// ─────────────────────────── Corrections / reversals ───────────────────────────

// POST /api/events/:id/attendance/:attendanceId/correction
router.post('/:id/attendance/:attendanceId/correction', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), validate(attendanceCorrectionSchema), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const attendance = await kdb('event_attendance_detailed').where({ id: req.params.attendanceId, event_id: event.id }).first();
    if (!attendance) return res.status(404).json({ success: false, message: 'سجل الحضور غير موجود' });
    const session = attendance.session_id ? await kdb('event_sessions').where({ id: attendance.session_id }).first() : null;
    const student = await kdb('students').where({ id: attendance.student_id }).first();
    if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    const result = await correctAttendance({
      event, session, attendance, student,
      newStatus: (req.body as any).status,
      reason: (req.body as any).reason,
      userId: req.user.id,
    });
    res.json({ success: true, message: 'تم تصحيح سجل الحضور', data: { attendance: result.attendance, reversedPenalties: result.reversedPenaltyIds } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تصحيح سجل الحضور' });
  }
});

// POST /api/events/:id/attendance/:attendanceId/penalty/reverse
router.post('/:id/attendance/:attendanceId/penalty/reverse', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), validate(penaltyReverseSchema), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const penalty = await kdb('attendance_penalties').where({ attendance_id: req.params.attendanceId, event_id: event.id, status: 'APPLIED' }).first();
    if (!penalty) return res.status(404).json({ success: false, message: 'لا توجد غرامة سارية لهذا السجل' });
    await reversePenalty({ event, penalty, reason: (req.body as any).reason, userId: req.user.id });
    res.json({ success: true, message: 'تم إلغاء الغرامة وإضافة سجلات التراجع' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر إلغاء الغرامة' });
  }
});

// ─────────────────────────── Reports ───────────────────────────

// GET /api/events/:id/attendance/report
router.get('/:id/attendance/report', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const rows = await getEventReport(event);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر توليد التقرير' });
  }
});

// GET /api/events/:id/attendance/overview → كشف حضور/غياب/أعذار مجمّع على مستوى
// الفعالية للمشرف/الكاهن، يشمل مدة التأخير والغرامات الموقعة وحالة العذر.
router.get('/:id/attendance/overview', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const data = await getEventOverview(event);
    res.json({
      success: true,
      data: {
        ...data,
        event: {
          id: event.id,
          title: event.title,
          excuseDeadlineMinutes: event.excuse_deadline_minutes ?? null,
          start_time: event.start_time || null,
          event_date: event.event_date || null,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل كشف الحضور' });
  }
});

// ─────────────────────────── Absence review workflow ───────────────────────────

// GET /api/events/:id/attendance/review → pending absence classifications
router.get('/:id/attendance/review', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const rows = await getPendingReviewRows(event);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل قائمة الغيابات المعلقة' });
  }
});

// POST /api/events/:id/attendance/:attendanceId/review → classify a pending absence
// (UNEXCUSED / EXCUSED / TRAVEL). This is what fires event-rule actions and the
// absence escalations — closing a session only materializes PENDING_REVIEW.
router.post('/:id/attendance/:attendanceId/review', authenticate, authorizePermission(AppPermission.MANAGE_EVENT_ATTENDANCE), validate(attendanceReviewBodySchema), async (req, res) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const body = req.body as any;
    try {
      const updated = await classifyAbsence({
        event,
        attendanceId: req.params.attendanceId,
        classification: body.classification,
        reason: body.reason,
        userId: req.user.id,
      });
      res.json({ success: true, message: 'تم تسجيل تصنيف الغياب', data: { attendance: updated } });
    } catch (err: any) {
      if (err?.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'سجل الغياب غير موجود' });
      if (err?.message === 'ALREADY_REVIEWED') return res.status(400).json({ success: false, message: 'تم تصنيف هذا الغياب مسبقاً، أو أن السجل ليس غياباً معلقاً' });
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر حفظ تصنيف الغياب' });
  }
});

export default router;