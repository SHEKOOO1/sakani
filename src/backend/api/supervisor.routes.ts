import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission, computeUserTenantIds } from "./middleware";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

// GET /api/supervisor/contacts - جلب إعدادات التواصل للمشرف الحالي
router.get("/contacts", authenticate, authorizePermission(AppPermission.VIEW_DASHBOARD), async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.json({ success: true, data: null });
    }

    let contact = await kdb("supervisor_contacts")
      .where({ user_id: userId, tenant_id: tenantId })
      .first();

    if (contact && typeof contact.phone_numbers === 'string') {
      contact.phone_numbers = JSON.parse(contact.phone_numbers);
    }

    res.json({ success: true, data: contact || null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// PUT /api/supervisor/contacts - تحديث إعدادات التواصل
router.put("/contacts", authenticate, authorizePermission(AppPermission.VIEW_DASHBOARD), async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const { phone_numbers, available_from, available_to, available_days } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: "Tenant ID is required" });
    }

    const existing = await kdb("supervisor_contacts")
      .where({ user_id: userId, tenant_id: tenantId })
      .first();

    const data = {
      phone_numbers: JSON.stringify(phone_numbers || []),
      available_from: available_from || null,
      available_to: available_to || null,
      available_days: available_days || null,
      updated_at: new Date()
    };

    if (existing) {
      await kdb("supervisor_contacts").where({ id: existing.id }).update(data);
    } else {
      await kdb("supervisor_contacts").insert({
        id: uuidv4(),
        user_id: userId,
        tenant_id: tenantId,
        ...data,
        created_at: new Date()
      });
    }

    const updated = await kdb("supervisor_contacts")
      .where({ user_id: userId, tenant_id: tenantId })
      .first();

    if (updated && typeof updated.phone_numbers === 'string') {
      updated.phone_numbers = JSON.parse(updated.phone_numbers);
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// GET /api/supervisor/:tenantId/contact - جلب بيانات المشرف المسؤول عن سكن معين (لأولياء الأمور)
router.get("/:tenantId/contact", authenticate, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const user = (req as any).user;

    // لا يجوز لأي مستخدم استكشاف سكنات خارج نطاقه
    const allowed = await computeUserTenantIds(user);
    if (!allowed.includes(tenantId)) {
      return res.status(403).json({ success: false, message: "غير مصرح بالوصول إلى هذا السكن" });
    }

    const supervisor = await kdb("users")
      .where({ role: "supervisor", tenant_id: tenantId })
      .select("id", "name")
      .first();

    if (!supervisor) {
      return res.json({ success: true, data: null });
    }

    let contact = await kdb("supervisor_contacts")
      .where({ user_id: supervisor.id, tenant_id: tenantId })
      .first();

    if (contact) {
      if (typeof contact.phone_numbers === 'string') {
        contact.phone_numbers = JSON.parse(contact.phone_numbers);
      }
      return res.json({
        success: true,
        data: {
          supervisorName: supervisor.name,
          ...contact
        }
      });
    }

    res.json({
      success: true,
      data: {
        supervisorName: supervisor.name,
        phone_numbers: [],
        available_from: null,
        available_to: null,
        available_days: null
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
