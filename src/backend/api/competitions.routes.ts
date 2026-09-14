import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission, requireItemAccess, canManageItem, computeUserTenantIds } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { validate } from "../validation/middleware";
import { createCompetitionSchema, updateCompetitionStatusSchema, createCompetitionTeamSchema, scoreTeamSchema, finishCompetitionSchema } from "../validation/schemas";

const router = express.Router();

// Get competitions
router.get("/", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { role } = req.user;
  try {
    let competitions: any[];
    if (role === 'admin') {
      // Admin sees only global competitions
      competitions = await kdb('competitions').whereNull('tenant_id').orderBy('created_at', 'desc');
    } else if (tenantId) {
      // Tenant staff see their own + global competitions
      competitions = await kdb('competitions')
        .where(function () {
          this.where({ tenant_id: tenantId }).orWhereNull('tenant_id');
        })
        .orderBy('created_at', 'desc');
    } else {
      competitions = [];
    }
    // Per-item manager flag (used by the UI to grant control to assigned managers)
    competitions = await Promise.all(competitions.map(async (c: any) => ({
      ...c,
      canManage: await canManageItem(req.user, 'competition', c.id),
    })));
    res.json({ success: true, data: competitions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Create competition
router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_COMPETITIONS), validate(createCompetitionSchema), async (req, res) => {
  const { title, description, startDate, endDate, prizePoints, questionsCount = 0, responsibleId = null } = req.body;
  const tenantId = req.user.tenantId;

  const id = uuidv4();
  try {
    await kdb('competitions').insert({
        id,
        tenant_id: tenantId,
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        prize_points: prizePoints,
        questions_count: questionsCount,
        responsible_id: responsibleId,
        created_by: req.user.id,
        status: 'draft'
    });
    res.json({ success: true, data: { id, title } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Update status
router.patch("/:id/status", authenticate, requireItemAccess('competition', AppPermission.MANAGE_COMPETITIONS), validate(updateCompetitionStatusSchema), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const tenantId = req.user.tenantId;

  try {
    await kdb('competitions').where({ id, tenant_id: tenantId }).update({ status });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Join competition
router.post("/:id/join", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
      const student = await kdb('students').select('id', 'tenant_id').where({ user_id: userId }).first();
      if (!student) return res.status(403).json({ success: false, message: "Only students can join" });

      // لا يجوز لطالب الانضمام لمسابقة في سكن آخر
      const comp = await kdb('competitions').where({ id }).first();
      if (!comp) return res.status(404).json({ success: false, message: "المسابقة غير موجودة" });
      if (comp.tenant_id && comp.tenant_id !== student.tenant_id) {
        return res.status(403).json({ success: false, message: "هذه المسابقة ليست ضمن سكنك" });
      }

      await kdb('competition_participants').insert({ competition_id: id, student_id: student.id });
      res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: "Already joined or competition not found" });
  }
});

// Teams management
router.post("/:id/teams", authenticate, requireItemAccess('competition', AppPermission.MANAGE_COMPETITIONS), validate(createCompetitionTeamSchema), async (req, res) => {
    const { id: competitionId } = req.params;
    const { name, responsibleId, studentIds = [] } = req.body;
    const tenantId = req.user.tenantId;
    const teamId = uuidv4();

    try {
        await kdb.transaction(async trx => {
            // منع إضافة طلاب من سكنات أخرى للفريق (عزل البيانات بين السكنات)
            if (studentIds.length > 0) {
                const members = await trx('students').whereIn('id', studentIds).select('id', 'tenant_id');
                if (members.length !== studentIds.length) {
                    throw new Error("أحد الطلاب غير موجود");
                }
                for (const m of members) {
                    if (m.tenant_id !== tenantId) {
                        throw new Error(`الطالب ${m.id} ليس ضمن سكنك`);
                    }
                }
            }
            await trx('competition_teams').insert({
                id: teamId,
                competition_id: competitionId,
                tenant_id: tenantId,
                name,
                responsible_id: responsibleId
            });

            if (studentIds.length > 0) {
                for (const sid of studentIds) {
                    await trx('competition_team_members').insert({ team_id: teamId, student_id: sid });
                }
            }
        });
        res.json({ success: true, data: { id: teamId } });
    } catch (err: any) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.get("/:id/teams", authenticate, async (req, res) => {
    const { id: competitionId } = req.params;
    try {
        const comp = await kdb('competitions').select('tenant_id').where({ id: competitionId }).first();
        if (!comp) return res.status(404).json({ success: false, message: "المسابقة غير موجودة" });
        if (comp.tenant_id && req.user.role !== 'admin') {
          const allowed = await computeUserTenantIds(req.user);
          if (!allowed.includes(comp.tenant_id)) return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
        }
        const teams = await kdb('competition_teams as ct')
            .leftJoin('users as u', 'ct.responsible_id', 'u.id')
            .select('ct.*', 'u.name as responsible_name')
            .where('ct.competition_id', competitionId);
        
        // Enrich with members
        const enrichedTeams = await Promise.all(teams.map(async (t: any) => {
            const members = await kdb('competition_team_members as tm')
                .join('students as s', 'tm.student_id', 's.id')
                .join('users as u', 's.user_id', 'u.id')
                .select('tm.*', 'u.name as student_name')
                .where('tm.team_id', t.id);
            return { ...t, members };
        }));

        res.json({ success: true, data: enrichedTeams });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update score for individual student in a team
router.post(
  "/teams/:teamId/members/:studentId/score",
  authenticate,
  requireItemAccess('competition', AppPermission.MANAGE_COMPETITIONS, async (req) => {
    const team = await kdb('competition_teams').where({ id: (req.params as any).teamId }).first();
    return team ? team.competition_id : null;
  }),
  async (req, res) => {
  const { teamId, studentId } = req.params;
  const { points } = req.body;
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async trx => {
      const team = await trx('competition_teams').where({ id: teamId }).first();
      if (!team) throw new Error("Team not found");

      await trx('competition_team_members')
        .where({ team_id: teamId, student_id: studentId })
        .increment('points_earned', points);

      await trx('student_points').insert({
        id: uuidv4(),
        tenant_id: tenantId,
        student_id: studentId,
        amount: points,
        reason: `���� ������ �������: ${team.name}`,
        category: 'competition',
        created_by: req.user.id
      });
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update team score and distribute points
router.post(
  "/teams/:teamId/score",
  authenticate,
  requireItemAccess('competition', AppPermission.MANAGE_COMPETITIONS, async (req) => {
    const team = await kdb('competition_teams').where({ id: (req.params as any).teamId }).first();
    return team ? team.competition_id : null;
  }),
  validate(scoreTeamSchema),
  async (req, res) => {
    const { teamId } = req.params;
    const { points } = req.body;
    const tenantId = req.user.tenantId;

    try {
        await kdb.transaction(async trx => {
            const team = await trx('competition_teams').where({ id: teamId }).first();
            if (!team) throw new Error("Team not found");

            await trx('competition_teams').where({ id: teamId }).increment('score', points);

            const members = await trx('competition_team_members').select('student_id').where({ team_id: teamId });
            
            for (const m of members) {
                await trx('competition_team_members')
                    .where({ team_id: teamId, student_id: m.student_id })
                    .increment('points_earned', points);
                
                await trx('student_points').insert({
                    id: uuidv4(),
                    tenant_id: tenantId,
                    student_id: m.student_id,
                    amount: points,
                    reason: `نقاط الفريق بمسابقة: ${team.name}`,
                    category: 'competition',
                    created_by: req.user.id
                });
            }
        });
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// Delete a competition (creator can delete, or tenant supervisor/priest/bishop, or requires MANAGE_COMPETITIONS)
router.delete("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const comp = await kdb('competitions').where({ id }).first();
    if (!comp) return res.status(404).json({ success: false, message: "المسابقة غير موجودة" });

    const isCreator = comp.created_by && comp.created_by.toLowerCase() === req.user.id.toLowerCase();
    if (!isCreator) {
      // مدير التطبيق أو أسقف يملك صلاحيات مؤسسة
      const isAdminOrBishop = req.user.role === 'admin' || req.user.role === 'bishop';
      if (!isAdminOrBishop || (req.user.role === 'bishop' && comp.tenant_id)) {
        // ليس مدير تطبيق: يجب أن تكون المسابقة ضمن سكنات المستخدم أو يديرها كمُعين
        const allowedIds = await computeUserTenantIds(req.user);
        const inScope = comp.tenant_id ? allowedIds.includes(comp.tenant_id) : false;
        if (!inScope) {
          const isManager = await canManageItem(req.user, 'competition', id);
          if (!isManager) {
            return res.status(403).json({ success: false, message: "ليس لديك صلاحية حذف هذه المسابقة" });
          }
        } else {
          const isStaff = ['priest', 'supervisor', 'assistant_supervisor'].includes(req.user.role);
          if (!isStaff) {
            return res.status(403).json({ success: false, message: "ليس لديك صلاحية حذف هذه المسابقة" });
          }
        }
      }
    }

    const compTables = ['competition_participants', 'competition_team_members', 'competition_teams'];
    await kdb.transaction(async trx => {
      for (const table of compTables) {
        try {
          if (table === 'competition_team_members') {
            const teamIds = await trx('competition_teams').where({ competition_id: id }).select('id');
            for (const t of teamIds) {
              await trx(table).where({ team_id: t.id }).del();
            }
          } else {
            await trx(table).where({ competition_id: id }).del();
          }
        } catch (e: any) {
          console.warn(`[DeleteCompetition] Skipping table "${table}": ${e?.message}`);
        }
      }
      await trx('competitions').where({ id }).del();
    });
    res.json({ success: true, message: "تم حذف المسابقة وكل بياناتها بنجاح" });
  } catch (error: any) {
    console.error('Delete competition error:', error);
    res.status(400).json({ success: false, message: "فشل الحذف. ربما لا تملك صلاحية أو أن المسابقة غير موجودة." });
  }
});

// Finish competition and distribute points
router.post("/:id/finish", authenticate, requireItemAccess('competition', AppPermission.MANAGE_COMPETITIONS), validate(finishCompetitionSchema), async (req, res) => {
  const { id } = req.params;
  const { winners } = req.body; // Changed from winnerIds to winners to match frontend
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async trx => {
      const comp = await trx('competitions').where({ id, tenant_id: tenantId }).first();
      if (!comp) throw new Error("Competition not found");

      await trx('competitions').where({ id }).update({ status: 'finished' });

      if (winners && Array.isArray(winners)) {
        for (const studentId of winners) {
          await trx('student_points').insert({
            id: uuidv4(),
            tenant_id: tenantId,
            student_id: studentId,
            amount: comp.prize_points,
            reason: `فوز بمسابقة: ${comp.title}`,
            category: 'competition',
            created_by: req.user.id
          });
        }
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
