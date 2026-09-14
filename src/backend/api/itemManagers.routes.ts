import express, { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate } from "./middleware";

const router = express.Router();

// كل نقاط هذه الـ router تتطلب مصادقة (كانت مفتوحة بلا auth فتفشل دائمًا بـ 403)
router.use(authenticate);

type ItemType = 'event' | 'competition';

const ITEM_TABLE: Record<ItemType, string> = {
  event: 'events',
  competition: 'competitions',
};

function isItemType(v: string): v is ItemType {
  return v === 'event' || v === 'competition';
}

// الكاهن أو المشرف الخاص بالسكن يقدر يعين متحكمين — وكذلك الادارة العامة
async function canAssign(user: { id: string; role: string; tenantId?: string | null }, itemType: ItemType, itemId: string) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'bishop') return true;
  const item = await kdb(ITEM_TABLE[itemType]).where({ id: itemId }).first();
  if (!item) return false;
  if (user.role === 'priest' || user.role === 'supervisor') {
    return item.tenant_id && user.tenantId && String(item.tenant_id).toLowerCase() === String(user.tenantId).toLowerCase();
  }
  return false;
}

async function isManager(userId: string, itemType: ItemType, itemId: string) {
  return !!(await kdb('item_managers').where({ user_id: userId, item_id: itemId, item_type: itemType }).first());
}

// عرض المتحكمين الحاليين
router.get("/:itemType/:itemId/managers", async (req: Request, res: Response) => {
  const { itemType, itemId } = req.params as any;
  if (!isItemType(itemType)) return res.status(400).json({ success: false, message: "نوع العنصر غير صحيح" });

  try {
    const user = (req as any).user;
    const canAssignHere = await canAssign(user, itemType, itemId);
    const isMgr = user ? await isManager(user.id, itemType, itemId) : false;
    if (!canAssignHere && !isMgr && !['admin', 'bishop'].includes(user?.role)) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية عرض المتحكمين" });
    }

    const managers = await kdb('item_managers as im')
      .join('users as u', 'im.user_id', 'u.id')
      .select('im.id as manager_id', 'im.user_id', 'u.name as user_name', 'u.role', 'u.email', 'im.created_at')
      .where({ 'im.item_id': itemId, 'im.item_type': itemType })
      .orderBy('im.created_at', 'desc');

    res.json({ success: true, data: managers, canAssign: canAssignHere });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// المستخدمون المرشحون للتعيين كمتحكمين (نفس السكن فقط، وباستثناء من هم متحكمون بالفعل)
router.get("/:itemType/:itemId/assignable-users", async (req: Request, res: Response) => {
  const { itemType, itemId } = req.params as any;
  if (!isItemType(itemType)) return res.status(400).json({ success: false, message: "نوع العنصر غير صحيح" });

  try {
    const user = (req as any).user;
    if (!await canAssign(user, itemType, itemId)) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية تعيين متحكمين لهذا العنصر" });
    }

    const item = await kdb(ITEM_TABLE[itemType]).where({ id: itemId }).first();
    if (!item || !item.tenant_id) {
      return res.status(404).json({ success: false, message: "العنصر غير موجود" });
    }

    const managerRows = await kdb('item_managers').select('user_id').where({ item_id: itemId, item_type: itemType });
    const managerIds = new Set(managerRows.map((r: any) => r.user_id));

    const candidates = await kdb('users as u')
      .leftJoin('user_tenant_assignments as uta', 'u.id', 'uta.user_id')
      .select('u.id', 'u.name', 'u.role', 'u.email', 'u.tenant_id')
      .where(function () {
        this.where('u.tenant_id', item.tenant_id).orWhere('uta.tenant_id', item.tenant_id);
      })
      .whereNotIn('u.role', ['admin', 'student', 'parent'])
      .distinct()
      .orderBy('u.name');

    const data = candidates.filter((u: any) => !managerIds.has(u.id));
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// تعيين متحكمين جدد لعنصر معين
router.post("/:itemType/:itemId/managers", async (req: Request, res: Response) => {
  const { itemType, itemId } = req.params as any;
  const { userIds } = req.body as { userIds?: string[] };
  if (!isItemType(itemType)) return res.status(400).json({ success: false, message: "نوع العنصر غير صحيح" });
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, message: "اختر مستخدماً واحداً على الأقل" });
  }

  try {
    const user = (req as any).user;
    if (!await canAssign(user, itemType, itemId)) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية تعيين متحكمين لهذا العنصر" });
    }

    const item = await kdb(ITEM_TABLE[itemType]).where({ id: itemId }).first();
    if (!item || !item.tenant_id) {
      return res.status(404).json({ success: false, message: "العنصر غير موجود" });
    }

    // المستخدم المُعين يجب أن ينتمي لنفس السكن
    const users = await kdb('users as u')
      .leftJoin('user_tenant_assignments as uta', 'u.id', 'uta.user_id')
      .select('u.id', 'u.tenant_id')
      .whereIn('u.id', userIds)
      .where(function () {
        this.where('u.tenant_id', item.tenant_id).orWhere('uta.tenant_id', item.tenant_id);
      })
      .distinct();

    const validIds = new Set(users.map((u: any) => u.id));
    const existing = await kdb('item_managers')
      .where({ item_id: itemId, item_type: itemType })
      .whereIn('user_id', [...validIds])
      .select('user_id');
    const existingIds = new Set(existing.map((r: any) => r.user_id));

    let added = 0;
    for (const uid of userIds) {
      if (!validIds.has(uid) || existingIds.has(uid)) continue;
      await kdb('item_managers').insert({ id: uuidv4(), user_id: uid, item_id: itemId, item_type: itemType });
      added++;
    }

    const managers = await kdb('item_managers as im')
      .join('users as u', 'im.user_id', 'u.id')
      .select('im.id as manager_id', 'im.user_id', 'u.name as user_name', 'u.role', 'u.email', 'im.created_at')
      .where({ 'im.item_id': itemId, 'im.item_type': itemType });

    res.json({ success: true, data: managers, added, skipped: userIds.length - added });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// إزالة متحكم
router.delete("/:itemType/:itemId/managers/:userId", async (req: Request, res: Response) => {
  const { itemType, itemId, userId } = req.params as any;
  if (!isItemType(itemType)) return res.status(400).json({ success: false, message: "نوع العنصر غير صحيح" });

  try {
    const user = (req as any).user;
    if (!await canAssign(user, itemType, itemId)) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية إزالة متحكمين" });
    }
    await kdb('item_managers')
      .where({ user_id: userId, item_id: itemId, item_type: itemType })
      .del();
    res.json({ success: true, message: "تمت إزالة المتحكم" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;