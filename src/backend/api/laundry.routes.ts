import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb, checkUserPermission } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { createNotification } from "./notifications.routes";
import { logger } from "../infrastructure/logger.ts";
import { validate } from "../validation/middleware";
import { createMachineSchema, updateMachineStatusSchema, createOperatorSchema, laundrySettingsSchema, queueCallSchema, queueActionSchema } from "../validation/schemas";

const router = express.Router();

// Helper to get the Socket.io instance from app.locals
const getIo = () => {
  try {
    return (global as any).__io;
  } catch { return null; }
};

// 1. Machines Management
router.get("/machines", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const machines = await kdb('laundry_machines').where('tenant_id', tenantId);
    res.json({ success: true, data: machines });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/machines", authenticate, authorizePermission(AppPermission.MANAGE_LAUNDRY), validate(createMachineSchema), async (req, res) => {
  const { name, id } = req.body;
  const tenantId = req.user.tenantId;

  try {
    if (id) {
        const updated = await kdb('laundry_machines').where({ id, tenant_id: tenantId }).update({ name });
        if (!updated) return res.status(404).json({ success: false, message: "الغسالة غير موجودة في سكنك" });
    } else {
        await kdb('laundry_machines').insert({ id: uuidv4(), tenant_id: tenantId, name });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.patch("/machines/:id/status", authenticate, authorizePermission(AppPermission.MANAGE_LAUNDRY), validate(updateMachineStatusSchema), async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  try {
      await kdb('laundry_machines').where({ id, tenant_id: tenantId }).update({ status });
      res.json({ success: true });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// 2. Operators Management
router.get("/operators", authenticate, authorizePermission(AppPermission.MANAGE_LAUNDRY_OPERATORS), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const operators = await kdb('laundry_operators as lo')
        .join('users as u', 'lo.user_id', 'u.id')
        .select('lo.*', 'u.name', 'u.email', 'u.role')
        .where('lo.tenant_id', tenantId);
    res.json({ success: true, data: operators });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/operators", authenticate, authorizePermission(AppPermission.MANAGE_LAUNDRY_OPERATORS), validate(createOperatorSchema), async (req, res) => {
  const { userId } = req.body;
  const tenantId = req.user.tenantId;
  const id = uuidv4();

  try {
    // المستخدم المراد تعيينه كمسؤول مغسلة يجب أن ينتمي لسكن المستخدم الحالي
    const targetUser = await kdb('users').select('tenant_id').where({ id: userId }).first();
    if (!targetUser) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    if (targetUser.tenant_id && targetUser.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: "لا يمكنك تعيين مستخدم من سكن آخر" });
    }
    await kdb('laundry_operators').insert({ id, tenant_id: tenantId, user_id: userId });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ success: false, message: "هذا المستخدم مسؤول بالفعل للمغسلة" });
  }
});

router.delete("/operators/:userId", authenticate, authorizePermission(AppPermission.MANAGE_LAUNDRY_OPERATORS), async (req, res) => {
  const { userId } = req.params;
  const tenantId = req.user.tenantId;
  try {
    await kdb('laundry_operators').where({ user_id: userId, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Helper
const isOperator = async (userId: string, tenantId: string) => {
  const op = await kdb('laundry_operators').where({ user_id: userId, tenant_id: tenantId }).first();
  return !!op;
};

// التحقق من أن المستخدم الحالي مسؤول معين عن المغسلة
router.get("/is-operator", authenticate, async (req, res) => {
  const { id: userId, tenantId } = req.user;
  if (!tenantId) return res.json({ success: true, isOperator: false });
  try {
    const op = await kdb('laundry_operators').where({ user_id: userId, tenant_id: tenantId }).first();
    res.json({ success: true, isOperator: !!op });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
  }
});

// 3. Sessions
router.get("/session/active", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const session = await kdb('laundry_sessions as ls')
        .join('users as u', 'ls.operator_id', 'u.id')
        .select('ls.*', 'u.name as operator_name')
        .where('ls.tenant_id', tenantId)
        .where('ls.status', 'active')
        .orderBy('ls.start_at', 'desc')
        .first();
    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/session/start", authenticate, async (req, res) => {
  const { id: userId, tenantId, role } = req.user;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  
  // مشرف السكن أو المسؤول المعين عن المغسلة فقط هم من يمكنهم تشغيل المغسلة
  if (role !== 'supervisor' && !(await isOperator(userId, tenantId)) && !(await checkUserPermission(userId, AppPermission.START_LAUNDRY_SESSION))) {
    return res.status(403).json({ success: false, message: "غير مسموح لك بتشغيل المغسلة" });
  }

  try {
      await kdb('laundry_sessions')
        .where({ tenant_id: tenantId, status: 'active' })
        .update({ status: 'closed', end_at: kdb.fn.now() });

      const id = uuidv4();
      await kdb('laundry_sessions').insert({ id, tenant_id: tenantId, operator_id: userId });
      
      logger.info(`Laundry started by ${req.user.name}`);

      res.json({ success: true, data: { id } });
  } catch(error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/session/close", authenticate, async (req, res) => {
  const { id: userId, tenantId, role } = req.user;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  
  // مشرف السكن أو المسؤول المعين عن المغسلة فقط هم من يمكنهم إيقاف المغسلة
  if (role !== 'supervisor' && !(await isOperator(userId, tenantId)) && !(await checkUserPermission(userId, AppPermission.CLOSE_LAUNDRY_SESSION))) {
    return res.status(403).json({ success: false, message: "غير مسموح لك بإيقاف المغسلة" });
  }

  try {
      await kdb('laundry_sessions')
        .where({ tenant_id: tenantId, status: 'active' })
        .update({ status: 'closed', end_at: kdb.fn.now() });
      
      logger.info(`Laundry closed by ${req.user.name}`);

      res.json({ success: true });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// 2b. Laundry Settings Management

router.get("/settings", authenticate, async (req, res) => {
    const tenantId = req.user.tenantId;
    try {
        const settings = await kdb('laundry_settings').where({ tenant_id: tenantId }).first();
        if (!settings) {
            return res.json({ success: true, data: null, message: "إعدادات المغسلة غير مضبوطة" });
        }
        res.json({ success: true, data: settings });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
    }
});

router.post("/settings", authenticate, authorizePermission(AppPermission.MANAGE_LAUNDRY), validate(laundrySettingsSchema), async (req, res) => {
    const tenantId = req.user.tenantId;
    const { days, start_hour, end_hour } = req.body;
    try {
        const exists = await kdb('laundry_settings').where({ tenant_id: tenantId }).first();
        if (exists) {
            await kdb('laundry_settings').where({ tenant_id: tenantId }).update({ days: JSON.stringify(days), start_hour, end_hour });
        } else {
            await kdb('laundry_settings').insert({ id: uuidv4(), tenant_id: tenantId, days: JSON.stringify(days), start_hour, end_hour });
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
    }
});

// Helper check function
const checkLaundryOperatingHours = async (tenantId: string) => {
    const settings = await kdb('laundry_settings').where({ tenant_id: tenantId }).first();
    if (!settings) return true; // لا توجد إعدادات = مفتوحة افتراضياً

    const now = new Date();
    const day = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const allowedDays = JSON.parse(settings.days);
    if (!allowedDays.includes(day)) return false;

    const [startH, startM] = settings.start_hour.split(':').map(Number);
    const [endH, endM] = settings.end_hour.split(':').map(Number);

    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    return currentTime >= startTime && currentTime <= endTime;
};

// 4. Queue Management
router.get("/queue", authenticate, authorizePermission(AppPermission.VIEW_LAUNDRY_QUEUE), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { status } = req.query;
  
  try {
    let query = kdb('laundry_queue as lq')
      .join('students as s', 'lq.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('laundry_machines as lm', 'lq.machine_id', 'lm.id')
      .select('lq.*', 'u.name as student_name', 'u.id as user_id', 's.id as student_id', 'lm.name as machine_name')
      .select(kdb.raw("DATEDIFF(day, lq.joined_at, GETDATE()) as waiting_days"))
      .where('lq.tenant_id', tenantId);

    if (status) {
      query = query.where('lq.status', status);
    } else {
      query = query.whereIn('lq.status', ['waiting', 'called']);
    }

    const queue = await query.orderBy('lq.joined_at', 'asc');
    res.json({ success: true, data: queue });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/queue/join", authenticate, authorizePermission(AppPermission.JOIN_LAUNDRY), async (req, res) => {
  const { id: userId, tenantId } = req.user;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  
  try {
      const isAllowed = await checkLaundryOperatingHours(tenantId);
      if (!isAllowed) {
          return res.status(400).json({ success: false, message: "المغسلة مغلقة حالياً حسب إعدادات ساعات العمل." });
      }

      const student = await kdb('students').select('id').where({ user_id: userId }).first();
      if (!student) {
        return res.status(400).json({ success: false, message: "لم يتم العثور على سجل طالب مربوط بحسابك" });
      }

      // منع الطالب المسافر من الانضمام لطابور الغسيل
      const studentProfile = await kdb('students').select('is_traveling').where({ user_id: userId }).first();
      if (studentProfile && studentProfile.is_traveling) {
        return res.status(400).json({ success: false, message: "لا يمكنك الانضمام لطابور الغسيل أثناء فترة السفر." });
      }

      const existing = await kdb('laundry_queue').where({ student_id: student.id, tenant_id: tenantId }).whereIn('status', ['waiting', 'called']).first();
      if (existing) {
        return res.status(400).json({ success: false, message: "أنت بالفعل موجود في طابور الانتظار" });
      }

      await kdb('laundry_queue').insert({ id: uuidv4(), tenant_id: tenantId, student_id: student.id });
      res.json({ success: true });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});


router.post("/queue/call", authenticate, validate(queueCallSchema), async (req, res) => {
  const { id: userId, tenantId, role } = req.user;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const { queueId, machineId } = req.body;

  if (role !== 'admin' && role !== 'supervisor' && role !== 'priest' && !(await isOperator(userId, tenantId)) && !(await checkUserPermission(userId, AppPermission.MANAGE_LAUNDRY))) {
    return res.status(403).json({ success: false, message: "غير مسموح لك باستدعاء التالي" });
  }

  try {
  await kdb('laundry_queue').where({ id: queueId, tenant_id: tenantId }).update({ status: 'called', machine_id: machineId, called_at: kdb.fn.now() });
      await kdb('laundry_machines').where({ id: machineId, tenant_id: tenantId }).update({ status: 'occupied' });

      // إرسال إشعار للطالب عبر قاعدة البيانات
      const queueItem = await kdb('laundry_queue').select('student_id', 'machine_id').where({ id: queueId, tenant_id: tenantId }).first();
      if (queueItem) {
        const student = await kdb('students').select('user_id').where({ id: queueItem.student_id }).first();
        if (student) {
          const machine = await kdb('laundry_machines').select('name').where({ id: queueItem.machine_id, tenant_id: tenantId }).first();
          await createNotification({
            userId: student.user_id,
            tenantId: tenantId,
            title: '🧺 دورك في المغسلة!',
            message: `تم استدعاؤك للغسيل. الغسالة: ${machine?.name || '---'}. يرجى التوجه فوراً.`,
            type: 'success',
            metadata: JSON.stringify({ page: 'laundry' })
          });

          // إرسال إشعار فوري عبر Socket
          const io = (global as any).__io;
          if (io) {
            io.to(`user-${student.user_id}`).emit('laundry-called', {
              queueId,
              machineName: machine?.name || '---',
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      res.json({ success: true });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/queue/complete", authenticate, validate(queueActionSchema), async (req, res) => {
  const { queueId } = req.body;
  const { id: userId, role, tenantId } = req.user;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });

  if (role !== 'admin' && role !== 'supervisor' && role !== 'priest' && !(await isOperator(userId, tenantId)) && !(await checkUserPermission(userId, AppPermission.MANAGE_LAUNDRY))) {
    return res.status(403).json({ success: false, message: "غير مسموح لك بإتمام الغسيل" });
  }

  try {
      const q = await kdb('laundry_queue').select('machine_id').where({ id: queueId, tenant_id: tenantId }).first();
      
      if (q && q.machine_id) {
        await kdb('laundry_machines').where({ id: q.machine_id, tenant_id: tenantId }).update({ status: 'available' });
      }
      
      await kdb('laundry_queue').where({ id: queueId, tenant_id: tenantId }).update({ status: 'completed', finished_at: kdb.fn.now() });
      res.json({ success: true });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/queue/cancel", authenticate, validate(queueActionSchema), async (req, res) => {
  const { queueId } = req.body;
  const { id: userId, role, tenantId } = req.user;

  try {
      const q = await kdb('laundry_queue').select('student_id', 'machine_id').where({ id: queueId, tenant_id: tenantId }).first();
      if (!q) return res.status(404).json({ success: false });

      const studentRecord = await kdb('students').select('id').where({ user_id: userId }).first();
      if (role !== 'admin' && role !== 'supervisor' && q.student_id !== studentRecord?.id && !(await checkUserPermission(userId, AppPermission.MANAGE_LAUNDRY))) {
        return res.status(403).json({ success: false });
      }

      if (q.machine_id) {
        await kdb('laundry_machines').where({ id: q.machine_id, tenant_id: tenantId }).update({ status: 'available' });
      }

      await kdb('laundry_queue').where({ id: queueId, tenant_id: tenantId }).update({ status: 'cancelled' });
      res.json({ success: true });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

router.post("/queue/clear-all", authenticate, authorizePermission(AppPermission.MANAGE_LAUNDRY), async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
      await kdb('laundry_queue').where({ tenant_id: tenantId }).whereIn('status', ['waiting', 'called']).update({ status: 'cancelled' });
      await kdb('laundry_machines').where({ tenant_id: tenantId }).update({ status: 'available' });
      res.json({ success: true });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
