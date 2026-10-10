import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";

type Executor = typeof kdb;

export const LEDGER_ACCOUNTS = [
  'CASH',
  'STUDENT_PAYMENT',
  'ROOM_REVENUE',
  'RESTAURANT_REVENUE',
  'CANTEEN_REVENUE',
  'PENALTY',
  'DISCOUNT',
  'EXPENSE',
] as const;

export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];

export const ENTRY_TYPES = [
  'invoice',
  'payment',
  'expense',
  'penalty',
  'discount',
  'reversal',
  'adjustment',
  'seed',
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export type LedgerSource = 'legacy' | 'api' | 'attendance' | 'system';

export interface JournalLineInput {
  account: LedgerAccount;
  debit?: number | null;
  credit?: number | null;
  studentId?: string | null;
  memo?: string | null;
}

export interface PostEntryInput {
  entryType: EntryType;
  amount: number;
  lines: JournalLineInput[];
  entryDate?: Date;
  tenantId?: string | null;
  studentId?: string | null;
  category?: string | null;
  description?: string | null;
  paymentMethodId?: string | null;
  financeId?: string | null;
  reversesEntryId?: string | null;
  source?: LedgerSource;
  isAdminOnly?: boolean;
  createdBy?: string | null;
  /** Preserve the original timestamp when importing a legacy row. */
  createdAt?: Date;
  /** Idempotency key for attendance charges: a penalty id or `event-rule:<id>`. */
  reference?: string | null;
  attendanceId?: string | null;
  eventId?: string | null;
  sessionId?: string | null;
}

export interface PostedEntry {
  id: string;
  entryType: EntryType;
  amount: number;
  status: 'posted' | 'reversed';
}

export interface StudentLedgerTotals {
  invoiceEntries: number;
  paid: number;
  reversals: number;
  penaltiesCharged: number;
  penaltiesCancelled: number;
  penaltiesNet: number;
  discounts: number;
  expenses: number;
  accountBalance: number;
}

export interface LedgerEntryRow {
  id: string;
  entry_type: EntryType;
  status: 'posted' | 'reversed';
  amount: number;
  category: string | null;
  description: string | null;
  entry_date: string | null;
  created_at: string | null;
  created_by: string | null;
  creator_name: string | null;
  payment_method_name: string | null;
  reverses_entry_id: string | null;
  /** entry_type of the entry this one reverses, when it is a reversal. */
  reverses_entry_type: EntryType | null;
  reversed_by_entry_id: string | null;
  source: LedgerSource;
  is_admin_only: number;
  lines: { account: LedgerAccount; debit: number; credit: number; memo: string | null }[];
}

export class LedgerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

function toCents(value: number): number {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function roomPriceFor(room: any, cycle?: string | null): number {
  if (!room) return 0;
  const c = cycle || 'semester';
  if (c === 'daily') return Number(room.price_daily || 0);
  if (c === 'monthly') return Number(room.price_monthly || 0);
  return Number(room.price_semester || 0);
}

/**
 * The single source of the invoice figure. The room price wins whenever the
 * room has one for this billing cycle; agreed_price is only the fallback for a
 * room with no price configured. Nothing posts this amount to the ledger —
 * `remaining` = invoiceForStudent(...).invoice - SUM(payment) from
 * getStudentLedgerTotals.
 */
export function invoiceForStudent(student: any): {
  roomPrice: number;
  invoice: number;
  source: 'room' | 'agreed';
  billingCycle: string;
} {
  const billingCycle = student?.billing_cycle || 'semester';
  const roomPrice = roomPriceFor(student, billingCycle);
  const invoice = roomPrice > 0 ? roomPrice : Number(student?.agreed_price || 0);
  return { roomPrice, invoice, source: roomPrice > 0 ? 'room' : 'agreed', billingCycle };
}

export function paymentLines(amount: number): JournalLineInput[] {
  return [
    { account: 'CASH', debit: amount },
    { account: 'STUDENT_PAYMENT', credit: amount },
  ];
}

/**
 * Restaurant/canteen income is NOT a student housing payment: the credit goes
 * to the dedicated revenue account (studentId stays null so it never mixes
 * with a student's account balance). Categories قِطع: 'مطعم' / 'كانتين'.
 */
export function restaurantRevenueLines(amount: number): JournalLineInput[] {
  return [
    { account: 'CASH', debit: amount },
    { account: 'RESTAURANT_REVENUE', credit: amount },
  ];
}

export function canteenRevenueLines(amount: number): JournalLineInput[] {
  return [
    { account: 'CASH', debit: amount },
    { account: 'CANTEEN_REVENUE', credit: amount },
  ];
}

/**
 * Not yet posted anywhere: there is no invoice table, so the invoice amount is
 * derived from the room price by invoiceForStudent() above and `remaining`
 * reads it from there. Kept because the pair is part of the chart of accounts
 * and becomes live the moment an invoice is recorded as an event.
 */
export function invoiceLines(amount: number): JournalLineInput[] {
  return [
    { account: 'STUDENT_PAYMENT', debit: amount },
    { account: 'ROOM_REVENUE', credit: amount },
  ];
}

export function expenseLines(amount: number): JournalLineInput[] {
  return [
    { account: 'EXPENSE', debit: amount },
    { account: 'CASH', credit: amount },
  ];
}

export function penaltyLines(amount: number): JournalLineInput[] {
  return [
    { account: 'STUDENT_PAYMENT', debit: amount },
    { account: 'PENALTY', credit: amount },
  ];
}

export function discountLines(amount: number): JournalLineInput[] {
  return [
    { account: 'DISCOUNT', debit: amount },
    { account: 'STUDENT_PAYMENT', credit: amount },
  ];
}

/** Category prefix every attendance penalty starts with (غرامة ...). */
export const PENALTY_CATEGORY_PREFIX = 'غرامة';

export interface FinanceRowLike {
  type: string | null;
  category?: string | null;
  amount: unknown;
  attendance_id?: string | null;
  reference?: string | null;
  is_reversal?: unknown;
}

/**
 * Recognises an attendance penalty the same way attendance.service.ts writes
 * one: attendance link, event-rule reference, or a penalty category. Broad on
 * purpose — a future penalty category must not quietly land in operating
 * expenses. Only `type='expense'` rows qualify; penalty cancellations are
 * written as `type='revenue'` and are handled as reversals.
 */
export function isPenaltyCharge(row: FinanceRowLike): boolean {
  if (row.type !== 'expense') return false;
  if (row.attendance_id) return true;
  if ((row.reference || '').trim().startsWith('event-rule:')) return true;
  return (row.category || '').trim().startsWith(PENALTY_CATEGORY_PREFIX);
}

export type MovementEntryType = Extract<EntryType, 'payment' | 'penalty' | 'expense'>;

/**
 * How a `finances` row maps onto the chart of accounts. One classifier shared
 * by the legacy backfill and by the live write paths, so a row can never be
 * filed one way on import and another way on the next edit.
 *
 *   type = 'revenue'           -> payment    DR CASH             CR STUDENT_PAYMENT
 *   type = 'expense' + penalty -> penalty    DR STUDENT_PAYMENT  CR PENALTY
 *   type = 'expense'           -> expense    DR EXPENSE          CR CASH
 *
 * `is_reversal` rows are deliberately rejected: they must be built by
 * reverseEntry() as a mirror of the entry they cancel.
 */
export function entryForFinanceRow(row: FinanceRowLike): {
  entryType: MovementEntryType;
  lines: JournalLineInput[];
} {
  if (row.is_reversal !== undefined && row.is_reversal !== null && row.is_reversal !== false && Number(row.is_reversal) !== 0) {
    throw new LedgerError(
      'LEGACY_REVERSAL_ROW',
      'قيود العكس تُبنى عبر reverseEntry ولا تُصنَّف من صف finances مباشرة',
    );
  }
  const amount = Number(row.amount);
  if (isPenaltyCharge(row)) return { entryType: 'penalty', lines: penaltyLines(amount) };
  if (row.type === 'revenue') return { entryType: 'payment', lines: paymentLines(amount) };
  return { entryType: 'expense', lines: expenseLines(amount) };
}

function validateEntry(input: PostEntryInput): void {
  if (!(toCents(input.amount) > 0)) {
    throw new LedgerError('AMOUNT_NOT_POSITIVE', 'مبلغ القيد لازم يكون أكبر من صفر');
  }
  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new LedgerError('TOO_FEW_LINES', 'القيد لازم يكون فيه سطرين على الأقل (مدين ودائن)');
  }

  let debitCents = 0;
  let creditCents = 0;
  for (const line of input.lines) {
    if (!LEDGER_ACCOUNTS.includes(line.account)) {
      throw new LedgerError('UNKNOWN_ACCOUNT', `حساب غير معروف: ${String(line.account)}`);
    }
    const debit = toCents(line.debit || 0);
    const credit = toCents(line.credit || 0);
    if (debit < 0 || credit < 0) {
      throw new LedgerError('NEGATIVE_LINE', 'قيم المدين والدائن لا يمكن أن تكون سالبة');
    }
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new LedgerError('NOT_ONE_SIDED', 'كل سطر لازم يكون مدين بالكامل أو دائن بالكامل');
    }
    debitCents += debit;
    creditCents += credit;
  }

  if (debitCents !== creditCents) {
    throw new LedgerError(
      'UNBALANCED_ENTRY',
      `القيد غير متوازن: مدين ${fromCents(debitCents)} مقابل دائن ${fromCents(creditCents)}`,
    );
  }

  const entryCents = toCents(input.amount);
  if (entryCents !== debitCents) {
    throw new LedgerError(
      'AMOUNT_LINE_MISMATCH',
      `مبلغ القيد ${fromCents(entryCents)} لا يساوي مجموع السطور ${fromCents(debitCents)}`,
    );
  }
}

export async function postEntry(trx: Executor, input: PostEntryInput): Promise<PostedEntry> {
  validateEntry(input);

  const id = uuidv4();
  const entryDate = input.entryDate || new Date();

  await trx('journal_entries').insert({
    id,
    tenant_id: input.tenantId ?? null,
    entry_date: entryDate,
    entry_type: input.entryType,
    status: 'posted',
    amount: fromCents(toCents(input.amount)),
    category: input.category ?? null,
    description: input.description ?? null,
    student_id: input.studentId ?? null,
    payment_method_id: input.paymentMethodId ?? null,
    finance_id: input.financeId ?? null,
    reverses_entry_id: input.reversesEntryId ?? null,
    reversed_by_entry_id: null,
    source: input.source || 'api',
    is_admin_only: input.isAdminOnly ? 1 : 0,
    version: 1,
    created_by: input.createdBy ?? null,
    created_at: input.createdAt || new Date(),
    reference: input.reference ?? null,
    attendance_id: input.attendanceId ?? null,
    event_id: input.eventId ?? null,
    session_id: input.sessionId ?? null,
  });

  const lineRows = input.lines.map((line, index) => ({
    id: uuidv4(),
    entry_id: id,
    line_no: index + 1,
    account: line.account,
    debit: fromCents(toCents(line.debit || 0)),
    credit: fromCents(toCents(line.credit || 0)),
    student_id: line.studentId ?? input.studentId ?? null,
    memo: line.memo ?? null,
  }));

  await trx('journal_lines').insert(lineRows);

  return { id, entryType: input.entryType, amount: Number(input.amount), status: 'posted' };
}

export async function reverseEntry(
  trx: Executor,
  opts: {
    entryId: string;
    reason?: string | null;
    createdBy?: string | null;
    entryDate?: Date;
    source?: LedgerSource;
    /**
     * The `finances` row the reversal itself stands for.
     *
     * Attendance records a cancellation as its own row next to the charge it
     * cancels, so the reversal entry carries that row's id — which is what lets
     * a later repair run recognise it as already imported instead of posting a
     * second reversal and refunding money twice. Edits and deletes leave it
     * unset: there the row keeps meaning "the movement as it now stands", which
     * is the replacement entry's job, not the reversal's.
     */
    financeId?: string | null;
  },
): Promise<PostedEntry> {
  const original = await trx('journal_entries').where({ id: opts.entryId }).first();
  if (!original) throw new LedgerError('ENTRY_NOT_FOUND', 'القيد غير موجود');
  if (original.status !== 'posted') {
    throw new LedgerError('ENTRY_ALREADY_REVERSED', 'تم عكس هذا القيد من قبل');
  }

  const originalLines = await trx('journal_lines')
    .where({ entry_id: opts.entryId })
    .orderBy('line_no', 'asc');

  if (!originalLines.length) {
    throw new LedgerError('ENTRY_HAS_NO_LINES', 'لا يمكن عكس قيد بلا سطور');
  }

  const mirrored: JournalLineInput[] = originalLines.map((l: any) => ({
    account: l.account as LedgerAccount,
    debit: Number(l.credit || 0),
    credit: Number(l.debit || 0),
    studentId: l.student_id ?? null,
    memo: l.memo ?? null,
  }));

  const description = opts.reason
    ? `عكس قيد. السبب: ${opts.reason}`
    : 'عكس قيد';

  const reversal = await postEntry(trx, {
    entryType: 'reversal',
    amount: Number(original.amount),
    lines: mirrored,
    entryDate: opts.entryDate || new Date(),
    tenantId: original.tenant_id ?? null,
    studentId: original.student_id ?? null,
    category: original.category ?? null,
    description,
    paymentMethodId: original.payment_method_id ?? null,
    reversesEntryId: original.id,
    financeId: opts.financeId ?? null,
    source: opts.source || 'api',
    isAdminOnly: Number(original.is_admin_only || 0) === 1,
    createdBy: opts.createdBy ?? null,
  });

  await trx('journal_entries')
    .where({ id: original.id })
    .update({ status: 'reversed', reversed_by_entry_id: reversal.id, version: Number(original.version || 1) + 1 });

  return reversal;
}

/**
 * The posted charge a reference stands for, if any. Attendance uses this as its
 * idempotency guard now that it no longer writes `finances`: a penalty (or an
 * `event-rule:<id>` fee) is charged at most once, and a cancellation finds the
 * entry to mirror instead of refunding twice. Reversals are excluded so a
 * cancellation is never mistaken for the charge itself.
 */
export async function findPostedEntryByReference(
  trx: Executor,
  opts: { attendanceId: string; reference?: string | null },
): Promise<PostedEntry | null> {
  const qb = trx('journal_entries')
    .where({ attendance_id: opts.attendanceId, status: 'posted' })
    .whereNot('entry_type', 'reversal');
  if (opts.reference) qb.where('reference', opts.reference);
  const row = await qb.first();
  if (!row) return null;
  return { id: row.id, entryType: row.entry_type, amount: Number(row.amount), status: 'posted' };
}

/**
 * Every posted attendance charge for a record, optionally narrowed to a
 * reference prefix (`event-rule:%`). Corrections reverse the whole set at once,
 * which is what `reverseEventRuleLedger` used to scan `finances` for.
 */
export async function listPostedAttendanceEntries(
  trx: Executor,
  opts: { attendanceId: string; referencePrefix?: string | null },
): Promise<{ id: string; amount: number; reference: string | null }[]> {
  const qb = trx('journal_entries')
    .where({ attendance_id: opts.attendanceId, status: 'posted' })
    .whereNot('entry_type', 'reversal');
  if (opts.referencePrefix) qb.where('reference', 'like', `${opts.referencePrefix}%`);
  const rows = await qb.select('id', 'amount', 'reference');
  return (rows as any[]).map((r) => ({ id: r.id, amount: Number(r.amount || 0), reference: r.reference ?? null }));
}

function visibilityFilter(query: any, studentId: string, opts: { visibility?: 'all' | 'tenant' }): any {
  query.where('e.student_id', studentId);
  if (opts.visibility === 'tenant') {
    query.where(function (this: any) {
      this.whereNull('e.is_admin_only').orWhere('e.is_admin_only', 0);
    });
  }
  return query;
}

export async function getStudentLedgerTotals(
  studentId: string,
  opts: { visibility?: 'all' | 'tenant'; executor?: Executor } = {},
): Promise<StudentLedgerTotals> {
  const db = opts.executor || kdb;
  const query = db('journal_entries as e')
    .where('e.student_id', studentId)
    .select(
      db.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'invoice' AND e.status = 'posted' THEN e.amount ELSE 0 END), 0) as invoice_entries"),
      db.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'payment' AND e.status = 'posted' THEN e.amount ELSE 0 END), 0) as paid"),
      db.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'penalty' AND e.status = 'posted' THEN e.amount ELSE 0 END), 0) as penalties_charged"),
      db.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'reversal' AND e.status = 'posted' THEN e.amount ELSE 0 END), 0) as reversals"),
      db.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'discount' AND e.status = 'posted' THEN e.amount ELSE 0 END), 0) as discounts"),
      db.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'expense' AND e.status = 'posted' THEN e.amount ELSE 0 END), 0) as expenses"),
      db.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'penalty' AND e.status = 'reversed' THEN e.amount ELSE 0 END), 0) as penalties_cancelled"),
    )
    .first();

  if (opts.visibility === 'tenant') {
    query.where(function (this: any) {
      this.whereNull('e.is_admin_only').orWhere('e.is_admin_only', 0);
    });
  }

  const row = await query;

  const balanceQuery = db('journal_lines as l')
    .join('journal_entries as e', 'e.id', 'l.entry_id')
    .where('l.student_id', studentId)
    .where('l.account', 'STUDENT_PAYMENT')
    .whereIn('e.status', ['posted', 'reversed'])
    .select(db.raw("COALESCE(SUM(l.debit - l.credit), 0) as balance"));
  if (opts.visibility === 'tenant') {
    balanceQuery.where(function (this: any) {
      this.whereNull('e.is_admin_only').orWhere('e.is_admin_only', 0);
    });
  }
  const balanceRow = await balanceQuery.first();

  const penaltiesCharged = Number(row?.penalties_charged || 0);
  const penaltiesCancelled = Number(row?.penalties_cancelled || 0);

  return {
    invoiceEntries: Number(row?.invoice_entries || 0),
    paid: Number(row?.paid || 0),
    reversals: Number(row?.reversals || 0),
    penaltiesCharged,
    penaltiesCancelled,
    penaltiesNet: penaltiesCharged - penaltiesCancelled,
    discounts: Number(row?.discounts || 0),
    expenses: Number(row?.expenses || 0),
    accountBalance: Number(balanceRow?.balance || 0),
  };
}

export async function getStudentLedgerEntries(
  studentId: string,
  opts: { visibility?: 'all' | 'tenant'; limit?: number; offset?: number; executor?: Executor } = {},
): Promise<LedgerEntryRow[]> {
  const db = opts.executor || kdb;
  const query = visibilityFilter(db('journal_entries as e'), studentId, opts)
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .leftJoin('payment_methods as pm', 'e.payment_method_id', 'pm.id')
    .leftJoin('journal_entries as rev', 'e.reverses_entry_id', 'rev.id')
    .select(
      'e.id',
      'e.entry_type',
      'e.status',
      'e.amount',
      'e.category',
      'e.description',
      'e.entry_date',
      'e.created_at',
      'e.created_by',
      'e.reverses_entry_id',
      'e.reversed_by_entry_id',
      'e.source',
      'e.is_admin_only',
      'rev.entry_type as reverses_entry_type',
      'u.name as creator_name',
      'pm.name as payment_method_name',
    )
    .orderBy('e.created_at', 'desc')
    .orderBy('e.entry_date', 'desc');

  if (opts.limit) query.limit(opts.limit);
  if (opts.offset) query.offset(opts.offset);

  const entries = await query;
  if (!entries.length) return [];

  const lines = await db('journal_lines').whereIn(
    'entry_id',
    entries.map((e: any) => e.id),
  );

  const byEntry = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const list = byEntry.get(line.entry_id) || [];
    list.push(line);
    byEntry.set(line.entry_id, list);
  }

  return entries.map((e: any) => ({
    id: e.id,
    entry_type: e.entry_type,
    status: e.status,
    amount: Number(e.amount || 0),
    category: e.category,
    description: e.description,
    entry_date: toDateOnly(e.entry_date),
    created_at: e.created_at || null,
    created_by: e.created_by,
    creator_name: e.creator_name || null,
    payment_method_name: e.payment_method_name || null,
    reverses_entry_id: e.reverses_entry_id,
    reverses_entry_type: e.reverses_entry_type ?? null,
    reversed_by_entry_id: e.reversed_by_entry_id,
    source: e.source,
    is_admin_only: Number(e.is_admin_only || 0),
    lines: (byEntry.get(e.id) || [])
      .sort((a: any, b: any) => Number(a.line_no) - Number(b.line_no))
      .map((l: any) => ({
        account: l.account,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        memo: l.memo ?? null,
      })),
  }));
}

/**
 * Read model over the journal, swapped in by Phase 4.
 *
 * Everything a report or dashboard used to SUM out of `finances` is expressed
 * here instead, from `entry_type` + `status` only — never from raw account
 * balances — so the contract in migrations/043 (penalties and discounts stay
 * out of `remaining`: remaining = invoice - SUM(payment)) holds for every
 * reader. A reversed entry drops out of its class automatically because its
 * status flips to 'reversed'; the mirror entry it leaves behind is `entry_type
 * = 'reversal'` and is reported as its own class, so nothing is counted twice.
 *
 * The legacy `finances` table is still dual-written by Phase 3 and remains the
 * source for the raw finance list (an editable row needs its `finances.id`),
 * but every aggregate figure below is derived from the ledger.
 */

export interface LedgerScopeFilter {
  tenantId?: string | null;
  tenantIds?: string[] | null;
  studentId?: string | null;
  /** true = admin-only books, false = housing books, undefined = both. */
  isAdmin?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  category?: string | null;
}

export interface LedgerClassTotals {
  /** Money collected: entry_type = 'payment', currently posted. */
  income: number;
  /** Operating cost: entry_type = 'expense', currently posted. */
  expense: number;
  /** Penalties still standing: entry_type = 'penalty', currently posted. */
  penalty: number;
  /** Discounts granted: entry_type = 'discount', currently posted. */
  discount: number;
  /** Cancellations issued: entry_type = 'reversal', currently posted. */
  reversal: number;
  transactionCount: number;
}

/**
 * Normalizes an mssql `date` cell — which the driver hands back as a JS Date —
 * or a plain string to `yyyy-MM-dd`. `String(date).slice(0, 10)` would yield
 * "Mon Oct 05", which breaks `new Date(...)` in the Excel/PDF exporters.
 */
function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** The one place the is_admin_only / tenant / date scope is applied. */
function applyLedgerScope(qb: any, f: LedgerScopeFilter): any {
  if (f.isAdmin === true) {
    qb.where('e.is_admin_only', 1);
  } else if (f.isAdmin === false) {
    qb.where(function (this: any) {
      this.whereNull('e.is_admin_only').orWhere('e.is_admin_only', 0);
    });
  }
  if (f.tenantIds) {
    // An empty list means "no access", not "everyone": a scoped user with zero
    // allowed tenants must not see other housings' (or the admin's) books.
    if (f.tenantIds.length) qb.whereIn('e.tenant_id', f.tenantIds);
    else qb.whereRaw('1 = 0');
  } else if (f.tenantId) qb.where('e.tenant_id', f.tenantId);
  if (f.studentId) qb.where('e.student_id', f.studentId);
  if (f.category) qb.where('e.category', f.category);
  if (f.startDate) qb.where('e.entry_date', '>=', f.startDate);
  if (f.endDate) qb.where('e.entry_date', '<=', f.endDate);
  return qb;
}

/**
 * How a journal entry reads to the old finance UI: money in (`revenue`) or
 * money out (`expense`). Penalties and discounts were filed as `type='expense'`
 * rows in `finances`, and a reversal is shown opposite to what it cancels — a
 * refunded payment leaves, so the reversal reads as an outflow; a cancelled
 * penalty/expense is credited back, so it reads as an inflow.
 */
export function entryDisplayType(entryType: EntryType, reversesEntryType?: string | null): 'revenue' | 'expense' {
  if (entryType === 'payment') return 'revenue';
  if (entryType === 'reversal') return reversesEntryType === 'payment' ? 'expense' : 'revenue';
  return 'expense';
}

const DISPLAY_TYPE_SQL = `(CASE
    WHEN e.entry_type = 'payment' THEN 'revenue'
    WHEN e.entry_type = 'reversal' THEN (CASE WHEN rev.entry_type = 'payment' THEN 'expense' ELSE 'revenue' END)
    ELSE 'expense'
  END)`;

export async function getLedgerClassTotals(
  f: LedgerScopeFilter = {},
  executor: Executor = kdb,
): Promise<LedgerClassTotals> {
  const qb = executor('journal_entries as e').where('e.status', 'posted');
  applyLedgerScope(qb, f);
  const row = await qb
    .select(
      executor.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'payment' THEN e.amount ELSE 0 END), 0) as income"),
      executor.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'expense' THEN e.amount ELSE 0 END), 0) as expense"),
      executor.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'penalty' THEN e.amount ELSE 0 END), 0) as penalty"),
      executor.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'discount' THEN e.amount ELSE 0 END), 0) as discount"),
      executor.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'reversal' THEN e.amount ELSE 0 END), 0) as reversal"),
      executor.raw('COUNT(*) as transaction_count'),
    )
    .first();
  return {
    income: Number(row?.income || 0),
    expense: Number(row?.expense || 0),
    penalty: Number(row?.penalty || 0),
    discount: Number(row?.discount || 0),
    reversal: Number(row?.reversal || 0),
    transactionCount: Number(row?.transaction_count || 0),
  };
}

export interface LedgerCategoryRow {
  type: 'revenue' | 'expense';
  entry_type: EntryType;
  category: string;
  total: number;
}

export async function getLedgerByCategory(
  f: LedgerScopeFilter = {},
  executor: Executor = kdb,
): Promise<LedgerCategoryRow[]> {
  const qb = executor('journal_entries as e')
    .where('e.status', 'posted')
    .whereIn('e.entry_type', ['payment', 'expense', 'penalty', 'discount']);
  applyLedgerScope(qb, f);
  const rows = await qb
    .select('e.entry_type as entry_type', 'e.category as category')
    .sum({ total: 'e.amount' })
    .groupBy('e.entry_type', 'e.category')
    .orderBy('e.entry_type');
  return (rows as any[]).map((r) => ({
    type: r.entry_type === 'payment' ? ('revenue' as const) : ('expense' as const),
    entry_type: r.entry_type,
    category: r.category || '—',
    total: Number(r.total || 0),
  }));
}

export interface LedgerMonthRow {
  month: string;
  income: number;
  expense: number;
}

export async function getLedgerByMonth(
  f: LedgerScopeFilter = {},
  executor: Executor = kdb,
): Promise<LedgerMonthRow[]> {
  const monthExpr = "FORMAT(e.entry_date, 'yyyy-MM')";
  const qb = executor('journal_entries as e')
    .where('e.status', 'posted')
    .whereIn('e.entry_type', ['payment', 'expense', 'penalty', 'discount']);
  applyLedgerScope(qb, f);
  const rows = await qb
    .select(
      executor.raw(`${monthExpr} as month`),
      executor.raw("COALESCE(SUM(CASE WHEN e.entry_type = 'payment' THEN e.amount ELSE 0 END), 0) as income"),
      executor.raw("COALESCE(SUM(CASE WHEN e.entry_type <> 'payment' THEN e.amount ELSE 0 END), 0) as expense"),
    )
    .groupByRaw(monthExpr)
    .orderBy('month');
  return (rows as any[]).map((r) => ({
    month: r.month,
    income: Number(r.income || 0),
    expense: Number(r.expense || 0),
  }));
}

export interface LedgerReport {
  totals: LedgerClassTotals & { net: number };
  byCategory: LedgerCategoryRow[];
  byMonth: LedgerMonthRow[];
}

/**
 * Same shape `finance-report.service.getReportSummary` returned before Phase 4,
 * but the expense side is `expense + penalty + discount` so it still matches the
 * `type='expense'` bucket the UI expects, and reversals (already excluded from
 * the posted figures) never inflate it.
 */
export async function getLedgerReport(
  f: LedgerScopeFilter = {},
  executor: Executor = kdb,
): Promise<LedgerReport> {
  const [totals, byCategory, byMonth] = await Promise.all([
    getLedgerClassTotals(f, executor),
    getLedgerByCategory(f, executor),
    getLedgerByMonth(f, executor),
  ]);
  const expense = totals.expense + totals.penalty + totals.discount;
  return {
    totals: { ...totals, expense, net: totals.income - expense },
    byCategory,
    byMonth,
  };
}

export interface LedgerMovementRow {
  id: string;
  type: 'revenue' | 'expense';
  entry_type: EntryType;
  status: string;
  category: string;
  amount: number;
  description: string | null;
  date: string | null;
  created_at: string | null;
  student_id: string | null;
  student_name: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  /** True when this row is a reversal entry (never editable/deletable). */
  is_reversal: boolean;
}

/**
 * Row-level read behind the finance list/report/export: the journal becomes the
 * `finances`-shaped list the callers already consume, including the reversal
 * rows that used to live in `finances` as `is_reversal = 1`.
 */
export async function getLedgerMovements(
  f: LedgerScopeFilter & {
    movementType?: 'revenue' | 'expense' | null;
    search?: string | null;
    limit?: number;
    offset?: number;
  } = {},
  executor: Executor = kdb,
): Promise<LedgerMovementRow[]> {
  const qb = executor('journal_entries as e')
    .leftJoin('journal_entries as rev', 'e.reverses_entry_id', 'rev.id')
    .leftJoin('students as s', 'e.student_id', 's.id')
    .leftJoin('users as u', 's.user_id', 'u.id')
    .leftJoin('payment_methods as pm', 'e.payment_method_id', 'pm.id')
    .where('e.status', 'posted');
  applyLedgerScope(qb, f);
  if (f.movementType) qb.whereRaw(`${DISPLAY_TYPE_SQL} = ?`, [f.movementType]);
  if (f.search) {
    const term = `%${f.search}%`;
    qb.andWhere(function (this: any) {
      this.where('e.description', 'like', term)
        .orWhere('e.category', 'like', term)
        .orWhere('u.name', 'like', term)
        .orWhereRaw('CAST(e.amount AS NVARCHAR(30)) LIKE ?', [term]);
    });
  }
  qb.select(
    'e.id',
    'e.entry_type',
    'e.status',
    'e.category',
    'e.amount',
    'e.description',
    'e.entry_date as date',
    'e.created_at',
    'e.student_id',
    'e.payment_method_id',
    'rev.entry_type as reverses_entry_type',
    'u.name as student_name',
    'pm.name as payment_method_name',
  )
    .orderBy('e.entry_date', 'desc')
    .orderBy('e.created_at', 'desc');
  if (f.limit) qb.limit(f.limit);
  if (f.offset) qb.offset(f.offset);

  const rows = await qb;
  return (rows as any[]).map((r) => ({
    id: r.id,
    type: entryDisplayType(r.entry_type, r.reverses_entry_type),
    entry_type: r.entry_type,
    status: r.status,
    category: r.category || '',
    amount: Number(r.amount || 0),
    description: r.description ?? null,
    date: toDateOnly(r.date),
    created_at: r.created_at || null,
    student_id: r.student_id ?? null,
    student_name: r.student_name || null,
    payment_method_id: r.payment_method_id ?? null,
    payment_method_name: r.payment_method_name || null,
    is_reversal: r.entry_type === 'reversal',
  }));
}

/** Count behind the paginated finance list; same scope/filters as getLedgerMovements. */
export async function countLedgerMovements(
  f: LedgerScopeFilter & { movementType?: 'revenue' | 'expense' | null; search?: string | null } = {},
  executor: Executor = kdb,
): Promise<number> {
  const qb = executor('journal_entries as e')
    .leftJoin('journal_entries as rev', 'e.reverses_entry_id', 'rev.id')
    .leftJoin('students as s', 'e.student_id', 's.id')
    .leftJoin('users as u', 's.user_id', 'u.id')
    .where('e.status', 'posted');
  applyLedgerScope(qb, f);
  if (f.movementType) qb.whereRaw(`${DISPLAY_TYPE_SQL} = ?`, [f.movementType]);
  if (f.search) {
    const term = `%${f.search}%`;
    qb.andWhere(function (this: any) {
      this.where('e.description', 'like', term)
        .orWhere('e.category', 'like', term)
        .orWhere('u.name', 'like', term)
        .orWhereRaw('CAST(e.amount AS NVARCHAR(30)) LIKE ?', [term]);
    });
  }
  const row = await qb.count({ total: 'e.id' }).first();
  return Number(row?.total || 0);
}

export interface StudentPenaltyRow {
  id: string;
  description: string | null;
  category: string | null;
  amount: number;
  date: string | null;
  created_at: string | null;
  cancelled: boolean;
}

export async function getStudentPenalties(
  studentId: string,
  opts: { visibility?: 'all' | 'tenant'; executor?: Executor } = {},
): Promise<StudentPenaltyRow[]> {
  const db = opts.executor || kdb;
  const qb = db('journal_entries as e')
    .where('e.student_id', studentId)
    .where('e.entry_type', 'penalty');
  if (opts.visibility === 'tenant') {
    qb.where(function (this: any) {
      this.whereNull('e.is_admin_only').orWhere('e.is_admin_only', 0);
    });
  }
  const rows = await qb
    .select('e.id', 'e.description', 'e.category', 'e.amount', 'e.entry_date', 'e.created_at', 'e.status')
    .orderBy('e.entry_date', 'desc')
    .orderBy('e.created_at', 'desc');
  return (rows as any[]).map((r) => ({
    id: r.id,
    description: r.description ?? null,
    category: r.category ?? null,
    amount: Number(r.amount || 0),
    date: toDateOnly(r.entry_date),
    created_at: r.created_at || null,
    cancelled: r.status === 'reversed',
  }));
}

export interface StudentPaymentTotal {
  student_id: string;
  paid: number;
}

/** Posted payment per student — the aggregate behind the student-accounts report. */
export async function getLedgerPaymentTotalsByStudent(
  f: LedgerScopeFilter = {},
  executor: Executor = kdb,
): Promise<StudentPaymentTotal[]> {
  const qb = executor('journal_entries as e')
    .where('e.status', 'posted')
    .where('e.entry_type', 'payment')
    .whereNotNull('e.student_id');
  applyLedgerScope(qb, f);
  const rows = await qb
    .select('e.student_id')
    .sum({ paid: 'e.amount' })
    .groupBy('e.student_id');
  return (rows as any[]).map((r) => ({ student_id: r.student_id, paid: Number(r.paid || 0) }));
}

export interface LedgerReconciliation {
  balanced: boolean;
  unbalancedEntries: { id: string; debit: number; credit: number }[];
  entryCount: number;
  totalDebit: number;
  totalCredit: number;
  amountMismatches: { id: string; entryAmount: number; lineTotal: number }[];
  orphanLines: number;
}

export async function verifyLedger(executor: Executor = kdb): Promise<LedgerReconciliation> {
  const unbalanced = await executor.raw(`
    SELECT e.id,
           CAST(SUM(l.debit) AS DECIMAL(18,2)) AS debit,
           CAST(SUM(l.credit) AS DECIMAL(18,2)) AS credit
      FROM journal_entries e
      JOIN journal_lines l ON l.entry_id = e.id
     GROUP BY e.id
    HAVING SUM(l.debit) <> SUM(l.credit)
  `);

  const mismatched = await executor.raw(`
    SELECT e.id,
           CAST(e.amount AS DECIMAL(18,2)) AS entry_amount,
           CAST(ISNULL(SUM(l.debit), 0) AS DECIMAL(18,2)) AS line_total
      FROM journal_entries e
      LEFT JOIN journal_lines l ON l.entry_id = e.id
     GROUP BY e.id, e.amount
    HAVING e.amount <> ISNULL(SUM(l.debit), 0)
  `);

  const orphanRow = await executor.raw(`
    SELECT COUNT(*) AS n
      FROM journal_lines l
     WHERE NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = l.entry_id)
  `);

  const totalsRow = await executor.raw(`
    SELECT COUNT(DISTINCT e.id) AS entry_count,
           CAST(ISNULL(SUM(l.debit), 0) AS DECIMAL(18,2)) AS total_debit,
           CAST(ISNULL(SUM(l.credit), 0) AS DECIMAL(18,2)) AS total_credit
      FROM journal_entries e
      LEFT JOIN journal_lines l ON l.entry_id = e.id
  `);

  const totals = firstRow(totalsRow);
  const unbalancedEntries = rowsOf(unbalanced).map((r: any) => ({
    id: String(r.id),
    debit: Number(r.debit || 0),
    credit: Number(r.credit || 0),
  }));
  const amountMismatches = rowsOf(mismatched).map((r: any) => ({
    id: String(r.id),
    entryAmount: Number(r.entry_amount || 0),
    lineTotal: Number(r.line_total || 0),
  }));
  const orphanLines = Number(firstRow(orphanRow)?.n || 0);

  return {
    balanced: unbalancedEntries.length === 0 && amountMismatches.length === 0 && orphanLines === 0,
    unbalancedEntries,
    amountMismatches,
    orphanLines,
    entryCount: Number(totals?.entry_count || 0),
    totalDebit: Number(totals?.total_debit || 0),
    totalCredit: Number(totals?.total_credit || 0),
  };
}

function rowsOf(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) {
    if (result.length > 0 && Array.isArray(result[0])) return result[0];
    return result;
  }
  if (Array.isArray(result.recordset)) return result.recordset;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

function firstRow(result: any): any {
  const rows = rowsOf(result);
  return rows.length ? rows[0] : null;
}
