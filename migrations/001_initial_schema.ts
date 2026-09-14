import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = (name: string) => knex.schema.hasTable(name);

  if (!(await hasTable('users'))) {
    await knex.schema.createTable('users', (t) => {
      t.string('id', 128).primary();
      t.string('email', 255).notNullable().unique();
      t.string('password_hash', 500).notNullable();
      t.string('name', 255).notNullable();
      t.string('role', 50).notNullable();
      t.string('tenant_id', 128);
      t.string('phone', 20);
      t.string('whatsapp_number', 20);
      t.string('gender', 10);
      t.boolean('is_active').defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('permissions'))) {
    await knex.schema.createTable('permissions', (t) => {
      t.string('id', 128).primary();
      t.string('name', 255).notNullable();
      t.string('description', 500);
      t.string('group', 100);
    });
  }

  if (!(await hasTable('role_permissions'))) {
    await knex.schema.createTable('role_permissions', (t) => {
      t.string('role', 50).notNullable();
      t.string('permission_id', 128).notNullable();
      t.primary(['role', 'permission_id']);
    });
  }

  if (!(await hasTable('students'))) {
    await knex.schema.createTable('students', (t) => {
      t.string('id', 128).primary();
      t.string('tenant_id', 128).notNullable();
      t.string('user_id', 128).notNullable();
      t.string('room_id', 128);
      t.string('student_id_number', 50);
      t.string('national_id', 50);
      t.string('name', 255).notNullable();
      t.string('email', 255);
      t.string('phone', 20);
      t.string('whatsapp_number', 20);
      t.string('gender', 10);
      t.date('birth_date');
      t.string('governorate', 100);
      t.string('village', 100);
      t.string('church_name', 255);
      t.string('college', 255);
      t.string('major', 255);
      t.string('academic_year', 50);
      t.string('guardian_name', 255);
      t.string('guardian_phone', 20);
      t.string('guardian_relation', 50);
      t.string('guardian_whatsapp', 20);
      t.boolean('is_active').defaultTo(true);
      t.boolean('is_servant').defaultTo(false);
      t.boolean('is_deacon').defaultTo(false);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('tenants'))) {
    await knex.schema.createTable('tenants', (t) => {
      t.string('id', 128).primary();
      t.string('name', 255).notNullable();
      t.string('type', 50);
      t.string('address', 500);
      t.integer('capacity');
      t.boolean('is_active').defaultTo(true);
      t.decimal('location_lat', 10, 7);
      t.decimal('location_lng', 10, 7);
      t.integer('radius_meters');
      t.string('curfew_time', 5);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('apartments'))) {
    await knex.schema.createTable('apartments', (t) => {
      t.string('id', 128).primary();
      t.string('tenant_id', 128).notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('name', 255).notNullable();
      t.string('floor', 50);
      t.integer('capacity');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('rooms'))) {
    await knex.schema.createTable('rooms', (t) => {
      t.string('id', 128).primary();
      t.string('apartment_id', 128).notNullable();
      t.string('room_number', 50).notNullable();
      t.integer('capacity').defaultTo(2);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('attendance'))) {
    await knex.schema.createTable('attendance', (t) => {
      t.increments('id').primary();
      t.string('student_id', 128).notNullable();
      t.string('tenant_id', 128);
      t.string('user_id', 128);
      t.string('type', 20).notNullable();
      t.string('status', 20);
      t.decimal('location_lat', 10, 7);
      t.decimal('location_lng', 10, 7);
      t.timestamp('attended_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('student_delays'))) {
    await knex.schema.createTable('student_delays', (t) => {
      t.increments('id').primary();
      t.string('student_id', 128).notNullable();
      t.string('tenant_id', 128);
      t.string('reason', 500);
      t.integer('delay_minutes').defaultTo(0);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('student_points'))) {
    await knex.schema.createTable('student_points', (t) => {
      t.increments('id').primary();
      t.string('student_id', 128).notNullable();
      t.integer('points').notNullable();
      t.string('reason', 500);
      t.string('added_by', 128);
      t.string('category', 50);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('student_warnings'))) {
    await knex.schema.createTable('student_warnings', (t) => {
      t.increments('id').primary();
      t.string('student_id', 128).notNullable();
      t.string('reason', 500).notNullable();
      t.string('status', 20).defaultTo('active');
      t.boolean('notify_parent').defaultTo(false);
      t.boolean('notify_priest').defaultTo(false);
      t.string('issued_by', 128);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('student_archive'))) {
    await knex.schema.createTable('student_archive', (t) => {
      t.increments('id').primary();
      t.string('student_id', 128).notNullable();
      t.string('reason', 500);
      t.string('archived_by', 128);
      t.timestamp('archived_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('rewards_definitions'))) {
    await knex.schema.createTable('rewards_definitions', (t) => {
      t.increments('id').primary();
      t.string('name', 255).notNullable();
      t.text('description');
      t.integer('points_cost');
      t.boolean('is_active').defaultTo(true);
    });
  }

  if (!(await hasTable('events'))) {
    await knex.schema.createTable('events', (t) => {
      t.string('id', 128).primary();
      t.string('title', 255).notNullable();
      t.text('description');
      t.string('type', 50);
      t.string('location', 255);
      t.datetime('start_date');
      t.datetime('end_date');
      t.boolean('is_active').defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('event_attendance'))) {
    await knex.schema.createTable('event_attendance', (t) => {
      t.increments('id').primary();
      t.string('event_id', 128).notNullable();
      t.string('student_id', 128).notNullable();
      t.string('status', 20);
      t.timestamp('attended_at');
    });
  }

  if (!(await hasTable('event_subscriptions'))) {
    await knex.schema.createTable('event_subscriptions', (t) => {
      t.increments('id').primary();
      t.string('event_id', 128).notNullable();
      t.string('student_id', 128).notNullable();
      t.timestamp('subscribed_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('notifications'))) {
    await knex.schema.createTable('notifications', (t) => {
      t.increments('id').primary();
      t.string('user_id', 128).notNullable();
      t.string('tenant_id', 128);
      t.string('title', 255);
      t.text('message');
      t.string('type', 50);
      t.boolean('is_read').defaultTo(false);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('broadcasts'))) {
    await knex.schema.createTable('broadcasts', (t) => {
      t.increments('id').primary();
      t.string('title', 255).notNullable();
      t.text('content');
      t.string('display_type', 50).defaultTo('news');
      t.string('priority', 20).defaultTo('normal');
      t.boolean('is_active').defaultTo(true);
      t.datetime('start_at');
      t.datetime('end_at');
      t.text('targeting');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('finance_transactions'))) {
    await knex.schema.createTable('finance_transactions', (t) => {
      t.increments('id').primary();
      t.string('tenant_id', 128).notNullable();
      t.string('student_id', 128);
      t.string('type', 20).notNullable();
      t.decimal('amount', 10, 2).notNullable();
      t.string('description', 500);
      t.date('transaction_date');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('laundry_machines'))) {
    await knex.schema.createTable('laundry_machines', (t) => {
      t.increments('id').primary();
      t.string('name', 255).notNullable();
      t.string('status', 20).defaultTo('available');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('laundry_queue'))) {
    await knex.schema.createTable('laundry_queue', (t) => {
      t.increments('id').primary();
      t.string('student_id', 128).notNullable();
      t.string('machine_id', 128);
      t.string('status', 20).defaultTo('waiting');
      t.timestamp('joined_at').defaultTo(knex.fn.now());
      t.timestamp('started_at');
      t.timestamp('completed_at');
    });
  }

  if (!(await hasTable('maintenance_requests'))) {
    await knex.schema.createTable('maintenance_requests', (t) => {
      t.increments('id').primary();
      t.string('tenant_id', 128).notNullable();
      t.string('student_id', 128);
      t.string('title', 255).notNullable();
      t.text('description');
      t.string('status', 20).defaultTo('pending');
      t.string('priority', 20).defaultTo('normal');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('StudentPhones'))) {
    await knex.schema.createTable('StudentPhones', (t) => {
      t.increments('id').primary();
      t.string('student_id', 128).notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.string('phone_type', 50);
      t.string('label', 100);
      t.string('phone_number', 20).notNullable();
    });
  }

  if (!(await hasTable('StudentDocuments'))) {
    await knex.schema.createTable('StudentDocuments', (t) => {
      t.increments('id').primary();
      t.string('student_id', 128).notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.string('doc_type', 100);
      t.text('file_path').notNullable();
      t.string('file_name', 255);
      t.timestamp('uploaded_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('audit_log'))) {
    await knex.schema.createTable('audit_log', (t) => {
      t.increments('id').primary();
      t.string('user_id', 128);
      t.string('action', 100).notNullable();
      t.string('entity_type', 100);
      t.string('entity_id', 128);
      t.text('details');
      t.string('ip_address', 45);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('competitions'))) {
    await knex.schema.createTable('competitions', (t) => {
      t.increments('id').primary();
      t.string('name', 255).notNullable();
      t.text('description');
      t.string('type', 50);
      t.datetime('start_date');
      t.datetime('end_date');
      t.boolean('is_active').defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('competition_results'))) {
    await knex.schema.createTable('competition_results', (t) => {
      t.increments('id').primary();
      t.integer('competition_id').notNullable();
      t.string('student_id', 128).notNullable();
      t.decimal('score', 10, 2);
      t.integer('rank');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await hasTable('item_managers'))) {
    await knex.schema.createTable('item_managers', (t) => {
      t.increments('id').primary();
      t.string('item_type', 50).notNullable();
      t.string('item_id', 128).notNullable();
      t.string('user_id', 128).notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'student_delays', 'competition_results', 'competitions',
    'StudentDocuments', 'StudentPhones',
    'laundry_queue', 'laundry_machines',
    'maintenance_requests', 'finance_transactions',
    'event_subscriptions', 'event_attendance', 'events',
    'notifications', 'broadcasts',
    'student_warnings', 'student_points', 'rewards_definitions',
    'student_archive', 'attendance',
    'item_managers',
    'rooms', 'apartments',
    'students', 'tenants',
    'role_permissions', 'permissions',
    'audit_log',
    'users',
  ];
  for (const t of tables) {
    if (await knex.schema.hasTable(t)) {
      await knex.schema.dropTable(t);
    }
  }
}
