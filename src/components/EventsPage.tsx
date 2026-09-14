import { useState, useEffect } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useEventTargeting } from '../hooks/useEventTargeting';
import { useEventCrud } from '../hooks/useEventCrud';
import { useEventCompetition } from '../hooks/useEventCompetition';
import { useEventSubscriptions } from '../hooks/useEventSubscriptions';
import { useEventAttendance } from '../hooks/useEventAttendance';
import { motion, AnimatePresence } from 'motion/react';
import { QRScanner } from './QRScanner';
import { LiveLeaderboard } from './LiveLeaderboard';
import { SessionCreateModal } from './events/SessionCreateModal';
import { TeamCreateModal } from './events/TeamCreateModal';
import { CriteriaManagerModal } from './events/CriteriaManagerModal';
import { EventsPageHeader } from './events/EventsPageHeader';
import { EventSearchSection } from './events/EventSearchSection';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { EventCreateModal } from './events/EventCreateModal';
import { EventDashboard } from './events/EventDashboard';
import { EventDetailModal } from './events/EventDetailModal';
import { ScoringModal } from './events/ScoringModal';
import { AbsenceModal } from './events/AbsenceModal';
import { ManagersModal } from './items/ManagersModal';

export function EventsPage({ defaultView = 'management' }: { defaultView?: 'management' | 'attendance' }) {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const mounted = useMounted();
  const [activeTab, setActiveTab] = useState(defaultView);

  const targeting = useEventTargeting();
  const crud = useEventCrud();
  const competition = useEventCompetition(crud.selectedEvent);
  const attendance = useEventAttendance(crud.selectedEvent, crud.fetchEvents);
  const subscriptions = useEventSubscriptions(crud.selectedEvent, crud.fetchEvents, (updated) => crud.setSelectedEvent(updated));

  const [activeView, setActiveView] = useState<'details' | 'sessions' | 'attendance_list' | 'report' | 'competition' | 'payments' | 'subscriptions'>('details');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [modalData, setModalData] = useState<any>({});
  const [managersItem, setManagersItem] = useState<{ itemType: 'event'; itemId: string; itemTitle?: string } | null>(null);

  useEffect(() => {
    const handleClose = () => competition.setShowLiveLeaderboard(false);
    window.addEventListener('closeLeaderboard', handleClose);
    return () => window.removeEventListener('closeLeaderboard', handleClose);
  }, []);

  useEffect(() => {
    setActiveTab(defaultView);
  }, [defaultView]);

  useEffect(() => {
    crud.fetchBaseData(user);
    const pendingId = sessionStorage.getItem('sakani_pending_event');
    if (pendingId) {
      sessionStorage.removeItem('sakani_pending_event');
      crud.pendingEventRef.current = pendingId;
    }
    crud.fetchEvents();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.eventId) {
        sessionStorage.removeItem('sakani_pending_event');
        crud.pendingEventRef.current = detail.eventId;
      }
    };
    window.addEventListener('openEvent', handler);
    return () => { window.removeEventListener('openEvent', handler); };
  }, [crud.fetchBaseData, crud.fetchEvents]);

  useEffect(() => {
    if (!crud.pendingEventRef.current || crud.events.length === 0) return;
    const ev = crud.events.find((ev: any) => ev.id === crud.pendingEventRef.current);
    if (ev) {
      crud.pendingEventRef.current = null;
      openEventFromNotification(ev);
    }
  }, [crud.events]);

  const openEventFromNotification = (ev: any) => {
    if (user?.role === 'parent' || user?.role === 'student') {
      subscriptions.setDetailEvent(ev);
      subscriptions.setShowEventDetail(true);
      subscriptions.setMySubscription(ev._user_subscription || null);
      subscriptions.setSelectedPaymentMethod('');
      subscriptions.setReceiptFile(null);
      subscriptions.setReceiptPreview('');
    } else {
      crud.setSelectedEvent(ev);
      setActiveView('subscriptions');
      subscriptions.fetchSubscriptions(ev.id);
    }
  };

  useEffect(() => {
    if (user?.role === 'parent') {
      (async () => {
        try {
          const res = await request('/api/parents/children');
          if (!mounted.current) return;
          if (res.data && res.data.length > 0) {
            subscriptions.setParentChildren(res.data);
          }
        } catch (err) { console.error(err); showSnackbar('فشل تحميل قائمة الأبناء', 'error'); }
      })();
    }
  }, [user?.role]);

  useEffect(() => {
    attendance.fetchEventDetails(crud.selectedEvent?.id);
    setActiveView('details');
  }, [crud.selectedEvent?.id]);

  useEffect(() => {
    if (crud.selectedEvent && activeView === 'competition') {
      competition.fetchCompetitionData();
    }
  }, [crud.selectedEvent, activeView]);

  useEffect(() => {
    if (crud.modalOpen && !crud.isEditing) {
      request('/api/payments/methods').then(res => {
        setPaymentMethods(res.data || []);
      }).catch(e => console.error('Load payment methods failed:', e));
      targeting.loadTargetData();
      targeting.setTargeting({});
    }
  }, [crud.modalOpen]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      showSnackbar('الجهاز لا يدعم تحديد الموقع', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        crud.setFormData({ ...crud.formData, location_lat: pos.coords.latitude.toString(), location_lng: pos.coords.longitude.toString() });
      },
      (err) => showSnackbar('فشل الحصول على الموقع: ' + err.message, 'error')
    );
  };

  const handleSave = async () => {
    await crud.handleSave(targeting.targeting, modalData, targeting.resetTargeting);
  };

  const handleQrScan = (decodedText: string) => {
    attendance.handleQrScan(decodedText, crud.studentsList);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans" dir="rtl">
      <EventsPageHeader
        selectedEvent={crud.selectedEvent}
        user={user}
        activeTab={activeTab}
        onBack={() => crud.setSelectedEvent(null)}
        onTabChange={setActiveTab}
        onNewEvent={() => crud.setModalOpen(true)}
        hasCreatePermission={hasPermission(AppPermission.CREATE_EVENT)}
      />

      {crud.selectedEvent ? (
        <EventDashboard
          selectedEvent={crud.selectedEvent}
          activeView={activeView}
          setActiveView={setActiveView}
          selectedSession={attendance.selectedSession}
          setSelectedSession={attendance.setSelectedSession}
          sessions={attendance.sessions}
          handleMarkAttendance={() => attendance.handleMarkAttendance(crud.selectedEvent.id)}
          setShowSessionModal={attendance.setShowSessionModal}
          setShowScanner={attendance.setShowScanner}
          setShowTeamModal={competition.setShowTeamModal}
          setShowCriteriaModal={competition.setShowCriteriaModal}
          detailedAttendance={attendance.detailedAttendance}
          studentsList={crud.studentsList}
          handleUpdateAttendanceStatus={attendance.handleUpdateAttendanceStatus}
          setAbsenceModal={attendance.setAbsenceModal}
          handleQrScan={handleQrScan}
          reportData={attendance.reportData}
          teams={competition.teams}
          criteria={competition.criteria}
          setScoringModal={competition.setScoringModal}
          handleCallCompetition={competition.handleCallCompetition}
          isCompetitionActive={competition.isCompetitionActive}
          showLiveLeaderboard={competition.showLiveLeaderboard}
          setShowLiveLeaderboard={competition.setShowLiveLeaderboard}
          handleSendPaymentReminder={subscriptions.handleSendPaymentReminder}
          paymentsLoading={subscriptions.paymentsLoading}
          eventPayments={subscriptions.eventPayments}
          subscriptions={subscriptions.subscriptions}
          subscriptionsLoading={subscriptions.subscriptionsLoading}
          handleUpdateEvent={(e) => crud.handleUpdateEvent(e, targeting.targeting, targeting.resetTargeting, crud.resetForm)}
          handleToggleParentEnroll={subscriptions.handleToggleParentEnroll}
          handleDeleteEvent={crud.handleDeleteEvent}
          isAdmin={false}
          user={user}
          rooms={[]}
          handleScoreTeam={competition.handleScoreTeam}
          getCurrentLocation={getCurrentLocation}
          hasPermission={hasPermission}
          fetchSubscriptions={subscriptions.fetchSubscriptions}
          fetchEventPayments={subscriptions.fetchEventPayments}
          employeeList={crud.employeeList}
          onManageManagers={() => {
            if (crud.selectedEvent) setManagersItem({ itemType: 'event', itemId: crud.selectedEvent.id, itemTitle: crud.selectedEvent.title });
          }}
          request={request}
          showSnackbar={showSnackbar}
          confirm={confirm}
          setFormData={crud.setFormData}
          setTargeting={targeting.setTargeting}
          setPaymentMethods={setPaymentMethods}
          setIsEditing={crud.setIsEditing}
          setModalOpen={crud.setModalOpen}
          loadTargetData={targeting.loadTargetData}
        />
      ) : (
        <EventSearchSection
          events={crud.events}
          eventSearch={crud.eventSearch}
          onSearchChange={crud.setEventSearch}
          user={user}
          joining={attendance.joining}
          onMarkAttendance={attendance.handleMarkAttendance}
          onSelectEvent={(e) => crud.setSelectedEvent(e)}
          request={request}
          setDetailEvent={subscriptions.setDetailEvent}
          setShowEventDetail={subscriptions.setShowEventDetail}
          setMySubscription={subscriptions.setMySubscription}
          setSelectedPaymentMethod={subscriptions.setSelectedPaymentMethod}
          setReceiptFile={subscriptions.setReceiptFile}
          setReceiptPreview={subscriptions.setReceiptPreview}
          setSubscribePaymentMethods={subscriptions.setSubscribePaymentMethods}
        />
      )}

      <AnimatePresence>
        {attendance.showScanner && (
          <QRScanner
            title={`مسح كود: ${attendance.selectedSession?.title || crud.selectedEvent?.title}`}
            onScan={handleQrScan}
            onClose={() => attendance.setShowScanner(false)}
          />
        )}

        <EventCreateModal
          isOpen={crud.modalOpen}
          onClose={() => { crud.setModalOpen(false); crud.setIsEditing(false); }}
          modalData={{ formData: crud.formData, paymentMethods, studentsList: crud.studentsList, employeeList: crud.employeeList, ...targeting }}
          setModalData={setModalData}
          handleSave={handleSave}
          editMode={crud.isEditing}
          saving={crud.saving}
        />
        <SessionCreateModal
          isOpen={attendance.showSessionModal}
          onClose={() => attendance.setShowSessionModal(false)}
          onSubmit={attendance.handleAddSession}
          formData={attendance.sessionFormData}
          onFormDataChange={attendance.setSessionFormData}
        />

        <TeamCreateModal
          isOpen={competition.showTeamModal}
          onClose={() => competition.setShowTeamModal(false)}
          onSubmit={competition.handleCreateTeam}
          formData={competition.teamFormData}
          onFormDataChange={competition.setTeamFormData}
          studentsList={crud.studentsList}
          studentSearch={competition.studentSearch}
          onStudentSearchChange={competition.setStudentSearch}
        />

        <CriteriaManagerModal
          isOpen={competition.showCriteriaModal}
          onClose={() => competition.setShowCriteriaModal(false)}
          criteria={competition.criteria}
          formData={competition.criterionFormData}
          onFormDataChange={competition.setCriterionFormData}
          onAddCriterion={competition.handleAddCriterion}
          onRemoveCriterion={competition.handleRemoveCriterion}
        />

        <ScoringModal
          isOpen={competition.scoringModal.isOpen}
          team={competition.scoringModal.team}
          scores={competition.scoringModal.scores}
          individualScores={competition.scoringModal.individualScores}
          criteria={competition.criteria}
          onClose={() => competition.setScoringModal({ isOpen: false, team: null, scores: {}, individualScores: {} })}
          onScoreChange={(scores) => competition.setScoringModal(prev => ({ ...prev, scores }))}
          onIndividualScoreChange={(individualScores) => competition.setScoringModal(prev => ({ ...prev, individualScores }))}
          onSaveScores={() => {
            if (!competition.scoringModal.team) return;
            const groupScores = Object.entries(competition.scoringModal.scores).map(([cid, val]) => ({
              criterionId: cid, score: val as number
            }));
            const indScores = Object.values(competition.scoringModal.individualScores).map((item: any) => ({
              criterionId: competition.criteria[0]?.id || 'individual', score: item.score, studentId: item.studentId
            }));
            competition.handleScoreTeam(competition.scoringModal.team.id, [...groupScores, ...indScores]);
          }}
        />

        <AbsenceModal
          isOpen={attendance.absenceModal.isOpen}
          student={attendance.absenceModal.student}
          formData={attendance.absenceFormData}
          onFormDataChange={(data) => attendance.setAbsenceFormData(data)}
          onSubmit={attendance.handleAbsenceUpdate}
          onClose={() => attendance.setAbsenceModal({ isOpen: false, student: null })}
        />
        <EventDetailModal
          isOpen={subscriptions.showEventDetail}
          event={subscriptions.detailEvent}
          onClose={() => { subscriptions.setShowEventDetail(false); subscriptions.setDetailEvent(null); }}
          subscriptionLoading={subscriptions.subscriptionLoading}
          mySubscription={subscriptions.mySubscription}
          subscribePaymentMethods={subscriptions.subscribePaymentMethods}
          selectedPaymentMethod={subscriptions.selectedPaymentMethod}
          onPaymentMethodChange={subscriptions.setSelectedPaymentMethod}
          receiptFile={subscriptions.receiptFile}
          receiptPreview={subscriptions.receiptPreview}
          onReceiptChange={(file, preview) => { subscriptions.setReceiptFile(file); subscriptions.setReceiptPreview(preview); }}
          user={user}
          parentChildren={subscriptions.parentChildren}
          selectedChildId={subscriptions.selectedChildId}
          onChildChange={subscriptions.setSelectedChildId}
          onSubscribe={subscriptions.handleSubscribeEvent}
          onCancelSubscription={subscriptions.handleCancelSubscription}
          onUploadPayment={subscriptions.handleUploadPayment}
          receiptUploading={subscriptions.receiptUploading}
          onRefresh={crud.fetchEvents}
        />

        <ManagersModal
          isOpen={!!managersItem}
          onClose={() => setManagersItem(null)}
          itemType="event"
          itemId={managersItem?.itemId || ''}
          itemTitle={managersItem?.itemTitle}
        />

<AnimatePresence>
          {competition.showLiveLeaderboard && crud.selectedEvent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] overflow-y-auto"
            >
              <LiveLeaderboard
                teams={competition.teams}
                eventTitle={crud.selectedEvent.title}
                winningThreshold={crud.selectedEvent.winning_threshold || 100}
                maxScore={crud.selectedEvent.max_score || 200}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
}
