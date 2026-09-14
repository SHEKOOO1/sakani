import { Router } from 'express';
import { authenticate, authorizePermission, authorize, computeUserTenantIds } from './middleware';
import { AppPermission } from '../../types/permissions';
import { BehaviorController } from '../controllers/behavior.controller';
import { kdb } from '../infrastructure/db';

const router = Router();

// صفحة إدارة نقاط السلوك والإنذارات خاصة فقط بمشرف السكن (ومساعده) والكاهن
const BEHAVIOR_STAFF_ROLES = ['supervisor', 'assistant_supervisor', 'priest'];
const behaviorStaffOnly = authorize(BEHAVIOR_STAFF_ROLES);

async function scopedTenantIds(req: any): Promise<string[]> {
  return computeUserTenantIds(req.user);
}

// جلب قائمة الطلاب داخل سكنات المستخدم الحالي (لاختيار من يستحق المكافأة أو الجزاء)
router.get('/students', authenticate, behaviorStaffOnly, authorizePermission(AppPermission.VIEW_POINTS), async (req, res) => {
  try {
    const tenantIds = await scopedTenantIds(req);
    if (!tenantIds.length) return res.json({ success: true, data: [] });
    const students = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('student_points as sp', 'sp.student_id', 's.id')
      .leftJoin('student_warnings as sw', function () {
        this.on('sw.student_id', 's.id').andOnVal('sw.status', 'active');
      })
      .whereIn('s.tenant_id', tenantIds)
      .select(
        's.id',
        'u.name',
        kdb.raw('ISNULL(SUM(sp.amount), 0) as points'),
        kdb.raw('SUM(CASE WHEN sw.id IS NOT NULL THEN 1 ELSE 0 END) as active_warnings')
      )
      .groupBy('s.id', 'u.name')
      .orderBy('u.name');
    res.json({ success: true, data: students });
  } catch (error: any) { res.status(500).json({ success: false, message: 'حدث خطأ' }); }
});

// سجل النقاط لكل الطلاب في نطاق المستخدم (مهم أن يكون قبل مسار /points/:studentId)
router.get('/points/history', authenticate, behaviorStaffOnly, authorizePermission(AppPermission.VIEW_POINTS), async (req, res) => {
  try {
    const tenantIds = await scopedTenantIds(req);
    if (!tenantIds.length) return res.json({ success: true, data: [] });
    const rows = await kdb('student_points as sp')
      .join('students as s', 'sp.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .whereIn('s.tenant_id', tenantIds)
      .select('sp.id', 'sp.student_id', 'sp.amount as points', 'sp.reason as description', 'sp.created_at', 'u.name as student_name')
      .orderBy('sp.created_at', 'desc')
      .limit(100);
    res.json({ success: true, data: rows });
  } catch (error: any) { res.status(500).json({ success: false, message: 'حدث خطأ' }); }
});

// سجل الإنذارات لكل الطلاب في نطاق المستخدم
router.get('/warnings', authenticate, behaviorStaffOnly, authorizePermission(AppPermission.VIEW_POINTS), async (req, res) => {
  try {
    const tenantIds = await scopedTenantIds(req);
    if (!tenantIds.length) return res.json({ success: true, data: [] });
    const rows = await kdb('student_warnings as sw')
      .join('students as s', 'sw.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .whereIn('s.tenant_id', tenantIds)
      .select('sw.id', 'sw.student_id', 'sw.level', 'sw.reason', 'sw.status', 'sw.created_at', 'u.name as student_name')
      .orderBy('sw.created_at', 'desc')
      .limit(100);
    res.json({ success: true, data: rows });
  } catch (error: any) { res.status(500).json({ success: false, message: 'حدث خطأ' }); }
});

// إضافة/خصم نقاط للطالب
router.post('/points', authenticate, behaviorStaffOnly, authorizePermission(AppPermission.MANAGE_POINTS), BehaviorController.addPoints);

// إصدار إنذار للطالب
router.post('/warnings', authenticate, behaviorStaffOnly, authorizePermission(AppPermission.MANAGE_PENALTIES), BehaviorController.issueWarning);

// ��� ���� ���� ���� (����� + ������)
router.get('/points/:studentId', authenticate, behaviorStaffOnly, authorizePermission(AppPermission.VIEW_POINTS), async (req, res) => {
  try {
    const { studentId } = req.params;
    const tenantIds = req.user?.tenantIds || [];
    const points = await kdb('student_points as sp')
      .join('students as s', 'sp.student_id', 's.id')
      .where('sp.student_id', studentId)
      .whereIn('s.tenant_id', tenantIds)
      .orderBy('sp.created_at', 'desc')
      .limit(100)
      .select('sp.*');
    const total = points.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    res.json({ success: true, data: { points, total } });
  } catch (error: any) { res.status(500).json({ success: false, message: 'حدث خطأ' }); }
});

// جلب ملخص سلوك الطالب (نقاط وإنذارات)
router.get('/summary/:studentId', authenticate, behaviorStaffOnly, authorizePermission(AppPermission.VIEW_POINTS), BehaviorController.getSummary);

// تعيين طالب كمدير لنشاط معين (Step 7.3)
router.post('/assign-item-manager', authenticate, behaviorStaffOnly, authorizePermission(AppPermission.ASSIGN_ROLES), BehaviorController.assignItemManager);

interface AuthenticatedRequest extends Express.Request {
  user: any;
}

router.get("/my-history", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const student = await kdb('students').where({ user_id: userId }).first();
    if (!student) return res.json({ success: true, data: [] });
    const history = await kdb('student_points')
      .where({ student_id: student.id })
      .select('id', 'student_id', 'tenant_id', 'amount as points', 'reason', 'category', 'created_by', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(50);
    res.json({ success: true, data: history });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

router.get("/my-warnings", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const student = await kdb('students').where({ user_id: userId }).first();
    if (!student) return res.json({ success: true, data: [] });
    const warnings = await kdb('student_warnings')
      .where({ student_id: student.id })
      .orderBy('created_at', 'desc')
      .limit(50);
    res.json({ success: true, data: warnings });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// ��� ������� ���� ����
router.get("/warnings/:studentId", authenticate, behaviorStaffOnly, authorizePermission(AppPermission.VIEW_POINTS), async (req, res) => {
  try {
    const { studentId } = req.params;
    const tenantIds = req.user?.tenantIds || [];
    const warnings = await kdb('student_warnings as sw')
      .join('students as s', 'sw.student_id', 's.id')
      .where('sw.student_id', studentId)
      .whereIn('s.tenant_id', tenantIds)
      .orderBy('sw.created_at', 'desc')
      .select('sw.*');
    res.json({ success: true, data: warnings });
  } catch (error: any) { res.status(500).json({ success: false, message: 'حدث خطأ' }); }
});

// ���/����� �����
router.post("/warnings/:id/reverse", authenticate, behaviorStaffOnly, authorizePermission(AppPermission.UNDO_DECISION), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    await kdb('student_warnings').where({ id, tenant_id: tenantId }).update({ status: 'reversed' });
    res.json({ success: true, message: "تم عكس الإنذار بنجاح" });
  } catch (error: any) { res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من عكس الإنذار." }); }
});

export default router;
