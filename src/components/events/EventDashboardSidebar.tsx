import { UserPlus, Trash2, Wallet, Users } from 'lucide-react';
import { AppPermission } from '../../types/permissions';

interface EventDashboardSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedEvent: any;
  user: any;
  hasPermission: (perm: AppPermission) => boolean;
  onManageManagers: () => void;
  fetchSubscriptions: (eventId: string) => void;
  fetchEventPayments: (eventId: string) => void;
  handleDeleteEvent: (id: string) => void;
}

export function EventDashboardSidebar({
  activeView, setActiveView, selectedEvent, user, hasPermission, onManageManagers,
  fetchSubscriptions, fetchEventPayments, handleDeleteEvent,
}: EventDashboardSidebarProps) {
  const btnClass = (view: string, activeBg: string) =>
    `w-full text-right px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
      activeView === view
        ? `${activeBg} text-white shadow-lg`
        : 'text-slate-500 dark:text-slate-400 hover:bg-white/5'
    }`;

  const canAssignManagers = user && (['admin', 'bishop', 'priest', 'supervisor'].includes(user.role) || selectedEvent.canManage);
  const canManageEvent = hasPermission(AppPermission.DELETE_EVENT) || selectedEvent.canManage;

  return (
    <div className="lg:w-72 space-y-2">
      <button onClick={() => setActiveView('details')} className={btnClass('details', 'bg-primary-600')}>التفاصيل العامة</button>
      {selectedEvent.is_competition && (
        <button onClick={() => setActiveView('competition')} className={btnClass('competition', 'bg-warm-500')}>المسابقة والفرق</button>
      )}
      <button onClick={() => setActiveView('sessions')} className={btnClass('sessions', 'bg-ocean-600')}>الأقسام والمحاضرات</button>
      <button onClick={() => setActiveView('attendance_list')} className={btnClass('attendance_list', 'bg-rose-500')}>كشف الحضور والغياب</button>
      <button onClick={() => { setActiveView('subscriptions'); fetchSubscriptions(selectedEvent.id); }} className={btnClass('subscriptions', 'bg-primary-600')}>
        <UserPlus size={14} className="inline ml-2" />الاشتراكات
      </button>
      <button onClick={() => setActiveView('report')} className={btnClass('report', 'bg-white text-slate-800')}>التقرير الإجمالي</button>
      {(hasPermission(AppPermission.MANAGE_EVENT_PAYMENTS) || selectedEvent.canManage) && selectedEvent?.is_paid ? (
        <button onClick={() => { setActiveView('payments'); fetchEventPayments(selectedEvent.id); }} className={btnClass('payments', 'bg-emerald-600')}>
          <Wallet size={14} className="inline ml-2" />المدفوعات
        </button>
      ) : null}
      {canAssignManagers && (
        <button onClick={onManageManagers} className={btnClass('managers', 'bg-vibrant-600')}>
          <Users size={14} className="inline ml-2" />إدارة المتحكمين
        </button>
      )}
      <div className="border-t border-white/10 my-4" />
      {canManageEvent && (
        <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="w-full text-right px-8 py-4 rounded-ultra font-black text-xs uppercase tracking-widest transition-all text-red-400 hover:bg-red-500/10 hover:text-red-300">
          <Trash2 size={14} className="inline ml-2" />حذف الفعالية بالكامل
        </button>
      )}
    </div>
  );
}