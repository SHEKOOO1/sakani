import express from 'express';
import { kdb, checkUserPermission } from '../infrastructure/db';
import { authenticate, computeUserTenantIds } from './middleware';
import { validate } from '../validation/middleware';
import { excuseDecideSchema, excuseSubmitSchema } from '../validation/schemas';
import { AppPermission } from '../../types/permissions';
import { decideExcuse, generateStudentQr, getStudentAttendanceHistory, submitExcuse } from '../services/attendance.service';

const router = express.Router();

// الصلاحيات هنا كلها من قاعدة البيانات (لا تُقبل معرفات/أدوار من الواجهة).
export async function canViewStudentAttendance(req: any, studentId: string): Promise<number /* 200 | 403 | 404 */> {
  if (req.user.role === 'admin') return 200;
  const student = await kdb('students').where({ id: studentId }).first();
  if (!student) return 404;
  // الطالب نفسه (user يطابق ملفه)
  if (student.user_id && student.user_id === req.user.id) return 200;
  // ولي أمر الطالب
  if (req.user.role === 'parent') {
    const parent = await kdb('parents').where({ user_id: req.user.id }).first();
    if (parent) {
      const link = await kdb('student_guardians').where({ guardian_id: parent.id, student_id: studentId }).first();
      if (link) return 200;
    }
  }
  // موظف/كاهن/مشرف لديه صلاحية حضـور ضمن سكن الطالب
  const hasPerm = await checkUserPermission(req.user.id, AppPermission.VIEW_ATTENDANCE)
    || await checkUserPermission(req.user.id, AppPermission.MANAGE_EVENT_ATTENDANCE);
  if (hasPerm) {
    if (student.tenant_id) {
      const ids = await computeUserTenantIds(req.user);
      if (ids.includes(student.tenant_id)) return 200;
    } else {
      return 200; // عناصر المؤسسة العامة يشرف عليها من يملك الصلاحية
    }
  }
  return 403;
}

// GET /api/students/:id/attendance/history → سجل الحضور والإنذارات والغرامات للطالب
router.get('/students/:id/attendance/history', authenticate, async (req, res) => {
  try {
    const code = await canViewStudentAttendance(req, req.params.id);
    if (code !== 200) return res.status(code).json({ success: false, message: code === 404 ? 'الطالب غير موجود' : 'غير مصرح بالوصول' });
    const rows = await getStudentAttendanceHistory({ studentId: req.params.id, tenantId: req.query.tenantId ? String(req.query.tenantId) : (req.user.tenantId || (req.user.tenantIds && req.user.tenantIds[0]) || ''), limit: Number(req.query.limit || 50) });
    let warnings: any[] = [];
    if (req.query.includeWarnings !== '0') {
      warnings = await kdb('student_warnings')
        .where({ student_id: req.params.id, is_attendance_warning: 1 })
        .orderBy('created_at', 'desc')
        .limit(100);
    }
    res.json({ success: true, data: { records: rows, warnings } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل سجل الحضور' });
  }
});

// GET /api/students/:id/attendance/qr → رمز QR مُوقّع للحضور (لا يحوي معرفاً خاماً)
router.get('/students/:id/attendance/qr', authenticate, async (req, res) => {
  try {
    const code = await canViewStudentAttendance(req, req.params.id);
    if (code !== 200) return res.status(code).json({ success: false, message: code === 404 ? 'الطالب غير موجود' : 'غير مصرح بالوصول' });
    const student = await kdb('students').where({ id: req.params.id }).first();
    if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    const qr = generateStudentQr(student, student.tenant_id || req.user.tenantId || null);
    res.json({ success: true, data: { qr, issuedAt: new Date().toISOString() } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر توليد رمز الحضور' });
  }
});

// POST /api/students/:id/attendance/excuse → تقديم عذر لحالة غياب/تأخير
router.post('/students/:id/attendance/excuse', authenticate, validate(excuseSubmitSchema), async (req, res) => {
  try {
    const studentId = req.params.id;
    if (req.user.role !== 'admin') {
      const student = await kdb('students').where({ id: studentId }).first();
      if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
      const isSelf = student.user_id === req.user.id;
      let isParent = false;
      if (req.user.role === 'parent') {
        const parent = await kdb('parents').where({ user_id: req.user.id }).first();
        if (parent) {
          const link = await kdb('student_guardians').where({ guardian_id: parent.id, student_id: studentId }).first();
          isParent = !!link;
        }
      }
      if (!isSelf && !isParent) {
        return res.status(403).json({ success: false, message: 'يمكنك فقط تقديم عذر لنفسك أو لابنك' });
      }
    }
    const body = req.body as any;
    const selection = await kdb('event_attendance_detailed')
      .where({ event_id: body.eventId, student_id: studentId })
      .modify((qb: any) => {
        if (body.sessionId) qb.where({ session_id: body.sessionId });
        if (body.attendanceId) qb.where({ id: body.attendanceId });
        else qb.orderBy('created_at', 'desc').limit(1);
      })
      .first();
    const tenantId = selection?.tenant_id || req.user.tenantId || (req.user.tenantIds && req.user.tenantIds[0]) || null;
    const excuse = await submitExcuse({
      studentId,
      eventId: body.eventId,
      sessionId: body.sessionId || (selection?.session_id ?? null),
      attendanceId: body.attendanceId || (selection?.id ?? null),
      reason: body.reason,
      notes: body.notes,
      submittedBy: req.user.id,
      submittedByRole: req.user.role,
      tenantId,
    });
    res.status(201).json({ success: true, message: 'تم إرسال العذر بانتظار المراجعة', data: excuse });
  } catch (error: any) {
    if (error?.message === 'EXCUSE_DEADLINE_PASSED') {
      return res.status(400).json({ success: false, message: 'انتهى الموعد النهائي لتقديم الأعذار لهذه الفعالية' });
    }
    if (error?.message === 'EXCUSE_ALREADY_PENDING') {
      return res.status(400).json({ success: false, message: 'لديك عذر معلق بانتظار المراجعة بالفعل' });
    }
    if (error?.message === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'الفعالية غير موجودة' });
    }
    res.status(500).json({ success: false, message: 'تعذر إرسال العذر' });
  }
});

// GET /api/students/:id/attendance/excuse?eventId=... → أحدث عذر (وعامل حالي يعرض الحالة)
router.get('/students/:id/attendance/excuse', authenticate, async (req, res) => {
  try {
    const studentId = req.params.id;
    const { eventId } = req.query as any;
    if (!eventId) return res.status(400).json({ success: false, message: 'معرف الفعالية مطلوب' });
    if (req.user.role !== 'admin') {
      const student = await kdb('students').where({ id: studentId }).first();
      if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
      const isSelf = student.user_id === req.user.id;
      let isParent = false;
      if (req.user.role === 'parent') {
        const parent = await kdb('parents').where({ user_id: req.user.id }).first();
        if (parent) {
          const link = await kdb('student_guardians').where({ guardian_id: parent.id, student_id: studentId }).first();
          isParent = !!link;
        }
      }
      if (!isSelf && !isParent) {
        return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
      }
    }
    const excuse = await kdb('attendance_excuses')
      .where({ student_id: studentId, event_id: eventId })
      .orderBy('submitted_at', 'desc')
      .first();
    res.json({ success: true, data: excuse || null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل العذر' });
  }
});

// POST /api/attendance/excuses/:id/decide → قبول/رفض العذر (مشرف/كاهن/إدارة)
router.post('/attendance/excuses/:id/decide', authenticate, validate(excuseDecideSchema), async (req, res) => {
  try {
    const excuse = await kdb('attendance_excuses').where({ id: req.params.id }).first();
    if (!excuse) return res.status(404).json({ success: false, message: 'العذر غير موجود' });
    if (excuse.status !== 'PENDING') return res.status(400).json({ success: false, message: 'تم البت في هذا العذر مسبقاً' });

    const hasPerm = req.user.role === 'admin'
      || await checkUserPermission(req.user.id, AppPermission.MANAGE_EVENT_ATTENDANCE);
    if (!hasPerm) return res.status(403).json({ success: false, message: 'غير مصرح بالبت في الأعذار' });

    if (excuse.tenant_id) {
      const ids = await computeUserTenantIds(req.user);
      if (req.user.role !== 'admin' && !ids.includes(excuse.tenant_id)) {
        return res.status(403).json({ success: false, message: 'العذر ليس ضمن سكناتك' });
      }
    }

    const body = req.body as any;
    await decideExcuse({ excuse, decision: body.decision, notes: body.notes, decidedBy: req.user.id, tenantId: excuse.tenant_id });
    res.json({ success: true, message: body.decision === 'APPROVED' ? 'تم قبول العذر' : 'تم رفض العذر' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر البت في العذر' });
  }
});

export default router;