import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";

type Executor = typeof kdb;

export const LEDGER_ACCOUNTS = [
  'CASH',
  'STUDENT_PAYMENT',
  'ROOM_REVENUE',
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
    source: opts.source || 'api',
    isAdminOnly: Number(original.is_admin_only || 0) === 1,
    createdBy: opts.createdBy ?? null,
  });

  await trx('journal_entries')
    .where({ id: original.id })
    .update({ status: 'reversed', reversed_by_entry_id: reversal.id, version: Number(original.version || 1) + 1 });

  return reversal;
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

  const balanceRow = await db('journal_lines as l')
    .join('journal_entries as e', 'e.id', 'l.entry_id')
    .where('l.student_id', studentId)
    .where('l.account', 'STUDENT_PAYMENT')
    .whereIn('e.status', ['posted', 'reversed'])
    .select(db.raw("COALESCE(SUM(l.debit - l.credit), 0) as balance"))
    .first();

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
    entry_date: e.entry_date ? String(e.entry_date).slice(0, 10) : null,
    created_at: e.created_at || null,
    created_by: e.created_by,
    creator_name: e.creator_name || null,
    payment_method_name: e.payment_method_name || null,
    reverses_entry_id: e.reverses_entry_id,
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
