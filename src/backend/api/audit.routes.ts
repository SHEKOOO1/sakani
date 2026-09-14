import express from "express";
import { kdb } from "../infrastructure/db";
import { authenticate, computeUserTenantIds } from "./middleware";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  // سجل التدقيق خاص بالكوادر الإدارية فقط (لا أولياء أمور ولا طلاب ولا موظفين)
  const staffTiers = ['admin', 'bishop', 'supervisor', 'assistant_supervisor', 'priest'];
  if (!staffTiers.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "غير مصرح بالوصول إلى سجل التدقيق" });
  }
  const tenantId = req.user.tenantId;
  try {
    let query = kdb('audit_logs')
      .select(
        'audit_logs.id',
        'audit_logs.tenant_id as tenantId',
        'audit_logs.user_id as userId',
        'audit_logs.user_email as userEmail',
        'audit_logs.user_role as userRole',
        'audit_logs.action',
        'audit_logs.entity_type as entityType',
        'audit_logs.entity_id as entityId',
        'audit_logs.method',
        'audit_logs.path',
        'audit_logs.status',
        'audit_logs.details',
        'audit_logs.created_at as createdAt',
        'users.name as actorName',
        'tenants.name as tenantName',
        'tenants.bishop_id as tenantBishopId',
        'bishopUsers.name as bishopName'
      )
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .leftJoin('tenants', 'audit_logs.tenant_id', 'tenants.id')
      .leftJoin('users as bishopUsers', 'tenants.bishop_id', 'bishopUsers.id')
      .orderBy('audit_logs.created_at', 'desc');
    if (req.user.role === 'admin') {
      // مدير التطبيق يرى كل السجل
    } else if (tenantId) {
      query = query.where('audit_logs.tenant_id', tenantId);
    } else {
      // أسقف بلا سكن أساسي: يقتصر على سكناته المُدارة فقط
      const allowedIds = await computeUserTenantIds(req.user);
      if (allowedIds.length === 0) return res.json({ success: true, data: [] });
      query = query.whereIn('audit_logs.tenant_id', allowedIds);
    }
    const logs = await query.limit(200);

    const parsedLogs = logs.map((log: any) => ({
      ...log,
      details: log.details ? (() => { try { return JSON.parse(log.details); } catch { return log.details; } })() : null,
    }));

    res.json({ success: true, data: parsedLogs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
