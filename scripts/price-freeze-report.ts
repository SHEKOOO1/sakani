import { kdb } from '../src/backend/infrastructure/db';
import { invoiceForStudent } from '../src/backend/services/ledger.service';

/**
 * READ-ONLY reconciliation report for the "freeze the residence price at
 * enrollment" policy (migrations/055 + ledger.invoiceForStudent).
 *
 * It does NOT change anything. It lists every student with a room and shows:
 *   - the current effective invoice (what they are billed today),
 *   - whether their price is already frozen (price_frozen_at set),
 *   - the value to freeze them at if an approved transition is run
 *     (always their CURRENT effective invoice, so no balance changes).
 *
 * Use it to review the impacted population before running any backfill.
 *
 * Run: npx tsx scripts/price-freeze-report.ts
 */

interface Row {
  id: string;
  student: string;
  tenant_id: string | null;
  room: string | null;
  billing_cycle: string | null;
  agreed_price: number;
  frozen_at: string | null;
  effective: number;
  source: string;
}

async function main(): Promise<void> {
  console.log('\n═══ Residence price freeze — reconciliation report (read-only) ═══\n');

  const rows = await kdb('students as s')
    .leftJoin('users as u', 's.user_id', 'u.id')
    .leftJoin('rooms as r', 's.room_id', 'r.id')
    .select(
      's.id',
      'u.name as student',
      's.tenant_id',
      'r.room_number as room',
      's.billing_cycle',
      's.agreed_price',
      's.price_frozen_at',
      'r.price_daily',
      'r.price_monthly',
      'r.price_semester',
    )
    .orderBy('u.name');

  const report: Row[] = [];
  let frozenCount = 0;
  let legacyWithPrice = 0;
  let freezePending = 0;
  const needsManualReview: Row[] = [];

  for (const s of rows as any[]) {
    const { invoice, source } = invoiceForStudent(s);
    const frozenAt = s.price_frozen_at ? new Date(s.price_frozen_at).toISOString() : null;
    const frozenActive = frozenAt != null && new Date(frozenAt).getTime() <= Date.now();
    const roomHasPrice = Number(s.price_daily || 0) > 0 || Number(s.price_monthly || 0) > 0 || Number(s.price_semester || 0) > 0;

    if (frozenActive) frozenCount++;
    else if (roomHasPrice) legacyWithPrice++;

    // A legacy student (not frozen) whose agreed_price differs from the current
    // effective room price would change if naively frozen at agreed_price — the
    // safe freeze value is always the CURRENT effective invoice (no balance move).
    const agreed = Number(s.agreed_price || 0);
    if (!frozenActive && roomHasPrice && agreed !== invoice) freezePending++;

    const row: Row = {
      id: s.id,
      student: s.student || '—',
      tenant_id: s.tenant_id || null,
      room: s.room || null,
      billing_cycle: s.billing_cycle || null,
      agreed_price: agreed,
      frozen_at: frozenAt,
      effective: invoice,
      source,
    };
    report.push(row);

    // Insufficient historical data: not frozen, no room price for the cycle, and
    // no agreed price → the effective invoice is 0 only because nothing was ever
    // configured. Never guess a value for these; a human must supply the real price.
    if (!frozenActive && !roomHasPrice && agreed === 0) {
      needsManualReview.push(row);
    }
  }

  console.log(`students             : ${report.length}`);
  console.log(`already frozen       : ${frozenCount}`);
  console.log(`legacy on room price : ${legacyWithPrice}`);
  console.log(`would change if frozen at agreed_price (needs care): ${freezePending}`);
  console.log(`needs manual review (insufficient historical data): ${needsManualReview.length}`);
  console.log('\nSource legend: frozen = agreed_price + marker | room = shared room price for cycle | agreed = agreed_price fallback | (none) = nothing configured');
  console.log('Suggested transition: freeze every legacy student at their CURRENT effective');
  console.log('invoice (source of truth today) so no balance moves, then keep the marker.\n');

  const pending = report.filter(r => r.frozen_at == null && r.effective > 0 && !needsManualReview.includes(r));
  if (pending.length) {
    console.log('Students to freeze (id | student | tenant | cycle | source | effective → freeze value):');
    for (const r of pending) {
      console.log(`  ${r.id} | ${r.student} | ${r.tenant_id} | ${r.billing_cycle} | ${r.source} | ${r.effective}`);
    }
    console.log('\nBackfill (review first, then run manually — NOT automatic):');
    console.log("  UPDATE students SET agreed_price = <effective>, price_frozen_at = GETDATE() WHERE id = '<id>';");
  } else {
    console.log('No legacy students with a determinable price to freeze.');
  }

  if (needsManualReview.length) {
    console.log('\n⚠ Needs manual review — NO price data at all (do not guess, do not auto-freeze):');
    for (const r of needsManualReview) {
      console.log(`  ${r.id} | ${r.student} | ${r.tenant_id} | room=${r.room ?? '—'}`);
    }
    console.log('  → Supply the real agreed price for each, then freeze it explicitly.');
  }

  console.log('\nReconciliation plan (before/after):');
  console.log('  1) BACKUP the students + ledger tables and record balances before any change.');
  console.log('  2) Re-run this report and capture the "would change" / "manual review" lists.');
  console.log('  3) Apply the manual freeze only after review; each row uses its CURRENT effective invoice.');
  console.log('  4) Re-run the report and confirm frozen count rose and balances are unchanged.');

  await kdb.destroy?.();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await kdb.destroy?.().catch(() => undefined);
  process.exit(2);
});
