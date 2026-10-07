import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'daily_readings_enabled'))) {
    await knex.schema.alterTable('users', (table) => {
      table.boolean('daily_readings_enabled').defaultTo(true);
    });
  }

  if (!(await knex.schema.hasColumn('tenants', 'daily_readings_enabled'))) {
    await knex.schema.alterTable('tenants', (table) => {
      table.boolean('daily_readings_enabled').defaultTo(true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('users', 'daily_readings_enabled')) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('daily_readings_enabled');
    });
  }

  if (await knex.schema.hasColumn('tenants', 'daily_readings_enabled')) {
    await knex.schema.alterTable('tenants', (table) => {
      table.dropColumn('daily_readings_enabled');
    });
  }
}
