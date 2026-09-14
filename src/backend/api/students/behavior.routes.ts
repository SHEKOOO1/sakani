import express from "express";
import { kdb } from "../../infrastructure/db";
import { authenticate } from "../middleware";

const router = express.Router();

// جلب ملخص السلوك (النقاط والإندارات) للطالب الحالي
router.get("/behavior/my-summary", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    // جلب معرف الطالب المرتبط بحساب المستخدم
    const student = await kdb('students').where({ user_id: userId }).first();
    
    if (!student) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    // حساب إجمالي النقاط
    const pointsResult = await kdb('student_points')
      .where({ student_id: student.id })
      .sum('amount as total')
      .first();

    // حساب عدد الإندارات النشطة
    const warningsResult = await kdb('student_warnings')
      .where({ student_id: student.id, status: 'active' })
      .count('id as count')
      .first();

    res.json({
      success: true,
      data: {
        points: Number(pointsResult?.total || 0),
        activeWarnings: Number(warningsResult?.count || 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// جلب سجل تاريخ النقاط للطالب الحالي
router.get("/behavior/my-history", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await kdb('students').where({ user_id: userId }).first();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const history = await kdb('student_points')
      .where({ student_id: student.id })
      .select('id', 'student_id', 'tenant_id', 'amount as points', 'reason', 'category', 'created_by', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(10);

    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// جلب الإندارات النشطة للطالب الحالي
router.get("/behavior/my-warnings", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await kdb('students').where({ user_id: userId }).first();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const warnings = await kdb('student_warnings')
      .where({ student_id: student.id, status: 'active' })
      .orderBy('created_at', 'desc');

    res.json({ success: true, data: warnings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

export default router;
