import express from "express";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission, computeUserTenantIds } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { getLedgerClassTotals, getLedgerByMonth } from "../services/ledger.service";

const router = express.Router();

// عزل السكنات: لا يجوز للمستخدم غير مدير التطبيق طلب سكنات خارج نطاقه
async function resolveTenantIds(req: express.Request): Promise<string[]> {
  const queryTenants = (req.query.tenant_ids as string)?.split(',').filter(Boolean);
  const user: any = (req as any).user;
  if (user?.role === 'admin') {
    return queryTenants?.length ? queryTenants : (user.tenantIds || []);
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

    // A global admin with no tenant list sees everything; any other user with
    // an empty list has no access and an empty whereIn must yield zero rows,
    // never the whole books (see applyLedgerScope).
    const isAdmin = (req.user as any).role === 'admin';
    const ledgerScope = tenantIds?.length
      ? { tenantIds, startDate: startDate || null, endDate: endDate || null }
      : isAdmin
        ? { startDate: startDate || null, endDate: endDate || null }
        : { tenantIds: [] as string[], startDate: startDate || null, endDate: endDate || null };
    const ledgerTotals = await getLedgerClassTotals(ledgerScope);
    const totalFinance = {
      income: ledgerTotals.income,
      expenses: ledgerTotals.expense + ledgerTotals.penalty + ledgerTotals.discount,
    };

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
          const fin = await getLedgerClassTotals({ tenantId: tid });
          return {
            id: t.id,
            name: t.name,
            students: s?.count || 0,
            totalCapacity: caps?.total || 0,
            occupancy: caps?.occ || 0,
            emptyRooms: empty?.count || 0,
            income: fin.income,
            expenses: fin.expense + fin.penalty + fin.discount,
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
  const { startDate, endDate } = req.query as any;

  try {
    const tenantIds = await resolveTenantIds(req);
    const tenantList = tenantIds && tenantIds.length ? tenantIds : [];
    if (!tenantList.length) {
      return res.json({ success: true, data: [], summary: [] });
    }

    const monthly = await getLedgerByMonth({
      tenantIds: tenantList,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    // Sum the totals over every month in the range; only the chart rows (the
    // most recent 12) get cut for the UI, otherwise a >12-month range silently
    // drops the older months from totalRevenue/totalExpenses.
    const sorted = monthly
      .map((m) => ({ month: m.month, revenue: m.income, expenses: m.expense }))
      .sort((a, b) => String(b.month).localeCompare(String(a.month)));
    const rows = sorted.slice(0, 12);

    let totalRevenue = 0, totalExpenses = 0;
    for (const row of sorted) {
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
