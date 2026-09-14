import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission, sanitizeInput } from "./middleware";
import { AppPermission } from "../../types/permissions";
import { createNotification } from "./notifications.routes";
import { upload, UPLOADS_BASE, validateMagicBytes } from "../middleware/upload";
import { validate } from "../validation/middleware";
import { createMaintenanceSchema, updateMaintenanceStatusSchema } from "../validation/schemas";
import { parsePagination } from "../services/radio/pagination.ts";

const router = express.Router();

// Get all requests
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_MAINTENANCE), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { page, limit } = parsePagination(req.query);

  try {
    const baseQuery = kdb('maintenance_requests as m')
      .join('users as u', 'm.requester_id', 'u.id')
      .leftJoin('users as a', 'm.assigned_to', 'a.id')
      .where('m.tenant_id', tenantId);

    const [totalResult, requests] = await Promise.all([
      baseQuery.clone().clearSelect().count("* as total").first(),
      baseQuery.clone().select('m.*', 'u.name as requester_name', 'a.name as assignee_name')
        .orderBy('m.created_at', 'desc')
        .offset((page - 1) * limit)
        .limit(limit),
    ]);

    const total = Number((totalResult as any)?.total || 0);
    res.json({ success: true, data: requests, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
      res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Create request
router.post("/", authenticate, authorizePermission(AppPermission.REQUEST_MAINTENANCE), upload.array('files', 3), validateMagicBytes, sanitizeInput, validate(createMaintenanceSchema), async (req, res) => {
  const { apartmentId, roomId, description, priority } = req.body;
  const tenantId = req.user.tenantId;
  const requesterId = req.user.id;
  const id = uuidv4();
  const files = (req as any).files as Express.Multer.File[];

  try {
    // تخزين رابط نسبي آمن بدلًا من مسار النظام المطلق (منع تسريب مسار الخادم)
    const photoUrl = files && files.length > 0 ? `${UPLOADS_BASE}/documents/${files[0].filename}` : null;

    await kdb('maintenance_requests').insert({
        id,
        tenant_id: tenantId,
        requester_id: requesterId,
        apartment_id: apartmentId || null,
        room_id: roomId || null,
        description,
        priority: priority || 'medium',
        photo_url: photoUrl
    });

    res.status(201).json({ success: true, data: { id, description } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Update status (Supervisor/Employee)
router.patch("/:id/status", authenticate, authorizePermission(AppPermission.HANDLE_MAINTENANCE), validate(updateMaintenanceStatusSchema), async (req, res) => {
  const { status, assignedTo } = req.body;
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  try {
    await kdb('maintenance_requests').where({ id }).where('tenant_id', tenantId).update({ status, assigned_to: assignedTo || null });
    
    // Send notification to the assignee if assigned
    if (assignedTo && status === 'assigned') {
      const mtnTenantId = req.user.tenantId;
      if (!mtnTenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
      createNotification({
        userId: assignedTo,
        tenantId: mtnTenantId,
        title: "مهمة صيانة جديدة",
        message: `تم تعيين مهمة صيانة جديدة لك: ${id.substring(0, 8)}`,
        type: 'warning',
        metadata: JSON.stringify({ page: 'maintenance' })
      });
    }

    res.json({ success: true, message: "Request updated" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

router.get("/my", authenticate, async (req, res) => {
  try {
    const requests = await kdb('maintenance_requests as m')
      .leftJoin('rooms as r', 'm.room_id', 'r.id')
      .leftJoin('apartments as a', 'r.apartment_id', 'a.id')
      .leftJoin('users as u', 'm.requester_id', 'u.id')
      .select('m.*', 'u.name as requester_name', 'r.room_number', 'a.name as apartment_name')
      .where({ requester_id: req.user.id })
      .orderBy('m.created_at', 'desc')
      .limit(50);
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
