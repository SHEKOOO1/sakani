import express from "express";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

router.get("/summary", authenticate, authorizePermission(AppPermission.VIEW_DASHBOARD), async (req, res) => {
  const tenantId = req.user.tenantId;

  // الملخص المالي والغيابات خاص بالكوادر الإدارية فقط، وليس الطلبة أو أولياء الأمور أو الموظفين
  const staffTiers = ['admin', 'bishop', 'supervisor', 'assistant_supervisor', 'priest'];
  if (!staffTiers.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "غير مصرح بالاطلاع على الملخص" });
  }

  try {
    const studentCount = (await kdb("students").where('tenant_id', tenantId).count("* as count").first()) as { count: number };
    
    const roomStats = (await kdb("rooms")
      .where('tenant_id', tenantId)
      .select(
        kdb.raw("COUNT(*) as total"),
        kdb.raw("SUM(CASE WHEN current_occupancy >= capacity THEN 1 ELSE 0 END) as full_rooms"),
        kdb.raw("SUM(capacity) as total_capacity"),
        kdb.raw("SUM(current_occupancy) as current_occupancy")
      )
      .first()) as any;

    const maintenanceCount = (await kdb("maintenance_requests").where({ status: 'pending' }).where('tenant_id', tenantId).count("* as count").first()) as { count: number };
    
    const isAdmin = req.user.role === 'admin';

    let financeQuery = kdb("finances");
    if (isAdmin) {
      financeQuery = financeQuery.where('is_admin_only', 1);
    } else {
      financeQuery = financeQuery.where(function () {
        this.where('is_admin_only', 0).orWhereNull('is_admin_only');
      }).where('tenant_id', tenantId);
    }
    const financeSummary = (await financeQuery
      .select(
        kdb.raw("SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END) as income"),
        kdb.raw("SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense")
      )
      .first()) as any;

    const recentAttendance = await kdb("attendance as a")
      .leftJoin("students as s", "a.student_id", "s.id")
      .leftJoin("users as u", "s.user_id", "u.id")
      .select("a.*", "u.name as student_name")
      .where("a.tenant_id", tenantId)
      .orderBy("a.created_at", "desc")
      .limit(5);

    res.json({
      success: true,
      data: {
        students: studentCount.count,
        rooms: {
          total: roomStats.total || 0,
          full: roomStats.full_rooms || 0,
          occupancyRate: roomStats.total_capacity ? Math.round((roomStats.current_occupancy / roomStats.total_capacity) * 100) : 0
        },
        maintenance: maintenanceCount.count,
        finance: {
          balance: (financeSummary.income || 0) - (financeSummary.expense || 0),
          income: financeSummary.income || 0
        },
        attendance: recentAttendance
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

export default router;
