import express from "express";
import { kdb } from "../infrastructure/db";
import { dateFormatColumn } from "../infrastructure/knex";
import { authenticate, authorizePermission, computeUserTenantIds } from "./middleware";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

// عزل السكنات: لا يجوز للمستخدم غير مدير التطبيق طلب سكنات خارج نطاقه
async function resolveTenantIds(req: express.Request): Promise<string[]> {
  const queryTenants = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
  const user: any = (req as any).user;
  if (user?.role === 'admin') {
    return queryTenants.length ? queryTenants : (user.tenantIds || []);
  }
  const allowed = await computeUserTenantIds(user);
  if (!allowed.length) return [];
  if (queryTenants?.length) {
    return queryTenants.filter(t => allowed.includes(t));
  }
  return allowed;
}

router.get("/global-stats", authenticate, authorizePermission(AppPermission.VIEW_GLOBAL_REPORTS), async (req, res) => {
  try {
    const tenantIds = await resolveTenantIds(req);
    const { startDate, endDate } = req.query as any;
    const scopeQuery = tenantIds?.length ? (qb: any) => qb.whereIn('tenant_id', tenantIds) : (qb: any) => qb;

    const totalStudents = await kdb("students").where(function () { scopeQuery(this); }).count("* as count").first() as any;
    const totalTenants = tenantIds?.length
      ? await kdb("tenants").whereIn('id', tenantIds).count("* as count").first() as any
      : await kdb("tenants").count("* as count").first() as any;

    const totalCapacity = await kdb("rooms").where(function () { scopeQuery(this); })
      .select(kdb.raw("COALESCE(SUM(capacity), 0) as total_capacity"))
      .first() as any;
    const totalOccupancy = await kdb("rooms").where(function () { scopeQuery(this); })
      .select(kdb.raw("COALESCE(SUM(current_occupancy), 0) as total_occupancy"))
      .first() as any;
    const occupancyRate = totalCapacity?.total_capacity > 0
      ? ((totalOccupancy?.total_occupancy || 0) / totalCapacity.total_capacity) * 100
      : 0;

    const emptyRooms = await kdb("rooms")
      .where(function () { scopeQuery(this); })
      .where("current_occupancy", 0)
      .count("* as count").first() as any;

    let financeQuery = kdb("finances").where(function () { scopeQuery(this); });
    if (startDate) financeQuery = financeQuery.where('date', '>=', startDate);
    if (endDate) financeQuery = financeQuery.where('date', '<=', endDate);

    const totalFinance = await financeQuery
        .select(
            kdb.raw("COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0) as income"),
            kdb.raw("COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses")
        )
        .first() as any;

    let maintQuery = kdb("maintenance_requests").where(function () {
      scopeQuery(this);
      this.where(function () {
        this.where("status", "pending").orWhere("status", "in_progress");
      });
    });
    if (startDate) maintQuery = maintQuery.where('created_at', '>=', startDate);
    if (endDate) maintQuery = maintQuery.where('created_at', '<=', endDate);

    const pendingMaintenance = await maintQuery.count("* as count").first() as any;

    const avgRepairTime = await kdb("maintenance_requests")
        .where(function () { scopeQuery(this); })
        .whereNotNull("completed_at")
        .select(kdb.raw("AVG(DATEDIFF(HOUR, created_at, completed_at)) as avg_hours"))
        .first() as any;

    const totalRooms = await kdb("rooms").where(function () { scopeQuery(this); }).count("* as count").first() as any;
    const occupiedRooms = await kdb("rooms")
        .where(function () { scopeQuery(this); })
        .where("current_occupancy", ">", 0)
        .count("* as count").first() as any;
    const roomsFull = await kdb("rooms")
        .where(function () { scopeQuery(this); })
        .whereRaw("current_occupancy >= capacity")
        .count("* as count").first() as any;

    let tenantBreakdown: any[] = [];
    if (tenantIds?.length) {
      tenantBreakdown = await Promise.all(
        tenantIds.map(async (tid: string) => {
          const t = await kdb("tenants").where({ id: tid }).select("id", "name").first();
          if (!t) return null;
          const s = await kdb("students").where({ tenant_id: tid }).count("* as count").first() as any;
          const caps = await kdb("rooms").where({ tenant_id: tid })
            .select(kdb.raw("COALESCE(SUM(capacity), 0) as total"), kdb.raw("COALESCE(SUM(current_occupancy), 0) as occ"))
            .first() as any;
          const empty = await kdb("rooms").where({ tenant_id: tid }).where("current_occupancy", 0).count("* as count").first() as any;
          const fin = await kdb("finances").where({ tenant_id: tid })
            .select(
              kdb.raw("COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0) as income"),
              kdb.raw("COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses")
            ).first() as any;
          return {
            id: t.id,
            name: t.name,
            students: s?.count || 0,
            totalCapacity: caps?.total || 0,
            occupancy: caps?.occ || 0,
            emptyRooms: empty?.count || 0,
            income: fin?.income || 0,
            expenses: fin?.expenses || 0,
          };
        })
      );
      tenantBreakdown = tenantBreakdown.filter(Boolean);
    }

    res.json({
      success: true,
      data: {
        totalStudents,
        totalTenants,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        totalFinance,
        maintenance: {
          pending: pendingMaintenance?.count || 0,
          avgRepairHours: Math.round((avgRepairTime?.avg_hours || 0) * 10) / 10
        },
        rooms: {
          total: totalRooms?.count || 0,
          occupied: occupiedRooms?.count || 0,
          full: roomsFull?.count || 0,
          empty: emptyRooms?.count || 0
        },
        tenantBreakdown
      }
    });
  } catch (error: any) {
    console.error('global-stats error:', error?.message, error?.stack);
    res.status(500).json({ success: false, message: "حصل خطأ في تحميل الإحصائيات. لو سمحت كرر المحاولة." });
  }
});

router.get("/finance-summary", authenticate, authorizePermission(AppPermission.VIEW_FINANCE_REPORTS), async (req, res) => {
  const tenantIds = await resolveTenantIds(req);
  const { startDate, endDate } = req.query as any;

  try {
    const tenantList = tenantIds && tenantIds.length ? tenantIds : [];
    if (!tenantList.length) {
      return res.json({ success: true, data: [], summary: [] });
    }

    const monthCol = dateFormatColumn('date', 'yyyy-MM');
    let query = kdb("finances")
        .select(
            kdb.raw(`${monthCol} as month`),
            kdb.raw("COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0) as revenue"),
            kdb.raw("COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses")
        )
        .whereIn('tenant_id', tenantList)
        .groupByRaw(monthCol)
        .orderBy("month", "desc")
        .limit(12);

    if (startDate) query = query.where('date', '>=', startDate);
    if (endDate) query = query.where('date', '<=', endDate);

    const rows: any[] = await query;

    let totalRevenue = 0, totalExpenses = 0;
    for (const row of rows) {
      totalRevenue += Number(row.revenue || 0);
      totalExpenses += Number(row.expenses || 0);
    }

    res.json({ success: true, data: rows, summary: { totalRevenue, totalExpenses } });
  } catch (error: any) {
    console.error('Finance summary error:', error?.message, error?.stack);
    res.status(500).json({ success: false, message: "حصل خطأ في تحميل التقرير المالي. لو سمحت كرر المحاولة." });
  }
});

export default router;
