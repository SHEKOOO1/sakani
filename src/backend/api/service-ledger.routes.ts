import express from "express";
import { kdb } from "../infrastructure/db";
import { authenticate } from "./middleware";
import { validate } from "../validation/middleware";
import { serviceLedgerEntrySchema } from "../validation/schemas";
import {
  postEntry,
  reverseEntry,
  getLedgerMovements,
  countLedgerMovements,
  getLedgerClassTotals,
  restaurantRevenueLines,
  canteenRevenueLines,
  expenseLines,
  LedgerError,
  type LedgerKind,
} from "../services/ledger.service";
import { requireServiceEnabled, type TenantService } from "../infrastructure/service-features";
import { sameId } from "../infrastructure/id-match";
import { parsePagination } from "../services/radio/pagination.ts";
import { logger } from "../infrastructure/logger.ts";

/**
 * دفتر اليومية لمطعم/كانتين.
 *
 * The three activities share one journal but keep separate books (see
 * `ledger_kind`). These routes read and write only the book for the service
 * they are mounted on, so recording a restaurant expense can never leak into
 * the housing figures and vice versa. Reads/writes are tenant-scoped, not
 * admin-scoped: service entries are never `is_admin_only`, so an admin sees
 * them through the tenant(s) they manage, exactly like the rest of the module.
 */
type ServiceKind = Extract<LedgerKind, "restaurant" | "canteen">;

export interface ServiceLedgerConfig {
  kind: ServiceKind;
  /** Whether the caller may operate this book (view + record + delete). */
  canOperate: (req: any) => Promise<boolean>;
}

/** The tenant(s) whose book this caller may touch, plus the activity filter. */
function scopeOf(req: any, kind: ServiceKind) {
  const tenantId = req.user?.tenantId || null;
  const tenantIds: string[] = tenantId ? [tenantId] : (req.user?.tenantIds || []);
  return { tenantIds, ledgerKind: kind as LedgerKind };
}

export function buildServiceLedgerRouter(cfg: ServiceLedgerConfig) {
  const router = express.Router();
  const revenueLines = cfg.kind === "restaurant" ? restaurantRevenueLines : canteenRevenueLines;
  const service: TenantService = cfg.kind;

  // ─── List movements (with filters + pagination) ───
  router.get("/", authenticate, async (req, res) => {
    try {
      if (!(await cfg.canOperate(req))) {
        return res.status(403).json({ success: false, message: "غير مسموح بعرض دفتر اليومية" });
      }
      const { page, limit } = parsePagination(req.query);
      const scope = scopeOf(req, cfg.kind);
      if (!scope.tenantIds.length) {
        return res.json({ success: true, data: [], total: 0, page, limit, totalPages: 0 });
      }
      const filters = {
        ...scope,
        movementType: (req.query.type as "revenue" | "expense") || null,
        category: (req.query.category as string) || null,
        startDate: (req.query.startDate as string) || null,
        endDate: (req.query.endDate as string) || null,
        search: (req.query.search as string) || null,
      };
      const [total, rows] = await Promise.all([
        countLedgerMovements(filters),
        getLedgerMovements({ ...filters, limit, offset: (page - 1) * limit }),
      ]);
      res.json({ success: true, data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (e) {
      logger.error(`service-ledger.${cfg.kind}.list: ${(e as Error)?.message}`);
      res.status(500).json({ success: false, message: "تعذر تحميل دفتر اليومية. حاول مرة أخرى." });
    }
  });

  // ─── Accounts summary (وارد / مصروف / الصافي) ───
  router.get("/summary", authenticate, async (req, res) => {
    try {
      if (!(await cfg.canOperate(req))) {
        return res.status(403).json({ success: false, message: "غير مسموح بعرض ملخص الحسابات" });
      }
      const scope = scopeOf(req, cfg.kind);
      if (!scope.tenantIds.length) {
        return res.json({ success: true, data: { income: 0, expense: 0, net: 0, transactionCount: 0 } });
      }
      const totals = await getLedgerClassTotals({
        ...scope,
        category: (req.query.category as string) || null,
        startDate: (req.query.startDate as string) || null,
        endDate: (req.query.endDate as string) || null,
      });
      // A service book carries only income (payment) and expense entries;
      // penalties and discounts belong to the housing book and are zero here.
      res.json({
        success: true,
        data: {
          income: totals.income,
          expense: totals.expense,
          net: totals.income - totals.expense,
          transactionCount: totals.transactionCount,
        },
      });
    } catch (e) {
      logger.error(`service-ledger.${cfg.kind}.summary: ${(e as Error)?.message}`);
      res.status(500).json({ success: false, message: "تعذر تحميل ملخص الحسابات. حاول مرة أخرى." });
    }
  });

  // ─── Record a manual income/expense ───
  router.post("/", authenticate, requireServiceEnabled(service), validate(serviceLedgerEntrySchema), async (req, res) => {
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: "معرف السكن مطلوب" });
    if (!(await cfg.canOperate(req))) {
      return res.status(403).json({ success: false, message: "غير مسموح بتسجيل حركة في دفتر اليومية" });
    }
    const { type, category, amount, description, date } = req.body;
    const isIncome = type === "income";
    const value = Number(amount);
    try {
      const posted = await kdb.transaction((trx) =>
        postEntry(trx, {
          entryType: isIncome ? "payment" : "expense",
          amount: value,
          lines: isIncome ? revenueLines(value) : expenseLines(value),
          entryDate: date ? new Date(date) : new Date(),
          tenantId,
          category,
          description: description || null,
          source: "api",
          createdBy: req.user.id,
          ledgerKind: cfg.kind,
        }),
      );
      res.status(201).json({ success: true, data: { id: posted.id } });
    } catch (e) {
      if (e instanceof LedgerError) {
        return res.status(400).json({ success: false, message: e.message });
      }
      logger.error(`service-ledger.${cfg.kind}.create: ${(e as Error)?.message}`);
      res.status(500).json({ success: false, message: "تعذر حفظ الحركة. حاول مرة أخرى." });
    }
  });

  // ─── Delete = reverse the entry (history is never erased) ───
  router.delete("/:id", authenticate, async (req, res) => {
    if (!(await cfg.canOperate(req))) {
      return res.status(403).json({ success: false, message: "غير مسموح بحذف حركة من دفتر اليومية" });
    }
    const scope = scopeOf(req, cfg.kind);
    try {
      const entry = await kdb("journal_entries").where({ id: req.params.id }).first();
      const inScope = !!entry
        && entry.ledger_kind === cfg.kind
        && scope.tenantIds.some((t) => sameId(t, entry.tenant_id));
      if (!inScope) {
        return res.status(404).json({ success: false, message: "الحركة غير موجودة" });
      }
      if (entry.entry_type === "reversal") {
        return res.status(409).json({ success: false, message: "لا يمكن حذف قيد عكسي." });
      }
      await kdb.transaction(async (trx) => {
        const current = await trx("journal_entries").where({ id: req.params.id }).first();
        if (!current) return;
        if (current.status !== "posted") {
          throw new LedgerError("ALREADY_REVERSED", "هذه الحركة مُلغاة بالفعل.");
        }
        await reverseEntry(trx, {
          entryId: req.params.id,
          reason: "حذف حركة من دفتر اليومية",
          createdBy: req.user.id,
        });
      });
      res.json({ success: true });
    } catch (e) {
      if (e instanceof LedgerError) {
        return res.status(409).json({ success: false, message: e.message });
      }
      logger.error(`service-ledger.${cfg.kind}.delete: ${(e as Error)?.message}`);
      res.status(400).json({ success: false, message: "تعذر حذف الحركة. حاول مرة أخرى." });
    }
  });

  return router;
}
