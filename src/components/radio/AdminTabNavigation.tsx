import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { AppPermission } from '../../types/permissions';

interface AdminTabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: { id: string; icon: React.ComponentType<any>; label: string }[];
}

export function AdminTabNavigation({ activeTab, onTabChange, tabs }: AdminTabNavigationProps) {
  const { user, hasPermission } = useAuth();
  return (
    <div className="relative bg-slate-100 dark:bg-white/5 p-1.5 rounded-xl overflow-x-auto">
      <div className="flex gap-1">
        {tabs.filter(tab => {
          if (tab.id === 'permissions') return ['admin'].includes(user?.role || '');
          if (tab.id === 'bans') return ['admin'].includes(user?.role || '') || hasPermission(AppPermission.MODERATE_RADIO_CHAT);
          return true;
        }).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => onTabChange(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-3 px-5 py-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                isActive ? 'text-white' : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
              }`}>
              {isActive && (
                <motion.div layoutId="admin-radio-main-tab"
                  className="absolute inset-0 bg-gradient-to-br from-primary-600 to-vibrant-600 rounded-lg shadow-lg shadow-primary-500/20"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10 flex items-center gap-2.5">
                <Icon size={20} />
                <span>{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
