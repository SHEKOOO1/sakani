import type { Knex } from 'knex';

const MISSING_PRIEST_PERMISSIONS = [
  'MANAGE_COMPETITIONS',
  'MANAGE_ATTENDANCE',
  'HANDLE_MAINTENANCE',
  'MANAGE_POINTS',
  'MANAGE_REWARDS',
  'MANAGE_PENALTIES',
  'VIEW_FINANCE_REPORTS',
  'VIEW_SETTINGS',
  'VIEW_RADIO',
  'UNDO_DECISION',
];

export async function up(knex: Knex): Promise<void> {
  for (const permission of MISSING_PRIEST_PERMISSIONS) {
    await knex.raw(`
      IF NOT EXISTS (
        SELECT 1 FROM role_permissions WHERE role = 'priest' AND permission = ?
      )
      INSERT INTO role_permissions (role, permission) VALUES ('priest', ?)
    `, [permission, permission]);
  }
  console.log(`Added ${MISSING_PRIEST_PERMISSIONS.length} missing permissions for priest role`);
}

export async function down(knex: Knex): Promise<void> {
  for (const permission of MISSING_PRIEST_PERMISSIONS) {
    await knex('role_permissions').where({ role: 'priest', permission }).delete();
  }
}