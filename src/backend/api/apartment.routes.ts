import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { validate } from "../validation/middleware";
import { createApartmentSchema, updateApartmentSchema } from "../validation/schemas";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

// Get all apartments in a tenant
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_HOUSING), (req, res) => {
  const tenantId = req.user.tenantId;
  
  kdb('apartments as a')
    .select('a.*')
    .select(
      kdb('rooms')
        .whereRaw('apartment_id = a.id')
        .sum({ total_capacity: 'capacity' })
        .as('total_capacity'),
      kdb('rooms')
        .whereRaw('apartment_id = a.id')
        .sum({ current_occupancy: 'current_occupancy' })
        .as('current_occupancy')
    )
    .where('a.tenant_id', tenantId)
    .then(apartments => {
      // Map sums to numbers (Knex sum returns strings often in some dialects)
      const formatted = apartments.map(apt => ({
        ...apt,
        total_capacity: Number(apt.total_capacity || 0),
        current_occupancy: Number(apt.current_occupancy || 0)
      }));
      res.json({ success: true, data: formatted });
    })
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

// Create an apartment
router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_HOUSING), validate(createApartmentSchema), async (req, res) => {
  const { name, building, supervisor_id, is_active, amenities, has_kitchen, kitchen_details, has_bathroom, bathroom_details } = req.body;
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

  try {
    await kdb('apartments').insert(dataToInsert);
    res.status(201).json({ success: true, data: { id, name, building, tenantId, is_active } });
  } catch (error: any) {
    let message = "��� �� ����� �����. ���� �� ��� ��������.";
    if (error.message.includes("FOREIGN KEY constraint failed") || error.message.includes("REFERENCE constraint")) {
      message = "��� �� ��� ��������: ����� ����� (������) ��� ����� �� �� ���� �� ������. ���� ����� ����� ������ �� ������ ������ ������.";
    }
    res.status(400).json({ success: false, message });
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
      message: "���� ��� ����� ����� ������ ������ ��"
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
      res.json({ success: true, message: "�� ����� ������ ����� �����" });
    })
    .catch(error => {
      let message = "��� �� ����� �����. ���� �� ��� ��������.";
      if (error.message.includes("FOREIGN KEY constraint failed") || error.message.includes("REFERENCE constraint")) {
        message = "��� �� ��� ��������: ����� ����� (������) ��� ����� �� �� ���� �� ������.";
      }
      res.status(400).json({ success: false, message });
    });
});

export default router;
