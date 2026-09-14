import type { Knex } from 'knex';

const NEW_PRIEST_PERMISSIONS = [
  'VIEW_USERS', 'MANAGE_USERS', 'MANAGE_EMPLOYEES', 'ASSIGN_ROLES',
  'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT',
  'ASSIGN_ROOM', 'MOVE_STUDENT',
  'MANAGE_HOUSING',
  'ADD_ROOM', 'EDIT_ROOM', 'DELETE_ROOM',
  'CHECKIN_ATTENDANCE',
  'REQUEST_MAINTENANCE',
  'JOIN_LAUNDRY', 'VIEW_LAUNDRY_QUEUE', 'MANAGE_LAUNDRY',
  'MANAGE_LAUNDRY_OPERATORS', 'START_LAUNDRY_SESSION', 'CLOSE_LAUNDRY_SESSION',
  'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT',
  'ATTEND_EVENT', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS',
  'JOIN_COMPETITIONS',
  'ADD_EXPENSE', 'ADD_REVENUE',
  'VIEW_INVENTORY', 'MANAGE_INVENTORY',
  'VIEW_NOTIFICATIONS', 'SEND_NOTIFICATIONS',
  'MANAGE_SETTINGS',
];

export async function up(knex: Knex): Promise<void> {
  for (const permission of NEW_PRIEST_PERMISSIONS) {
    await knex.raw(`
      IF NOT EXISTS (
        SELECT 1 FROM role_permissions WHERE role = 'priest' AND permission = ?
      )
      INSERT INTO role_permissions (role, permission) VALUES ('priest', ?)
    `, [permission, permission]);
  }
  console.log(`✅ Added ${NEW_PRIEST_PERMISSIONS.length} missing permissions for priest role`);
}

export async function down(knex: Knex): Promise<void> {
  for (const permission of NEW_PRIEST_PERMISSIONS) {
    await knex('role_permissions').where({ role: 'priest', permission }).delete();
  }
}
