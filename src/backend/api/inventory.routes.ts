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
    res.status(500).json({ success: false, message: "Õ’· Œÿ√ ›‰Ì. ·Ê ”„Õ  ﬂ—— «·„Õ«Ê·…." });
  }
});

router.post("/", authenticate, authorizePermission(AppPermission.MANAGE_INVENTORY), async (req, res) => {
  const { name, category, quantity, unit, minQuantity } = req.body;
  const tenantId = req.user.tenantId;
  const id = uuidv4();

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
    res.status(400).json({ success: false, message: "›‘· «·⁄„·Ì….  Õﬁﬁ „‰ «·»Ì«‰«  ÊÕ«Ê· „—… √Œ—Ï." });
  }
});

export default router;
