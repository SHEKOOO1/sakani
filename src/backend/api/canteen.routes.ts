import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb, checkUserPermission } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission, UserRole } from "../../types/permissions";
import { validate } from "../validation/middleware";
import {
  canteenCategorySchema,
  updateCanteenCategorySchema,
  canteenProductSchema,
  updateCanteenProductSchema,
  canteenStockInSchema,
  canteenSaleSchema,
  canteenReturnSchema,
  canteenWasteSchema,
  canteenAdjustmentSchema,
  canteenOperatorSchema,
} from "../validation/schemas";
import { createNotification } from "./notifications.routes";
import { sameId } from "../infrastructure/id-match";
import { requireServiceEnabled } from "../infrastructure/service-features";
import { postEntry, reverseEntry, canteenRevenueLines } from "../services/ledger.service";
import { priceLine } from "../services/pricing.service";
import { resolveCustomerIdentity } from "../services/customer-identity.service";
import { InputError, ConflictError, InsufficientStockError, StockChangedError, affected } from "../infrastructure/domain-errors";
import { logger } from "../infrastructure/logger.ts";

const router = express.Router();

function normalizeFlag(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null) return fallback;
  return value !== 0 && value !== "0" && value !== false && value !== "false";
}

const isCanteenOperator = async (userId: string, tenantId: string): Promise<boolean> => {
  const op = await kdb("canteen_operators").where({ user_id: userId, tenant_id: tenantId }).first();
  return !!op;
};

async function canOperateCanteen(req: any): Promise<boolean> {
  const { id: userId, tenantId, role } = req.user || {};
  if (!tenantId) return false;
  if (role === UserRole.Admin || role === UserRole.Supervisor || role === UserRole.Priest) return true;
  if (await checkUserPermission(userId, AppPermission.MANAGE_CANTEEN)) return true;
  return isCanteenOperator(userId, tenantId);
}

function respondDomainError(res: any, e: unknown, label: string): void {
  if (e instanceof InputError) {
    res.status(400).json({ success: false, message: e.message });
    return;
  }
  if (e instanceof ConflictError) {
    res.status(409).json({ success: false, message: e.message });
    return;
  }
  if (e instanceof InsufficientStockError) {
    res.status(400).json({ success: false, message: e.message });
    return;
  }
  if (e instanceof StockChangedError) {
    res.status(409).json({ success: false, message: e.message });
    return;
  }
  logger.error(`${label}: ${(e as Error)?.message}`);
  res.status(500).json({ success: false, message: "حدث خطأ. من فضلك حاول مرة أخرى." });
}

async function lowStockProducts(tenantId: string): Promise<any[]> {
  const products = await kdb("canteen_products").where({ tenant_id: tenantId });
  return products.filter((p: any) =>
    normalizeFlag(p.is_active, true) &&
    p.min_quantity !== null && p.min_quantity !== undefined &&
    Number(p.quantity_on_hand || 0) <= Number(p.min_quantity || 0),
  );
}

async function notifyLowStock(tenantId: string): Promise<void> {
  try {
    const low = await lowStockProducts(tenantId);
    if (low.length === 0) return;
    const operators = await kdb("canteen_operators").where({ tenant_id: tenantId });
    const reviewerIds = new Set<string>();
    for (const op of operators) reviewerIds.add(op.user_id);
    const staff = await kdb("users").where({ tenant_id: tenantId }).whereIn("role", [UserRole.Supervisor, UserRole.Priest]);
    for (const s of staff) reviewerIds.add(s.id);
    const names = low.slice(0, 10).map((p: any) => `${p.name} (${Number(p.quantity_on_hand)})`).join("، ");
    for (const userId of reviewerIds) {
      await createNotification({
        userId,
        tenantId,
        title: "⚠️ تنبيه مخزون الكانتين",
        message: `المنتجات التالية وصلت للحد الأدنى: ${names}`,
        type: "warning",
        metadata: JSON.stringify({ page: "canteen" }),
      });
    }
  } catch (e) {
    logger.error(`canteen.low-stock.notify: ${(e as Error)?.message}`);
  }
}

// ─── Categories ───
router.get("/categories", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const rows = await kdb("canteen_categories").where({ tenant_id: tenantId }).orderBy("sort_order", "asc");
    res.json({ success: true, data: rows });
  } catch (e) {
    respondDomainError(res, e, "canteen.categories.list");
  }
});

router.post("/categories", authenticate, requireServiceEnabled("canteen"), authorizePermission(AppPermission.MANAGE_CANTEEN), validate(canteenCategorySchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const { name, sort_order, is_active } = req.body;
  try {
    const id = uuidv4();
    await kdb("canteen_categories").insert({ id, tenant_id: tenantId, name, sort_order: sort_order ?? 0, is_active: is_active ? 1 : 0 });
    res.status(201).json({ success: true, data: { id } });
  } catch (e) {
    respondDomainError(res, e, "canteen.categories.create");
  }
});

router.put("/categories/:id", authenticate, requireServiceEnabled("canteen"), authorizePermission(AppPermission.MANAGE_CANTEEN), validate(updateCanteenCategorySchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { name, sort_order, is_active } = req.body;
  try {
    const update: Record<string, any> = {};
    if (name !== undefined) update.name = name;
    if (sort_order !== undefined) update.sort_order = sort_order;
    if (is_active !== undefined) update.is_active = is_active ? 1 : 0;
    if (Object.keys(update).length === 0) return res.status(400).json({ success: false, message: "لا توجد بيانات للتحديث" });
    const changed = await kdb("canteen_categories").where({ id: req.params.id, tenant_id: tenantId }).update(update);
    if (!affected(changed)) return res.status(404).json({ success: false, message: "التصنيف غير موجود" });
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.categories.update");
  }
});

router.delete("/categories/:id", authenticate, requireServiceEnabled("canteen"), authorizePermission(AppPermission.MANAGE_CANTEEN), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await kdb("canteen_products").where({ category_id: req.params.id, tenant_id: tenantId }).update({ category_id: null });
    await kdb("canteen_categories").where({ id: req.params.id, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.categories.delete");
  }
});

// ─── Products ───
router.get("/products", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const rows = await kdb("canteen_products").where({ tenant_id: tenantId }).orderBy("name", "asc");
    res.json({ success: true, data: rows });
  } catch (e) {
    respondDomainError(res, e, "canteen.products.list");
  }
});

router.get("/low-stock", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.json({ success: true, data: [] });
  try {
    res.json({ success: true, data: await lowStockProducts(tenantId) });
  } catch (e) {
    respondDomainError(res, e, "canteen.low-stock");
  }
});

router.post("/products", authenticate, requireServiceEnabled("canteen"), authorizePermission(AppPermission.MANAGE_CANTEEN), validate(canteenProductSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  const { name, category_id, unit, barcode, cost_price, sell_price, quantity_on_hand, min_quantity, is_active, image_url, discount_type, discount_value } = req.body;
  try {
    if (category_id) {
      const cat = await kdb("canteen_categories").where({ id: category_id, tenant_id: tenantId }).first();
      if (!cat) return res.status(400).json({ success: false, message: "التصنيف غير موجود في هذا السكن" });
    }
    const id = uuidv4();
    const initialQty = Number(quantity_on_hand || 0);
    await kdb.transaction(async (trx) => {
      await trx("canteen_products").insert({
        id, tenant_id: tenantId, name,
        category_id: category_id || null,
        unit: unit || "قطعة",
        barcode: barcode || null,
        cost_price: cost_price ?? 0,
        sell_price: sell_price ?? 0,
        quantity_on_hand: initialQty,
        min_quantity: min_quantity ?? 0,
        is_active: is_active ? 1 : 0,
        image_url: image_url || null,
        discount_type: discount_type || null,
        discount_value: discount_value ?? 0,
      });
      if (initialQty > 0) {
        await trx("canteen_stock_movements").insert({
          id: uuidv4(), tenant_id: tenantId, product_id: id,
          movement_type: "purchase", quantity: initialQty, unit_cost: cost_price ?? 0,
          note: "رصيد افتتاحي", actor_id: req.user.id, created_at: new Date(),
        });
      }
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (e) {
    respondDomainError(res, e, "canteen.products.create");
  }
});

router.put("/products/:id", authenticate, requireServiceEnabled("canteen"), authorizePermission(AppPermission.MANAGE_CANTEEN), validate(updateCanteenProductSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { name, category_id, unit, barcode, cost_price, sell_price, min_quantity, is_active, image_url, discount_type, discount_value } = req.body;
  try {
    if (category_id) {
      const cat = await kdb("canteen_categories").where({ id: category_id, tenant_id: tenantId }).first();
      if (!cat) return res.status(400).json({ success: false, message: "التصنيف غير موجود في هذا السكن" });
    }
    const update: Record<string, any> = { updated_at: kdb.fn.now() };
    if (name !== undefined) update.name = name;
    if (category_id !== undefined) update.category_id = category_id || null;
    if (unit !== undefined) update.unit = unit;
    if (barcode !== undefined) update.barcode = barcode || null;
    if (cost_price !== undefined) update.cost_price = cost_price;
    if (sell_price !== undefined) update.sell_price = sell_price;
    if (min_quantity !== undefined) update.min_quantity = min_quantity;
    if (is_active !== undefined) update.is_active = is_active ? 1 : 0;
    if (image_url !== undefined) update.image_url = image_url || null;
    if (discount_type !== undefined) update.discount_type = discount_type || null;
    if (discount_value !== undefined) update.discount_value = discount_value;
    const changed = await kdb("canteen_products").where({ id: req.params.id, tenant_id: tenantId }).update(update);
    if (!affected(changed)) return res.status(404).json({ success: false, message: "المنتج غير موجود" });
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.products.update");
  }
});

router.delete("/products/:id", authenticate, requireServiceEnabled("canteen"), authorizePermission(AppPermission.MANAGE_CANTEEN), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await kdb("canteen_products").where({ id: req.params.id, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.products.delete");
  }
});

// ─── Stock movements: purchase / waste / adjustment ───
router.get("/stock/movements", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.json({ success: true, data: [] });
  try {
    let query = kdb("canteen_stock_movements").where({ tenant_id: tenantId });
    if (req.query.product_id) query = query.where({ product_id: req.query.product_id as string });
    if (req.query.type) query = query.where({ movement_type: req.query.type as string });
    const rows = await query.orderBy("created_at", "desc").limit(500);
    res.json({ success: true, data: rows });
  } catch (e) {
    respondDomainError(res, e, "canteen.stock.movements.list");
  }
});

router.post("/stock/purchase", authenticate, requireServiceEnabled("canteen"), validate(canteenStockInSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  if (!(await canOperateCanteen(req))) return res.status(403).json({ success: false, message: "غير مسموح بتوريد مخزون الكانتين" });
  const { product_id, quantity, unit_cost, note } = req.body;
  try {
    await kdb.transaction(async (trx) => {
      const p = await trx("canteen_products").where({ id: product_id, tenant_id: tenantId }).first();
      if (!p) throw new InputError("المنتج غير موجود");
      const oldQty = Number(p.quantity_on_hand || 0);
      const newQty = oldQty + Number(quantity);
      const changed = await trx("canteen_products").where({ id: product_id, tenant_id: tenantId }).where("quantity_on_hand", oldQty).update({ quantity_on_hand: newQty });
      if (!affected(changed)) throw new StockChangedError("تغيّر المخزون، أعد المحاولة");
      await trx("canteen_stock_movements").insert({
        id: uuidv4(), tenant_id: tenantId, product_id,
        movement_type: "purchase", quantity: Number(quantity), unit_cost: unit_cost ?? 0,
        note: note || null, actor_id: req.user.id, created_at: new Date(),
      });
    });
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.stock.purchase");
  }
});

router.post("/stock/waste", authenticate, requireServiceEnabled("canteen"), validate(canteenWasteSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  if (!(await canOperateCanteen(req))) return res.status(403).json({ success: false, message: "غير مسموح بتسجيل التالف" });
  const { product_id, quantity, reason } = req.body;
  try {
    await kdb.transaction(async (trx) => {
      const p = await trx("canteen_products").where({ id: product_id, tenant_id: tenantId }).first();
      if (!p) throw new InputError("المنتج غير موجود");
      const oldQty = Number(p.quantity_on_hand || 0);
      if (oldQty < Number(quantity)) throw new InsufficientStockError("الكمية التالفة أكبر من المتوفر");
      const newQty = oldQty - Number(quantity);
      const changed = await trx("canteen_products").where({ id: product_id, tenant_id: tenantId }).where("quantity_on_hand", oldQty).update({ quantity_on_hand: newQty });
      if (!affected(changed)) throw new StockChangedError("تغيّر المخزون، أعد المحاولة");
      await trx("canteen_stock_movements").insert({
        id: uuidv4(), tenant_id: tenantId, product_id,
        movement_type: "waste", quantity: -Number(quantity),
        note: reason, actor_id: req.user.id, created_at: new Date(),
      });
    });
    await notifyLowStock(tenantId);
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.stock.waste");
  }
});

router.post("/stock/adjustment", authenticate, requireServiceEnabled("canteen"), validate(canteenAdjustmentSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  if (!(await canOperateCanteen(req))) return res.status(403).json({ success: false, message: "غير مسموح بجرد مخزون الكانتين" });
  const { product_id, new_quantity, reason } = req.body;
  try {
    await kdb.transaction(async (trx) => {
      const p = await trx("canteen_products").where({ id: product_id, tenant_id: tenantId }).first();
      if (!p) throw new InputError("المنتج غير موجود");
      const oldQty = Number(p.quantity_on_hand || 0);
      const delta = Number(new_quantity) - oldQty;
      const changed = await trx("canteen_products").where({ id: product_id, tenant_id: tenantId }).where("quantity_on_hand", oldQty).update({ quantity_on_hand: Number(new_quantity) });
      if (!affected(changed)) throw new StockChangedError("تغيّر المخزون، أعد المحاولة");
      await trx("canteen_stock_movements").insert({
        id: uuidv4(), tenant_id: tenantId, product_id,
        movement_type: "adjustment", quantity: delta,
        note: reason, actor_id: req.user.id, created_at: new Date(),
      });
    });
    await notifyLowStock(tenantId);
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.stock.adjustment");
  }
});

// ─── Operators ───
router.get("/operators", authenticate, authorizePermission(AppPermission.MANAGE_CANTEEN_OPERATORS), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const operators = await kdb("canteen_operators as co")
      .join("users as u", "co.user_id", "u.id")
      .select("co.*", "u.name", "u.email", "u.role")
      .where("co.tenant_id", tenantId);
    res.json({ success: true, data: operators });
  } catch (e) {
    respondDomainError(res, e, "canteen.operators.list");
  }
});

router.get("/is-operator", authenticate, async (req, res) => {
  const { id: userId, tenantId } = req.user;
  if (!tenantId) return res.json({ success: true, isOperator: false });
  try {
    res.json({ success: true, isOperator: await isCanteenOperator(userId, tenantId) });
  } catch (e) {
    respondDomainError(res, e, "canteen.operators.is-operator");
  }
});

router.get("/assignable-users", authenticate, authorizePermission(AppPermission.MANAGE_CANTEEN_OPERATORS), async (req, res) => {
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
    respondDomainError(res, e, "canteen.assignable-users");
  }
});

// طلاب السكن (لاختيار المشتري في نقطة البيع) — متاح لمن يستطيع تشغيل الكانتين
router.get("/students", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.json({ success: true, data: [] });
  if (!(await canOperateCanteen(req))) return res.status(403).json({ success: false, message: "غير مسموح بعرض الطلاب" });
  try {
    const rows = await kdb("students as s")
      .leftJoin("users as u", "s.user_id", "u.id")
      .leftJoin("rooms as r", "s.room_id", "r.id")
      .leftJoin("apartments as a", "r.apartment_id", "a.id")
      .select(
        "s.id",
        kdb.raw("COALESCE(s.name, u.name) as name"),
        kdb.raw("COALESCE(s.phone, u.phone) as phone"),
        "r.room_number as room_name",
        "a.name as apartment_name",
      )
      .where("s.tenant_id", tenantId)
      .orderBy("name", "asc");
    res.json({ success: true, data: rows });
  } catch (e) {
    respondDomainError(res, e, "canteen.students.list");
  }
});

router.post("/operators", authenticate, requireServiceEnabled("canteen"), authorizePermission(AppPermission.MANAGE_CANTEEN_OPERATORS), validate(canteenOperatorSchema), async (req, res) => {
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
    const exists = await kdb("canteen_operators").where({ tenant_id: tenantId, user_id: userId }).first();
    if (exists) return res.status(400).json({ success: false, message: "المستخدم مسؤول كانتين بالفعل" });
    await kdb("canteen_operators").insert({ id: uuidv4(), tenant_id: tenantId, user_id: userId, created_by: req.user.id });
    res.status(201).json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.operators.create");
  }
});

router.delete("/operators/:userId", authenticate, requireServiceEnabled("canteen"), authorizePermission(AppPermission.MANAGE_CANTEEN_OPERATORS), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await kdb("canteen_operators").where({ user_id: req.params.userId, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.operators.delete");
  }
});

// ─── Sales (POS) ───
router.get("/sales", authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.json({ success: true, data: [] });
  try {
    const sales = await kdb("canteen_sales").where({ tenant_id: tenantId }).orderBy("sold_at", "desc").limit(200);
    const saleIds = sales.map((s: any) => s.id);
    const items = saleIds.length ? await kdb("canteen_sale_items").whereIn("sale_id", saleIds) : [];
    const bySale = new Map<string, any[]>();
    for (const it of items) {
      if (!bySale.has(it.sale_id)) bySale.set(it.sale_id, []);
      bySale.get(it.sale_id)!.push(it);
    }
    res.json({ success: true, data: sales.map((s: any) => ({ ...s, items: bySale.get(s.id) || [] })) });
  } catch (e) {
    respondDomainError(res, e, "canteen.sales.list");
  }
});

router.post("/sales", authenticate, requireServiceEnabled("canteen"), validate(canteenSaleSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  const userId = req.user.id;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  if (!(await canOperateCanteen(req))) return res.status(403).json({ success: false, message: "غير مسموح بتسجيل بيع في الكانتين" });
  const { sale_ref, items, student_id, payment_method, note } = req.body;

  try {
    const existing = await kdb("canteen_sales").where({ tenant_id: tenantId, sale_ref }).first();
    if (existing) {
      return res.status(409).json({ success: false, message: "تم تسجيل هذه الفاتورة مسبقًا" });
    }

    // سجّل بيانات صاحب الفاتورة (الاسم/التليفون/الشقة/الغرفة) وقت البيع
    const identity = await resolveCustomerIdentity({ studentId: student_id || null, userId });

    let saleId = "";
    let total = 0;
    await kdb.transaction(async (trx) => {
      saleId = uuidv4();
      const saleRows: any[] = [];
      const movementRows: any[] = [];
      total = 0;

      for (const it of items) {
        const p = await trx("canteen_products").where({ id: it.product_id, tenant_id: tenantId }).first();
        if (!p) throw new InputError("المنتج غير موجود في هذا السكن");
        if (!normalizeFlag(p.is_active, true)) throw new InputError(`المنتج "${p.name}" غير مفعّل`);
        const oldQty = Number(p.quantity_on_hand || 0);
        const qty = Number(it.quantity);
        if (oldQty < qty) throw new InsufficientStockError(`الكمية المتوفرة من "${p.name}" غير كافية`);
        const newQty = oldQty - qty;
        const changed = await trx("canteen_products")
          .where({ id: p.id, tenant_id: tenantId })
          .where("quantity_on_hand", oldQty)
          .update({ quantity_on_hand: newQty });
        if (!affected(changed)) throw new StockChangedError(`تغيّرت كمية "${p.name}"، أعد المحاولة`);

        const priced = priceLine(p.sell_price, p.discount_type, p.discount_value, qty);
        total += priced.lineTotal;
        const saleItemId = uuidv4();
        saleRows.push({
          id: saleItemId, sale_id: saleId, product_id: p.id, product_name: p.name,
          quantity: qty, unit_price: priced.unitPrice, line_total: priced.lineTotal,
          original_unit_price: priced.originalUnitPrice, discount_amount: priced.discountAmount,
        });
        movementRows.push({
          id: uuidv4(), tenant_id: tenantId, product_id: p.id,
          movement_type: "sale", quantity: -qty, unit_cost: Number(p.cost_price || 0),
          note: note || `فاتورة ${sale_ref}`, actor_id: userId,
          student_id: student_id || null, sale_id: saleId, sale_item_id: saleItemId,
          created_at: new Date(),
        });
      }

      await trx("canteen_sales").insert({
        id: saleId, tenant_id: tenantId, sale_ref,
        operator_id: userId, student_id: student_id || null,
        total, payment_method: payment_method || "cash",
        status: "completed", note: note || null,
        customer_name: identity.customer_name,
        customer_phone: identity.customer_phone,
        apartment_name: identity.apartment_name,
        room_name: identity.room_name,
      });
      await trx("canteen_sale_items").insert(saleRows);
      await trx("canteen_stock_movements").insert(movementRows);

      if (total > 0) {
        const entry = await postEntry(trx, {
          entryType: "payment",
          amount: total,
          lines: canteenRevenueLines(total),
          entryDate: new Date(),
          tenantId,
          category: "كانتين",
          description: `مبيعات كانتين - فاتورة ${sale_ref}`,
          reference: `canteen-sale:${saleId}`,
          source: "api",
          createdBy: userId,
        });
        await trx("canteen_sales").where({ id: saleId }).update({ ledger_entry_id: entry.id });
      }
    });

    notifyLowStock(tenantId).catch(() => { /* best-effort */ });
    res.status(201).json({ success: true, data: { id: saleId, total, sale_ref } });
  } catch (e) {
    // Unique (tenant_id, sale_ref) race falls here — surface the honest message.
    const again = await kdb("canteen_sales").where({ tenant_id: tenantId, sale_ref }).first().catch(() => null);
    if (again) {
      return res.status(409).json({ success: false, message: "تم تسجيل هذه الفاتورة مسبقًا" });
    }
    respondDomainError(res, e, "canteen.sales.create");
  }
});

// ─── Returns ───
router.post("/returns", authenticate, requireServiceEnabled("canteen"), validate(canteenReturnSchema), async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
  if (!(await canOperateCanteen(req))) return res.status(403).json({ success: false, message: "غير مسموح بتسجيل مرتجع في الكانتين" });
  const { sale_id, items, reason } = req.body;

  try {
    const sale = await kdb("canteen_sales").where({ id: sale_id, tenant_id: tenantId }).first();
    if (!sale) return res.status(404).json({ success: false, message: "الفاتورة غير موجودة" });
    if (sale.status !== "completed") return res.status(400).json({ success: false, message: "لا يمكن الإرجاع لفاتورة غير مكتملة" });

    const saleItems = await kdb("canteen_sale_items").where({ sale_id: sale.id });
    const saleItemByProduct = new Map<string, any>(saleItems.map((s: any) => [s.product_id, s]));

    await kdb.transaction(async (trx) => {
      for (const r of items) {
        const si = saleItemByProduct.get(r.product_id);
        if (!si) throw new InputError("هذا المنتج ليس ضمن الفاتورة");
        const prev = await trx("canteen_stock_movements").where({ sale_id: sale.id, product_id: si.product_id, movement_type: "return" });
        const prevQty = prev.reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0);
        if (prevQty + Number(r.quantity) > Number(si.quantity)) {
          throw new InputError(`كمية الإرجاع من "${si.product_name}" أكبر من المباع`);
        }
        const p = await trx("canteen_products").where({ id: si.product_id, tenant_id: tenantId }).first();
        if (!p) throw new InputError("المنتج غير موجود");
        const oldQty = Number(p.quantity_on_hand || 0);
        const newQty = oldQty + Number(r.quantity);
        const changed = await trx("canteen_products").where({ id: si.product_id, tenant_id: tenantId }).where("quantity_on_hand", oldQty).update({ quantity_on_hand: newQty });
        if (!affected(changed)) throw new StockChangedError("تغيّر المخزون، أعد المحاولة");
        await trx("canteen_stock_movements").insert({
          id: uuidv4(), tenant_id: tenantId, product_id: si.product_id,
          movement_type: "return", quantity: Number(r.quantity), unit_cost: Number(si.unit_price || 0),
          note: reason, actor_id: req.user.id, student_id: sale.student_id || null,
          sale_id: sale.id, sale_item_id: si.id, created_at: new Date(),
        });
      }

      // إرجاع كامل لكل الفاتورة → عكس القيد المالي (المبالغ المستردة نقدية)
      const allReturns = await trx("canteen_stock_movements").where({ sale_id: sale.id, movement_type: "return" });
      const returnedByProduct = new Map<string, number>();
      for (const m of allReturns) {
        returnedByProduct.set(m.product_id, (returnedByProduct.get(m.product_id) || 0) + Number(m.quantity || 0));
      }
      const fullyReturned = saleItems.length > 0 && saleItems.every((si: any) =>
        (returnedByProduct.get(si.product_id) || 0) >= Number(si.quantity),
      );
      if (fullyReturned && sale.ledger_entry_id) {
        await reverseEntry(trx, {
          entryId: sale.ledger_entry_id,
          reason: reason || "إرجاع كامل لفاتورة الكانتين",
          createdBy: req.user.id,
          source: "api",
        });
        await trx("canteen_sales").where({ id: sale.id }).update({ status: "returned" });
      }
    });

    notifyLowStock(tenantId).catch(() => { /* best-effort */ });
    res.json({ success: true });
  } catch (e) {
    respondDomainError(res, e, "canteen.returns.create");
  }
});

export default router;