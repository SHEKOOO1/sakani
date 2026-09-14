import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

export function useStudentProfile(user: any, fetchStudents: () => void) {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [activeView, setActiveView] = useState<'list' | 'profile' | 'archive'>('list');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [guardianModalOpen, setGuardianModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editGuardianModalOpen, setEditGuardianModalOpen] = useState(false);
  const [editGuardianData, setEditGuardianData] = useState<any>({});
  const [editGuardianSaving, setEditGuardianSaving] = useState(false);
  const [sendingProfile, setSendingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customFileName, setCustomFileName] = useState('');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendOptions, setSendOptions] = useState<{ bishop: any; priests: any[]; supervisors: any[]; employees: any[] }>({ bishop: null, priests: [], supervisors: [], employees: [] });
  const [sendTargets, setSendTargets] = useState<{ toBishop: boolean; priestIds: string[]; supervisorIds: string[]; employeeIds: string[] }>({ toBishop: false, priestIds: [], supervisorIds: [], employeeIds: [] });
  const [recipientSearchTerm, setRecipientSearchTerm] = useState('');
  const [priestEditModalOpen, setPriestEditModalOpen] = useState(false);
  const [priestEditForm, setPriestEditForm] = useState<any>({});
  const [priestSaving, setPriestSaving] = useState(false);
  const [archiveData, setArchiveData] = useState({ reason: 'graduated' as 'graduated' | 'withdrawn' | 'dismissed' | 'finished', notes: '' });
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [restoreRoomId, setRestoreRoomId] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [tabs, setTabs] = useState<'overview' | 'supervisor'>('overview');
  const [loadingBehavior, setLoadingBehavior] = useState(false);
  const [guardianData, setGuardianData] = useState({ name: '', email: '', password: '', phone: '', whatsapp: '', occupation: '', relationType: 'father' as 'father' | 'mother' | 'other', photo: '' });
  const [supervisorActions, setSupervisorActions] = useState({ newRoomId: '', warningReason: '', notifyParent: false, notifyPriest: false, pointsAmount: 0, pointsReason: '', itemToManage: '', itemType: 'event' as 'event' | 'competition' | 'activity' });
  const [expandedTenants, setExpandedTenants] = useState<Record<string, boolean>>({});
  const [toggleState, setToggleState] = useState<Record<string, {daily?: boolean; radio?: boolean}>>({});

  const { data: selectedStudent } = useQuery({
    queryKey: ['students', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const resp = await request(`/api/students/${selectedStudentId}`);
      return resp.data;
    },
    enabled: !!selectedStudentId && activeView === 'profile',
    staleTime: 60000,
  });

  const setSelectedStudent = (s: any | null) => {
    setSelectedStudentId(s?.id ?? null);
    if (s) setActiveView('profile');
  };

  const fetchStudentProfile = async (id: string) => {
    setSelectedStudentId(id);
    setActiveView('profile');
  };

  const filteredSendOptions = (() => {
    if (!sendOptions) return { bishop: null, priests: [], supervisors: [], employees: [] };
    const term = recipientSearchTerm.toLowerCase();
    return {
      bishop: sendOptions.bishop && sendOptions.bishop.name.toLowerCase().includes(term) ? sendOptions.bishop : null,
      priests: (sendOptions.priests || []).filter(p => p.name.toLowerCase().includes(term)),
      supervisors: (sendOptions.supervisors || []).filter(s => s.name.toLowerCase().includes(term)),
      employees: (sendOptions.employees || []).filter(e => e.name.toLowerCase().includes(term)),
    };
  })();

  const handleArchiveStudent = async () => {
    if (!selectedStudentId) return;
    try {
      await request(`/api/students/${selectedStudentId}/leave`, {
        method: 'POST', body: JSON.stringify(archiveData)
      });
      setArchiveModalOpen(false);
      setActiveView('list');
      setSelectedStudentId(null);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleSaveEdit = async () => {
    if (!selectedStudentId) return;
    try {
      const editFields = [
        'name', 'email', 'college', 'major', 'university', 'governorate', 'village',
        'church_name', 'confession_father_name', 'confession_father_phone', 'confession_father_whatsapp',
        'confession_father_service', 'birth_date', 'address', 'id_card_number', 'room_id',
        'is_servant', 'servant_services', 'is_deacon', 'deacon_rank', 'deacon_details',
        'deacon_ordination_date', 'service_training_certificate',
        'whatsapp_number', 'phoneNumbers',
        ...(editForm.password ? ['password'] : []),
        ...(isAdmin ? ['daily_readings_enabled', 'radio_514_enabled'] : [])
      ];
      const body: any = {};
      for (const f of editFields) {
        if (editForm[f] !== undefined) body[f] = editForm[f];
      }
      await request(`/api/students/${selectedStudentId}`, { method: 'PUT', body: JSON.stringify(body) });
      setEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['students', selectedStudentId] });
      queryClient.invalidateQueries({ queryKey: ['students', 'search'] });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const openSendModal = async () => {
    if (!selectedStudentId) return;
    try {
      const resp = await request(`/api/students/${selectedStudentId}/send-profile-options`);
      const bishopOption = resp?.data?.bishop && resp.data.bishop.id !== user?.id ? resp.data.bishop : null;
      const priestOptions = (resp?.data?.priests || []).filter((p: any) => p.id !== user?.id);
      const supervisorOptions = (resp?.data?.supervisors || []).filter((s: any) => s.id !== user?.id);
      const employeeOptions = (resp?.data?.employees || []).filter((e: any) => e.id !== user?.id);
      setSendOptions({ bishop: bishopOption, priests: priestOptions, supervisors: supervisorOptions, employees: employeeOptions });
      setSendTargets({ toBishop: !!bishopOption, priestIds: priestOptions.map((p: any) => p.id) || [], supervisorIds: supervisorOptions.map((s: any) => s.id) || [], employeeIds: employeeOptions.map((e: any) => e.id) || [] });
      setRecipientSearchTerm('');
      setSendModalOpen(true);
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleSendProfile = async () => {
    if (!selectedStudentId) return;
    setSendingProfile(true);
    try {
      await request(`/api/students/${selectedStudentId}/send-profile`, { method: 'POST', body: JSON.stringify(sendTargets) });
      setSendModalOpen(false);
      showSnackbar('تم إرسال الملف بنجاح', 'success');
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setSendingProfile(false); }
  };

  const handlePriestEditSave = async () => {
    if (!selectedStudentId) return;
    setPriestSaving(true);
    try {
      const f = priestEditForm;
      const body: any = {
        name: f.name, email: f.email, governorate: f.governorate, village: f.village,
        churchName: f.church_name || f.churchName,
        confessionFatherName: f.confession_father_name || f.confessionFatherName,
        confession_father_phone: f.confession_father_phone,
        confession_father_whatsapp: f.confession_father_whatsapp,
        confession_father_service: f.confession_father_service,
        isServant: f.is_servant ? 1 : 0, servantServices: f.servant_services || f.servantServices,
        isDeacon: f.is_deacon ? 1 : 0, deaconRank: f.deacon_rank || f.deaconRank,
        deacon_details: f.deacon_details, deacon_ordination_date: f.deacon_ordination_date,
        serviceTrainingCertificate: f.service_training_certificate || f.serviceTrainingCertificate,
        address: f.address,
      };
      await request(`/api/students/${selectedStudentId}/priest-edit`, { method: 'PUT', body: JSON.stringify(body) });
      setPriestEditModalOpen(false);
      showSnackbar('تم تعديل بيانات الطالب وإخطار المشرفين', 'success');
      queryClient.invalidateQueries({ queryKey: ['students', selectedStudentId] });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setPriestSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    if (!selectedStudentId || !e.target.files?.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('files', file);
    formData.append('doc_types', docType);
    formData.append('file_labels', docType === 'other' ? (customFileName || file.name) : file.name);
    setUploading(true);
    try {
      await request(`/api/students/${selectedStudentId}/files`, { method: 'POST', body: formData, headers: {} });
      setCustomFileName('');
      e.target.value = '';
      queryClient.invalidateQueries({ queryKey: ['students', selectedStudentId] });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setUploading(false); }
  };

  // رفع عدة ملفات مرة واحدة مع اسم مخصص لكل ملف
  const handleUploadFiles = async (items: { file: File; name: string }[]) => {
    if (!selectedStudentId || !items.length) return;
    const formData = new FormData();
    items.forEach(item => formData.append('files', item.file));
    items.forEach(() => formData.append('doc_types', 'other'));
    items.forEach(item => formData.append('file_labels', item.name.trim() || item.file.name));
    setUploading(true);
    try {
      await request(`/api/students/${selectedStudentId}/files`, { method: 'POST', body: formData, headers: {} });
      setCustomFileName('');
      queryClient.invalidateQueries({ queryKey: ['students', selectedStudentId] });
      showSnackbar(`تم رفع ${items.length} ملف بنجاح`, 'success');
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setUploading(false); }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!selectedStudentId) return;
    try {
      await request(`/api/students/${selectedStudentId}/files/${fileId}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['students', selectedStudentId] });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleDownloadProfile = async () => {
    if (!selectedStudentId) return;
    try {
      const resp = await request(`/api/students/${selectedStudentId}/export-profile`);
      const blob = new Blob([JSON.stringify(resp, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `profile-${selectedStudent?.name || 'student'}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleAddGuardian = async () => {
    if (!selectedStudentId) return;
    try {
      await request(`/api/students/${selectedStudentId}/guardians`, { method: 'POST', body: JSON.stringify(guardianData) });
      setGuardianModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['students', selectedStudentId] });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleEditGuardian = async () => {
    if (!selectedStudentId || !editGuardianData.id) return;
    setEditGuardianSaving(true);
    try {
      const body: any = {};
      if (editGuardianData.name) body.name = editGuardianData.name;
      if (editGuardianData.email) body.email = editGuardianData.email;
      if (editGuardianData.phone) body.phone = editGuardianData.phone;
      if (editGuardianData.whatsapp) body.whatsapp = editGuardianData.whatsapp;
      if (editGuardianData.occupation) body.occupation = editGuardianData.occupation;
      if (editGuardianData.relationType) body.relationType = editGuardianData.relationType;
      if (editGuardianData.password) body.password = editGuardianData.password;
      await request(`/api/students/${selectedStudentId}/guardians/${editGuardianData.id}`, { method: 'PUT', body: JSON.stringify(body) });
      setEditGuardianModalOpen(false);
      setEditGuardianData({});
      showSnackbar('تم تحديث بيانات ولي الأمر بنجاح', 'success');
      queryClient.invalidateQueries({ queryKey: ['students', selectedStudentId] });
    } catch (err: any) { showSnackbar(err.message, 'error'); }
    finally { setEditGuardianSaving(false); }
  };

  const handleDeleteClick = (student: any) => {
    setSelectedStudentId(student.id);
    setSelectedStudent(student);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedStudentId) return;
    try {
      await request(`/api/students/${selectedStudentId}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['students', 'search'] });
      setModalOpen(false);
      setSelectedStudentId(null);
    } catch (err) { showSnackbar('حدث خطأ أثناء الحذف', 'error'); }
  };

  const handleToggleTenantDaily = async (tenantName: string, tenantId: string, current: boolean) => {
    const newVal = !current;
    if (!await confirm({ title: 'تأكيد', message: (newVal ? 'تفعيل' : 'إلغاء') + ' القراءة اليومية للسكن ' + tenantName + '؟', confirmText: newVal ? 'نعم، تفعيل' : 'نعم، إلغاء التفعيل', cancelText: 'إلغاء', type: newVal ? 'info' : 'warning' })) return;
    try {
      const res = await request('/api/tenants/' + tenantId + '/toggle-services', { method: 'PATCH', body: JSON.stringify({ daily_readings_enabled: newVal }) });
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['students', 'search'] });
        showSnackbar((newVal ? 'تم تفعيل' : 'تم إلغاء تفعيل') + ' القراءة اليومية للسكن ' + tenantName, 'success');
      }
    } catch (err) { showSnackbar('حدث خطأ', 'error'); }
  };

  const handleToggleTenantRadio = async (tenantName: string, tenantId: string, current: boolean) => {
    const newVal = !current;
    if (!await confirm({ title: 'تأكيد', message: (newVal ? 'تفعيل' : 'إلغاء') + ' راديو 5:14 للسكن ' + tenantName + '؟', confirmText: newVal ? 'نعم، تفعيل' : 'نعم، إلغاء التفعيل', cancelText: 'إلغاء', type: newVal ? 'info' : 'warning' })) return;
    try {
      const res = await request('/api/tenants/' + tenantId + '/toggle-services', { method: 'PATCH', body: JSON.stringify({ radio_514_enabled: newVal }) });
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['students', 'search'] });
        showSnackbar((newVal ? 'تم تفعيل' : 'تم إلغاء تفعيل') + ' راديو 5:14 للسكن ' + tenantName, 'success');
      }
    } catch (err) { showSnackbar('حدث خطأ', 'error'); }
  };

  const handleToggleStudentDaily = async (studentId: string, studentName: string, current: boolean) => {
    const newVal = !current;
    if (!await confirm({ title: 'تأكيد', message: (newVal ? 'تفعيل' : 'إلغاء') + ' القراءة اليومية للطالب ' + studentName + '؟', confirmText: newVal ? 'نعم، تفعيل' : 'نعم، إلغاء التفعيل', cancelText: 'إلغاء', type: newVal ? 'info' : 'warning' })) return;
    setToggleState(prev => ({...prev, [studentId]: {...prev[studentId], daily: newVal}}));
    try {
      const res = await request('/api/students/' + studentId + '/toggle-services', { method: 'PATCH', body: JSON.stringify({ daily_readings_enabled: newVal }) });
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['students', 'search'] });
        setToggleState(prev => { const n = {...prev}; delete n[studentId]; return n; });
        showSnackbar((newVal ? 'تم تفعيل' : 'تم إلغاء تفعيل') + ' القراءة اليومية للطالب ' + studentName, 'success');
      }
    } catch { showSnackbar('حدث خطأ', 'error'); }
  };

  const handleToggleStudentRadio = async (studentId: string, studentName: string, current: boolean) => {
    const newVal = !current;
    if (!await confirm({ title: 'تأكيد', message: (newVal ? 'تفعيل' : 'إلغاء') + ' راديو 5:14 للطالب ' + studentName + '؟', confirmText: newVal ? 'نعم، تفعيل' : 'نعم، إلغاء التفعيل', cancelText: 'إلغاء', type: newVal ? 'info' : 'warning' })) return;
    setToggleState(prev => ({...prev, [studentId]: {...prev[studentId], radio: newVal}}));
    try {
      const res = await request('/api/students/' + studentId + '/toggle-services', { method: 'PATCH', body: JSON.stringify({ radio_514_enabled: newVal }) });
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['students', 'search'] });
        setToggleState(prev => { const n = {...prev}; delete n[studentId]; return n; });
        showSnackbar((newVal ? 'تم تفعيل' : 'تم إلغاء تفعيل') + ' راديو 5:14 للطالب ' + studentName, 'success');
      }
    } catch { showSnackbar('حدث خطأ', 'error'); }
  };

  const handleToggleStudentGraduate = async (studentId: string, studentName: string, current: boolean) => {
    const newVal = !current;
    if (!await confirm({ title: 'تأكيد', message: (newVal ? 'تسجيل الطالب ' + studentName + ' كخريج في السكن؟' : 'إلغاء تسجيل الطالب ' + studentName + ' من قائمة الخريجين؟'), confirmText: newVal ? 'نعم، تسجيل' : 'نعم، إلغاء', cancelText: 'إلغاء', type: newVal ? 'info' : 'warning' })) return;
    try {
      const res = await request('/api/students/' + studentId + '/graduate', { method: 'PATCH', body: JSON.stringify({ is_graduate: newVal }) });
      queryClient.invalidateQueries({ queryKey: ['students', 'search'] });
      showSnackbar(res.message || (newVal ? 'تم تسجيل الطالب كخريج' : 'تم إلغاء تسجيل الطالب من الخريجين'), 'success');
    } catch (err: any) { showSnackbar(err.message || 'حدث خطأ', 'error'); }
  };

  const openRestoreModal = (archiveItem: any) => {
    setRestoreTarget(archiveItem);
    setRestoreRoomId('');
    setRestoreModalOpen(true);
  };

  const handleRestoreStudent = async () => {
    if (!restoreTarget) return;
    if (!restoreRoomId) { showSnackbar('يرجى اختيار غرفة لاستعادة الطالب', 'warning'); return; }
    try {
      setRestoreLoading(true);
      await request(`/api/students/${restoreTarget.student_id}/restore`, { method: 'POST', body: JSON.stringify({ roomId: restoreRoomId }) });
      setRestoreModalOpen(false);
      setRestoreTarget(null);
      setRestoreRoomId('');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (err: any) { showSnackbar(err.message || 'فشل استعادة الطالب', 'error'); }
    finally { setRestoreLoading(false); }
  };

  return {
    selectedStudent, setSelectedStudent, activeView, setActiveView,
    modalOpen, setModalOpen, addModalOpen, setAddModalOpen,
    guardianModalOpen, setGuardianModalOpen,
    archiveModalOpen, setArchiveModalOpen,
    editModalOpen, setEditModalOpen, editForm, setEditForm,
    editGuardianModalOpen, setEditGuardianModalOpen,
    editGuardianData, setEditGuardianData, editGuardianSaving,
    sendingProfile, uploading, setUploading, customFileName, setCustomFileName,
    sendModalOpen, setSendModalOpen, sendOptions, sendTargets, setSendTargets,
    recipientSearchTerm, setRecipientSearchTerm, filteredSendOptions,
    priestEditModalOpen, setPriestEditModalOpen,
    priestEditForm, setPriestEditForm, priestSaving,
    archiveData, setArchiveData,
    restoreModalOpen, setRestoreModalOpen, restoreTarget,
    restoreRoomId, setRestoreRoomId, restoreLoading,
    tabs, setTabs, loadingBehavior, setLoadingBehavior,
    guardianData, setGuardianData,
    supervisorActions, setSupervisorActions,
    expandedTenants, setExpandedTenants, toggleState,
    fetchStudentProfile,
    handleArchiveStudent, handleSaveEdit, openSendModal, handleSendProfile,
    handlePriestEditSave, handleFileUpload, handleUploadFiles, handleDeleteFile, handleDownloadProfile,
    handleAddGuardian, handleEditGuardian, handleDeleteClick, confirmDelete,
    handleToggleTenantDaily, handleToggleTenantRadio,
    handleToggleStudentDaily, handleToggleStudentRadio,
    handleToggleStudentGraduate,
    openRestoreModal, handleRestoreStudent,
  };
}
