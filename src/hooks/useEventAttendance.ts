import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

export function useEventAttendance(selectedEvent: any, fetchEvents: () => void) {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const queryClient = useQueryClient();
  const [joining, setJoining] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [absenceFormData, setAbsenceFormData] = useState({
    status: 'absent', reason: '', notifyParent: true, notifyPriest: false,
  });
  const [absenceModal, setAbsenceModal] = useState<{ isOpen: boolean; student: any | null }>({ isOpen: false, student: null });
  const [sessionFormData, setSessionFormData] = useState({
    title: '', description: '', start_time: '',
    type: 'lecture' as 'lecture' | 'workshop' | 'session' | 'session_prayer' | 'game' | 'other',
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ['events', selectedEvent?.id, 'sessions'],
    queryFn: async () => {
      const res = await request(`/api/events/${selectedEvent.id}/sessions`);
      return res.data || [];
    },
    enabled: !!selectedEvent,
    staleTime: 15000,
  });

  const { data: reportData } = useQuery<any>({
    queryKey: ['events', selectedEvent?.id, 'report'],
    queryFn: async () => {
      const res = await request(`/api/events/${selectedEvent.id}/comprehensive-report`);
      return res.data || null;
    },
    enabled: !!selectedEvent,
    staleTime: 15000,
  });

  const detailedAttendance = reportData?.attendance || [];

  const addSessionMutation = useMutation({
    mutationFn: () => request(`/api/events/${selectedEvent.id}/sessions`, {
      method: 'POST', body: JSON.stringify(sessionFormData),
    }),
    onSuccess: () => {
      setShowSessionModal(false);
      setSessionFormData({ title: '', description: '', start_time: '', type: 'lecture' });
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'report'] });
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await request('/api/events/attendance', {
        method: 'POST',
        body: JSON.stringify({ eventId, status: 'present', checkInMethod: 'manual' }),
      });
    },
    onSuccess: () => {
      fetchEvents();
      showSnackbar('تم تسجيل حضورك بنجاح', 'success');
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
    onSettled: () => { setJoining(false); },
  });

  const attendanceDetailMutation = useMutation({
    mutationFn: (params: { studentId: string; status: string; reason?: string; isPaid?: boolean }) =>
      request('/api/events/attendance-detailed', {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEvent.id,
          sessionId: selectedSession?.id || null,
          studentId: params.studentId,
          status: params.status,
          absenceReason: params.reason || undefined,
          isPaid: params.isPaid !== undefined ? params.isPaid : undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'report'] });
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const handleAddSession = (e: React.FormEvent) => {
    e.preventDefault();
    addSessionMutation.mutate();
  };

  const handleMarkAttendance = async (eventId: string) => {
    if (joining) return;
    setJoining(true);
    try { await markAttendanceMutation.mutateAsync(eventId); } catch {}
  };

  const handleQrScan = async (decodedText: string, studentsList: any[]) => {
    let studentId = decodedText;
    if (decodedText.startsWith("DORM-STUDENT-")) studentId = decodedText.replace("DORM-STUDENT-", "");
    const studentExists = studentsList.find(s => s.id === studentId || s.student_id_number === decodedText);
    if (!studentExists) {
      showSnackbar('كود طالب غير معروف', 'error');
      return;
    }
    try {
      await attendanceDetailMutation.mutateAsync({ studentId: studentExists.id, status: 'present' });
    } catch {}
  };

  const handleUpdateAttendanceStatus = async (studentId: string, status: string, reason: string = '', isPaid?: boolean) => {
    try {
      await attendanceDetailMutation.mutateAsync({ studentId, status, reason, isPaid });
    } catch {}
  };

  const handleAbsenceUpdate = async () => {
    if (!absenceModal.student) return;
    try {
      const isAbsent = ['absent', 'unexcused'].includes(absenceFormData.status);
      await request('/api/events/attendance-detailed', {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEvent.id,
          sessionId: selectedSession?.id || null,
          studentId: absenceModal.student.id,
          status: absenceFormData.status,
          absenceReason: absenceFormData.reason,
          notifiedParent: isAbsent ? true : absenceFormData.notifyParent,
          notifiedPriest: absenceFormData.notifyPriest,
        }),
      });
      setAbsenceModal({ isOpen: false, student: null });
      setAbsenceFormData({ status: 'absent', reason: '', notifyParent: true, notifyPriest: false });
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'report'] });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  return {
    joining, showScanner, setShowScanner,
    selectedSession, setSelectedSession,
    sessions, detailedAttendance, reportData,
    showSessionModal, setShowSessionModal,
    sessionFormData, setSessionFormData,
    absenceFormData, setAbsenceFormData,
    absenceModal, setAbsenceModal,
    fetchEventDetails: (eventId: string) => queryClient.invalidateQueries({
      queryKey: ['events', eventId],
    }),
    handleAddSession, handleMarkAttendance,
    handleQrScan, handleUpdateAttendanceStatus,
    handleAbsenceUpdate,
  };
}
