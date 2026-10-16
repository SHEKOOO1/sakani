import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { validate } from "../validation/middleware";
import { createApartmentSchema, updateApartmentSchema } from "../validation/schemas";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

// Get all apartments in a tenant, with per-room aggregates for the dashboard cards
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_HOUSING), async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    const apartments = await kdb('apartments as a')
      .select('a.*')
      .where('a.tenant_id', tenantId)
      .orderBy([{ column: 'a.sort_order', order: 'asc' }, { column: 'a.created_at', order: 'asc' }]);

    const rooms = await kdb('rooms')
      .where('tenant_id', tenantId)
      .select('id', 'apartment_id', 'capacity', 'current_occupancy', 'is_active');

    const byApartment = new Map<string, any[]>();
    for (const room of rooms) {
      const list = byApartment.get(room.apartment_id) || [];
      list.push(room);
      byApartment.set(room.apartment_id, list);
    }

    const formatted = apartments.map((apt: any) => {
      const list = byApartment.get(apt.id) || [];
      const isActiveRoom = (r: any) => Number(r.is_active ?? 1) === 1;
      const cap = (r: any) => Number(r.capacity || 0);
      const occ = (r: any) => Number(r.current_occupancy || 0);
      return {
        ...apt,
        rooms_count: list.length,
        total_capacity: list.reduce((s, r) => s + cap(r), 0),
        current_occupancy: list.reduce((s, r) => s + occ(r), 0),
        available_rooms: list.filter((r) => isActiveRoom(r) && occ(r) < cap(r)).length,
        empty_rooms: list.filter((r) => isActiveRoom(r) && occ(r) === 0).length,
        full_rooms: list.filter((r) => isActiveRoom(r) && cap(r) > 0 && occ(r) >= cap(r)).length,
        locked_rooms: list.filter((r) => !isActiveRoom(r)).length,
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create an apartment (optionally together with its rooms)
router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_HOUSING), validate(createApartmentSchema), async (req, res) => {
  const { name, building, supervisor_id, is_active, amenities, has_kitchen, kitchen_details, has_bathroom, bathroom_details, rooms } = req.body;
  const tenantId = req.user.tenantId;
  const id = uuidv4();

  // المشرف المرتبط بالشقة يجب أن يكون مشرفاً تابعاً لنفس السكن
  let supervisorId = supervisor_id || null;
  if (supervisorId) {
    const sup = await kdb('users').where({ id: supervisorId, role: 'supervisor', tenant_id: tenantId }).first();
    if (!sup) {
      return res.status(400).json({ success: false, message: "المشرف المحدد غير موجود في سكنك" });
    }
  }

  const dataToInsert = {
    id,
    tenant_id: tenantId,
    name,
    building: building || null,
    supervisor_id: supervisorId,
    is_active: is_active ? 1 : 0,
    amenities: amenities ? JSON.stringify(amenities) : null,
    has_kitchen: has_kitchen ? 1 : 0,
    kitchen_details: kitchen_details ? JSON.stringify(kitchen_details) : null,
    has_bathroom: has_bathroom ? 1 : 0,
    bathroom_details: bathroom_details ? JSON.stringify(bathroom_details) : null
  };

  // الغرف المُدخلة مع الشقة الجديدة (إن وُجدت) تُنشأ في نفس المعاملة.
  const roomRows = Array.isArray(rooms)
    ? rooms
        .map((r: any, idx: number) => ({
          id: uuidv4(),
          tenant_id: tenantId,
          apartment_id: id,
          room_number: String(r.roomNumber ?? r.room_number ?? '').trim(),
          capacity: Number(r.capacity) || 1,
          current_occupancy: 0,
          is_active: r.is_active === false || r.is_active === 0 ? 0 : 1,
          sort_order: idx,
          price_daily: Number(r.price_daily) || 0,
          price_monthly: Number(r.price_monthly) || 0,
          price_semester: Number(r.price_semester) || 0,
        }))
        .filter((r: any) => r.room_number)
    : [];

  try {
    await kdb.transaction(async (trx) => {
      await trx('apartments').insert(dataToInsert);
      if (roomRows.length) await trx('rooms').insert(roomRows);
    });
    res.status(201).json({ success: true, data: { id, name, building, tenantId, is_active, rooms_created: roomRows.length } });
  } catch (error: any) {
    let message = "حدث خطأ أثناء إنشاء السكن. من فضلك حاول مرة أخرى.";
    if (error.message.includes("FOREIGN KEY constraint failed") || error.message.includes("REFERENCE constraint")) {
      message = "تعذر ربط المشرف: المشرف المحدد (المُدرج) غير موجود في هذا السكن. تأكد من اختيار مشرف تابع للسكن ثم أعد المحاولة.";
    }
    res.status(400).json({ success: false, message });
  }
});

// Reorder apartments (drag & drop). Body: { order: [apartmentId, ...] }
router.put("/reorder", authenticate, authorizePermission(AppPermission.MANAGE_HOUSING), async (req, res) => {
  const tenantId = req.user.tenantId;
  const order = Array.isArray(req.body?.order) ? req.body.order : [];
  if (!order.length) {
    return res.status(400).json({ success: false, message: "ترتيب غير صالح" });
  }

  try {
    await kdb.transaction(async (trx) => {
      for (let i = 0; i < order.length; i++) {
        await trx('apartments')
          .where({ id: String(order[i]), tenant_id: tenantId })
          .update({ sort_order: i });
      }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete an apartment
router.delete("/:id", authenticate, authorizePermission(AppPermission.MANAGE_HOUSING), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  try {
    // 1. Verify apartment existence and ownership
    const apartment = await kdb('apartments').where({ id }).where('tenant_id', tenantId).first();
    if (!apartment) {
      return res.status(404).json({ success: false, message: "السكن غير موجود أو لا تملك صلاحية حذفه" });
    }

    // 2. Check if any room in this apartment is occupied OR referenced by any student record
    const occupiedRooms = await kdb('rooms').where({ apartment_id: id }).where('current_occupancy', '>', 0).count({ count: '*' }).first();
    const studentsInRooms = await kdb('students').whereIn('room_id', kdb('rooms').select('id').where({ apartment_id: id })).count({ count: '*' }).first();

    const occupiedCount = Number(occupiedRooms?.count || 0);
    const studentCount = Number(studentsInRooms?.count || 0);

    if (occupiedCount > 0 || studentCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "لا يمكن حذف السكن لأنه يحتوي على غرف مشغولة أو مرتبطة بسجلات طلاب. يرجى نقل الطلاب أولاً." 
      });
    }

    // 3. Check for maintenance requests linked to the apartment OR its rooms
    const maintenanceReqs = await kdb('maintenance_requests')
      .where({ apartment_id: id, tenant_id: tenantId })
      .orWhereIn('room_id', kdb('rooms').select('id').where({ apartment_id: id, tenant_id: tenantId }))
      .count({ count: '*' })
      .first();

    if (Number(maintenanceReqs?.count || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف السكن لوجود طلبات صيانة مرتبطة به أو بغرفه. يرجى معالجة الطلبات أولاً."
      });
    }

    // 4. Use transaction to delete rooms and apartment
    await kdb.transaction(async trx => {
      await trx('rooms').where({ apartment_id: id, tenant_id: tenantId }).del();
      await trx('apartments').where({ id, tenant_id: tenantId }).del();
    });

    res.json({ success: true, message: "تم حذف السكن وجميع الغرف التابعة له بنجاح" });
  } catch (error: any) {
    console.error("Critical Delete Apartment Error:", error);
    res.status(400).json({ 
      success: false, 
      message: "حدث خطأ أثناء حذف السكن. من فضلك حاول مرة أخرى."
    });
  }
});

// Update an apartment
router.put("/:id", authenticate, authorizePermission(AppPermission.MANAGE_HOUSING), validate(updateApartmentSchema), (req, res) => {
  const { id } = req.params;
  const { name, building, is_active, amenities, has_kitchen, kitchen_details, has_bathroom, bathroom_details } = req.body;
  const tenantId = req.user.tenantId;

  const dataToUpdate = {
    name,
    building: building || null,
    is_active: is_active ? 1 : 0,
    amenities: amenities ? JSON.stringify(amenities) : null,
    has_kitchen: has_kitchen ? 1 : 0,
    kitchen_details: kitchen_details ? JSON.stringify(kitchen_details) : null,
    has_bathroom: has_bathroom ? 1 : 0,
    bathroom_details: bathroom_details ? JSON.stringify(bathroom_details) : null
  };

  kdb('apartments')
    .where({ id }).where('tenant_id', tenantId)
    .update(dataToUpdate)
    .then(() => {
      res.json({ success: true, message: "تم تحديث بيانات السكن بنجاح" });
    })
    .catch(error => {
      let message = "حدث خطأ أثناء تحديث السكن. من فضلك حاول مرة أخرى.";
      if (error.message.includes("FOREIGN KEY constraint failed") || error.message.includes("REFERENCE constraint")) {
        message = "تعذر ربط المشرف: المشرف المحدد غير موجود في هذا السكن.";
      }
      res.status(400).json({ success: false, message });
    });
});

export default router;
