import express from "express";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { getUserBroadcasts } from "./broadcast.service";
import { fetchDailyReadings } from "../../services/dailyReadingsService";

const router = express.Router();

// 1. ملخص مدير النظام (Admin) - إحصائيات عامة فقط بدون أي صلاحيات مالية أو تشغيلية
router.get("/admin-summary", authenticate, authorizePermission(AppPermission.VIEW_DASHBOARD), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Forbidden" });
  try {
    // إحصائيات الأدوار مع التفريق بين الذكور والإناث
    const allUsers = await kdb('users').select('role', 'gender').whereNotNull('role');
    
    let bishops = 0, priests = 0, supervisors = 0, employees = 0, students = 0, parents = 0;
    let maleStudents = 0, femaleStudents = 0, maleSupervisors = 0, femaleSupervisors = 0;
    let maleEmployees = 0, femaleEmployees = 0;

    for (const u of allUsers) {
      const g = u.gender || 'male';
      switch (u.role) {
        case 'bishop': bishops++; break;
        case 'priest': priests++; break;
        case 'supervisor': case 'assistant_supervisor': 
          supervisors++;
          if (g === 'male') maleSupervisors++; else femaleSupervisors++;
          break;
        case 'employee': 
          employees++;
          if (g === 'male') maleEmployees++; else femaleEmployees++;
          break;
        case 'student': 
          students++;
          if (g === 'male') maleStudents++; else femaleStudents++;
          break;
        case 'parent': parents++; break;
      }
    }

    const totalUsersResult = await kdb('users').count({ count: 'id' }).first();
    const tenantsResult = await kdb('tenants').count({ count: 'id' }).first();
    const totalUsers = Number((totalUsersResult as any)?.count || 0);
    const tenantsC = Number((tenantsResult as any)?.count || 0);

    // College stats across all tenants
    const collegeStats = await kdb('students')
      .select('college')
      .whereNotNull('college')
      .andWhere('college', '!=', '');
    const collegeMap: Record<string, number> = {};
    for (const s of collegeStats) {
      collegeMap[s.college] = (collegeMap[s.college] || 0) + 1;
    }
    const colleges = Object.entries(collegeMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        totalUsers,
        tenantsCount: tenantsC,
        bishopsCount: bishops,
        priestsCount: priests,
        supervisorsCount: supervisors,
        employeesCount: employees,
        studentsCount: students,
        parentsCount: parents,
        genderBreakdown: {
          maleStudents, femaleStudents,
          maleSupervisors, femaleSupervisors,
          maleEmployees, femaleEmployees
        },
        colleges
      }
    });
  } catch (error: any) {
    console.error('admin-summary error:', error?.message || error);
    res.status(500).json({ success: false, message: "حدث خطأ في الخادم: " + (error?.message || 'خطأ غير معروف') });
  }
});

// 2. ملخص بيانات الأسقف (Bishop) - إحصائيات شاملة لكل السكنات التابعة له
router.get("/bishop-summary", authenticate, authorizePermission(AppPermission.VIEW_DASHBOARD), async (req, res) => {
  if (req.user.role !== 'bishop') return res.status(403).json({ success: false, message: "Forbidden" });
  try {
    const tenantIds: string[] = req.user.tenantIds || [];
    if (tenantIds.length === 0) {
      const owned = await kdb('tenants').where({ bishop_id: req.user.id }).select('id');
      tenantIds.push(...owned.map((t: any) => t.id));
    }
    if (tenantIds.length === 0) {
      return res.json({ success: true, data: { tenantsCount: 0, dioceseStudents: 0, activeTenantsCount: 0, priestsCount: 0, supervisorsCount: 0, occupancyRate: 0, annualStats: { newStudents: 0, expulsions: 0, graduates: 0 }, tenants: [], priests: [], receivedReports: [] } });
    }

    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    // كل السكنات
    const tenants = await kdb('tenants').whereIn('id', tenantIds).select('id', 'name', 'location', 'is_active', 'bishop_id');

    // إجمالي الطلاب
    const totalResult = await kdb('students').whereIn('tenant_id', tenantIds).count({ count: 'id' }).first();
    const totalStudents = Number((totalResult as any)?.count || 0);

    // السكنات النشطة
    const activeTenants = tenants.filter(t => t.is_active);

    // الكهنة المسندين
    const priestsResult = await kdb('users').whereIn('tenant_id', tenantIds).where('role', 'priest').count({ count: 'id' }).first();
    const assignedPriests = Number((priestsResult as any)?.count || 0);

    // المشرفين
    const supervisorRows = await kdb('user_tenant_assignments as uta')
      .join('users as u', 'uta.user_id', 'u.id')
      .whereIn('uta.tenant_id', tenantIds)
      .whereIn('u.role', ['supervisor', 'assistant_supervisor'])
      .select('uta.user_id').distinct();
    const supervisorsCount = supervisorRows.length;

    // إحصائيات الغرف لكل سكن
    const roomData = await kdb('rooms').whereIn('tenant_id', tenantIds).select(kdb.raw("SUM(capacity) as total"), kdb.raw("SUM(current_occupancy) as [current]")).first() as any;
    const totalBeds = Number(roomData?.total || 0);
    const currentOccupancy = Number(roomData?.current || 0);

    // إحصائيات سنوية
    const newStudentsResult = await kdb('students').whereIn('tenant_id', tenantIds).where('created_at', '>=', yearStart).count({ count: 'id' }).first();
    const expulsionsResult = await kdb('student_archive').whereIn('tenant_id', tenantIds).where('exit_reason', 'expelled').where('exit_date', '>=', yearStart).count({ count: 'id' }).first();
    const graduatesResult = await kdb('student_archive').whereIn('tenant_id', tenantIds).where('exit_reason', 'graduated').where('exit_date', '>=', yearStart).count({ count: 'id' }).first();
    const currentGraduatesResult = await kdb('students').whereIn('tenant_id', tenantIds).where('is_graduate', 1).where('status', '!=', 'archived').where('graduation_date', '>=', yearStart).count({ count: 'id' }).first();
    const graduatesCountResult = await kdb('students').whereIn('tenant_id', tenantIds).where('is_graduate', 1).where('status', '!=', 'archived').count({ count: 'id' }).first();
    const newStudents = Number((newStudentsResult as any)?.count || 0);
    const expulsions = Number((expulsionsResult as any)?.count || 0);
    const graduates = Number((graduatesResult as any)?.count || 0) + Number((currentGraduatesResult as any)?.count || 0);
    const graduatesCount = Number((graduatesCountResult as any)?.count || 0);

    // تفاصيل كل سكن
    const tenantDetails = await Promise.all(tenants.map(async (t) => {
      const aptsResult = await kdb('apartments').where({ tenant_id: t.id }).count({ count: 'id' }).first();
      const rooms = await kdb('rooms').where({ tenant_id: t.id }).select(kdb.raw("COUNT(*) as rooms_count"), kdb.raw("SUM(capacity) as total_beds"), kdb.raw("SUM(current_occupancy) as occupied")).first() as any;
      const priest = await kdb('users').where({ tenant_id: t.id, role: 'priest' }).select('name').first();
      const studentCountResult = await kdb('students').where({ tenant_id: t.id }).count({ count: 'id' }).first();
      const totalBeds = Number(rooms?.total_beds || 0);
      const currentOcc = Number(rooms?.occupied || 0);
      return {
        id: t.id,
        name: t.name,
        location: t.location,
        is_active: t.is_active,
        priestName: priest?.name || 'لم يعين',
        studentCount: Number((studentCountResult as any)?.count || 0),
        apartment_count: Number((aptsResult as any)?.count || 0),
        room_count: Number(rooms?.rooms_count || 0),
        totalCapacity: totalBeds,
        currentOccupancy: currentOcc,
        occupancyRate: totalBeds > 0 ? Math.round((currentOcc / totalBeds) * 100) : 0
      };
    }));

    // الكهنة مع السكنات المسندة والتقارير المعلقة
    const priestRows = await kdb('users')
      .whereIn('tenant_id', tenantIds)
      .where('role', 'priest')
      .select('id', 'name', 'email');
    const priestIds = priestRows.map((p: any) => p.id);
    const priestTenantNames = await kdb('users as u')
      .join('tenants as t', 'u.tenant_id', 't.id')
      .whereIn('u.tenant_id', tenantIds)
      .where('u.role', 'priest')
      .select('u.id as user_id', 't.name');
    const pendingReportCounts = priestIds.length > 0
      ? await kdb('priest_reports')
          .whereIn('supervisor_id', priestIds)
          .where('status', 'pending')
          .select('supervisor_id')
          .count({ count: 'id' })
          .groupBy('supervisor_id')
      : [];
    const pendingMap = new Map(pendingReportCounts.map((r: any) => [r.supervisor_id, Number(r.count)]));
    const tenantMap = new Map<string, string[]>();
    for (const row of priestTenantNames) {
      const arr = tenantMap.get(row.user_id) || [];
      arr.push(row.name);
      tenantMap.set(row.user_id, arr);
    }
    const priestsWithNames = priestRows.map((p: any) => ({
      ...p,
      pending_reports: pendingMap.get(p.id) || 0,
      tenant_names: (tenantMap.get(p.id) || []).join(', ')
    }));

    // البلاغات الواردة
    const receivedReports = await kdb('priest_reports as pr').join('users as u', 'pr.supervisor_id', 'u.id').whereIn('pr.tenant_id', tenantIds).where('pr.status', 'pending').select('pr.id', 'pr.title', 'pr.description', 'pr.created_at', 'u.name as supervisor_name', 'pr.type', 'pr.status').orderBy('pr.created_at', 'desc').limit(10);

    res.json({
      success: true,
      data: {
        tenantsCount: tenants.length,
        dioceseStudents: totalStudents,
        activeTenantsCount: activeTenants.length,
        priestsCount: assignedPriests,
        supervisorsCount: supervisorsCount,
        graduatesCount,
        occupancyRate: totalBeds > 0 ? Math.round((currentOccupancy / totalBeds) * 100) : 0,
        annualStats: {
          newStudents,
          expulsions,
          graduates
        },
        tenants: tenantDetails,
        priests: priestsWithNames,
        receivedReports
      }
    });
  } catch (error: any) {
    console.error('bishop-summary error:', error?.message || error);
    console.error('bishop-summary stack:', error?.stack || '(no stack)');
    res.status(500).json({ success: false, message: "حدث خطأ في الخادم: " + (error?.message || 'خطأ غير معروف') });
  }
});

// 3. ملخص مشرف السكن (Supervisor) - لوحة التحكم التشغيلية مع عزل تام للبيانات حسب السكن
router.get("/supervisor-summary", authenticate, authorizePermission(AppPermission.VIEW_DASHBOARD), async (req, res) => {
  const userId = req.user.id;
  let tenantId = req.user.tenantId;

  // مقصور على إدارة السكن (وليس الطلاب/أولياء الأمور/الموظفين) — يمنع كشف الأرقام المالية وأسماء الطلاب
  const managerRoles = ['admin', 'bishop', 'priest', 'supervisor', 'assistant_supervisor'];
  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "غير مسموح لك بالاطلاع على هذه اللوحة" });
  }

  try {
    const assignedTenants = await kdb('tenants as t')
      .join('user_tenant_assignments as uta', 't.id', 'uta.tenant_id')
      .where('uta.user_id', userId)
      .select('t.id', 't.name')
      .orderBy('t.name', 'asc');

    if (assignedTenants.length > 0) {
      const matches = assignedTenants.find((t: any) => t.id === tenantId);
      if (!matches) {
        tenantId = assignedTenants[0].id;
      }
    } else if (!tenantId) {
      console.warn('supervisor-summary: No tenantId for user', userId, 'no assignments found');
      return res.json({ success: true, data: { studentCount: 0, apartmentsCount: 0, roomStats: { total: 0, occupied: 0, occupancyRate: 0 } } });
    }

    const today = new Date().toISOString().split('T')[0];

    const travelingStudentIds = await kdb('students')
      .where({ tenant_id: tenantId, is_traveling: 1 })
      .select('id');
    const travelingIds = travelingStudentIds.map((s: any) => s.id);

    const students = await kdb('students').where({ tenant_id: tenantId }).count({ count: 'id' }).first();
    const apartments = await kdb('apartments').where({ tenant_id: tenantId }).count({ count: 'id' }).first();
    const graduates = await kdb('students').where({ tenant_id: tenantId, is_graduate: 1 }).where('status', '!=', 'archived').count({ count: 'id' }).first();

    let attendanceQuery = kdb('attendance')
      .where({ tenant_id: tenantId, type: 'check-in' })
      .andWhereRaw("CAST(created_at AS DATE) = ?", [today]);
    if (travelingIds.length > 0) {
      attendanceQuery = attendanceQuery.whereNotIn('student_id', travelingIds);
    }
    const attendance = await attendanceQuery.count({ count: 'id' }).first();

    const maintenance = await kdb('maintenance_requests').where({ tenant_id: tenantId, status: 'pending' }).count({ count: 'id' }).first();
    const laundry = await kdb('laundry_queue').where({ tenant_id: tenantId, status: 'waiting' }).count({ count: 'id' }).first();
    const income = await kdb('finances').where({ tenant_id: tenantId, type: 'revenue' }).sum<{ total: number }>('amount as total').first();
    const expenses = await kdb('finances').where({ tenant_id: tenantId, type: 'expense' }).sum<{ total: number }>('amount as total').first();

    const roomStats = await kdb('rooms').where({ tenant_id: tenantId }).select(
      kdb.raw("COUNT(*) as rooms_count"),
      kdb.raw("SUM(capacity) as total_beds"),
      kdb.raw("SUM(current_occupancy) as occupied"),
      kdb.raw("SUM(CASE WHEN current_occupancy >= capacity THEN 1 ELSE 0 END) as [full]")
    ).first() as any;

    const recentMaintenance = await kdb('maintenance_requests as m')
      .join('users as u', 'm.requester_id', 'u.id')
      .select('m.id', 'm.description', 'm.status', 'm.created_at', 'u.name as requester_name')
      .where('m.tenant_id', tenantId)
      .orderBy('m.created_at', 'desc')
      .limit(5);

    const upcomingEvents = await kdb('events')
      .select('id', 'title', 'event_date', 'location')
      .where('tenant_id', tenantId)
      .whereRaw("event_date >= CAST(GETDATE() AS DATE)")
      .orderBy('event_date', 'asc')
      .limit(5);

    const recentAttendance = await kdb('attendance as a')
      .leftJoin('students as s', 'a.student_id', 's.id')
      .leftJoin('users as u', 's.user_id', 'u.id')
      .select('a.id', 'a.created_at', 'u.name as student_name', 'a.type')
      .where('a.tenant_id', tenantId)
      .orderBy('a.created_at', 'desc')
      .limit(10);

    const recentDecisions = await kdb('decisions_log as d')
      .join('users as u', 'd.created_by', 'u.id')
      .leftJoin('students as s', kdb.raw("s.id = JSON_VALUE(d.details, '$.studentId')"))
      .leftJoin('users as su', 's.user_id', 'su.id')
      .select('d.id', 'd.action_type as action', 'd.details', 'd.created_at', 'u.name as creator_name', 'su.name as student_name')
      .where('d.tenant_id', tenantId)
      .orderBy('d.created_at', 'desc')
      .limit(5);

    const pendingComplaints = await kdb('complaints').where({ tenant_id: tenantId, status: 'pending' }).count({ count: 'id' }).first();
    const travelingStudents = await kdb('students').where({ tenant_id: tenantId, is_traveling: 1 }).count({ count: 'id' }).first();
    const activeWarnings = await kdb('student_warnings').where({ tenant_id: tenantId, status: 'active' }).count({ count: 'id' }).first();

    const collegeStats = await kdb('students')
      .select('college')
      .where('tenant_id', tenantId)
      .whereNotNull('college')
      .andWhere('college', '!=', '');
    const collegeMap: Record<string, number> = {};
    for (const s of collegeStats) {
      collegeMap[s.college] = (collegeMap[s.college] || 0) + 1;
    }
    const colleges = Object.entries(collegeMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const tenantsFinance = await Promise.all(assignedTenants.map(async (t) => {
      const tIncome = await kdb('finances').where({ tenant_id: t.id, type: 'revenue' }).sum<{ total: number }>('amount as total').first();
      const tExpenses = await kdb('finances').where({ tenant_id: t.id, type: 'expense' }).sum<{ total: number }>('amount as total').first();
      const tStudents = await kdb('students').where({ tenant_id: t.id }).count({ count: 'id' }).first();
      return {
        id: t.id,
        name: t.name,
        studentCount: Number(tStudents?.count || 0),
        totalIncome: Number(tIncome?.total || 0),
        totalExpenses: Number(tExpenses?.total || 0)
      };
    }));

    const topStudents = await kdb('student_points as sp')
      .join('students as s', 'sp.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .select('u.name', kdb.raw("SUM(sp.amount) as total_points"))
      .where('sp.tenant_id', tenantId)
      .andWhereRaw("sp.created_at >= DATEADD(month, -1, GETDATE())")
      .groupBy('u.name')
      .orderBy(kdb.raw("SUM(sp.amount)"), 'desc')
      .limit(3);

    const currentOccupancy = Number(roomStats?.occupied || 0);
    const totalBeds = Number(roomStats?.total_beds || 0);

    const now = new Date();
    let tickerBroadcasts: any[] = [];
    let dailyMessages: any[] = [];
    try {
      tickerBroadcasts = await getUserBroadcasts({ id: userId, tenantId, role: 'supervisor' }, 'news');
      dailyMessages = await getUserBroadcasts({ id: userId, tenantId, role: 'supervisor' }, 'messages');
    } catch (e: any) {
      console.warn('supervisor-summary: broadcast fetch error:', e.message);
    }

    res.json({
      success: true,
      data: {
        studentCount: Number(students?.count || 0),
        apartmentsCount: Number(apartments?.count || 0),
        graduatesCount: Number(graduates?.count || 0),
        presentToday: Number(attendance?.count || 0),
        pendingMaintenance: Number(maintenance?.count || 0),
        laundryQueue: Number(laundry?.count || 0),
        totalIncome: Number(income?.total || 0),
        totalExpenses: Number(expenses?.total || 0),
        roomStats: {
          total: totalBeds,
          roomsCount: Number(roomStats?.rooms_count || 0),
          occupied: currentOccupancy,
          full: Number(roomStats?.full || 0),
          occupancyRate: totalBeds > 0 ? Math.round((currentOccupancy / totalBeds) * 100) : 0
        },
        recentMaintenance: recentMaintenance.map(m => ({ ...m, description: m.description?.substring(0, 100) })),
        upcomingEvents,
        recentAttendance,
        recentDecisions,
        pendingComplaints: Number(pendingComplaints?.count || 0),
        travelingStudents: Number(travelingStudents?.count || 0),
        activeWarnings: Number(activeWarnings?.count || 0),
        topStudents: topStudents.map(s => ({ name: s.name, points: Number(s.total_points || 0) })),
        multiTenant: assignedTenants.length > 1,
        tenantsFinance,
        broadcasts: tickerBroadcasts,
        dailyMessages,
        colleges
      }
    });
  } catch (error: any) {
    console.error('supervisor-summary error:', error?.message || error);
    res.status(500).json({ success: false, message: "حدث خطأ في الخادم: " + (error?.message || 'خطأ غير معروف') });
  }
});

// 4. ملخص الموظف (Employee) - مهامه الشخصية
router.get("/employee-summary", authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.json({ success: true, data: { activeTasks: 0 } });
    const tasks = await kdb('maintenance_requests')
      .where({ assigned_to: req.user.id, status: 'assigned', tenant_id: tenantId })
      .count({ count: 'id' }).first();
    res.json({ success: true, data: { activeTasks: Number(tasks?.count || 0) } });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 5. مسارات الأب الكاهن (Priest) - الرقابة والرعاية
router.get("/priest/stats", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    // إحصائيات عامة
    const students = await kdb('students').where({ tenant_id: tenantId }).count({ count: 'id' }).first();
    const graduates = await kdb('students').where({ tenant_id: tenantId, is_graduate: 1 }).where('status', '!=', 'archived').count({ count: 'id' }).first();
    const occupancy = await kdb('rooms').where({ tenant_id: tenantId }).select(kdb.raw("SUM(capacity) as total, SUM(current_occupancy) as [current]")).first() as any;
    const warnings = await kdb('student_warnings').where({ tenant_id: tenantId }).count({ count: 'id' }).first();
    const reports = await kdb('complaints').where({ tenant_id: tenantId, status: 'pending' }).count({ count: 'id' }).first();

    // إحصائيات المباني
      const buildings = await kdb('apartments')
      .where({ tenant_id: tenantId })
      .select('name', 'id')
      .then(async (apts) => {
        return Promise.all(apts.map(async (a) => {
          const sCount = await kdb('students as s')
            .join('rooms as r', 's.room_id', 'r.id')
            .where('r.apartment_id', a.id)
            .count<{ count: number }>('s.id as count').first();
          const emptyBeds = await kdb('rooms').where({ apartment_id: a.id }).select(kdb.raw("SUM(capacity - current_occupancy) as empty")).first() as any;
          return {
            name: a.name,
            studentCount: Number(sCount?.count || 0),
            emptyBeds: Number(emptyBeds?.empty || 0),
            responsibleName: a.manager_name || "لم يعين"
          };
        }));
      });

    res.json({
      success: true,
      data: {
        totalStudents: Number(students?.count || 0),
        graduatesCount: Number(graduates?.count || 0),
        emptyBeds: Number((occupancy?.total || 0) - (occupancy?.current || 0)),
        activeWarnings: Number(warnings?.count || 0),
        pendingReports: Number(reports?.count || 0),
        occupancyRate: occupancy?.total ? Math.round((occupancy.current / occupancy.total) * 100) : 0,
        disciplineRate: 0, // Removed mock value
        buildings
      }
    });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 6. جلب مقترحات الفصل (طلاب لديهم إنذارات كثيرة)
router.get("/priest/expulsion-candidates", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
  try {
    const candidates = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .where({ 's.tenant_id': req.user.tenantId })
      .select(
        's.id', 
        'u.name', 
        's.created_at as suggestedAt', 
        kdb.raw('(SELECT COUNT(*) FROM student_warnings WHERE student_id = s.id) as warningCount'), 
        kdb.raw("'تجاوز الحد المسموح به من الإنذارات السلوكية (3 إنذارات فأكثر)' as reason")
      )
      .whereRaw('(SELECT COUNT(*) FROM student_warnings WHERE student_id = s.id) >= 3');

    res.json({ success: true, data: candidates });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 7. سجل الخريجين (الحاليون + المؤرشفون بسبب التخرج)
router.get("/priest/graduates", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
  try {
    const tenantIds: string[] = req.user.tenantIds?.length ? req.user.tenantIds : (req.user.tenantId ? [req.user.tenantId] : []);
    if (tenantIds.length === 0) return res.json({ success: true, data: [] });

    // 1) الخريجون الحاليون (is_graduate = 1)
    const currentGraduates = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .join('tenants as t', 's.tenant_id', 't.id')
      .whereIn('s.tenant_id', tenantIds)
      .where('s.is_graduate', 1)
      .select(
        's.id',
        'u.name as name',
        's.graduation_date as graduatedAt',
        's.university',
        's.college',
        's.major',
        's.governorate',
        't.name as tenant_name'
      )
      .orderBy('s.graduation_date', 'desc');

    // 2) الخريجون المؤرشفون (خروج بسبب التخرج)
    const archivedGraduates = await kdb('student_archive')
      .whereIn('tenant_id', tenantIds)
      .where('exit_reason', 'graduated')
      .select('id', 'student_name', 'exit_date', 'data_snapshot')
      .orderBy('exit_date', 'desc');

    const archivedMapped = archivedGraduates.map((a: any) => {
      let snap: any = { student: {} };
      try { snap = JSON.parse(a.data_snapshot || "{}") || { student: {} }; } catch {}
      const st: any = snap.student || {};
      return {
        id: `arc_${a.id}`,
        name: st.student_real_name || a.student_name.replace(/ \(\d+\)$/, ''),
        graduatedAt: a.exit_date,
        university: st.university || '',
        college: st.college || '',
        major: st.major || '',
        governorate: st.governorate || '',
        tenant_name: '',
        status: 'archived',
      };
    });

    const merged = [
      ...currentGraduates.map((g: any) => ({ ...g, status: 'current' })),
      ...archivedMapped,
    ].sort((a: any, b: any) => new Date(b.graduatedAt || 0).getTime() - new Date(a.graduatedAt || 0).getTime());

    res.json({ success: true, data: merged });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// ������/��� ����� ��� ���� �� ��� ���� ������
router.post("/priest/expulsion-candidates/:id/approve", authenticate, authorizePermission(AppPermission.MANAGE_PRIEST_REPORTS), async (req, res) => {
  try {
    const { id } = req.params;
    await kdb('students').where({ id, tenant_id: req.user.tenantId }).update({ status: 'expelled' });
    res.json({ success: true, message: '�� ������ ��� ������ �����' });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

router.post("/priest/expulsion-candidates/:id/reject", authenticate, authorizePermission(AppPermission.MANAGE_PRIEST_REPORTS), async (req, res) => {
  try {
    res.json({ success: true, message: '�� ��� ����� �����' });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 8. اعتماد تقرير من قبل الأب الكاهن
router.post("/priest/reports/:id/approve", authenticate, authorizePermission(AppPermission.MANAGE_PRIEST_REPORTS), async (req, res) => {
  try {
    await kdb('complaints').where({ id: req.params.id, tenant_id: req.user.tenantId }).update({ status: 'approved' });
    res.json({ success: true, message: 'تم اعتماد التقرير بنجاح' });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 9. البلاغات الموجهة للأب المسؤول
router.get("/priest/reports", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
  try {
    const reports = await kdb('complaints as c')
      .join('users as u', 'c.user_id', 'u.id')
      .where({ 'c.tenant_id': req.user.tenantId, 'c.status': 'pending' })
      .select('c.id', 'c.title', 'c.description', 'c.created_at as createdAt', 'u.name as supervisorName', kdb.raw("'warning' as type"))
      .orderBy('c.created_at', 'desc');
    res.json({ success: true, data: reports });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 10. سجل سلوك الطلاب للأب الكاهن (نقاط + تحذيرات)
router.get("/priest/discipline", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const students = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('student_warnings as sw', function() {
        this.on('s.id', '=', 'sw.student_id').andOnVal('sw.status', '=', 'active');
      })
      .leftJoin('student_points as sp', function() {
        this.on('s.id', '=', 'sp.student_id')
          .andOn(kdb.raw("sp.created_at >= DATEADD(month, -1, GETDATE())"));
      })
      .where('s.tenant_id', tenantId)
      .select(
        's.id', 'u.name',
        kdb.raw("COALESCE(SUM(sp.amount), 0) as points"),
        kdb.raw("COUNT(DISTINCT sw.id) as active_warnings"),
        kdb.raw("SUM(CASE WHEN sw.level IN ('high', 'critical') THEN 1 ELSE 0 END) as critical_warnings"),
        kdb.raw("(SELECT TOP 1 created_at FROM student_warnings WHERE student_id = s.id ORDER BY created_at DESC) as last_warning_date")
      )
      .groupBy('s.id', 'u.name')
      .orderBy('points', 'desc');

    res.json({ success: true, data: students });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 11. تفاصيل الإنذارات النشطة
router.get("/priest/warnings", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
  try {
    const warnings = await kdb('student_warnings as sw')
      .join('students as s', 'sw.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .where({ 'sw.tenant_id': req.user.tenantId, 'sw.status': 'active' })
      .select(
        'sw.id', 'sw.level', 'sw.reason', 'sw.created_at',
        'u.name as student_name', 'sw.notify_priest', 'sw.notify_parent'
      )
      .orderBy('sw.created_at', 'desc');

    res.json({ success: true, data: warnings });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 12. رفع تقرير من الأب الكاهن للأسقف
router.post("/priest/send-report", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
  try {
    const { title, description, type } = req.body;
    const id = require('uuid').v4();
    await kdb('priest_reports').insert({
      id,
      tenant_id: req.user.tenantId,
      title,
      description,
      type: type || 'general',
      supervisor_id: req.user.id,
      status: 'pending',
      created_at: new Date()
    });
    res.json({ success: true, message: 'تم رفع التقرير للأسقف بنجاح' });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// 13. بيانات الأسقف المشرف (لإرسال التقارير)
router.get("/priest/bishop-info", authenticate, authorizePermission(AppPermission.VIEW_PRIEST_DASHBOARD), async (req, res) => {
  try {
    const tenant = await kdb('tenants').where({ id: req.user.tenantId }).select('bishop_id').first();
    if (!tenant || !tenant.bishop_id) return res.json({ success: true, data: null });

    const bishop = await kdb('users').where({ id: tenant.bishop_id }).select('name', 'email').first();
    res.json({ success: true, data: bishop });
  } catch (error: any) { res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." }); }
});

// قراءات اليوم - تجلب من API قطمارس
router.get("/daily-readings", authenticate, async (req, res) => {
  try {
    const user = await kdb('users').where({ id: req.user.id }).select('daily_readings_enabled', 'tenant_id').first();
    if (!user || !user.daily_readings_enabled) {
      return res.json({ success: true, data: { enabled: false } });
    }

    const result = await fetchDailyReadings();

    return res.json({
      success: true,
      data: {
        enabled: true,
        date: result.date,
        copticDate: result.copticDate,
        bibleVerse: result.bibleVerse,
        gospelOfTheDay: result.gospelOfTheDay,
        synaxarium: result.synaxarium,
        readings: result.readings,
      }
    });
  } catch (error: any) {
    console.error('daily-readings error:', error?.message || error);
    res.status(500).json({ success: false, message: "حدث خطأ في الخادم: " + (error?.message || 'خطأ غير معروف') });
  }
});

// 1. ملخص بيانات الطالب
router.get("/student-summary", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // جلب حالة الحضور اليوم
    const attendance = await kdb('attendance')
      .join('students as s', 'attendance.student_id', 's.id')
      .where({ 's.user_id': userId })
      .andWhereRaw("CAST(attendance.created_at AS DATE) = ?", [today])
      .first();

    // جلب إحصائيات البلاغات الفنية
    const maintenance = await kdb('maintenance_requests')
      .where({ requester_id: userId })
      .andWhereNot('status', 'completed')
      .count({ count: 'id' })
      .first();

    // جلب رصيد النقاط
    const points = await kdb('student_points as sp')
      .join('students as s', 'sp.student_id', 's.id')
      .where({ 's.user_id': userId })
      .sum<{ total: number }>('sp.amount as total')
      .first();

    // جلب معرف الطالب الحالي للمقارنة في طابور المغسلة
    const studentRecord = await kdb('students').where({ user_id: userId }).first();
    const studentId = studentRecord?.id;

    // جلب حالة المغسلة (الطابور)
    let queue: any[] = [];
    try {
      queue = await kdb('laundry_queue')
        .where({ tenant_id: req.user.tenantId })
        .whereIn('status', ['waiting', 'called'])
        .orderBy('created_at', 'asc')
        .select('student_id', 'status');
    } catch {
      queue = await kdb('laundry_queue')
        .where({ tenant_id: req.user.tenantId })
        .whereIn('status', ['waiting', 'called'])
        .select('student_id', 'status');
    }

    const now = new Date();
    // جلب الإعلانات النشطة للطالب مع احترام الجدولة
    const broadcasts = await kdb('broadcasts')
      .where({ tenant_id: req.user.tenantId, is_active: 1 })
      .andWhere('start_at', '<=', now)
      .andWhere(function() {
        this.whereNull('end_at').orWhere('end_at', '>=', now);
      })
      .whereIn('target_audience', ['students', 'both'])
      .select('id', 'title', 'message', 'display_location')
      .orderBy('created_at', 'desc');

    const tickerBroadcasts = broadcasts.filter(b => b.display_location === 'ticker');
    const dailyMessages = broadcasts.filter(b => b.display_location === 'daily_message');

    const userInQueue = queue.find(q => q.student_id === studentId);
    const userPosition = userInQueue ? queue.indexOf(userInQueue) + 1 : null;

    res.json({
      success: true,
      data: {
        attendanceStatus: attendance?.type || 'لم يتم التسجيل',
        lastCheckIn: attendance?.created_at || null,
        activeMaintenance: Number(maintenance?.count || 0),
        totalPoints: Number(points?.total || 0),
        laundry: {
          totalInQueue: queue.length,
          userPosition: userPosition,
          status: userInQueue?.status || null
        },
        broadcasts: tickerBroadcasts,
        dailyMessages
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// 2. ملخص بيانات ولي الأمر
router.get("/parent-summary/:studentId", authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // التأكد من أن الطالب مرتبط بولي الأمر (Security Check عبر جدول الأوصياء الفعلي)
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin) {
      const guardianRow = await kdb('student_guardians as sg')
        .join('parents as p', 'sg.guardian_id', 'p.id')
        .where('sg.student_id', studentId)
        .where('p.user_id', req.user.id)
        .first();
      if (!guardianRow) {
        return res.status(403).json({ success: false, message: "Unauthorized access to child data" });
      }
    }

    // جلب ملخص مالي
    const finance = await kdb('finances')
      .where({ student_id: studentId })
      .select(
        kdb.raw("SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END) as total_paid"),
        kdb.raw("SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_debts")
      ).first() as any;

    const now = new Date();
    // جلب الإعلانات النشطة الموجهة لأولياء الأمور
    const dailyMessages = await kdb('broadcasts')
      .where({ tenant_id: req.user.tenantId, is_active: 1 })
      .andWhere('start_at', '<=', now)
      .andWhere(function() {
        this.whereNull('end_at').orWhere('end_at', '>=', now);
      })
      .whereIn('target_audience', ['parents', 'both'])
      .andWhere({ display_location: 'daily_message' })
      .orderBy('created_at', 'desc');

    // جلب آخر 5 سجلات حضور
    const history = await kdb('attendance')
      .where({ student_id: studentId })
      .orderBy('created_at', 'desc')
      .limit(5);

    res.json({
      success: true,
      data: {
        financials: {
          paid: Number(finance?.total_paid || 0),
          pending: Number(finance?.total_debts || 0)
        },
        attendanceHistory: history,
        dailyMessages
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
