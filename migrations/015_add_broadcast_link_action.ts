import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('broadcasts', 'link_action'))) {
    await knex.schema.alterTable('broadcasts', (table) => {
      table.text('link_action').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('broadcasts', 'link_action')) {
    await knex.schema.alterTable('broadcasts', (table) => {
      table.dropColumn('link_action');
    });
  }
}
