import type { Knex } from 'knex';

/**
 * Freeze the residence price at enrollment.
 *
 * Policy: a student's accommodation price is the price agreed when they enroll
 * (or when an administrator explicitly changes it). It is stored on the student
 * (`students.agreed_price`) and marked frozen via `students.price_frozen_at`.
 * Once frozen, changing a shared room price (`rooms.price_*`) no longer alters
 * that student's invoice, balance, or statements.
 *
 * Additive and idempotent — only adds a marker column. It deliberately does NOT
 * backfill existing students: legacy rows keep `price_frozen_at = NULL` and
 * continue on the room-price policy until an approved transition freezes them
 * at their current effective price (see scripts/price-freeze-report.ts). This
 * avoids silently changing any existing balance.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'price_frozen_at')
      ALTER TABLE [dbo].[students] ADD [price_frozen_at] DATETIME2 NULL;
  `);
  console.log('Students: price_frozen_at marker added — enrollment price can now be frozen');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'price_frozen_at')
      ALTER TABLE [dbo].[students] DROP COLUMN [price_frozen_at];
  `);
}
