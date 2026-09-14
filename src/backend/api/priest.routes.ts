import express from "express";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

// Helper to get all tenant IDs assigned to the priest
const getAssignedTenants = async (userId: string) => {
    const assignments = await kdb("user_tenant_assignments").select("tenant_id").where({ user_id: userId });
    return assignments.map(a => a.tenant_id);
};

router.get("/stats", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
    const tenantIds = await getAssignedTenants(req.user.id);
    
    if (tenantIds.length === 0) {
        return res.json({ success: true, data: { totalStudents: 0, emptyBeds: 0, activeWarnings: 0, pendingReports: 0, buildings: [] } });
    }

    try {
        const totalStudents = await kdb("students").whereIn("tenant_id", tenantIds).where({ status: 'active' }).count("* as count").first();
        const beds = await kdb("rooms").whereIn("tenant_id", tenantIds).select(
            kdb.raw("SUM(capacity) as total"),
            kdb.raw("SUM(current_occupancy) as [current]")
        ).first();
        const warnings = await kdb("student_warnings").whereIn("tenant_id", tenantIds).where({ status: 'active' }).count("* as count").first();
        const reports = await kdb("priest_reports").whereIn("tenant_id", tenantIds).where({ status: 'pending' }).count("* as count").first();

        const buildings = await kdb("tenants as t")
            .select(
                "t.id", "t.name", "t.bishop_id",
                kdb.raw("(SELECT TOP 1 name FROM users WHERE id IN (SELECT user_id FROM user_tenant_assignments WHERE tenant_id = t.id)) as responsibleName"),
                kdb.raw("(SELECT COUNT(*) FROM students WHERE tenant_id = t.id AND status = 'active') as studentCount"),
                kdb.raw("(SELECT SUM(capacity - current_occupancy) FROM rooms WHERE tenant_id = t.id) as emptyBeds")
            )
            .whereIn("t.id", tenantIds);

        res.json({
            success: true,
            data: {
                totalStudents: (totalStudents as any).count || 0,
                emptyBeds: ((beds as any).total || 0) - ((beds as any).current || 0),
                activeWarnings: (warnings as any).count || 0,
                pendingReports: (reports as any).count || 0,
                buildings,
                occupancyRate: (beds as any).total ? Math.round(((beds as any).current / (beds as any).total) * 100) : 0,
                disciplineRate: 95 // Placeholder for logic
            }
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
    }
});

router.get("/expulsion-candidates", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
    const tenantIds = await getAssignedTenants(req.user.id);
    if (tenantIds.length === 0) return res.json({ success: true, data: [] });

    const candidates = await kdb("students as s")
        .join("users as u", "s.user_id", "u.id")
        .select(
            "s.id", "u.name",
            kdb.raw("s.created_at as suggestedAt"),
            kdb.raw("(SELECT COUNT(*) FROM student_warnings WHERE student_id = s.id AND level IN ('high', 'critical')) as warningCount"),
            kdb.raw("'تكرار المخالفات السلوكية والإنذارات الرسمية' as reason")
        )
        .whereIn("s.tenant_id", tenantIds)
        .where(kdb.raw("(SELECT COUNT(*) FROM student_warnings WHERE student_id = s.id AND level IN ('high', 'critical'))"), ">=", 3);

    res.json({ success: true, data: candidates });
});

router.get("/graduates", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
    const tenantIds = await getAssignedTenants(req.user.id);
    if (tenantIds.length === 0) return res.json({ success: true, data: [] });

    const graduates = await kdb("student_archive")
        .select("id", "student_name as name", "data_snapshot", "exit_date as graduatedAt")
        .whereIn("tenant_id", tenantIds)
        .where("exit_reason", "graduated")
        .orderBy("exit_date", "desc");

    res.json({ success: true, data: graduates });
});

router.get("/reports", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
    const tenantIds = await getAssignedTenants(req.user.id);
    if (tenantIds.length === 0) return res.json({ success: true, data: [] });

    const reports = await kdb("priest_reports as r")
        .join("users as u", "r.supervisor_id", "u.id")
        .select("r.*", "u.name as supervisorName")
        .whereIn("r.tenant_id", tenantIds)
        .where("r.status", "pending")
        .orderBy("r.created_at", "desc");

    // Enforce student names
    const enrichedReports = [];
    for (const r of reports) {
        const studentIds = JSON.parse(r.student_ids || '[]');
        const studentNames = studentIds.length > 0 
            ? (await kdb("users").select("name").whereIn("id", kdb("students").select("user_id").whereIn("id", studentIds))).map((u: any) => u.name)
            : [];
        enrichedReports.push({ ...r, studentNames });
    }

    res.json({ success: true, data: enrichedReports });
});

router.post("/reports/:id/approve", authenticate, authorizePermission(AppPermission.MANAGE_PRIEST_REPORTS), async (req, res) => {
    const { id } = req.params;
    const tenantIds = await getAssignedTenants(req.user.id);
    if (tenantIds.length === 0) return res.status(403).json({ success: false, message: 'ليس لديك صلاحية' });
    await kdb("priest_reports").where({ id }).whereIn('tenant_id', tenantIds).update({ status: 'approved', approved_at: kdb.fn.now() });
    res.json({ success: true });
});

export default router;
