import { AnimatePresence } from 'motion/react';
import { EventDashboardSidebar } from './EventDashboardSidebar';
import { EventDetailsView } from './EventDetailsView';
import { EventSessionsView } from './EventSessionsView';
import { EventAttendanceView } from './EventAttendanceView';
import { EventReportView } from './EventReportView';
import { EventCompetitionView } from './EventCompetitionView';
import { EventPaymentsView } from './EventPaymentsView';
import { EventSubscriptionsView } from './EventSubscriptionsView';
import { AppPermission } from '../../types/permissions';

interface EventDashboardProps {
  selectedEvent: any;
  activeView: string;
  setActiveView: (view: any) => void;
  selectedSession: any;
  setSelectedSession: (session: any) => void;
  sessions: any[];
  handleMarkAttendance: (sessionId: string) => void;
  setShowSessionModal: (open: boolean) => void;
  setShowScanner: (open: boolean) => void;
  setShowTeamModal: (open: boolean) => void;
  setShowCriteriaModal: (open: boolean) => void;
  detailedAttendance: any[];
  studentsList: any[];
  handleUpdateAttendanceStatus: (studentId: string, status: string, reason?: string, isPaid?: boolean) => void;
  setAbsenceModal: (data: any) => void;
  handleQrScan: (code: string) => void;
  reportData: any;
  teams: any[];
  criteria: any[];
  setScoringModal: (data: any) => void;
  handleCallCompetition: () => void;
  isCompetitionActive: boolean;
  showLiveLeaderboard: boolean;
  setShowLiveLeaderboard: (open: boolean) => void;
  handleSendPaymentReminder: (subId: string) => void;
  paymentsLoading: boolean;
  eventPayments: any[];
  subscriptions: any[];
  subscriptionsLoading: boolean;
  handleUpdateEvent: (...args: any[]) => void;
  handleToggleParentEnroll: () => void;
  handleDeleteEvent: (id: string) => void;
  isAdmin: boolean;
  user: any;
  rooms: any[];
  handleScoreTeam: (teamId: string, scores: any[]) => void;
  getCurrentLocation: () => void;
  hasPermission: (permission: any) => boolean;
  fetchSubscriptions: (eventId: string) => void;
  fetchEventPayments: (eventId: string) => void;
  employeeList: any[];
  onManageManagers: () => void;
  request: (url: string, options?: any) => Promise<any>;
  showSnackbar: (message: string, type?: any) => void;
  confirm: (options: any) => Promise<boolean>;
  setFormData: (data: any | ((prev: any) => any)) => void;
  setTargeting: (data: any) => void;
  setPaymentMethods: (data: any) => void;
  setIsEditing: (val: boolean) => void;
  setModalOpen: (val: boolean) => void;
  loadTargetData: () => void;
}

export function EventDashboard(props: EventDashboardProps) {
  const {
    selectedEvent,
    activeView,
    setActiveView,
    selectedSession,
    setSelectedSession,
    sessions,
    setShowSessionModal,
    setShowScanner,
    setShowTeamModal,
    setShowCriteriaModal,
    detailedAttendance,
    studentsList,
    handleUpdateAttendanceStatus,
    setAbsenceModal,
    handleQrScan,
    teams,
    criteria,
    setScoringModal,
    handleCallCompetition,
    isCompetitionActive,
    setShowLiveLeaderboard,
    handleSendPaymentReminder,
    paymentsLoading,
    eventPayments,
    subscriptions,
    subscriptionsLoading,
    handleToggleParentEnroll,
    handleDeleteEvent,
    user,
    hasPermission,
    fetchSubscriptions,
    fetchEventPayments,
    onManageManagers,
    request,
    showSnackbar,
    confirm,
    setFormData,
    setTargeting,
    setPaymentMethods,
    setIsEditing,
    setModalOpen,
    loadTargetData,
  } = props;

  return (
    <div className="flex flex-col lg:flex-row gap-10 mt-10">
      <EventDashboardSidebar
        activeView={activeView}
        setActiveView={setActiveView}
        selectedEvent={selectedEvent}
        user={user}
        hasPermission={hasPermission}
        onManageManagers={onManageManagers}
        fetchSubscriptions={fetchSubscriptions}
        fetchEventPayments={fetchEventPayments}
        handleDeleteEvent={handleDeleteEvent}
      />

      <div className="flex-1 bg-white dark:bg-card-dark rounded-xl p-4 sm:p-6 md:p-10 min-h-[400px] sm:min-h-[600px] border border-slate-100 dark:border-white/[0.05] shadow-sm">
        <AnimatePresence mode="wait">
          {activeView === 'details' && (
            <EventDetailsView
              selectedEvent={selectedEvent}
              hasPermission={hasPermission}
              handleToggleParentEnroll={handleToggleParentEnroll}
              user={user}
              setFormData={setFormData}
              setTargeting={setTargeting}
              setPaymentMethods={setPaymentMethods}
              setIsEditing={setIsEditing}
              setModalOpen={setModalOpen}
              loadTargetData={loadTargetData}
              request={request}
              showSnackbar={showSnackbar}
              detailedAttendance={detailedAttendance}
            />
          )}

          {activeView === 'sessions' && (
            <EventSessionsView
              sessions={sessions}
              setSelectedSession={setSelectedSession}
              setShowScanner={setShowScanner}
              setActiveView={setActiveView}
              setShowSessionModal={setShowSessionModal}
            />
          )}

          {activeView === 'attendance_list' && (
            <EventAttendanceView
              selectedSession={selectedSession}
              setSelectedSession={setSelectedSession}
              selectedEvent={selectedEvent}
              studentsList={studentsList}
              detailedAttendance={detailedAttendance}
              setShowScanner={setShowScanner}
              setAbsenceModal={setAbsenceModal}
              handleQrScan={handleQrScan}
              handleUpdateAttendanceStatus={handleUpdateAttendanceStatus}
            />
          )}

          {activeView === 'report' && (
            <EventReportView
              studentsList={studentsList}
              detailedAttendance={detailedAttendance}
              sessions={sessions}
            />
          )}

          {activeView === 'competition' && (
            <EventCompetitionView
              selectedEvent={selectedEvent}
              teams={teams}
              criteria={criteria}
              setShowCriteriaModal={setShowCriteriaModal}
              setShowTeamModal={setShowTeamModal}
              setShowLiveLeaderboard={setShowLiveLeaderboard}
              handleCallCompetition={handleCallCompetition}
              isCompetitionActive={isCompetitionActive}
              setScoringModal={setScoringModal}
              hasPermission={hasPermission}
            />
          )}

          {activeView === 'payments' && (
            <EventPaymentsView
              eventPayments={eventPayments}
              paymentsLoading={paymentsLoading}
              handleSendPaymentReminder={handleSendPaymentReminder}
            />
          )}

          {activeView === 'subscriptions' && (
            <EventSubscriptionsView
              subscriptions={subscriptions}
              subscriptionsLoading={subscriptionsLoading}
              selectedEvent={selectedEvent}
              fetchSubscriptions={fetchSubscriptions}
              request={request}
              showSnackbar={showSnackbar}
              confirm={confirm}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
