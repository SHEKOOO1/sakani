import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

router.get("/", authenticate, authorizePermission(AppPermission.VIEW_INVENTORY), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const items = await kdb('inventory').where({ tenant_id: tenantId });
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
  }
});

router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_INVENTORY), async (req, res) => {
  const { name, category, quantity, unit, minQuantity } = req.body;
  const tenantId = req.user.tenantId;
  const id = uuidv4();

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, message: "اسم الصنف مطلوب" });
  }
  if (quantity !== undefined && (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0)) {
    return res.status(400).json({ success: false, message: "الكمية يجب أن تكون رقماً غير سالب" });
  }
  if (minQuantity !== undefined && (typeof minQuantity !== 'number' || !Number.isFinite(minQuantity) || minQuantity < 0)) {
    return res.status(400).json({ success: false, message: "حد التنبيه يجب أن يكون رقماً غير سالب" });
  }

  try {
    await kdb('inventory').insert({
        id,
        tenant_id: tenantId,
        name,
        category,
        quantity,
        unit,
        min_quantity: minQuantity
    });

    res.status(201).json({ success: true, data: { id, name } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

export default router;
