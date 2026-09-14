import type { Knex } from 'knex';

// The web-push subscription table referenced by notifications.routes.ts
// (POST /api/notifications/subscribe) was never created in any migration or
// the base schema, causing "Invalid object name 'user_push_subscriptions'".
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('user_push_subscriptions');
  if (!hasTable) {
    await knex.schema.createTable('user_push_subscriptions', (t) => {
      t.string('id', 128).primary();
      t.string('user_id', 128).notNullable();
      t.specificType('endpoint', 'NVARCHAR(1000)').notNullable();
      t.specificType('subscription_json', 'NVARCHAR(MAX)');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['endpoint'], 'idx_user_push_subscriptions_endpoint');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_push_subscriptions');
}