import type { Knex } from 'knex';

// The backend inserts `assigned_at` into user_tenant_assignments
// (user.routes.ts:assign-tenant, employees.routes.ts:create), and fresh-DDL
// schema_mssql.sql now declares the column, but live DBs created earlier are
// missing it -> "Invalid column name 'assigned_at'". This migration reconciles
// retrofit installations with the code + fresh-DDL contract.
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('user_tenant_assignments', 'assigned_at');
  if (!hasColumn) {
    await knex.schema.alterTable('user_tenant_assignments', (t) => {
      t.timestamp('assigned_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .alterTable('user_tenant_assignments', (t) => {
      t.dropColumn('assigned_at');
    })
    .catch(() => undefined);
}