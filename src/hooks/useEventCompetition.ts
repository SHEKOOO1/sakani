import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

export function useEventCompetition(selectedEvent: any) {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [teamFormData, setTeamFormData] = useState({ name: '', memberIds: [] as string[] });
  const [criterionFormData, setCriterionFormData] = useState({ title: '', max_score: 10 });
  const [scoringModal, setScoringModal] = useState<{
    isOpen: boolean;
    team: any | null;
    scores: Record<string, number>;
    individualScores: Record<string, { studentId: string; score: number }>;
  }>({ isOpen: false, team: null, scores: {}, individualScores: {} });
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [showLiveLeaderboard, setShowLiveLeaderboard] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ['events', selectedEvent?.id, 'teams'],
    queryFn: async () => {
      const res = await request(`/api/events/${selectedEvent.id}/teams`);
      return res.data || [];
    },
    enabled: !!selectedEvent,
    staleTime: 10000,
  });

  const { data: criteria = [] } = useQuery<any[]>({
    queryKey: ['events', selectedEvent?.id, 'criteria'],
    queryFn: async () => {
      const res = await request(`/api/events/${selectedEvent.id}/criteria`);
      return res.data || [];
    },
    enabled: !!selectedEvent,
    staleTime: 10000,
  });

  const teamMutation = useMutation({
    mutationFn: (data: typeof teamFormData) =>
      request(`/api/events/${selectedEvent.id}/teams`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setShowTeamModal(false);
      setTeamFormData({ name: '', memberIds: [] });
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'teams'] });
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const criterionMutation = useMutation({
    mutationFn: (data: typeof criterionFormData) =>
      request(`/api/events/${selectedEvent.id}/criteria`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setCriterionFormData({ title: '', max_score: 10 });
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'criteria'] });
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const removeCriterionMutation = useMutation({
    mutationFn: (criterionId: string) =>
      request(`/api/events/${selectedEvent.id}/criteria/${criterionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'criteria'] });
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const scoreMutation = useMutation({
    mutationFn: (params: { teamId: string; scores: { criterionId: string; score: number; studentId?: string }[] }) =>
      request(`/api/events/${selectedEvent.id}/teams/${params.teamId}/scores`, {
        method: 'POST', body: JSON.stringify({ scores: params.scores }),
      }),
    onSuccess: () => {
      setScoringModal({ isOpen: false, team: null, scores: {}, individualScores: {} });
      queryClient.invalidateQueries({ queryKey: ['events', selectedEvent?.id, 'teams'] });
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const { data: isCompetitionActive = false } = useQuery<boolean>({
    queryKey: ['events', selectedEvent?.id, 'competition-active'],
    queryFn: async () => {
      const res = await request(`/api/events/${selectedEvent.id}/status`);
      return res.data?.is_competition_active ?? false;
    },
    enabled: !!selectedEvent,
    staleTime: 15000,
  });

  const activateMutation = useMutation({
    mutationFn: () =>
      request(`/api/events/${selectedEvent.id}/activate-competition`, { method: 'POST' }),
    onSuccess: () => {
      showSnackbar('تم استدعاء المسابقة بنجاح! المسابقة الآن مرئية للطلاب وباب الانضمام مفتوح.', 'success');
    },
    onError: (err: any) => { showSnackbar(err.message, 'error'); },
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamFormData.name) return;
    teamMutation.mutate(teamFormData);
  };

  const handleAddCriterion = () => {
    if (!criterionFormData.title) return;
    criterionMutation.mutate(criterionFormData);
  };

  const handleRemoveCriterion = (index: number) => {
    const criterionToRemove = criteria[index];
    if (!criterionToRemove?.id) return;
    removeCriterionMutation.mutate(criterionToRemove.id);
  };

  const handleScoreTeam = async (teamId: string, scores: { criterionId: string; score: number; studentId?: string }[]) => {
    try { await scoreMutation.mutateAsync({ teamId, scores }); } catch {}
  };

  const handleCallCompetition = () => {
    activateMutation.mutate();
  };

  return {
    teams, criteria, isCompetitionActive,
    teamFormData, setTeamFormData,
    criterionFormData, setCriterionFormData,
    scoringModal, setScoringModal,
    showTeamModal, setShowTeamModal,
    showCriteriaModal, setShowCriteriaModal,
    showLiveLeaderboard, setShowLiveLeaderboard,
    studentSearch, setStudentSearch,
    fetchCompetitionData: () => queryClient.invalidateQueries({
      queryKey: ['events', selectedEvent?.id],
    }),
    handleCreateTeam, handleAddCriterion, handleRemoveCriterion,
    handleScoreTeam, handleCallCompetition,
  };
}
