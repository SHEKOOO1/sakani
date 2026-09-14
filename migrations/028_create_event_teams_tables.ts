import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasEventTeams = await knex.schema.hasTable('event_teams');
  if (!hasEventTeams) {
    await knex.schema.createTable('event_teams', (t) => {
      t.string('id', 128).primary();
      t.string('event_id', 128);
      t.string('tenant_id', 128);
      t.string('name', 255);
      t.integer('score').defaultTo(0);
      t.string('responsible_id', 128);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    await knex.raw('CREATE INDEX idx_event_teams_event_id ON [dbo].[event_teams] (event_id)');
  }

  const hasEventTeamMembers = await knex.schema.hasTable('event_team_members');
  if (!hasEventTeamMembers) {
    await knex.schema.createTable('event_team_members', (t) => {
      t.string('event_team_id', 128).notNullable();
      t.string('student_id', 128).notNullable();
      t.integer('points_earned').defaultTo(0);
    });
    await knex.raw('CREATE INDEX idx_event_team_members_team ON [dbo].[event_team_members] (event_team_id)');
  }

  // Move existing event-competition teams out of the shared competition tables
  const moved = await knex.transaction(async (trx) => {
    await trx.raw(`
      INSERT INTO [dbo].[event_teams] (id, event_id, tenant_id, name, score, responsible_id, created_at)
      SELECT ct.id, ct.competition_id, ct.tenant_id, ct.name, ct.score, ct.responsible_id, COALESCE(ct.created_at, GETDATE())
      FROM [dbo].[competition_teams] ct
      INNER JOIN [dbo].[events] e ON ct.competition_id = e.id
    `);
    await trx.raw(`
      INSERT INTO [dbo].[event_team_members] (event_team_id, student_id, points_earned)
      SELECT etm.team_id, etm.student_id, etm.points_earned
      FROM [dbo].[competition_team_members] etm
      INNER JOIN [dbo].[event_teams] et ON etm.team_id = et.id
    `);
    await trx.raw(`
      DELETE etm FROM [dbo].[competition_team_members] etm
      INNER JOIN [dbo].[event_teams] et ON etm.team_id = et.id
    `);
    await trx.raw(`
      DELETE ct FROM [dbo].[competition_teams] ct
      INNER JOIN [dbo].[events] e ON ct.competition_id = e.id
    `);
  });

  console.log('Separated event-competition teams into event_teams/event_team_members');
}

export async function down(knex: Knex): Promise<void> {
  const moved = await knex('event_teams').count('* as count').first();
  const count = Number(moved?.count || 0);
  if (count > 0) {
    await knex.raw(`
      INSERT INTO [dbo].[competition_teams] (id, competition_id, tenant_id, name, score, responsible_id, created_at)
      SELECT id, event_id, tenant_id, name, score, responsible_id, created_at
      FROM [dbo].[event_teams]
    ` .replace(/\s+/g, ' '));
    await knex.raw(`
      INSERT INTO [dbo].[competition_team_members] (team_id, student_id, points_earned)
      SELECT event_team_id, student_id, points_earned
      FROM [dbo].[event_team_members]
    ` .replace(/\s+/g, ' '));
  }
  await knex.schema.dropTableIfExists('event_team_members');
  await knex.schema.dropTableIfExists('event_teams');
}