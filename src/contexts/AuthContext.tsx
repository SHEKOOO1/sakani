import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UserRole, AppPermission } from '../types/permissions';

interface User {
  id: string;
  tenantId: string;
  role: UserRole;
  name: string;
  email: string;
  custom_permissions?: string | null;
  custom_role_id?: string | null;
  daily_readings_enabled?: boolean;
  radio_514_enabled?: boolean;
}

// Mirroring the backend logic in frontend for UI toggling
const rolePermissions: Record<string, AppPermission[]> = {
  // Application Manager (Director) - System-wide VIEW + system management, NO housing/operational access
  admin: [
    AppPermission.VIEW_DASHBOARD, AppPermission.VIEW_REPORTS, AppPermission.VIEW_STUDENT,
    AppPermission.VIEW_ATTENDANCE, AppPermission.VIEW_POINTS, AppPermission.VIEW_DECISION_LOG,
    AppPermission.MANAGE_BISHOPS, AppPermission.MANAGE_GLOBAL_TENANTS, AppPermission.ASSIGN_GLOBAL_STAFF, AppPermission.MANAGE_SUPERVISORS,
    AppPermission.MANAGE_EMPLOYEES, AppPermission.VIEW_SETTINGS, AppPermission.MANAGE_SETTINGS,
    AppPermission.SEND_NOTIFICATIONS, AppPermission.VIEW_NOTIFICATIONS,
    AppPermission.VIEW_USERS, AppPermission.MANAGE_USERS, AppPermission.ASSIGN_ROLES,
    AppPermission.SEND_BROADCAST, AppPermission.VIEW_BROADCASTS,
    AppPermission.VIEW_EVENTS, AppPermission.ATTEND_EVENT, AppPermission.CREATE_EVENT, AppPermission.EDIT_EVENT, AppPermission.DELETE_EVENT, AppPermission.MANAGE_EVENT_ATTENDANCE,
    AppPermission.MANAGE_COMPETITIONS, AppPermission.VIEW_COMPETITIONS, AppPermission.JOIN_COMPETITIONS,
    AppPermission.VIEW_SYSTEM_LOGS,
    AppPermission.VIEW_RADIO, AppPermission.MANAGE_RADIO_BROADCAST, AppPermission.MANAGE_RADIO_VIDEO_LIBRARY,
    AppPermission.MANAGE_RADIO_PLAYLISTS, AppPermission.MANAGE_RADIO_TICKERS, AppPermission.MODERATE_RADIO_CHAT,
    AppPermission.VIEW_RADIO_ANALYTICS,
    AppPermission.VIEW_FINANCE, AppPermission.VIEW_FINANCE_REPORTS, AppPermission.ADD_EXPENSE, AppPermission.ADD_REVENUE
  ],
  // Building Supervisor - Operational authorities
  supervisor: [
    AppPermission.VIEW_STUDENT, AppPermission.ADD_STUDENT, AppPermission.EDIT_STUDENT, AppPermission.DELETE_STUDENT,
    AppPermission.ASSIGN_ROOM, AppPermission.MOVE_STUDENT, AppPermission.VIEW_HOUSING, AppPermission.MANAGE_HOUSING,
    AppPermission.VIEW_ROOMS, AppPermission.ADD_ROOM, AppPermission.EDIT_ROOM, AppPermission.DELETE_ROOM,
    AppPermission.VIEW_ATTENDANCE, AppPermission.MANAGE_ATTENDANCE, AppPermission.JOIN_LAUNDRY,
    AppPermission.VIEW_LAUNDRY_QUEUE, AppPermission.MANAGE_LAUNDRY, AppPermission.MANAGE_LAUNDRY_OPERATORS,
    AppPermission.VIEW_MAINTENANCE, AppPermission.HANDLE_MAINTENANCE,
    AppPermission.VIEW_INVENTORY, AppPermission.MANAGE_INVENTORY,
    AppPermission.VIEW_FINANCE, AppPermission.VIEW_FINANCE_REPORTS, AppPermission.ADD_EXPENSE, AppPermission.ADD_REVENUE,
    AppPermission.CREATE_EVENT, AppPermission.EDIT_EVENT, AppPermission.DELETE_EVENT, AppPermission.MANAGE_EVENT_ATTENDANCE, AppPermission.VIEW_EVENTS,
    AppPermission.VIEW_DASHBOARD, AppPermission.VIEW_REPORTS, AppPermission.SEND_NOTIFICATIONS,
    AppPermission.VIEW_NOTIFICATIONS,
    AppPermission.MANAGE_POINTS, AppPermission.VIEW_POINTS, AppPermission.MANAGE_REWARDS, AppPermission.MANAGE_PENALTIES,
    AppPermission.MANAGE_COMPETITIONS, AppPermission.VIEW_COMPETITIONS, AppPermission.VIEW_DECISION_LOG, AppPermission.UNDO_DECISION,
    AppPermission.MANAGE_EMPLOYEES, AppPermission.VIEW_USERS, AppPermission.MANAGE_USERS, AppPermission.ASSIGN_ROLES,
    AppPermission.VIEW_SETTINGS, AppPermission.MANAGE_SETTINGS,
    AppPermission.SEND_BROADCAST, AppPermission.VIEW_BROADCASTS,
    AppPermission.VIEW_RADIO
  ],
  bishop: [
    AppPermission.VIEW_DASHBOARD, AppPermission.VIEW_REPORTS, AppPermission.VIEW_GLOBAL_REPORTS,
    AppPermission.VIEW_STUDENT, AppPermission.VIEW_ATTENDANCE,
    AppPermission.MANAGE_GLOBAL_TENANTS, AppPermission.ASSIGN_GLOBAL_STAFF, AppPermission.MANAGE_EMPLOYEES,
    AppPermission.VIEW_USERS, AppPermission.MANAGE_USERS,
    AppPermission.SEND_BROADCAST, AppPermission.VIEW_BROADCASTS,
    AppPermission.VIEW_RADIO
  ],
  priest: [
    AppPermission.VIEW_STUDENT, AppPermission.ADD_STUDENT, AppPermission.EDIT_STUDENT, AppPermission.DELETE_STUDENT,
    AppPermission.ASSIGN_ROOM, AppPermission.MOVE_STUDENT, AppPermission.VIEW_HOUSING, AppPermission.MANAGE_HOUSING,
    AppPermission.VIEW_ROOMS, AppPermission.ADD_ROOM, AppPermission.EDIT_ROOM, AppPermission.DELETE_ROOM,
    AppPermission.VIEW_ATTENDANCE, AppPermission.MANAGE_ATTENDANCE, AppPermission.JOIN_LAUNDRY,
    AppPermission.VIEW_LAUNDRY_QUEUE, AppPermission.MANAGE_LAUNDRY, AppPermission.MANAGE_LAUNDRY_OPERATORS,
    AppPermission.VIEW_MAINTENANCE, AppPermission.HANDLE_MAINTENANCE, AppPermission.REQUEST_MAINTENANCE,
    AppPermission.VIEW_INVENTORY, AppPermission.MANAGE_INVENTORY,
    AppPermission.VIEW_FINANCE_REPORTS,
    AppPermission.CREATE_EVENT, AppPermission.EDIT_EVENT, AppPermission.DELETE_EVENT, AppPermission.MANAGE_EVENT_ATTENDANCE, AppPermission.VIEW_EVENTS,
    AppPermission.VIEW_DASHBOARD, AppPermission.VIEW_PRIEST_DASHBOARD, AppPermission.VIEW_REPORTS, AppPermission.SEND_NOTIFICATIONS,
    AppPermission.VIEW_NOTIFICATIONS,
    AppPermission.MANAGE_POINTS, AppPermission.VIEW_POINTS, AppPermission.MANAGE_REWARDS, AppPermission.MANAGE_PENALTIES,
    AppPermission.MANAGE_COMPETITIONS, AppPermission.VIEW_COMPETITIONS, AppPermission.VIEW_DECISION_LOG, AppPermission.UNDO_DECISION,
    AppPermission.MANAGE_EMPLOYEES, AppPermission.VIEW_USERS, AppPermission.MANAGE_USERS, AppPermission.ASSIGN_ROLES,
    AppPermission.VIEW_SETTINGS, AppPermission.MANAGE_SETTINGS,
    AppPermission.SEND_BROADCAST, AppPermission.VIEW_BROADCASTS,
    AppPermission.VIEW_RADIO
  ],
  assistant_supervisor: [
    AppPermission.VIEW_STUDENT, AppPermission.VIEW_ROOMS, AppPermission.VIEW_ATTENDANCE,
    AppPermission.VIEW_MAINTENANCE, AppPermission.HANDLE_MAINTENANCE,
    AppPermission.VIEW_LAUNDRY_QUEUE, AppPermission.VIEW_DASHBOARD, AppPermission.VIEW_REPORTS,
    AppPermission.VIEW_POINTS, AppPermission.VIEW_COMPETITIONS, AppPermission.VIEW_EVENTS,
    AppPermission.MANAGE_EVENT_ATTENDANCE
  ],
  student: [
    AppPermission.VIEW_DASHBOARD, AppPermission.VIEW_STUDENT, AppPermission.CHECKIN_ATTENDANCE, AppPermission.JOIN_LAUNDRY,
    AppPermission.VIEW_LAUNDRY_QUEUE, AppPermission.REQUEST_MAINTENANCE,
    AppPermission.ATTEND_EVENT, AppPermission.VIEW_EVENTS, AppPermission.VIEW_NOTIFICATIONS,
    AppPermission.VIEW_RADIO,
    AppPermission.VIEW_POINTS, AppPermission.VIEW_COMPETITIONS, AppPermission.JOIN_COMPETITIONS,
    AppPermission.VIEW_BROADCASTS
  ],
  parent: [
    AppPermission.VIEW_DASHBOARD, AppPermission.VIEW_STUDENT, AppPermission.VIEW_ATTENDANCE,
    AppPermission.VIEW_NOTIFICATIONS, AppPermission.VIEW_POINTS,
    AppPermission.VIEW_REPORTS,
    AppPermission.VIEW_COMPETITIONS, AppPermission.VIEW_EVENTS,
    AppPermission.ATTEND_EVENT,
    AppPermission.VIEW_BROADCASTS
  ],
  employee: [
    AppPermission.VIEW_DASHBOARD,
    AppPermission.VIEW_RADIO
  ]
};

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (permission: AppPermission) => boolean;
  switchTenant: (tenantId: string) => void;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.user) {
          setUser(res.data.user);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const hasPermission = useCallback((permission: AppPermission): boolean => {
    if (!user) return false;

    const userRole = user.role;
    const perms = rolePermissions[userRole] || [];

    // Check base role permissions
    if (perms.includes(permission) || perms.includes(AppPermission.ALL)) return true;

    // Check per-user custom permissions (additive override from admin)
    if (user.custom_permissions) {
      try {
        const customPerms = JSON.parse(user.custom_permissions);
        if (customPerms.includes(permission) || customPerms.includes('ALL')) return true;
      } catch {}
    }

    return false;
  }, [user]);

  const login = useCallback((newUser: User) => {
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // حتي لو فشلت API، نمسح الجلسة
    }
    setUser(null);
  }, []);

  const switchTenant = useCallback((tenantId: string) => {
    if (!user) return;
    const updatedUser = { ...user, tenantId };
    setUser(updatedUser);
    window.location.href = window.location.pathname;
  }, [user]);

  const refreshPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data?.user) {
        setUser(json.data.user);
      }
    } catch (e) { console.error('Refresh permissions failed:', e); }
  }, []);

  const contextValue = useMemo(() => ({ user, login, logout, isLoading, hasPermission, switchTenant, refreshPermissions }), [user, isLoading, hasPermission, login, logout, switchTenant, refreshPermissions]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}