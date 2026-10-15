import { kdb } from '../src/backend/infrastructure/db';

/**
 * REAL concurrency verification against the live SQL Server. Proves the two
 * DB-level guards used by attendance and canteen returns actually serialise
 * racing writers — not just that the code "calls a lock".
 *
 *   1) Attendance dedup: two concurrent transactions take the same
 *      sp_getapplock(resource) and then read-then-insert; exactly one row lands.
 *   2) Canteen return idempotency: the unique filtered index
 *      UX_canteen_return_ref rejects a duplicate (tenant, return_ref, product)
 *      insert with SQL error 2601/2627.
 *
 * Both probes use a scratch table / a rolled-back transaction and leave NO data
 * behind. Read-only w.r.t. production rows.
 *
 * Run: npx tsx scripts/verify-concurrency.ts
 */

const PROBE_TABLE = 'zz_concurrency_probe';
const RESOURCE = `concurrency-probe:${Date.now()}`;

async function runAttendanceProbe(): Promise<boolean> {
  await kdb.raw(`
    IF OBJECT_ID('${PROBE_TABLE}') IS NULL
      CREATE TABLE [dbo].[${PROBE_TABLE}] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [resource] NVARCHAR(200) NOT NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
      );
  `);

  const worker = () =>
    kdb.transaction(async (trx) => {
      await trx.raw(
        "DECLARE @rc int; EXEC @rc = sp_getapplock @Resource = ?, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;",
        [RESOURCE],
      );
      const existing = await trx(PROBE_TABLE)
        .where({ resource: RESOURCE })
        .whereRaw('created_at > DATEADD(minute, -5, GETDATE())')
        .first();
      if (existing) return 'blocked';
      await trx(PROBE_TABLE).insert({ resource: RESOURCE });
      return 'inserted';
    });

  const [a, b] = await Promise.all([worker(), worker()]);
  const [{ n }] = (await kdb(PROBE_TABLE).where({ resource: RESOURCE }).count({ n: 'id' })) as any[];
  const count = Number(n);
  console.log(`   workers: [${a}, ${b}] → rows written: ${count}`);
  await kdb.raw(`DROP TABLE [dbo].[${PROBE_TABLE}];`);
  return count === 1;
}

async function runReturnRefProbe(): Promise<boolean> {
  const tenant = `__probe_tenant__`;
  const ref = `__probe_ref_${Date.now()}__`;
  const product = `__probe_product__`;
  let dupCaught = false;
  try {
    await kdb.transaction(async (trx) => {
      const base = {
        tenant_id: tenant, product_id: product, movement_type: 'return',
        quantity: 1, unit_cost: 0, return_ref: ref, created_at: new Date(),
      };
      await trx('canteen_stock_movements').insert({ id: `probe-${Date.now()}-1`, ...base });
      // Second row with the same (tenant, return_ref, product) must be rejected.
      await trx('canteen_stock_movements').insert({ id: `probe-${Date.now()}-2`, ...base });
    });
  } catch (e: any) {
    dupCaught = e?.number === 2601 || e?.number === 2627;
    if (!dupCaught) throw e;
  }
  // The transaction rolled back, so nothing persisted — confirm.
  const leftover = await kdb('canteen_stock_movements').where({ tenant_id: tenant, return_ref: ref }).count({ n: 'id' }).first();
  const cleaned = Number((leftover as any)?.n || 0) === 0;
  console.log(`   duplicate return_ref rejected: ${dupCaught}; rows left behind: ${cleaned ? 0 : 'NONZERO'}`);
  return dupCaught && cleaned;
}

async function main(): Promise<void> {
  console.log('\n═══ Real concurrency verification ═══\n');

  console.log('1) Attendance duplicate guard (sp_getapplock + read-then-insert)');
  const attendanceOk = await runAttendanceProbe();

  console.log('\n2) Canteen return idempotency (UX_canteen_return_ref unique index)');
  const returnsOk = await runReturnRefProbe();

  console.log('\n────────────────────────────────────────');
  console.log(`attendance guard : ${attendanceOk ? 'PASS' : 'FAIL'}`);
  console.log(`return idempotency: ${returnsOk ? 'PASS' : 'FAIL'}`);

  await kdb.destroy?.();
  process.exit(attendanceOk && returnsOk ? 0 : 1);
}

main().catch(async (e) => {
  console.error('verification error:', e);
  await kdb.destroy?.().catch(() => undefined);
  process.exit(2);
});
