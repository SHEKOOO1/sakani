import { kdb } from '../src/backend/infrastructure/db';
import {
  postEntry,
  paymentLines,
  expenseLines,
  penaltyLines,
  verifyLedger,
  type EntryType,
  type JournalLineInput,
  type LedgerAccount,
} from '../src/backend/services/ledger.service';

/**
 * Phase 2b — import every `finances` row into the double-entry ledger.
 *
 * Why this is a script and not a knex migration
 * ---------------------------------------------
 * The mapping depends on live data and on business classification (which
 * `type='expense'` rows are attendance penalties rather than operating costs),
 * so it has to be inspectable with --dry-run and re-runnable after the operator
 * fixes bad rows. A knex migration would hide it inside `migrate.latest()` and
 * roll the whole batch back on one bad row.
 *
 * The run is idempotent: a row is skipped once journal_entries.finance_id
 * already points at it, and migration 044 makes that link unique so two runs
 * cannot double-import the same movement.
 *
 * Classification of a non-reversal row
 * ------------------------------------
 *   is_reversal = 1              -> reversal   (mirror of the entry built from
 *                                              reversal_of_id, falling back to
 *                                              a category-derived mirror when
 *                                              the original row is gone)
 *   type = 'revenue'             -> payment    DR CASH             CR STUDENT_PAYMENT
 *   type = 'expense' + penalty   -> penalty    DR STUDENT_PAYMENT  CR PENALTY
 *   type = 'expense'             -> expense    DR EXPENSE          CR CASH
 *
 * A penalty is recognised the same way attendance.service.ts writes one:
 * attendance_id set, reference 'event-rule:*', or a category starting with the
 * penalty word. That is deliberately broader than two exact category strings so
 * a future penalty category cannot silently land in operating expenses.
 *
 * finance_edit_logs is NOT imported
 * ---------------------------------
 * It is an audit trail, not a movement: its rows either describe room-price
 * changes (edit_type='room_price', finance_id NULL — both live rows are of this
 * kind) or record the delta of an edit that `finances.amount` already reflects.
 * Turning them into entries would count the same money twice. The table stays
 * as history; after Phase 3 edits become reversal + new entry and stop writing
 * here.
 *
 * Nothing here writes to `finances`. The legacy table remains readable until
 * the read paths are switched over (Phase 4) and is only dropped afterwards.
 */

const PENALTY_PREFIX = 'غرامة';

interface LegacyFinance {
  id: string;
  tenant_id: string | null;
  student_id: string | null;
  type: string;
  category: string | null;
  amount: number | string;
  description: string | null;
  date: Date | string | null;
  created_by: string | null;
  created_at: Date | string | null;
  payment_method_id: string | null;
  is_admin_only: boolean | number | null;
  attendance_id: string | null;
  reference: string | null;
  is_reversal: boolean | number | null;
  reversal_of_id: string | null;
}

function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
}

function numOf(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toDate(v: Date | string | null | undefined): Date | undefined {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function trimmed(v: string | null | undefined): string {
  return (v || '').trim();
}

function isPenaltyCharge(f: LegacyFinance): boolean {
  if (f.type !== 'expense') return false;
  if (present(f.attendance_id)) return true;
  if (trimmed(f.reference).startsWith('event-rule:')) return true;
  return trimmed(f.category).startsWith(PENALTY_PREFIX);
}

function classifyNonReversal(f: LegacyFinance): { entryType: EntryType; lines: JournalLineInput[] } {
  const amount = numOf(f.amount);
  if (isPenaltyCharge(f)) return { entryType: 'penalty', lines: penaltyLines(amount) };
  if (f.type === 'revenue') return { entryType: 'payment', lines: paymentLines(amount) };
  return { entryType: 'expense', lines: expenseLines(amount) };
}

function mirrorLine(line: any): JournalLineInput {
  return {
    account: line.account as LedgerAccount,
    debit: numOf(line.credit),
    credit: numOf(line.debit),
    studentId: line.student_id ?? null,
    memo: line.memo ?? null,
  };
}

/**
 * Reversal rows whose original could not be linked (reversal_of_id is NULL —
 * attendance.service.ts:1049 writes exactly that when the penalty has no
 * finance row — or points at a hard-deleted row). Deriving the mirrored pair
 * from the reversal's own category keeps the entry balanced and keeps
 * SUM(ledger) == SUM(finances); only the reverses_entry_id link is lost.
 */
function unlinkedReversalLines(f: LegacyFinance): { lines: JournalLineInput[]; basis: string } {
  const amount = numOf(f.amount);
  const category = trimmed(f.category);
  if (category.startsWith('إلغاء ' + PENALTY_PREFIX) || category.startsWith(PENALTY_PREFIX)) {
    return { lines: [{ account: 'PENALTY', debit: amount }, { account: 'STUDENT_PAYMENT', credit: amount }], basis: 'penalty' };
  }
  if (f.type === 'revenue') {
    return { lines: [{ account: 'STUDENT_PAYMENT', debit: amount }, { account: 'CASH', credit: amount }], basis: 'payment' };
  }
  return { lines: [{ account: 'CASH', debit: amount }, { account: 'EXPENSE', credit: amount }], basis: 'expense' };
}

interface Report {
  legacyRows: number;
  skipped: number;
  imported: number;
  byType: Record<string, number>;
  warnings: string[];
}

async function runBackfill(dryRun: boolean): Promise<Report> {
  const rows = (await kdb('finances').select('*').orderBy('created_at', 'asc').orderBy('id', 'asc')) as LegacyFinance[];

  const linked = await kdb('journal_entries')
    .whereNotNull('finance_id')
    .select('id', 'finance_id');
  const entryIdByFinance = new Map<string, string>();
  for (const e of linked as any[]) entryIdByFinance.set(String(e.finance_id), String(e.id));

  const pending = rows.filter((f) => !entryIdByFinance.has(f.id));
  const report: Report = {
    legacyRows: rows.length,
    skipped: rows.length - pending.length,
    imported: 0,
    byType: {},
    warnings: [],
  };

  if (!pending.length) {
    console.log(`nothing to import (${report.legacyRows} legacy rows, all linked)`);
    return report;
  }

  const nonReversals = pending.filter((f) => !present(f.is_reversal));
  const reversals = pending.filter((f) => present(f.is_reversal));

  const write = async (trx: any) => {
    for (const f of nonReversals) {
      const { entryType, lines } = classifyNonReversal(f);
      const posted = await postEntry(trx, {
        entryType,
        amount: numOf(f.amount),
        lines,
        entryDate: toDate(f.date) || toDate(f.created_at) || new Date(),
        createdAt: toDate(f.created_at) || new Date(),
        tenantId: f.tenant_id,
        studentId: f.student_id,
        category: f.category,
        description: f.description,
        paymentMethodId: f.payment_method_id,
        financeId: f.id,
        source: 'legacy',
        isAdminOnly: present(f.is_admin_only),
        createdBy: f.created_by,
      });
      entryIdByFinance.set(f.id, posted.id);
      report.imported += 1;
      report.byType[entryType] = (report.byType[entryType] || 0) + 1;
    }

    // Reversals run second: every entry they mirror must already exist.
    for (const f of reversals) {
      const originalId = f.reversal_of_id ? entryIdByFinance.get(String(f.reversal_of_id)) : undefined;
      let lines: JournalLineInput[];
      let reversesEntryId: string | null = null;

      if (originalId) {
        const originalLines = await trx('journal_lines').where({ entry_id: originalId }).orderBy('line_no', 'asc');
        if (!originalLines.length) {
          throw new Error(
            `legacy reversal ${f.id} points at entry ${originalId} which has no lines; fix the source row and re-run`,
          );
        }
        lines = originalLines.map(mirrorLine);
        reversesEntryId = originalId;
      } else {
        const derived = unlinkedReversalLines(f);
        lines = derived.lines;
        report.warnings.push(
          `reversal ${f.id} could not be linked (reversal_of_id=${f.reversal_of_id ?? 'null'}); ` +
            `mirrored from category basis '${derived.basis}'`,
        );
      }

      const posted = await postEntry(trx, {
        entryType: 'reversal',
        amount: numOf(f.amount),
        lines,
        entryDate: toDate(f.date) || toDate(f.created_at) || new Date(),
        createdAt: toDate(f.created_at) || new Date(),
        tenantId: f.tenant_id,
        studentId: f.student_id,
        category: f.category,
        description: f.description,
        paymentMethodId: f.payment_method_id,
        financeId: f.id,
        reversesEntryId,
        source: 'legacy',
        isAdminOnly: present(f.is_admin_only),
        createdBy: f.created_by,
      });
      entryIdByFinance.set(f.id, posted.id);
      report.imported += 1;
      report.byType.reversal = (report.byType.reversal || 0) + 1;
    }
  };

  if (dryRun) {
    const plan: Record<string, number> = {};
    for (const f of nonReversals) {
      const { entryType } = classifyNonReversal(f);
      plan[entryType] = (plan[entryType] || 0) + 1;
    }
    for (const f of reversals) {
      const originalId = f.reversal_of_id ? entryIdByFinance.get(String(f.reversal_of_id)) : undefined;
      if (!originalId) {
        report.warnings.push(
          `reversal ${f.id} would be unlinked (reversal_of_id=${f.reversal_of_id ?? 'null'})`,
        );
      }
      plan.reversal = (plan.reversal || 0) + 1;
    }
    report.imported = pending.length;
    report.byType = plan;
    console.log(`DRY RUN: would import ${pending.length} row(s): ${JSON.stringify(plan)}`);
    return report;
  }

  const trx = await kdb.transaction();
  try {
    await write(trx);
    await trx.commit();
  } catch (e) {
    await trx.rollback();
    throw e;
  }

  return report;
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function runVerification(): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  const coverage = await kdb.raw(`
    WITH expected AS (
      SELECT id, amount,
             CASE
               WHEN ISNULL(is_reversal, 0) = 1 THEN 'reversal'
               WHEN type = 'revenue' THEN 'payment'
               WHEN attendance_id IS NOT NULL
                 OR LTRIM(RTRIM(ISNULL(reference, ''))) LIKE 'event-rule:%'
                 OR LTRIM(RTRIM(ISNULL(category, ''))) LIKE N'${PENALTY_PREFIX}%'
                 THEN 'penalty'
               ELSE 'expense'
             END AS expected_type
      FROM finances
    )
    SELECT
      (SELECT COUNT(*) FROM finances) AS legacy_rows,
      (SELECT COUNT(DISTINCT finance_id) FROM journal_entries WHERE finance_id IS NOT NULL) AS linked_rows,
      (SELECT COUNT(*) FROM expected x JOIN journal_entries e ON e.finance_id = x.id
        WHERE e.entry_type <> x.expected_type) AS type_mismatches,
      (SELECT COUNT(*) FROM expected x JOIN journal_entries e ON e.finance_id = x.id
        WHERE ABS(e.amount - x.amount) > 0.005) AS amount_mismatches
  `);
  const cov = ((coverage as any).recordset || coverage)[0];
  checks.push({
    name: 'every legacy row linked exactly once',
    ok: Number(cov.legacy_rows) === Number(cov.linked_rows),
    detail: `legacy=${cov.legacy_rows} linked=${cov.linked_rows}`,
  });
  checks.push({
    name: 'entry_type matches the classification rule',
    ok: Number(cov.type_mismatches) === 0,
    detail: `mismatches=${cov.type_mismatches}`,
  });
  checks.push({
    name: 'entry amount equals the legacy amount',
    ok: Number(cov.amount_mismatches) === 0,
    detail: `mismatches=${cov.amount_mismatches}`,
  });

  const sums = await kdb.raw(`
    SELECT
      (SELECT ISNULL(SUM(amount), 0) FROM finances
        WHERE ISNULL(is_reversal, 0) = 0 AND type = 'revenue') AS legacy_revenue,
      (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
        WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'payment') AS ledger_payment,
      (SELECT ISNULL(SUM(amount), 0) FROM finances
        WHERE ISNULL(is_reversal, 0) = 0 AND type = 'expense'
          AND NOT (attendance_id IS NOT NULL
                   OR LTRIM(RTRIM(ISNULL(reference, ''))) LIKE 'event-rule:%'
                   OR LTRIM(RTRIM(ISNULL(category, ''))) LIKE N'${PENALTY_PREFIX}%')) AS legacy_expense,
      (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
        WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'expense') AS ledger_expense,
      (SELECT ISNULL(SUM(amount), 0) FROM finances
        WHERE ISNULL(is_reversal, 0) = 0 AND type = 'expense'
          AND (attendance_id IS NOT NULL
               OR LTRIM(RTRIM(ISNULL(reference, ''))) LIKE 'event-rule:%'
               OR LTRIM(RTRIM(ISNULL(category, ''))) LIKE N'${PENALTY_PREFIX}%')) AS legacy_penalty,
      (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
        WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'penalty') AS ledger_penalty,
      (SELECT ISNULL(SUM(amount), 0) FROM finances WHERE ISNULL(is_reversal, 0) = 1) AS legacy_reversal,
      (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
        WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'reversal') AS ledger_reversal
  `);
  const s = ((sums as any).recordset || sums)[0];
  const pairs: Array<[string, string, string]> = [
    ['payments', 'legacy_revenue', 'ledger_payment'],
    ['expenses', 'legacy_expense', 'ledger_expense'],
    ['penalties', 'legacy_penalty', 'ledger_penalty'],
    ['reversals', 'legacy_reversal', 'ledger_reversal'],
  ];
  for (const [label, a, b] of pairs) {
    const left = Number(s[a]);
    const right = Number(s[b]);
    checks.push({
      name: `${label}: SUM(ledger) == SUM(finances)`,
      ok: Math.abs(left - right) < 0.005,
      detail: `ledger=${right.toFixed(2)} legacy=${left.toFixed(2)}`,
    });
  }

  const recon = await verifyLedger();
  checks.push({
    name: 'ledger is balanced (no unbalanced/amount-mismatch/orphan rows)',
    ok: recon.balanced,
    detail: `entries=${recon.entryCount} debit=${Number(recon.totalDebit).toFixed(2)} ` +
      `credit=${Number(recon.totalCredit).toFixed(2)} unbalanced=${recon.unbalancedEntries.length} ` +
      `mismatched=${recon.amountMismatches.length} orphans=${recon.orphanLines}`,
  });

  const legacyOnly = await kdb.raw(`
    SELECT
      (SELECT ISNULL(SUM(amount), 0) FROM finances WHERE type = 'revenue') AS old_paid,
      (SELECT ISNULL(SUM(amount), 0) FROM finances
        WHERE type = 'revenue' AND ISNULL(is_reversal, 0) = 1) AS reversals_as_revenue,
      (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
        WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'payment') AS new_paid
  `);
  const lo = ((legacyOnly as any).recordset || legacyOnly)[0];
  console.log(
    'correction applied by the cutover: old getStudentAccount counted ' +
      `${Number(lo.old_paid).toFixed(2)} as paid (including ${Number(lo.reversals_as_revenue).toFixed(2)} ` +
      `of penalty cancellations written as revenue); the ledger reports ${Number(lo.new_paid).toFixed(2)}`,
  );

  return checks;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verifyOnly = args.includes('--verify-only');

  if (!verifyOnly) {
    const report = await runBackfill(dryRun);
    console.log(
      `legacy rows=${report.legacyRows} skipped(already linked)=${report.skipped} ` +
        `imported=${report.imported} byType=${JSON.stringify(report.byType)}`,
    );
    for (const w of report.warnings) console.log(`  WARN  ${w}`);
  }

  console.log('');
  console.log('--- reconciliation ---');
  const checks = await runVerification();
  let failures = 0;
  for (const c of checks) {
    if (c.ok) {
      console.log(`  PASS  ${c.name}  (${c.detail})`);
    } else {
      failures += 1;
      console.log(`  FAIL  ${c.name}  (${c.detail})`);
    }
  }

  console.log('');
  if (failures === 0) {
    console.log('backfill verification PASSED');
  } else {
    console.log(`backfill verification FAILED: ${failures} check(s)`);
    process.exitCode = 1;
  }
}

main()
  .then(() => kdb.destroy())
  .catch(async (e) => {
    console.log('FATAL ' + (e && e.message ? e.message : e));
    try { await kdb.destroy(); } catch { /* already closed */ }
    process.exitCode = 1;
  });
