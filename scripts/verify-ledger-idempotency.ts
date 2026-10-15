import { postEntry, paymentLines } from '../src/backend/services/ledger.service';
import { kdb } from '../src/backend/infrastructure/db';

/**
 * Verifies that the ledger's reference idempotency is DB-enforced
 * (migrations/054: unique (reference, status) filtered index) and that
 * postEntry() absorbs a duplicate-reference race by returning the existing
 * entry instead of posting the money twice.
 *
 * Writes one probe entry and deletes it at the end. Requires a reachable DB
 * (DB_HOST=localhost for the local dev database).
 *
 * Run: npx tsx scripts/verify-ledger-idempotency.ts
 */

let passCount = 0;
let failCount = 0;

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passCount++;
    console.log(`  PASS  ${name}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main(): Promise<void> {
  console.log('\n═══ Ledger reference idempotency (unique index + postEntry retry) ═══\n');

  const ref = `idem-verify:${Date.now()}`;

  const first = await kdb.transaction(async (trx) => {
    const amount = 12.5;
    const base = {
      entryType: 'payment' as const,
      amount,
      lines: paymentLines(amount),
      tenantId: null as string | null,
      category: 'تحقق',
      description: `idempotency probe ${ref}`,
      reference: ref,
      source: 'system' as const,
    };
    const post = (input: typeof base) => postEntry(trx as any, input);

    const a = await post(base);
    const b = await post(base);
    const [c1, c2] = await Promise.all([post(base), post(base)]);
    return { a, b, c1, c2 };
  });

  const rows = await kdb('journal_entries').where({ reference: ref }).select('id', 'entry_type', 'status');
  check('four postEntry attempts produced exactly one row', rows.length === 1, `rows=${rows.length}`);
  check('sequential duplicate returned the original entry', first.b.id === first.a.id, `a=${first.a.id} b=${first.b.id}`);
  check('concurrent duplicate resolved to the same entry', first.c1.id === first.a.id && first.c2.id === first.a.id, `c1=${first.c1.id} c2=${first.c2.id} a=${first.a.id}`);
  const row = rows[0];
  check('surviving row is the posted payment', row?.entry_type === 'payment' && row?.status === 'posted', JSON.stringify(row));

  await kdb('journal_lines').where({ entry_id: first.a.id }).del();
  await kdb('journal_entries').where({ id: first.a.id }).del();
  const left = await kdb('journal_entries').where({ reference: ref }).first();
  check('cleanup: probe entry removed', !left);

  console.log('\n═══ %d passed, %d failed ═══', passCount, failCount);
  await kdb.destroy?.();
  process.exit(failCount ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await kdb.destroy?.().catch(() => undefined);
  process.exit(2);
});