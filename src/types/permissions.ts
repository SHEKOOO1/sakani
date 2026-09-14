
export enum AppPermission {
  // Students
  VIEW_STUDENT = 'VIEW_STUDENT',
  ADD_STUDENT = 'ADD_STUDENT',
  EDIT_STUDENT = 'EDIT_STUDENT',
  DELETE_STUDENT = 'DELETE_STUDENT',
  ASSIGN_ROOM = 'ASSIGN_ROOM',
  MOVE_STUDENT = 'MOVE_STUDENT',

  // Housing
  VIEW_HOUSING = 'VIEW_HOUSING',
  MANAGE_HOUSING = 'MANAGE_HOUSING',
  VIEW_ROOMS = 'VIEW_ROOMS',
  ADD_ROOM = 'ADD_ROOM',
  EDIT_ROOM = 'EDIT_ROOM',
  DELETE_ROOM = 'DELETE_ROOM',

  // Attendance
  VIEW_ATTENDANCE = 'VIEW_ATTENDANCE',
  CHECKIN_ATTENDANCE = 'CHECKIN_ATTENDANCE',
  MANAGE_ATTENDANCE = 'MANAGE_ATTENDANCE',

  // Laundry
  JOIN_LAUNDRY = 'JOIN_LAUNDRY',
  VIEW_LAUNDRY_QUEUE = 'VIEW_LAUNDRY_QUEUE',
  MANAGE_LAUNDRY = 'MANAGE_LAUNDRY',
  MANAGE_LAUNDRY_OPERATORS = 'MANAGE_LAUNDRY_OPERATORS',
  START_LAUNDRY_SESSION = 'START_LAUNDRY_SESSION',
  CLOSE_LAUNDRY_SESSION = 'CLOSE_LAUNDRY_SESSION',

  // System Administration
  MANAGE_BISHOPS = 'MANAGE_BISHOPS',
  MANAGE_GLOBAL_TENANTS = 'MANAGE_GLOBAL_TENANTS',
  ASSIGN_GLOBAL_STAFF = 'ASSIGN_GLOBAL_STAFF',
  MANAGE_SUPERVISORS = 'MANAGE_SUPERVISORS',
  VIEW_SYSTEM_LOGS = 'VIEW_SYSTEM_LOGS',

  // Behavior & Points
  MANAGE_POINTS = 'MANAGE_POINTS',
  VIEW_POINTS = 'VIEW_POINTS',
  MANAGE_REWARDS = 'MANAGE_REWARDS',
  MANAGE_PENALTIES = 'MANAGE_PENALTIES',
  
  // Competitions
  MANAGE_COMPETITIONS = 'MANAGE_COMPETITIONS',
  VIEW_COMPETITIONS = 'VIEW_COMPETITIONS',
  JOIN_COMPETITIONS = 'JOIN_COMPETITIONS',

  // Administrative Logs & Undo
  VIEW_DECISION_LOG = 'VIEW_DECISION_LOG',
  UNDO_DECISION = 'UNDO_DECISION',

  // Maintenance
  REQUEST_MAINTENANCE = 'REQUEST_MAINTENANCE',
  VIEW_MAINTENANCE = 'VIEW_MAINTENANCE',
  HANDLE_MAINTENANCE = 'HANDLE_MAINTENANCE',

  // Inventory
  VIEW_INVENTORY = 'VIEW_INVENTORY',
  MANAGE_INVENTORY = 'MANAGE_INVENTORY',

  // Finance
  VIEW_FINANCE = 'VIEW_FINANCE',
  ADD_EXPENSE = 'ADD_EXPENSE',
  ADD_REVENUE = 'ADD_REVENUE',
  VIEW_FINANCE_REPORTS = 'VIEW_FINANCE_REPORTS',

  // Events
  CREATE_EVENT = 'CREATE_EVENT',
  EDIT_EVENT = 'EDIT_EVENT',
  DELETE_EVENT = 'DELETE_EVENT',
  ATTEND_EVENT = 'ATTEND_EVENT',
  VIEW_EVENTS = 'VIEW_EVENTS',
  MANAGE_EVENT_ATTENDANCE = 'MANAGE_EVENT_ATTENDANCE',
  MANAGE_EVENT_PAYMENTS = 'MANAGE_EVENT_PAYMENTS',

  // Settings
  VIEW_SETTINGS = 'VIEW_SETTINGS',
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',

  // Notifications
  VIEW_NOTIFICATIONS = 'VIEW_NOTIFICATIONS',
  SEND_NOTIFICATIONS = 'SEND_NOTIFICATIONS',

  // Reports
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_REPORTS = 'VIEW_REPORTS',
  VIEW_GLOBAL_REPORTS = 'VIEW_GLOBAL_REPORTS',

  // Priest Specific
  VIEW_PRIEST_DASHBOARD = 'VIEW_PRIEST_DASHBOARD',
  MANAGE_PRIEST_REPORTS = 'MANAGE_PRIEST_REPORTS',

  // User Management
  VIEW_USERS = 'VIEW_USERS',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_EMPLOYEES = 'MANAGE_EMPLOYEES',
  ASSIGN_ROLES = 'ASSIGN_ROLES',

  // Broadcast / News
  SEND_BROADCAST = 'SEND_BROADCAST',
  VIEW_BROADCASTS = 'VIEW_BROADCASTS',

  // Radio 5:14
  VIEW_RADIO = 'VIEW_RADIO',
  MANAGE_RADIO_BROADCAST = 'MANAGE_RADIO_BROADCAST',
  MANAGE_RADIO_VIDEO_LIBRARY = 'MANAGE_RADIO_VIDEO_LIBRARY',
  MANAGE_RADIO_PLAYLISTS = 'MANAGE_RADIO_PLAYLISTS',
  MANAGE_RADIO_TICKERS = 'MANAGE_RADIO_TICKERS',
  MODERATE_RADIO_CHAT = 'MODERATE_RADIO_CHAT',
  VIEW_RADIO_ANALYTICS = 'VIEW_RADIO_ANALYTICS',

  // Special permissions
  ALL = 'ALL',
}

export enum RadioRole {
  RadioAdmin = 'radio_admin',
  RadioAudioAdmin = 'radio_audio_admin',
  RadioVideoAdmin = 'radio_video_admin',
  RadioLibraryAdmin = 'radio_library_admin',
  RadioOperator = 'radio_operator',
}

export enum UserRole {
  Admin = 'admin',
  Supervisor = 'supervisor',
  Employee = 'employee',
  AssistantSupervisor = 'assistant_supervisor',
  Student = 'student',
  Parent = 'parent',
  Bishop = 'bishop',
  Priest = 'priest',
}

// Allowed permission values — used to validate permission assignments and prevent privilege escalation
const _VALID_PERMISSIONS: Record<string, true> = {} as any;
for (const perm of Object.values(AppPermission)) {
  _VALID_PERMISSIONS[perm] = true;
}
export const VALID_PERMISSIONS: ReadonlySet<string> = new Set(Object.keys(_VALID_PERMISSIONS));

export function isValidPermission(value: string): boolean {
  return VALID_PERMISSIONS.has(value);
}

export function validatePermissionArray(permissions: any[]): { valid: boolean; invalidPermission?: string } {
  if (!Array.isArray(permissions)) return { valid: false };
  for (const p of permissions) {
    if (typeof p !== 'string' || !isValidPermission(p)) {
      return { valid: false, invalidPermission: String(p) };
    }
  }
  return { valid: true };
}
