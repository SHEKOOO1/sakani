import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb, checkUserPermission } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission, UserRole } from "../../types/permissions";
import { validate } from "../validation/middleware";
import {
  restaurantCategorySchema,
  updateRestaurantCategorySchema,
  restaurantItemSchema,
  updateRestaurantItemSchema,
  placeRestaurantOrderSchema,
  restaurantOrderStatusSchema,
  restaurantOperatorSchema,
} from "../validation/schemas";
import { createNotification } from "./notifications.routes";
import { sameId } from "../infrastructure/id-match";
import { requireServiceEnabled } from "../infrastructure/service-features";
import { postEntry, restaurantRevenueLines } from "../services/ledger.service";
import { priceLine } from "../services/pricing.service";
import { resolveCustomerIdentity } from "../services/customer-identity.service";
import { InputError, affected } from "../infrastructure/domain-errors";
import { logger } from "../infrastructure/logger.ts";

const router = express.Router();

const STAFF_ROLES: string[] = [
  UserRole.Admin,
  UserRole.Bishop,
  UserRole.Supervisor,
  UserRole.Priest,
  UserRole.AssistantSupervisor,
  UserRole.Employee,
];

function normalizeFlag(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null) return fallback;
  return value !== 0 && value !== "0" && value !== false && value !== "false";
}

const isRestaurantOperator = async (userId: string, tenantId: string): Promise<boolean> => {
  const op = await kdb("restaurant_operators").where({ user_id: userId, tenant_id: tenantId }).first();
  return !!op;
};

async function canOperateRestaurant(req: any): Promise<boolean> {
  const { id: userId, tenantId, role } = req.user || {};
  if (!tenantId) return false;
  if (role === UserRole.Admin || role === UserRole.Supervisor || role === UserRole.Priest) return true;
  if (await checkUserPermission(userId, AppPermission.MANAGE_RESTAURANT)) return true;
  return isRestaurantOperator(userId, tenantId);
}

async function selfStudentId(userId: string): Promise<string | null> {
  const s = await kdb("students").select("id").where({ user_id: userId }).first();
  return s ? s.id : null;
}

function respondDomainError(res: any, e: unknown, label: string): void {
  if (e instanceof InputError) {
    res.status(400).json({ success: false, message: e.message });
    return;
  }
  logger.error(`${label}: ${(e as Error)?.message}`);
  res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
}

// ─── Categories ───
router.get("/categories", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const rows = await kdb("restaurant_categories").where({ tenant_id: tenantId }).orderBy("sort_order", "asc");
    res.json({ success: true, data: rows });
  } catch (e) {
    respondDomainError(res, e, "restaurant.categories.list");
  }
});

router.post("/categories", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.MANAGE_RESTAURANT), validate(restaurantCategorySchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const { name, sort_order, is_active } = req.body;
  try {
    const id = uuidv4();
    await kdb("restaurant_categories").insert({ id, tenant_id: tenantId, name, sort_order: sort_order ?? 0, is_active: is_active ? 1 : 0 });
    res.status(201).json({ success: true, data: { id } });
  } catch (e) {
    respondDomainError(res, e, "restaurant.categories.create");
  }
});

router.put("/categories/:id", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.MANAGE_RESTAURANT), validate(updateRestaurantCategorySchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { name, sort_order, is_active } = req.body;
  try {
    const update: Record<string, any> = {};
    if (name !== undefined) update.name = name;
    if (sort_order !== undefined) update.sort_order = sort_order;
    if (is_active !== undefined) update.is_active = is_active ? 1 : 0;
    if (Object.keys(update).length === 0) return res.status(400).json({ success: false, message: "لا توجد بيانات للتحديث" });
    const changed = await kdb("restaurant_categories").where({ id: req.params.id, tenant_id: tenantId }).update(update);
    if (!affected(changed)) return res.status(404).json({ success: false, message: "التصنيف غير موجود" });
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "restaurant.categories.update");
  }
});

router.delete("/categories/:id", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.MANAGE_RESTAURANT), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await kdb("restaurant_items").where({ category_id: req.params.id, tenant_id: tenantId }).update({ category_id: null });
    await kdb("restaurant_categories").where({ id: req.params.id, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "restaurant.categories.delete");
  }
});

// ─── Items (menu) ───
router.get("/items", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const rows = await kdb("restaurant_items").where({ tenant_id: tenantId }).orderBy("sort_order", "asc");
    res.json({ success: true, data: rows });
  } catch (e) {
    respondDomainError(res, e, "restaurant.items.list");
  }
});

router.post("/items", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.MANAGE_RESTAURANT), validate(restaurantItemSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const { name, category_id, description, price, is_available, is_included_meal, sort_order, image_url, discount_type, discount_value } = req.body;
  try {
    if (category_id) {
      const cat = await kdb("restaurant_categories").where({ id: category_id, tenant_id: tenantId }).first();
      if (!cat) return res.status(400).json({ success: false, message: "التصنيف غير موجود في هذا السكن" });
    }
    const id = uuidv4();
    await kdb("restaurant_items").insert({
      id, tenant_id: tenantId, name,
      category_id: category_id || null,
      description: description || null,
      price: price ?? 0,
      is_available: is_available ? 1 : 0,
      is_included_meal: is_included_meal ? 1 : 0,
      sort_order: sort_order ?? 0,
      image_url: image_url || null,
      discount_type: discount_type || null,
      discount_value: discount_value ?? 0,
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (e) {
    respondDomainError(res, e, "restaurant.items.create");
  }
});

router.put("/items/:id", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.MANAGE_RESTAURANT), validate(updateRestaurantItemSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { name, category_id, description, price, is_available, is_included_meal, sort_order, image_url, discount_type, discount_value } = req.body;
  try {
    if (category_id) {
      const cat = await kdb("restaurant_categories").where({ id: category_id, tenant_id: tenantId }).first();
      if (!cat) return res.status(400).json({ success: false, message: "التصنيف غير موجود في هذا السكن" });
    }
    const update: Record<string, any> = { updated_at: kdb.fn.now() };
    if (name !== undefined) update.name = name;
    if (category_id !== undefined) update.category_id = category_id || null;
    if (description !== undefined) update.description = description || null;
    if (price !== undefined) update.price = price;
    if (is_available !== undefined) update.is_available = is_available ? 1 : 0;
    if (is_included_meal !== undefined) update.is_included_meal = is_included_meal ? 1 : 0;
    if (sort_order !== undefined) update.sort_order = sort_order;
    if (image_url !== undefined) update.image_url = image_url || null;
    if (discount_type !== undefined) update.discount_type = discount_type || null;
    if (discount_value !== undefined) update.discount_value = discount_value;
    const changed = await kdb("restaurant_items").where({ id: req.params.id, tenant_id: tenantId }).update(update);
    if (!affected(changed)) return res.status(404).json({ success: false, message: "الوجبة غير موجودة" });
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "restaurant.items.update");
  }
});

router.delete("/items/:id", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.MANAGE_RESTAURANT), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await kdb("restaurant_items").where({ id: req.params.id, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "restaurant.items.delete");
  }
});

// ─── Operators ───
router.get("/operators", authenticate, authorizePermission(AppPermission.MANAGE_RESTAURANT_OPERATORS), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const operators = await kdb("restaurant_operators as ro")
      .join("users as u", "ro.user_id", "u.id")
      .select("ro.*", "u.name", "u.email", "u.role")
      .where("ro.tenant_id", tenantId);
    res.json({ success: true, data: operators });
  } catch (e) {
    respondDomainError(res, e, "restaurant.operators.list");
  }
});

router.get("/is-operator", authenticate, async (req, res) => {
  const { id: userId, tenantId } = req.user;
  if (!tenantId) return res.json({ success: true, isOperator: false });
  try {
    res.json({ success: true, isOperator: await isRestaurantOperator(userId, tenantId) });
  } catch (e) {
    respondDomainError(res, e, "restaurant.operators.is-operator");
  }
});

router.get("/assignable-users", authenticate, authorizePermission(AppPermission.MANAGE_RESTAURANT_OPERATORS), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.json({ success: true, data: [] });
  try {
    const direct = await kdb("users").select("id", "name", "email", "role").where({ tenant_id: tenantId });
    const assigned = await kdb("user_tenant_assignments as uta")
      .join("users as u", "uta.user_id", "u.id")
      .select("u.id", "u.name", "u.email", "u.role")
      .where("uta.tenant_id", tenantId);
    const map = new Map<string, any>();
    for (const u of [...direct, ...assigned]) {
      if (u.role === UserRole.Admin) continue;
      map.set(u.id, u);
    }
    res.json({ success: true, data: [...map.values()] });
  } catch (e) {
    respondDomainError(res, e, "restaurant.assignable-users");
  }
});

router.post("/operators", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.MANAGE_RESTAURANT_OPERATORS), validate(restaurantOperatorSchema), async (req, res) => {
  const { userId } = req.body;
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  try {
    const targetUser = await kdb("users").select("tenant_id", "role").where({ id: userId }).first();
    if (!targetUser) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    if (targetUser.role === UserRole.Admin) return res.status(403).json({ success: false, message: "لا يمكن تعيين مدير التطبيق كمسؤول خدمة" });
    const belongs = sameId(targetUser.tenant_id, tenantId)
      || !!(await kdb("user_tenant_assignments").where({ user_id: userId, tenant_id: tenantId }).first());
    if (!belongs) return res.status(403).json({ success: false, message: "هذا المستخدم ليس من سكان سكنك" });
    const exists = await kdb("restaurant_operators").where({ tenant_id: tenantId, user_id: userId }).first();
    if (exists) return res.status(400).json({ success: false, message: "المستخدم مسؤول مطعم بالفعل" });
    await kdb("restaurant_operators").insert({ id: uuidv4(), tenant_id: tenantId, user_id: userId, created_by: req.user.id });
    res.status(201).json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "restaurant.operators.create");
  }
});

router.delete("/operators/:userId", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.MANAGE_RESTAURANT_OPERATORS), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await kdb("restaurant_operators").where({ user_id: req.params.userId, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "restaurant.operators.delete");
  }
});

// ─── Orders ───
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: [],
  cancelled: [],
};
const ACTION_TO_STATUS: Record<string, string> = {
  confirm: "confirmed",
  preparing: "preparing",
  ready: "ready",
  serve: "served",
  cancel: "cancelled",
};

router.get("/orders", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.json({ success: true, data: [] });
  try {
    const staff = STAFF_ROLES.includes(req.user.role) || await isRestaurantOperator(req.user.id, tenantId);
    let query = kdb("restaurant_orders").where({ tenant_id: tenantId });
    if (req.query.status) query = query.where({ status: req.query.status as string });
    if (!staff) {
      const sid = await selfStudentId(req.user.id);
      query = query.where(function (this: any) {
        this.where({ ordered_by: req.user.id });
        if (sid) this.orWhere({ student_id: sid });
      });
    }
    const orders = await query.orderBy("created_at", "desc");
    const orderIds = orders.map((o: any) => o.id);
    const items = orderIds.length
      ? await kdb("restaurant_order_items").whereIn("order_id", orderIds)
      : [];
    const byOrder = new Map<string, any[]>();
    for (const it of items) {
      if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
      byOrder.get(it.order_id)!.push(it);
    }
    res.json({ success: true, data: orders.map((o: any) => ({ ...o, items: byOrder.get(o.id) || [] })) });
  } catch (e) {
    respondDomainError(res, e, "restaurant.orders.list");
  }
});

router.get("/orders/:id", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(404).json({ success: false, message: "الطلب غير موجود" });
  try {
    const order = await kdb("restaurant_orders").where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!order) return res.status(404).json({ success: false, message: "الطلب غير موجود" });
    const staff = STAFF_ROLES.includes(req.user.role) || await isRestaurantOperator(req.user.id, tenantId);
    if (!staff) {
      const sid = await selfStudentId(req.user.id);
      const own = sameId(order.ordered_by, req.user.id) || (!!sid && sameId(order.student_id, sid));
      if (!own) return res.status(403).json({ success: false, message: "غير مسموح بعرض هذا الطلب" });
    }
    const items = await kdb("restaurant_order_items").where({ order_id: order.id });
    res.json({ success: true, data: { ...order, items } });
  } catch (e) {
    respondDomainError(res, e, "restaurant.orders.get");
  }
});

router.post("/orders", authenticate, requireServiceEnabled("restaurant"), authorizePermission(AppPermission.ORDER_RESTAURANT), validate(placeRestaurantOrderSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  const userId = req.user.id;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const { items, student_id, meal_slot, notes } = req.body;
  try {
    let targetStudentId: string | null = null;
    if (student_id) {
      const staff = STAFF_ROLES.includes(req.user.role) || await checkUserPermission(userId, AppPermission.MANAGE_RESTAURANT);
      if (!staff) return res.status(403).json({ success: false, message: "غير مسموح بالطلب بالنيابة عن طالب آخر" });
      const st = await kdb("students").where({ id: student_id, tenant_id: tenantId }).first();
      if (!st) return res.status(400).json({ success: false, message: "الطالب غير موجود في هذا السكن" });
      targetStudentId = st.id;
    } else {
      targetStudentId = await selfStudentId(userId);
    }

    // سجّل بيانات صاحب الطلب (الاسم/التليفون/الشقة/الغرفة) وقت الطلب
    const identity = await resolveCustomerIdentity({ studentId: targetStudentId, userId });

    const result = await kdb.transaction(async (trx) => {
      const ids: string[] = [...new Set((items as any[]).map((i) => String(i.item_id)))];
      const dbItems = await trx("restaurant_items").whereIn("id", ids).where({ tenant_id: tenantId });
      const map = new Map<string, any>(dbItems.map((i: any) => [i.id, i]));
      const orderId = uuidv4();
      let total = 0;
      let itemCount = 0;
      const rows: any[] = [];
      for (const it of items) {
        const p = map.get(it.item_id);
        if (!p) throw new InputError("إحدى الوجبات غير متاحة في هذا السكن");
        if (!normalizeFlag(p.is_available, true)) throw new InputError(`الوجبة "${p.name}" غير متاحة حاليًا`);
        const included = normalizeFlag(p.is_included_meal, false);
        const priced = included
          ? { originalUnitPrice: 0, unitPrice: 0, discountAmount: 0, lineTotal: 0 }
          : priceLine(p.price, p.discount_type, p.discount_value, it.quantity);
        total += priced.lineTotal;
        itemCount += it.quantity;
        rows.push({
          id: uuidv4(),
          order_id: orderId,
          item_id: p.id,
          item_name: p.name,
          unit_price: priced.unitPrice,
          quantity: it.quantity,
          line_total: priced.lineTotal,
          original_unit_price: priced.originalUnitPrice,
          discount_amount: priced.discountAmount,
          is_included_meal: included ? 1 : 0,
        });
      }
      await trx("restaurant_orders").insert({
        id: orderId,
        tenant_id: tenantId,
        student_id: targetStudentId,
        ordered_by: userId,
        status: "pending",
        meal_slot: meal_slot || null,
        notes: notes || null,
        total,
        item_count: itemCount,
        customer_name: identity.customer_name,
        customer_phone: identity.customer_phone,
        apartment_name: identity.apartment_name,
        room_name: identity.room_name,
      });
      await trx("restaurant_order_items").insert(rows);
      return { id: orderId, total, item_count: itemCount };
    });

    res.status(201).json({ success: true, data: result });
  } catch (e) {
    respondDomainError(res, e, "restaurant.orders.create");
  }
});

router.post("/orders/:id/status", authenticate, requireServiceEnabled("restaurant"), validate(restaurantOrderStatusSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const { action, reason } = req.body;
  const target = ACTION_TO_STATUS[action];
  try {
    const order = await kdb("restaurant_orders").where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!order) return res.status(404).json({ success: false, message: "الطلب غير موجود" });

    const staff = await canOperateRestaurant(req);
    const isOwn = sameId(order.ordered_by, req.user.id);
    if (action === "cancel" && isOwn && !staff) {
      if (!["pending", "confirmed"].includes(order.status)) {
        return res.status(403).json({ success: false, message: "لا يمكن إلغاء الطلب في هذه المرحلة" });
      }
    } else if (!staff) {
      return res.status(403).json({ success: false, message: "غير مسموح بتنفيذ هذا الإجراء" });
    }

    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(target)) {
      return res.status(400).json({ success: false, message: "تحويل الحالة غير مسموح" });
    }

    let ledgerEntryId: string | null = null;
    await kdb.transaction(async (trx) => {
      const update: Record<string, any> = { status: target, updated_at: kdb.fn.now(), processed_by: req.user.id };
      if (action === "cancel") {
        update.cancelled_at = kdb.fn.now();
        update.cancelled_by = req.user.id;
        update.cancel_reason = reason || null;
      }
      await trx("restaurant_orders").where({ id: order.id, tenant_id: tenantId }).update(update);

      if (action === "serve" && !order.ledger_entry_id && Number(order.total) > 0) {
        const amount = Number(order.total);
        const entry = await postEntry(trx, {
          entryType: "payment",
          amount,
          lines: restaurantRevenueLines(amount),
          entryDate: new Date(),
          tenantId,
          category: "مطعم",
          description: `مبيعات مطعم - طلب ${order.id}`,
          reference: `restaurant-order:${order.id}`,
          source: "api",
          createdBy: req.user.id,
        });
        await trx("restaurant_orders").where({ id: order.id }).update({ ledger_entry_id: entry.id });
        ledgerEntryId = entry.id;
      }
    });

    if (action === "ready" && order.student_id) {
      kdb("students").select("user_id").where({ id: order.student_id }).first()
        .then((st: any) => {
          if (st?.user_id) {
            return createNotification({
              userId: st.user_id,
              tenantId,
              title: "طلبك جاهز 🍽️",
              message: "طلبك في المطعم جاهز للاستلام",
              type: "success",
              metadata: JSON.stringify({ page: "restaurant" }),
            });
          }
        })
        .catch(() => { /* notification is best-effort */ });
    }

    res.json({ success: true, data: { status: target, ledger_entry_id: ledgerEntryId } });
  } catch (e) {
    respondDomainError(res, e, "restaurant.orders.status");
  }
});

export default router;