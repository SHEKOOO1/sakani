import type { Knex } from 'knex';

/**
 * Per-student discount on the residence price.
 *
 * A discount is a property of the student's price, not a cash movement: when
 * set it lowers the invoice derived by invoiceForStudent() (and therefore the
 * student's remaining balance). It never edits the shared room price and it
 * posts no journal entry, so it can be changed or removed cleanly.
 *
 *   discount_type         – 'percent' (of the price) or 'amount' (EGP)
 *   discount_value        – the percent (0-100) or the fixed amount
 *   discount_note         – optional reason (staff-only)
 *   discount_document_id  – the uploaded letter (StudentDocuments.id) that
 *                           justifies the discount; required while active
 *   discount_set_by       – the supervisor who granted it
 *   discount_set_at       – when it was last set
 *
 * Idempotent: every ALTER is guarded with IF NOT EXISTS on sys.columns.
 * Mirrors the boot-time reconciliation in src/backend/infrastructure/db.ts.
 */
export async function up(knex: Knex): Promise<void> {
  const addColumn = async (table: string, name: string, type: string) => {
    await knex.raw(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${name}')
        ALTER TABLE [dbo].[${table}] ADD [${name}] ${type};
    `);
  };

  await addColumn('students', 'discount_type', 'NVARCHAR(20) NULL');
  await addColumn('students', 'discount_value', 'DECIMAL(18,2) NULL');
  await addColumn('students', 'discount_note', 'NVARCHAR(500) NULL');
  await addColumn('students', 'discount_document_id', 'INT NULL');
  await addColumn('students', 'discount_set_by', 'NVARCHAR(128) NULL');
  await addColumn('students', 'discount_set_at', 'DATETIME2 NULL');

  console.log('Student discount columns migration applied');
}

export async function down(knex: Knex): Promise<void> {
  const dropColumn = async (table: string, name: string) => {
    await knex.raw(`
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${name}')
        ALTER TABLE [dbo].[${table}] DROP COLUMN [${name}];
    `);
  };

  await dropColumn('students', 'discount_set_at');
  await dropColumn('students', 'discount_set_by');
  await dropColumn('students', 'discount_document_id');
  await dropColumn('students', 'discount_note');
  await dropColumn('students', 'discount_value');
  await dropColumn('students', 'discount_type');
}
