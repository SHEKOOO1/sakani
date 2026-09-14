import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../../infrastructure/db";
import { invalidateUserPermissionCache } from "../../infrastructure/cache";
import { authenticate, authorizePermission, sanitizeInput, computeUserTenantIds } from "../middleware";
import { AppPermission } from "../../../types/permissions";
import { upload, validateMagicBytes } from "../../middleware/upload";
import { StudentController } from '../student.controller';

const router = express.Router();

// التحقق من أن الموظف المستهدف ضمن سكنات المستخدم الحالي (لمنع منح الصلاحيات عبر سكنات)
const canManageEmployee = async (req: any, employeeId: string): Promise<boolean> => {
  const employee = await kdb('users').where('id', employeeId).first();
  if (!employee) return false;
  if (req.user.role === 'admin') return true;
  if (employee.role === 'admin' || employee.role === 'bishop') return false;
  if (!employee.tenant_id) return true;
  const allowedIds = await computeUserTenantIds(req.user);
  if (allowedIds.includes(employee.tenant_id)) return true;
  const assignments = await kdb('user_tenant_assignments')
    .where({ user_id: employee.id })
    .select('tenant_id');
  return assignments.some((a: any) => allowedIds.includes(a.tenant_id));
};

// Travel Start
router.post("/travel/start", authenticate, async (req, res) => {
  const { destination, reason } = req.body;
  const userId = req.user.id;
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async trx => {
      const student = await trx('students').select('id').where({ user_id: userId }).first();
      if (!student) throw new Error("Student record not found");

      // Update student travel status
      await trx('students').where({ id: student.id }).update({
          is_traveling: 1, travel_destination: destination, travel_reason: reason, travel_start_time: kdb.fn.now()
      });

      // إلغاء أي دور حالي للطالب في طابور الغسيل تلقائياً
      await trx("laundry_queue")
        .where({ student_id: student.id, tenant_id: tenantId })
        .whereIn('status', ['waiting', 'called'])
        .update({ status: 'cancelled', finished_at: kdb.fn.now() });

      const user = await trx('users').select('name').where({ id: userId }).first();

      const supervisors = await trx('user_tenant_assignments as uta')
        .join('users as u', 'uta.user_id', 'u.id')
        .where('uta.tenant_id', tenantId)
        .where('u.role', 'supervisor')
        .select('uta.user_id');

      const now = new Date();
      const message = `قام الطالب ${user.name} بالسفر من السكن يوم ${new Date().toLocaleDateString('ar-EG')} في تمام الساعة ${new Date().toLocaleTimeString('ar-EG')}. الوجهة: ${destination}. السبب: ${reason}`;

      for (const sup of supervisors) {
        await trx('notifications').insert({
          id: uuidv4(),
          user_id: sup.user_id,
          tenant_id: tenantId,
          title: "إخطار سفر طالب",
          message,
          type: "warning"
        });
      }

      const parentUsers = await trx('student_guardians as sg')
        .join('parents as p', 'sg.guardian_id', 'p.id')
        .join('users as u', 'p.user_id', 'u.id')
        .where('sg.student_id', student.id)
        .select('u.id');

      for (const p of parentUsers) {
        await trx('notifications').insert({
          id: uuidv4(),
          user_id: p.id,
          tenant_id: tenantId,
          title: "سفر ابنكم من السكن",
          message,
          type: "info"
        });
      }
    });

    res.json({ success: true, message: "تم تسجيل السفر بنجاح وإرسال الإشعارات" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Travel End (Return)
router.post("/travel/end", authenticate, async (req, res) => {
  const userId = req.user.id;
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async trx => {
      const student = await trx('students').select('id').where({ user_id: userId }).first();
      if (!student) throw new Error("Student record not found");

      // Update student travel status
      await trx('students').where({ id: student.id }).update({
          is_traveling: 0, travel_destination: null, travel_reason: null, travel_start_time: null
      });

      const user = await trx('users').select('name').where({ id: userId }).first();
      const message = `عاد الطالب ${user.name} إلى السكن يوم ${new Date().toLocaleDateString('ar-EG')} في تمام الساعة ${new Date().toLocaleTimeString('ar-EG')}.`;

      // Notify supervisors
      const supervisors = await trx('user_tenant_assignments as uta')
        .join('users as u', 'uta.user_id', 'u.id')
        .where('uta.tenant_id', tenantId)
        .where('u.role', 'supervisor')
        .select('uta.user_id');

      for (const sup of supervisors) {
        await trx('notifications').insert({
          id: uuidv4(),
          user_id: sup.user_id,
          tenant_id: tenantId,
          title: "عودة طالب من السفر",
          message,
          type: "info"
        });
      }

      // Notify parents
      const parentUsers = await trx('student_guardians as sg')
        .join('parents as p', 'sg.guardian_id', 'p.id')
        .join('users as u', 'p.user_id', 'u.id')
        .where('sg.student_id', student.id)
        .select('u.id');

      for (const p of parentUsers) {
        await trx('notifications').insert({
          id: uuidv4(),
          user_id: p.id,
          tenant_id: tenantId,
          title: "عودة ابنكم إلى السكن",
          message,
          type: "info"
        });
      }
    });

    res.json({ success: true, message: "تم تسجيل العودة بنجاح وإرسال الإشعارات" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Supervisor grants employee permission to manage students (add/edit)
router.post("/employee-permission", authenticate, authorizePermission(AppPermission.MANAGE_EMPLOYEES), async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId is required' });

  try {
    const employee = await kdb('users').where('id', employeeId).first();
    if (!employee) return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    if (employee.role !== 'employee') return res.status(400).json({ success: false, message: 'المستخدم ليس موظفاً' });
    if (!(await canManageEmployee(req, employeeId))) {
      return res.status(403).json({ success: false, message: 'لا تملك صلاحية إدارة هذا الموظف' });
    }

    const currentPerms: string[] = employee.custom_permissions
      ? JSON.parse(employee.custom_permissions)
      : [];
    const newPerms = [...new Set([...currentPerms, AppPermission.ADD_STUDENT, AppPermission.EDIT_STUDENT])];
    await kdb('users').where('id', employeeId).update({ custom_permissions: JSON.stringify(newPerms) });
    invalidateUserPermissionCache(employeeId);

    res.json({ success: true, message: 'تم منح الصلاحية للموظف' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Supervisor revokes employee permission to manage students
router.delete("/employee-permission/:employeeId", authenticate, authorizePermission(AppPermission.MANAGE_EMPLOYEES), async (req, res) => {
  const { employeeId } = req.params;
  try {
    const employee = await kdb('users').where('id', employeeId).first();
    if (!employee) return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    if (!(await canManageEmployee(req, employeeId))) {
      return res.status(403).json({ success: false, message: 'لا تملك صلاحية إدارة هذا الموظف' });
    }

    const currentPerms: string[] = employee.custom_permissions
      ? JSON.parse(employee.custom_permissions)
      : [];
    const newPerms = currentPerms.filter((p: string) => p !== AppPermission.ADD_STUDENT && p !== AppPermission.EDIT_STUDENT);
    await kdb('users').where('id', employeeId).update({ custom_permissions: JSON.stringify(newPerms) });
    invalidateUserPermissionCache(employeeId);

    res.json({ success: true, message: 'تم سحب الصلاحية من الموظف' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// جلب نتائج المسابقات للطالب الحالي
router.get("/competition-results", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    const student = await kdb('students').where({ user_id: userId, tenant_id: tenantId }).first();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const studentId = student.id;

    // 1. Find competitions the student participated in (via teams or direct join)
    const teamMemberships = await kdb('competition_team_members as ctm')
      .join('competition_teams as ct', 'ctm.team_id', 'ct.id')
      .select('ct.competition_id', 'ct.id as team_id', 'ct.name as team_name', 'ct.score as team_score')
      .where('ctm.student_id', studentId);

    // Event competitions live in their own tables (separated by migration 028)
    const eventTeamMemberships = await kdb('event_team_members as etm')
      .join('event_teams as et', 'etm.event_team_id', 'et.id')
      .select('et.event_id', 'et.id as team_id', 'et.name as team_name', 'et.score as team_score')
      .where('etm.student_id', studentId);

    const directJoins = await kdb('competition_participants')
      .select('competition_id')
      .where('student_id', studentId);

    const compIds = new Set<string>();
    for (const m of teamMemberships) compIds.add(m.competition_id);
    for (const m of eventTeamMemberships) compIds.add(m.event_id);
    for (const j of directJoins) compIds.add(j.competition_id);

    if (compIds.size === 0) return res.json({ success: true, data: [] });

    // 2. Get item details — standalone competitions + event competitions (separated data)
    const ids = [...compIds];
    const competitions = await kdb('competitions')
      .whereIn('id', ids)
      .andWhere('tenant_id', tenantId)
      .orderBy('created_at', 'desc');

    const events = (await kdb('events')
      .whereIn('id', ids)
      .where(function () {
        this.whereNull('tenant_id').orWhere('tenant_id', tenantId);
      }))
      .map((e: any) => ({ ...e, status: e.competition_active ? 'active' : 'finished' }));

    const eventIds = new Set(events.map((e: any) => e.id));
    const compList: any[] = [...competitions, ...events].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // 3. For each competition, get full info
    const results = await Promise.all(compList.map(async (comp: any) => {
      const compId = comp.id;
      const isEvent = eventIds.has(compId);

      // Get all teams (event competitions use their own separated tables)
      const allTeams: any[] = isEvent
        ? await kdb('event_teams')
            .where({ event_id: compId })
            .orderBy('score', 'desc')
        : await kdb('competition_teams')
            .where({ competition_id: compId, tenant_id: tenantId })
            .orderBy('score', 'desc');

      // Effective score for event competitions = sum of criterion scores (event_teams.score is not maintained)
      let effectiveScores: Record<string, number> = {};
      if (isEvent && allTeams.length > 0) {
        const scoreRows = await kdb('event_scores')
          .select('team_id')
          .sum('score as total_score')
          .where({ event_id: compId })
          .groupBy('team_id');
        effectiveScores = Object.fromEntries(scoreRows.map((r: any) => [r.team_id, Number(r.total_score) || 0]));
      }

      // Get team members
      const teamsWithMembers = await Promise.all(allTeams.map(async (team: any) => {
        const members = isEvent
          ? await kdb('event_team_members as ctm')
              .join('students as s', 'ctm.student_id', 's.id')
              .join('users as u', 's.user_id', 'u.id')
              .select('ctm.student_id', 'u.name as member_name')
              .where('ctm.event_team_id', team.id)
          : await kdb('competition_team_members as ctm')
              .join('students as s', 'ctm.student_id', 's.id')
              .join('users as u', 's.user_id', 'u.id')
              .select('ctm.student_id', 'u.name as member_name')
              .where('ctm.team_id', team.id);

        // Get per-criterion scores for event-based competitions
        let criterionScores: any[] = [];
        if (isEvent) {
          const scores = await kdb('event_scores')
            .join('event_criteria as ec', 'event_scores.criterion_id', 'ec.id')
            .select('ec.id as criterion_id', 'ec.title as criterion_title', 'ec.max_score', kdb.raw('SUM(event_scores.score) as total_score'))
            .where('event_scores.event_id', compId)
            .andWhere('event_scores.team_id', team.id)
            .groupBy('ec.id', 'ec.title', 'ec.max_score')
            .orderBy('ec.id');

          criterionScores = scores.map((s: any) => ({
            criterion_id: s.criterion_id,
            criterion_title: s.criterion_title,
            max_score: s.max_score,
            score: Number(s.total_score)
          }));
        }

        return {
          id: team.id,
          name: team.name,
          score: isEvent ? (effectiveScores[team.id] ?? (Number(team.score) || 0)) : team.score,
          members,
          criterion_scores: criterionScores
        };
      }));

      // Rank teams
      const sorted = [...teamsWithMembers].sort((a, b) => b.score - a.score);
      const ranked = sorted.map((t, i) => ({ ...t, rank: i + 1 }));

      // Find student's team
      const myTeam = ranked.find(t => t.members.some((m: any) => m.student_id === studentId)) || null;

      // Determine wins/losses
      const myRank = myTeam?.rank ?? null;
      const totalTeams = ranked.length;

      return {
        competition_id: compId,
        title: comp.title,
        status: comp.status,
        is_event: isEvent,
        created_at: comp.created_at,
        total_teams: totalTeams,
        my_rank: myRank,
        my_team: myTeam,
        teams: ranked
      };
    }));

    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// تسجيل طالب جديد مع المستندات
router.post("/register-full", authenticate, authorizePermission(AppPermission.ADD_STUDENT), upload.array('docs'), validateMagicBytes, sanitizeInput, StudentController.register);

// تعيين غرفة للطالب
router.put("/:id/room", authenticate, authorizePermission(AppPermission.ASSIGN_ROOM), StudentController.updateRoom);

// تصدير بيانات الطالب PDF
router.get("/:id/export-pdf", authenticate, authorizePermission(AppPermission.VIEW_STUDENT), StudentController.exportPdf);

export default router;
