import express from 'express';
import { kdb, checkUserPermission } from '../infrastructure/db';
import { authenticate, computeUserTenantIds } from './middleware';
import { validate } from '../validation/middleware';
import { attendancePolicyUpdateSchema, disciplinaryDecisionSchema } from '../validation/schemas';
import { AppPermission } from '../../types/permissions';
import { getPolicy, updatePolicy } from '../services/attendance.service';

const router = express.Router();

// الوصول للسكن مشتق من العلاقات في قاعدة البيانات فقط (لا نثق بـ x-tenant-id).
export async function canAccessTenant(req: any, tenantId: string): Promise<boolean> {
  if (req.user.role === 'admin') return true;
  const ids = await computeUserTenantIds(req.user);
  return ids.includes(tenantId);
}

export async function requirePermOrAdmin(req: any, res: any, permission: AppPermission): Promise<boolean> {
  if (req.user.role === 'admin') return true;
  const ok = await checkUserPermission(req.user.id, permission);
  if (!ok) { res.status(403).json({ success: false, message: 'غير مصرح بالوصول' }); }
  return ok;
}

// GET /api/tenants/:tenantId/attendance/policy
router.get('/tenants/:tenantId/attendance/policy', authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: 'غير مصرح بالوصول للسكن' });
    if (!await requirePermOrAdmin(req, res, AppPermission.VIEW_ATTENDANCE)) return;
    const policy = await getPolicy(tenantId, req.user.id);
    const history = await kdb('attendance_policy_versions').where({ tenant_id: tenantId }).orderBy('version', 'desc').limit(20);
    res.json({ success: true, data: { policy, history } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل سياسة الحضور' });
  }
});

// PUT /api/tenants/:tenantId/attendance/policy → إصدار جديد (إصدارات مؤرشفة)
router.put('/tenants/:tenantId/attendance/policy', authenticate, validate(attendancePolicyUpdateSchema), async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: 'غير مصرح بالوصول للسكن' });
    if (!await requirePermOrAdmin(req, res, AppPermission.MANAGE_EVENT_ATTENDANCE)) return;
    const body = req.body as any;
    const { note, ...config } = body;
    const policy = await updatePolicy({ tenantId, userId: req.user.id, note: note ?? null, config });
    res.json({ success: true, message: 'تم تحديث سياسة الحضور وإنشاء إصدار جديد', data: { policy } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحديث سياسة الحضور' });
  }
});

// GET /api/tenants/:tenantId/attendance/risk-report → قائمة الطلاب الأكثر تعرضاً حسب الغياب غير المبرر
router.get('/tenants/:tenantId/attendance/risk-report', authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: 'غير مصرح بالوصول للسكن' });
    if (!await requirePermOrAdmin(req, res, AppPermission.VIEW_ATTENDANCE)) return;
    const rows = await kdb('event_attendance_detailed as ead')
      .join('students as s', 'ead.student_id', 's.id')
      .where('ead.tenant_id', tenantId)
      .select('ead.student_id', 'ead.status', 'ead.unexcused', 'ead.is_required_attendance', 'ead.attendance_weight', 'ead.counts_toward_absence_limit', 's.name as student_name');

    type Accum = { student_id: string; name: string; unexcused: number; weightedUnexcused: number; attended: number; total: number };
    const byStudent = new Map<string, { student_id: string; name: string; unexcusedCount: number; weightedUnexcused: number; attendedCount: number; requiredTotal: number; attendanceRate: number }>();
    for (const r of rows as any[]) {
      if (!r.is_required_attendance) continue;
      const w = Number(r.attendance_weight) || 1;
      const cur = byStudent.get(r.student_id) || { student_id: r.student_id, name: r.student_name, unexcusedCount: 0, weightedUnexcused: 0, attendedCount: 0, requiredTotal: 0, attendanceRate: 100 };
      cur.requiredTotal = Math.round((cur.requiredTotal + w) * 100) / 100;
      if (r.status === 'present' || r.status === 'late') {
        cur.attendedCount = Math.round((cur.attendedCount + w) * 100) / 100;
      } else if (r.status === 'absent' && r.unexcused && r.counts_toward_absence_limit !== 0) {
        cur.unexcusedCount += 1;
        cur.weightedUnexcused = Math.round((cur.weightedUnexcused + w) * 100) / 100;
      }
      cur.attendanceRate = cur.requiredTotal > 0 ? Math.round((cur.attendedCount / cur.requiredTotal) * 10000) / 100 : 100;
      byStudent.set(r.student_id, cur);
    }

    const policy = await getPolicy(tenantId, req.user.id);
    const students = [...byStudent.values()].sort((a: any, b: any) => b.unexcusedCount - a.unexcusedCount).slice(0, 200);
    res.json({
      success: true,
      data: students.map((s: any) => ({
        ...s,
        atRisk: policy.enforce_absence_thresholds && s.unexcusedCount >= policy.warning_1_threshold,
        riskLevel: s.unexcusedCount >= policy.residence_termination_review_threshold ? 'critical'
          : s.unexcusedCount >= policy.disciplinary_review_threshold ? 'high'
          : s.unexcusedCount >= policy.final_warning_threshold ? 'medium'
          : s.unexcusedCount >= policy.warning_1_threshold ? 'elevated'
          : 'ok',
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر توليد تقرير المخاطر' });
  }
});

// GET /api/tenants/:tenantId/attendance/cases → القضايا التأديبية التلقائية والأعذار المعلقة
router.get('/tenants/:tenantId/attendance/cases', authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: 'غير مصرح بالوصول للسكن' });
    if (!await requirePermOrAdmin(req, res, AppPermission.VIEW_ATTENDANCE)) return;
    const cases = await kdb('disciplinary_cases as c')
      .join('students as s', 'c.student_id', 's.id')
      .where('c.tenant_id', tenantId)
      .select('c.*', 's.name as student_name')
      .orderByRaw("CASE WHEN c.status IN ('OPEN','UNDER_REVIEW') THEN 0 ELSE 1 END, c.created_at DESC");
    const pendingExcuses = await kdb('attendance_excuses as e')
      .join('students as s', 'e.student_id', 's.id')
      .leftJoin('events as ev', 'e.event_id', 'ev.id')
      .where('e.tenant_id', tenantId)
      .where('e.status', 'PENDING')
      .select('e.*', 's.name as student_name', 'ev.title as event_title');
    const warnings = await kdb('student_warnings')
      .where({ tenant_id: tenantId, is_attendance_warning: 1 })
      .orderBy('created_at', 'desc')
      .limit(200);
    res.json({ success: true, data: { cases, pendingExcuses, warnings } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر تحميل الحالات التأديبية' });
  }
});

// POST /api/tenants/:tenantId/attendance/cases/:id/decision
// قاعدة ثابتة: القرار يؤرشف الحالة فقط، ولا يغيّر حالة الطالب أو إقامته تلقائياً
// (إنهاء/ترحيل السكن يتطلب قراراً بشرياً خارج النظام).
router.post('/tenants/:tenantId/attendance/cases/:id/decision', authenticate, validate(disciplinaryDecisionSchema), async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!await canAccessTenant(req, tenantId)) return res.status(403).json({ success: false, message: 'غير مصرح بالوصول للسكن' });
    if (!await requirePermOrAdmin(req, res, AppPermission.MANAGE_EVENT_ATTENDANCE)) return;
    const caseRow = await kdb('disciplinary_cases').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!caseRow) return res.status(404).json({ success: false, message: 'الحالة غير موجودة' });
    if (!['OPEN', 'UNDER_REVIEW'].includes(caseRow.status)) return res.status(400).json({ success: false, message: 'تم البت في هذه الحالة مسبقاً' });

    const body = req.body as any;
    await kdb('disciplinary_cases').where({ id: caseRow.id }).update({
      status: body.decision === 'REJECTED' ? 'CLOSED' : body.decision,
      decided_by: req.user.id,
      decided_at: new Date(),
      reason: body.reason ?? null,
      notes: body.notes ?? null,
      effective_date: body.effective_date ? new Date(body.effective_date) : caseRow.effective_date,
      decision: body.decision,
    });
    res.json({ success: true, message: 'تم تسجيل القرار (لا يتم تغيير حالة الطالب تلقائياً)' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'تعذر حفظ القرار' });
  }
});

export default router;