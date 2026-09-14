import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { validate } from "../validation/middleware";
import { createRoomSchema, updateRoomSchema } from "../validation/schemas";
import { AppPermission } from "../../types/permissions";
import { parsePagination, paginateQuery } from "../services/radio/pagination.ts";

const router = express.Router();

// Get all rooms in a tenant or filtered by apartment
/**
 * @openapi
 * /rooms:
 *   get:
 *     tags: [الغرف]
 *     summary: جلب قائمة الغرف مع pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: apartmentId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الغرف
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_ROOMS), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { apartmentId } = req.query;
  const { page, limit } = parsePagination(req.query);

  let query = kdb('rooms as r')
    .leftJoin('apartments as a', 'r.apartment_id', 'a.id')
    .select('r.*', 'a.name as apartment_name', 'a.building as apartment_building')
    .where('r.tenant_id', tenantId);
  if (apartmentId) {
    query = query.where('r.apartment_id', apartmentId);
  }

  try {
    const result = await paginateQuery<any>(query, { page, limit });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
  }
});

// Create a room
router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_HOUSING), validate(createRoomSchema), async (req, res) => {
  const { 
    apartmentId, roomNumber, capacity, 
    price_daily, price_monthly, price_semester,
    amenities, has_kitchen, kitchen_details, has_bathroom, bathroom_details 
  } = req.body;
  const tenantId = req.user.tenantId;
  const id = uuidv4();

  if (apartmentId) {
    const apartment = await kdb('apartments').where({ id: apartmentId, tenant_id: tenantId }).first();
    if (!apartment) {
      return res.status(400).json({ success: false, message: "الشقة المحددة غير موجودة في سكنك" });
    }
  }

  const dataToInsert = {
    id, tenant_id: tenantId, apartment_id: apartmentId, room_number: roomNumber, capacity,
    price_daily: price_daily || 0, price_monthly: price_monthly || 0, price_semester: price_semester || 0,
    amenities: amenities ? JSON.stringify(amenities) : null,
    has_kitchen: has_kitchen ? 1 : 0,
    kitchen_details: kitchen_details ? JSON.stringify(kitchen_details) : null,
    has_bathroom: has_bathroom ? 1 : 0,
    bathroom_details: bathroom_details ? JSON.stringify(bathroom_details) : null
  };

  try {
    await kdb('rooms').insert(dataToInsert);
    res.status(201).json({ success: true, data: { id, apartmentId, roomNumber, capacity, tenantId } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Delete a room
router.delete("/:id", authenticate, authorizePermission(AppPermission.MANAGE_HOUSING), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  try {
    const room = await kdb('rooms').where({ id }).where('tenant_id', tenantId).first();
    if (!room) {
      return res.status(404).json({ success: false, message: "الغرفة غير موجودة" });
    }
    
    if (room.current_occupancy > 0) {
      return res.status(400).json({ success: false, message: "لا يمكن حذف الغرفة لأنها مشغولة حالياً بالطلاب." });
    }

    await kdb('rooms').where({ id }).where('tenant_id', tenantId).del();
    res.json({ success: true, message: "تم حذف الغرفة بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Update a room
router.put("/:id", authenticate, authorizePermission(AppPermission.MANAGE_HOUSING), validate(updateRoomSchema), async (req, res) => {
  const { id } = req.params;
  const { 
    apartmentId, roomNumber, capacity,
    price_daily, price_monthly, price_semester,
    amenities, has_kitchen, kitchen_details, has_bathroom, bathroom_details
  } = req.body;
  const tenantId = req.user.tenantId;

  if (apartmentId) {
    const apartment = await kdb('apartments').where({ id: apartmentId, tenant_id: tenantId }).first();
    if (!apartment) {
      return res.status(400).json({ success: false, message: "الشقة المحددة غير موجودة في سكنك" });
    }
  }

  const dataToUpdate = {
    apartment_id: apartmentId,
    room_number: roomNumber,
    capacity,
    price_daily: price_daily || 0,
    price_monthly: price_monthly || 0,
    price_semester: price_semester || 0,
    amenities: amenities ? JSON.stringify(amenities) : null,
    has_kitchen: has_kitchen ? 1 : 0,
    kitchen_details: kitchen_details ? JSON.stringify(kitchen_details) : null,
    has_bathroom: has_bathroom ? 1 : 0,
    bathroom_details: bathroom_details ? JSON.stringify(bathroom_details) : null
  };

  try {
    await kdb('rooms')
      .where({ id }).where('tenant_id', tenantId)
      .update(dataToUpdate);

    res.json({ success: true, message: "تم تحديث بيانات الغرفة بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

export default router;
