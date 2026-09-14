import { Response } from 'express';
import { BehaviorService } from '../services/behavior.service.ts';
import { AuthRequest, computeUserTenantIds } from '../api/middleware.ts';
import { kdb } from '../infrastructure/db.ts';
import { notifyBehaviorAction } from '../api/notifications.routes.ts';
import { logger } from '../infrastructure/logger.ts';

const behaviorService = new BehaviorService();

// التحقق من أن الطالب ينتمي لسكن من سكنات المستخدم الحالي
async function resolveScopedStudent(req: AuthRequest, studentId: string) {
  const scoped = await computeUserTenantIds(req.user!);
  const student = await kdb('students').select('id', 'tenant_id', 'user_id').where({ id: studentId }).first();
  if (!student) {
    return { error: { status: 404, message: 'الطالب غير موجود' } };
  }
  if (!student.tenant_id || !scoped.includes(student.tenant_id)) {
    return { error: { status: 403, message: 'لا يمكنك التعامل مع هذا الطالب فهو خارج نطاق سكناتك' } };
  }
  return { student };
}

export const BehaviorController = {
  addPoints: async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, amount, reason, category, points, description } = req.body;
      if (!studentId) return res.status(400).json({ success: false, message: 'معرف الطالب مطلوب' });
      const resolvedAmount = (amount !== undefined ? amount : points) as number;
      if (typeof resolvedAmount !== 'number' || isNaN(resolvedAmount)) {
        return res.status(400).json({ success: false, message: 'عدد النقاط مطلوب' });
      }
      const resolvedReason = reason || description || '';
      const resolvedCategory = category || 'default';

      const { student, error } = await resolveScopedStudent(req, studentId);
      if (error || !student) return res.status(error!.status).json({ success: false, message: error!.message });

      const result = await behaviorService.addPoints({
        studentId,
        amount: resolvedAmount,
        reason: resolvedReason,
        category: resolvedCategory,
        createdBy: req.user!.id
      }, student.tenant_id);

      await notifyBehaviorAction({
        kind: 'reward',
        studentId,
        tenantId: student.tenant_id,
        details: { amount: resolvedAmount, reason: resolvedReason }
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  issueWarning: async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, reason, level, notifyParent, notifyPriest, deductPoints } = req.body;
      if (!studentId) return res.status(400).json({ success: false, message: 'معرف الطالب مطلوب' });

      let resolvedDeduct = 0;
      if (deductPoints !== undefined && deductPoints !== null && deductPoints !== '') {
        const n = Number(deductPoints);
        if (isNaN(n) || n < 0) {
          return res.status(400).json({ success: false, message: 'قيمة خصم النقاط غير صالحة' });
        }
        resolvedDeduct = Math.floor(n);
      }

      const { student, error } = await resolveScopedStudent(req, studentId);
      if (error || !student) return res.status(error!.status).json({ success: false, message: error!.message });

      const resolvedLevel = level || 'medium';
      const result = await behaviorService.issueWarning({
        studentId,
        reason: reason || '',
        level: resolvedLevel,
        notifyParent: !!notifyParent,
        notifyPriest: !!notifyPriest,
        createdBy: req.user!.id,
        deductPoints: resolvedDeduct
      }, student.tenant_id);

      await notifyBehaviorAction({
        kind: 'penalty',
        studentId,
        tenantId: student.tenant_id,
        details: { level: resolvedLevel, reason: reason || '', deductPoints: resolvedDeduct }
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getSummary: async (req: AuthRequest, res: Response) => {
    try {
      const { studentId } = req.params;
      const tenantIds = req.user?.tenantIds || [];
      const result = await behaviorService.getBehaviorSummary(studentId, tenantIds);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('[BehaviorController.getSummary]', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  assignItemManager: async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, itemId, itemType } = req.body;
      if (!studentId || !itemId || !itemType) {
        return res.status(400).json({ success: false, message: 'معرف الطالب والعنصر ونوعه مطلوبون' });
      }
      if (itemType !== 'event' && itemType !== 'competition') {
        return res.status(400).json({ success: false, message: 'نوع العنصر غير صالح' });
      }
      const itemTable = itemType === 'event' ? 'events' : 'competitions';
      const allowedIds = await computeUserTenantIds(req.user!);
      const item = await kdb(itemTable).select('id', 'tenant_id').where({ id: itemId }).first();
      if (!item) return res.status(404).json({ success: false, message: 'العنصر غير موجود' });
      // لا يمكن تعيين مدير لعنصر في سكن ليس ضمن نطاق المستخدم
      if (!item.tenant_id || !allowedIds.includes(item.tenant_id)) {
        return res.status(403).json({ success: false, message: 'العنصر ليس ضمن نطاق سكناتك' });
      }
      // المستخدم المعين يجب أن يكون ضمن نطاق المستخدم الحالي
      const target = await kdb('users').select('id', 'tenant_id').where({ id: studentId }).first();
      if (!target) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
      if (!target.tenant_id || !allowedIds.includes(target.tenant_id)) {
        return res.status(403).json({ success: false, message: 'المستخدم ليس ضمن نطاق سكناتك' });
      }
      const result = await behaviorService.assignItemManager(studentId, itemId, itemType);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
