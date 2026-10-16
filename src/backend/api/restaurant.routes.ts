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
import { createNotification, notifyRestaurantOrderPlaced } from "./notifications.routes";
import { sameId } from "../infrastructure/id-match";
import { requireServiceEnabled } from "../infrastructure/service-features";
import { postEntry, restaurantRevenueLines } from "../services/ledger.service";
import { buildServiceLedgerRouter } from "./service-ledger.routes";
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

    // اسم من قام بالطلب فعليًا (حتى لو كان مشرفًا أو موظفًا)
    const actor = await kdb("users").select("name").where({ id: userId }).first();
    const actorName: string | null = (actor as any)?.name ?? null;

    // رقم الطلب: تسلسلي لكل سكن ولكل يوم على حدة (يبدأ من 1 كل يوم جديد)
    const today = new Date();
    const orderDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const buildOrder = () => kdb.transaction(async (trx) => {
      const ids: string[] = [...new Set((items as any[]).map((i) => String(i.item_id)))];
      const dbItems = await trx("restaurant_items").whereIn("id", ids).where({ tenant_id: tenantId });
      const map = new Map<string, any>(dbItems.map((i: any) => [i.id, i]));

      const maxRow = await trx("restaurant_orders")
        .where({ tenant_id: tenantId, order_date: orderDate })
        .max("order_number as m")
        .first();
      const orderNumber = Number((maxRow as any)?.m || 0) + 1;

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
        ordered_by_name: actorName,
        ordered_by_role: req.user.role || null,
        status: "pending",
        meal_slot: meal_slot || null,
        notes: notes || null,
        total,
        item_count: itemCount,
        order_number: orderNumber,
        order_date: orderDate,
        customer_name: identity.customer_name,
        customer_phone: identity.customer_phone,
        apartment_name: identity.apartment_name,
        room_name: identity.room_name,
      });
      await trx("restaurant_order_items").insert(rows);
      return { id: orderId, total, item_count: itemCount, order_number: orderNumber, order_date: orderDate };
    });

    // أعد المحاولة عند تعارض نادر في رقم الطلب (فهرس فريد على السكن/اليوم/الرقم)
    let result: { id: string; total: number; item_count: number; order_number: number; order_date: string } | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        result = await buildOrder();
        break;
      } catch (e: any) {
        const num = e?.number ?? e?.originalError?.info?.number;
        if ((num === 2601 || num === 2627) && attempt < 4) continue;
        throw e;
      }
    }
    if (!result) throw new InputError("تعذر تسجيل الطلب. حاول مرة أخرى.");

    // إشعار إدارة المطعم ومشرف السكن (best-effort — لا يعطّل الطلب)
    void notifyRestaurantOrderPlaced({
      tenantId,
      orderId: result.id,
      orderNumber: result.order_number,
      orderDate: result.order_date,
      total: result.total,
      itemCount: result.item_count,
      ordererName: actorName,
      customerName: identity.customer_name,
      roomName: identity.room_name,
      apartmentName: identity.apartment_name,
      orderedBy: userId,
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
      // Re-read inside the transaction so a concurrent request that already
      // performed this transition is absorbed instead of double-applied (a
      // double-click on "serve" can both pass the read-before-transition check
      // above). Idempotent: the second request sees the target state already
      // reached and is answered with the recorded ledger entry.
      const current = await trx("restaurant_orders").where({ id: order.id, tenant_id: tenantId }).first();
      if (!current) throw new InputError("الطلب غير موجود");
      if (current.status === target) {
        ledgerEntryId = current.ledger_entry_id || null;
        return;
      }
      if (!((STATUS_TRANSITIONS[current.status] || []).includes(target))) {
        throw new InputError("تحويل الحالة غير مسموح");
      }

      const update: Record<string, any> = { status: target, updated_at: kdb.fn.now(), processed_by: req.user.id };
      if (action === "cancel") {
        update.cancelled_at = kdb.fn.now();
        update.cancelled_by = req.user.id;
        update.cancel_reason = reason || null;
      }
      if (action === "serve") {
        // "اتلم" — يُسجَّل وقت التسليم ليطهر الطلب من طابور الانتظار
        update.collected_at = kdb.fn.now();
      }
      await trx("restaurant_orders").where({ id: order.id, tenant_id: tenantId }).update(update);

      if (action === "serve" && !current.ledger_entry_id && Number(order.total) > 0) {
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
          ledgerKind: 'restaurant',
        });
        await trx("restaurant_orders").where({ id: order.id }).update({ ledger_entry_id: entry.id });
        ledgerEntryId = entry.id;
      }
    });

    if (action === "ready") {
      // أعلم الطالب (إن وُجد) ومن قام بالطلب فعليًا (قد يكون مشرفًا/موظفًا)
      Promise.resolve()
        .then(async () => {
          const recipients = new Set<string>();
          if (order.student_id) {
            const st: any = await kdb("students").select("user_id").where({ id: order.student_id }).first();
            if (st?.user_id) recipients.add(st.user_id);
          }
          if (order.ordered_by) recipients.add(order.ordered_by);
          for (const userId of recipients) {
            await createNotification({
              userId,
              tenantId,
              title: "طلبك جاهز 🍽️",
              message: "طلبك في المطعم جاهز للاستلام",
              type: "success",
              metadata: JSON.stringify({ page: "restaurant", order_id: order.id }),
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

// ─── Daily journal / accounts (دفتر اليومية) ───
// The restaurant keeps its own book, separate from the housing ledger.
router.use("/ledger", buildServiceLedgerRouter({ kind: "restaurant", canOperate: canOperateRestaurant }));

export default router;