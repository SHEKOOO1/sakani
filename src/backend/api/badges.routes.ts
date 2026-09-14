import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission, computeUserTenantIds } from "./middleware";
import { checkUserPermission } from "../infrastructure/db";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

// التحقق من أن الشارة تنتمي لسكن من سكنات المستخدم الحالي
const canAccessBadge = async (req: any, badge: any): Promise<boolean> => {
  if (req.user.role === 'admin') return true;
  if (!badge?.tenant_id) return true;
  const allowed = await computeUserTenantIds(req.user);
  return allowed.includes(badge.tenant_id);
};

// List all badges (admin sees all, others see their tenant's)
router.get("/", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { category } = req.query;
  try {
    let query = kdb('badges').orderBy('created_at', 'desc');
    if (req.user.role !== 'admin') {
      query = query.where(function () {
        this.where({ tenant_id: tenantId }).orWhereNull('tenant_id');
      });
    }
    if (category) query = query.where({ category });
    const badges = await query;
    res.json({ success: true, data: badges });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Create badge
router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_REWARDS), async (req, res) => {
  const { title, description, icon, color, category } = req.body;
  const tenantId = req.user.tenantId;
  const id = uuidv4();
  try {
    await kdb('badges').insert({
      id, tenant_id: tenantId, title, description, icon: icon || 'Award', color: color || 'amber', category: category || 'housing',
      created_by: req.user.id,
    });
    res.status(201).json({ success: true, data: { id, title } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Update badge
router.put("/:id", authenticate, authorizePermission(AppPermission.MANAGE_REWARDS), async (req, res) => {
  const { id } = req.params;
  const { title, description, icon, color, category } = req.body;
  try {
    const badge = await kdb('badges').where({ id }).first();
    if (!badge) return res.status(404).json({ success: false, message: 'Badge not found' });
    if (!await canAccessBadge(req, badge)) return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    const result = await kdb('badges').where({ id }).update({ title, description, icon, color, category });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Delete badge
router.delete("/:id", authenticate, authorizePermission(AppPermission.MANAGE_REWARDS), async (req, res) => {
  const { id } = req.params;
  try {
    const badge = await kdb('badges').where({ id }).first();
    if (!badge) return res.status(404).json({ success: false, message: 'Badge not found' });
    if (!await canAccessBadge(req, badge)) return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    await kdb('student_badges').where({ badge_id: id }).del();
    await kdb('badges').where({ id }).del();
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Assign badge to students
router.post("/assign", authenticate, authorizePermission(AppPermission.MANAGE_REWARDS), async (req, res) => {
  const { badgeId, studentIds, reason } = req.body;
  try {
    const badge = await kdb('badges').where({ id: badgeId }).first();
    if (!badge) return res.status(404).json({ success: false, message: "الشارة غير موجودة" });
    if (!await canAccessBadge(req, badge)) return res.status(403).json({ success: false, message: "لا يمكنك استخدام هذه الشارة" });

    await kdb.transaction(async trx => {
      for (const studentId of studentIds) {
        // الطلاب المستهدفون يجب أن يكونوا ضمن سكنات المستخدم الحالي
        const student = await trx('students').select('tenant_id').where({ id: studentId }).first();
        if (!student) throw new Error("أحد الطلاب غير موجود");
        if (req.user.role !== 'admin') {
          const allowed = await computeUserTenantIds(req.user);
          if (student.tenant_id && !allowed.includes(student.tenant_id)) throw new Error("أحد الطلاب ليس ضمن سكنك");
          if (badge.tenant_id && !allowed.includes(badge.tenant_id)) throw new Error("الشارة ليست ضمن سكنك");
        }
        await trx('student_badges').insert({
          id: uuidv4(),
          student_id: studentId,
          badge_id: badgeId,
          awarded_by: req.user.id,
          reason: reason || null,
        });
      }
    });
    res.json({ success: true, message: "تم منح الشارة بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// ��� ���� ����� (����� �����)
router.post("/grant", authenticate, authorizePermission(AppPermission.MANAGE_REWARDS), async (req, res) => {
  const { studentId, badgeName, pointsBonus } = req.body;
  try {
    const student = await kdb('students').select('tenant_id').where({ id: studentId }).first();
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });
    if (req.user.role !== 'admin' && student.tenant_id) {
      const allowed = await computeUserTenantIds(req.user);
      if (!allowed.includes(student.tenant_id)) {
        return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكنك" });
      }
    }
    await kdb.transaction(async trx => {
      const badge = await trx('badges').where({ title: badgeName, tenant_id: req.user.tenantId }).first();
      if (!badge) return res.status(404).json({ success: false, message: "������ ��� �����" });

      await trx('student_badges').insert({
        id: uuidv4(),
        student_id: studentId,
        badge_id: badge.id,
        awarded_by: req.user.id,
        reason: pointsBonus ? `��� �� ${pointsBonus} ���� ������` : null,
      });

      if (pointsBonus) {
        await trx('student_points').insert({
          id: uuidv4(),
          tenant_id: req.user.tenantId,
          student_id: studentId,
          amount: pointsBonus,
          reason: `���� ������ �� ����: ${badgeName}`,
          category: 'badge_bonus',
          created_by: req.user.id
        });
      }
    });
    res.json({ success: true, message: "�� ��� ������ �����" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Get badges for a student (with category grouping)
router.get("/student/:studentId", authenticate, async (req, res) => {
  const { studentId } = req.params;
  const role = req.user.role;
  const userId = req.user.id;
  try {
    const student = await kdb('students').select('tenant_id', 'user_id').where({ id: studentId }).first();
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

    // الطالب نفسه أو ولي أمره أو مشرف/كاهن ضمن سكنه فقط
    if (role === 'student') {
      if (student.user_id !== userId) return res.status(403).json({ success: false, message: "لا يمكنك عرض شارات طالب آخر" });
    } else if (role === 'parent') {
      const parent = await kdb('parents').select('id').where({ user_id: userId }).first();
      const isChild = parent ? await kdb('student_guardians').where({ guardian_id: parent.id, student_id: studentId }).first() : null;
      if (!isChild) return res.status(403).json({ success: false, message: "لا يمكنك عرض شارات هذا الطالب" });
    } else if (!['admin', 'bishop', 'supervisor', 'assistant_supervisor', 'priest'].includes(role)) {
      return res.status(403).json({ success: false, message: "غير مصرح بالوصول" });
    } else if (student.tenant_id && (await computeUserTenantIds(req.user)).includes(student.tenant_id) === false) {
      return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكنك" });
    }

    const studentBadges = await kdb('student_badges as sb')
      .join('badges as b', 'sb.badge_id', 'b.id')
      .join('users as u', 'sb.awarded_by', 'u.id')
      .select('sb.*', 'b.title', 'b.description', 'b.icon', 'b.color', 'b.category', 'b.tenant_id as badge_tenant_id', 'u.name as awarded_by_name')
      .where('sb.student_id', studentId)
      .orderBy('sb.awarded_at', 'desc');
    res.json({ success: true, data: studentBadges });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Get badges for current user (student)
router.get("/my", authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const student = await kdb('students').select('id').where({ user_id: userId }).first();
    if (!student) return res.json({ success: true, data: [] });
    const studentBadges = await kdb('student_badges as sb')
      .join('badges as b', 'sb.badge_id', 'b.id')
      .join('users as u', 'sb.awarded_by', 'u.id')
      .select('sb.*', 'b.title', 'b.description', 'b.icon', 'b.color', 'b.category', 'b.tenant_id as badge_tenant_id', 'u.name as awarded_by_name')
      .where('sb.student_id', student.id)
      .orderBy('sb.awarded_at', 'desc');
    res.json({ success: true, data: studentBadges });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Unassign badge
router.delete("/assign/:id", authenticate, authorizePermission(AppPermission.MANAGE_REWARDS), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  try {
    const record = await kdb('student_badges as sb')
      .join('badges as b', 'sb.badge_id', 'b.id')
      .where('sb.id', id)
      .where('b.tenant_id', tenantId)
      .select('sb.id')
      .first();
    if (!record) return res.status(404).json({ success: false, message: 'Badge assignment not found' });
    await kdb('student_badges').where({ id }).del();
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل الحذف. تأكد من صحة البيانات وحاول مرة أخرى." });
  }
});

export default router;
