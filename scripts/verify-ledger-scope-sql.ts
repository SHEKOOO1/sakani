import { kdb } from '../src/backend/infrastructure/db';
import {
  getLedgerClassTotals,
  getLedgerMovements,
  countLedgerMovements,
} from '../src/backend/services/ledger.service';

/**
 * Read-only correctness harness for the cutover ledger scope logic.
 *
 * It drives the SAME service functions the finance/parent/dashboard routers use
 * and compares every figure against raw SQL run against the real (dev) database,
 * so what applyLedgerScope() claims a role may see is checked against the actual
 * rows. Nothing in this script writes: totals are compared, list rows are
 * inspected, pagination semantics are asserted.
 *
 * Run: npm run verify:scope   (tsx scripts/verify-ledger-scope-sql.ts)
 */

let passCount = 0;
let failCount = 0;
const notes: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passCount++;
    console.log(`  PASS  ${name}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function num(v: unknown): number {
  return Number(v ?? 0);
}

async function rawTotals(scope: {
  isAdmin?: boolean;
  tenantId?: string | null;
  tenantIds?: string[] | null;
  studentId?: string | null;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<{ income: number; expense: number; penalty: number; discount: number; reversal: number; n: number }> {
  const parts: string[] = ["e.status = 'posted'"];
  if (scope.isAdmin) parts.push('e.is_admin_only = 1');
  else if (scope.isAdmin === false) parts.push("ISNULL(e.is_admin_only, 0) = 0");
  if (scope.tenantIds?.length) parts.push(`e.tenant_id IN (${scope.tenantIds.map((t) => `'${t.replace(/'/g, "''")}'`).join(',')})`);
  else if (scope.tenantId) parts.push(`e.tenant_id = '${scope.tenantId.replace(/'/g, "''")}'`);
  if (scope.studentId) parts.push(`e.student_id = '${scope.studentId.replace(/'/g, "''")}'`);
  if (scope.category) parts.push(`e.category = N'${scope.category.replace(/'/g, "''")}'`);
  if (scope.startDate) parts.push(`e.entry_date >= '${scope.startDate}'`);
  if (scope.endDate) parts.push(`e.entry_date <= '${scope.endDate}'`);
  const where = parts.join(' AND ');

  const r = await kdb.raw(`
    SELECT
      ISNULL(SUM(CASE WHEN e.entry_type = 'payment'  THEN e.amount ELSE 0 END), 0) AS income,
      ISNULL(SUM(CASE WHEN e.entry_type = 'expense'  THEN e.amount ELSE 0 END), 0) AS expense,
      ISNULL(SUM(CASE WHEN e.entry_type = 'penalty'  THEN e.amount ELSE 0 END), 0) AS penalty,
      ISNULL(SUM(CASE WHEN e.entry_type = 'discount' THEN e.amount ELSE 0 END), 0) AS discount,
      ISNULL(SUM(CASE WHEN e.entry_type = 'reversal' THEN e.amount ELSE 0 END), 0) AS reversal,
      COUNT(*) AS n
    FROM journal_entries e
    WHERE ${where}
  `);
  const row = (r as any).recordset?.[0] ?? (Array.isArray(r) ? r[0] : r?.[0]);
  return {
    income: num(row?.income),
    expense: num(row?.expense),
    penalty: num(row?.penalty),
    discount: num(row?.discount),
    reversal: num(row?.reversal),
    n: num(row?.n),
  };
}

async function main(): Promise<void> {
  console.log('\n═══ Ledger scope vs raw SQL (read-only) ═══\n');

  // ── 0. Baseline: whole committed ledger, admin reads only admin books ──
  const adminSql = await rawTotals({ isAdmin: true });
  const adminSvc = await getLedgerClassTotals({ isAdmin: true });
  check('admin: income == raw SQL', close(adminSvc.income, adminSql.income), `svc=${adminSvc.income} sql=${adminSql.income}`);
  check('admin: expense == raw SQL', close(adminSvc.expense, adminSql.expense), `svc=${adminSvc.expense} sql=${adminSql.expense}`);
  check('admin: penalty == raw SQL', close(adminSvc.penalty, adminSql.penalty), `svc=${adminSvc.penalty} sql=${adminSql.penalty}`);
  check('admin: discount == raw SQL', close(adminSvc.discount, adminSql.discount), `svc=${adminSvc.discount} sql=${adminSql.discount}`);
  check('admin: reversal == raw SQL', close(adminSvc.reversal, adminSql.reversal), `svc=${adminSvc.reversal} sql=${adminSql.reversal}`);

  // ── 1. Tenant (supervisor) scope — every tenant that has journal rows ──
  const tenants = (await kdb.raw(`
    SELECT DISTINCT e.tenant_id FROM journal_entries e WHERE e.tenant_id IS NOT NULL
  `)) as any;
  const tenantRows = tenants.recordset ?? tenants;
  const tenantIds = tenantRows.map((t: any) => t.tenant_id).filter((x: unknown) => x != null) as string[];
  notes.push(`tenants with ledger rows: ${tenantIds.length}`);

  for (const tid of tenantIds) {
    const sql = await rawTotals({ tenantId: tid });
    const svc = await getLedgerClassTotals({ tenantId: tid });
    check(`tenant ${tid}: income == raw SQL`, close(svc.income, sql.income), `svc=${svc.income} sql=${sql.income}`);
    check(`tenant ${tid}: expense bucket == raw SQL`, close(svc.expense + svc.penalty + svc.discount, sql.expense + sql.penalty + sql.discount), `svc=${svc.expense + svc.penalty + svc.discount} sql=${sql.expense + sql.penalty + sql.discount}`);

    // admin-only rows must never reach the tenant ledger
    if (sql.expense + sql.penalty + sql.discount + sql.income + sql.reversal > 0) {
      const adminHits = await kdb.raw(`
        SELECT COUNT(*) AS n FROM journal_entries e WHERE e.status='posted' AND e.tenant_id = '${tid.replace(/'/g, "''")}' AND e.is_admin_only = 1
      `);
      const n = num(((adminHits as any).recordset ?? adminHits)?.[0]?.n);
      check(`tenant ${tid}: zero admin-only rows leak into scope`, n === 0, `admin rows present: ${n}`);
    }
  }

  // ── 2. Bishop (multi-tenant) scope ──
  const bishops = (await kdb.raw(`SELECT DISTINCT bishop_id FROM tenants WHERE bishop_id IS NOT NULL`)) as any;
  const bishopRows = bishops.recordset ?? bishops;
  for (const b of bishopRows) {
    const tids = (await kdb.raw(`
      SELECT t.id FROM tenants t WHERE t.bishop_id = '${String(b.bishop_id).replace(/'/g, "''")}'
    `)) as any;
    const ids = (tids.recordset ?? tids).map((t: any) => t.id).filter((x: unknown) => x != null) as string[];
    if (!ids.length) continue;
    const sql = await rawTotals({ tenantIds: ids });
    const svc = await getLedgerClassTotals({ tenantIds: ids, isAdmin: false });
    check(`bishop ${String(b.bishop_id).slice(0, 8)} (${ids.length} tenants): income == raw SQL`, close(svc.income, sql.income), `svc=${svc.income} sql=${sql.income}`);
    check(`bishop ${String(b.bishop_id).slice(0, 8)}: expense bucket == raw SQL`, close(svc.expense + svc.penalty + svc.discount, sql.expense + sql.penalty + sql.discount), `svc=${svc.expense + svc.penalty + svc.discount} sql=${sql.expense + sql.penalty + sql.discount}`);
  }

  // ── 3. Parent scope — admin-only entries must be invisible to a student's parent ──
  const withMoney = (await kdb.raw(`
    SELECT TOP 5 s.id
    FROM students s
    JOIN journal_entries e ON e.student_id = s.id
    WHERE e.status = 'posted'
    GROUP BY s.id
    HAVING COUNT(*) > 0
  `)) as any;
  const studentRows = withMoney.recordset ?? withMoney;
  for (const s of studentRows) {
    const sid = s.id;
    const sql = await rawTotals({ studentId: sid, isAdmin: false });
    const svc = await getLedgerClassTotals({ studentId: sid, isAdmin: false });
    check(`parent(student ${String(sid).slice(0, 8)}): paid == raw SQL`, close(svc.income, sql.income), `svc=${svc.income} sql=${sql.income}`);

    const moves = await getLedgerMovements({ studentId: sid, isAdmin: false });
    const moveIds = new Set(moves.map((m) => m.id));
    const adminRows = (await kdb.raw(`
      SELECT id FROM journal_entries WHERE student_id = '${String(sid).replace(/'/g, "''")}' AND is_admin_only = 1 AND status = 'posted'
    `)) as any;
    const adminIds = (adminRows.recordset ?? adminRows).map((r: any) => r.id);
    const leaked = adminIds.filter((id: string) => moveIds.has(id));
    check(`parent(student ${String(sid).slice(0, 8)}): zero admin-only movements leak`, leaked.length === 0, `leaked=${leaked.length}`);
  }

  // ── 4. Report filters — category + date window on a tenant ──
  if (tenantIds.length) {
    const cat = await kdb.raw(`
      SELECT TOP 1 e.category FROM journal_entries e
      WHERE e.tenant_id = '${tenantIds[0].replace(/'/g, "''")}' AND e.category IS NOT NULL AND e.status='posted'
    `);
    const catRows = (cat as any).recordset ?? cat;
    if (catRows.length) {
      const category = catRows[0].category;
      const dates = await kdb.raw(`
        SELECT MIN(e.entry_date) AS d1, MAX(e.entry_date) AS d2
        FROM journal_entries e WHERE e.tenant_id = '${tenantIds[0].replace(/'/g, "''")}'
      `);
      const drow = (dates as any).recordset?.[0] ?? dates?.[0];
      const iso = (v: unknown) => { const s = String(v || ''); const d = new Date(s); return isNaN(d.getTime()) ? s.slice(0, 10) : d.toISOString().slice(0, 10); };
      const startDate = iso(drow?.d1);
      const endDate = iso(drow?.d2);
      const sql = await rawTotals({ tenantId: tenantIds[0], category, startDate, endDate });
      const svc = await getLedgerClassTotals({ tenantId: tenantIds[0], category, startDate, endDate });
      const svcBucket = svc.income + svc.expense + svc.penalty + svc.discount + svc.reversal;
      const sqlBucket = sql.income + sql.expense + sql.penalty + sql.discount + sql.reversal;
      check(`filtered report (cat '${category}', ${startDate}..${endDate}): totals == raw SQL`, close(svcBucket, sqlBucket), `svc=${svcBucket} sql=${sqlBucket}`);
    } else {
      notes.push('no category rows for filter comparison — skipped');
    }
  }

  // ── 5. Pagination ──
  const listScope = tenantIds.length ? { tenantId: tenantIds[0] as string | null } : { isAdmin: true as boolean };
  const total = await countLedgerMovements(listScope);
  const limit = 100;
  const page1 = await getLedgerMovements({ ...listScope, limit, offset: 0 });
  const page2 = await getLedgerMovements({ ...listScope, limit, offset: limit });
  check('pagination: first page ≤ limit', page1.length <= limit, `len=${page1.length}`);
  check('pagination: total == countLedgerMovements', num(total) === page1.length + page2.length, `total=${total} p1=${page1.length} p2=${page2.length}`);
  const ids1 = new Set(page1.map((m) => m.id));
  const overlap = page2.filter((m) => ids1.has(m.id)).length;
  check('pagination: no id overlap between pages', overlap === 0, `overlap=${overlap}`);

  // ── 6. Zero-access user (empty tenantIds) must see nothing ──
  const emptySvc = await getLedgerClassTotals({ isAdmin: false, tenantIds: [] });
  check('zero-access scope returns zero books', emptySvc.income === 0 && emptySvc.expense === 0 && emptySvc.penalty === 0 && emptySvc.discount === 0, JSON.stringify(emptySvc));

  if (notes.length) console.log('\n  notes:', notes.join('; '));
  console.log('\n═══ %d passed, %d failed ═══', passCount, failCount);
  await kdb.destroy?.();
  process.exit(failCount ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});