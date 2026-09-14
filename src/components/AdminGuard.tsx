import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppPermission } from '../types/permissions';
import { NotAuthorizedPage } from './NotAuthorizedPage';

interface AdminGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: AppPermission;
  onBack?: () => void;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ 
  children, 
  allowedRoles = ['admin'],
  requiredPermission,
  onBack
}) => {
  const { user, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-black text-slate-400 animate-pulse">جاري التحقق من الصلاحيات...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <NotAuthorizedPage onBack={onBack} />;
  }

  if (!allowedRoles.includes(user.role.toLowerCase())) {
    return <NotAuthorizedPage onBack={onBack} />;
  }

  return <>{children}</>;
};