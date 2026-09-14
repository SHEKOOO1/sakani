import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'radio_514_enabled'))) {
    await knex.schema.alterTable('users', (table) => {
      table.boolean('radio_514_enabled').defaultTo(true);
    });
  }

  if (!(await knex.schema.hasColumn('tenants', 'radio_514_enabled'))) {
    await knex.schema.alterTable('tenants', (table) => {
      table.boolean('radio_514_enabled').defaultTo(true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('users', 'radio_514_enabled')) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('radio_514_enabled');
    });
  }

  if (await knex.schema.hasColumn('tenants', 'radio_514_enabled')) {
    await knex.schema.alterTable('tenants', (table) => {
      table.dropColumn('radio_514_enabled');
    });
  }
}
