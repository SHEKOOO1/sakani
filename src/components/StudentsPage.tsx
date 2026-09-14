import { useState, FormEvent } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { ConfirmationModal } from './ConfirmationModal';
import { StudentProfileView } from './student/StudentProfileView';
import { AddStudentModal } from './student/modals/AddStudentModal';
import { StudentHero } from './student/StudentHero';
import { StudentArchivePage } from './student/StudentArchivePage';
import { StudentListView } from './student/StudentListView';
import { useStudentSearch } from '../hooks/useStudentSearch';
import { useStudentProfile } from '../hooks/useStudentProfile';

const defaultFormData = {
  name: '', email: '', password: '', studentIdNumber: '',
  birthDate: '', college: '', major: '', university: '',
  enrollmentYear: new Date().getFullYear(), studentPhoto: '', address: '',
  roomId: '', idCardNumber: '', billingCycle: 'monthly' as 'daily' | 'monthly' | 'semester',
  agreedPrice: 0, governorate: '', village: '', churchName: '',
  confessionFatherName: '',
  phoneNumbers: [] as Array<{ id: string; phoneType: 'mobile' | 'whatsapp' | 'work' | 'other'; label: string; phoneNumber: string; }>,
  docTypes: {} as Record<string, File | null>,
  isServant: false, isDeacon: false, servantServices: [] as string[],
  deaconRank: '', serviceTrainingCertificate: null as File | null,
};

export function StudentsPage() {
  const { request } = useApi();
  const { hasPermission, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isBishop = user?.role === 'bishop';
  const { showSnackbar, confirm } = useSnackbar();
  const canAddStudent = hasPermission(AppPermission.ADD_STUDENT);
  const canDeleteStudent = hasPermission(AppPermission.DELETE_STUDENT);
  const canEditStudent = hasPermission(AppPermission.EDIT_STUDENT);
  const canManageHousing = hasPermission(AppPermission.MANAGE_HOUSING);
  const canManagePoints = hasPermission(AppPermission.MANAGE_POINTS);
  const canManagePenalties = hasPermission(AppPermission.MANAGE_PENALTIES);

  const {
    students, setStudents, rooms, loading, searchTerm, setSearchTerm,
    filterCriteria, setFilterCriteria, showFilters, setShowFilters,
    page, setPage, totalPages, total,
    fetchStudents,
  } = useStudentSearch(hasPermission(AppPermission.VIEW_ROOMS));

  const {
    selectedStudent, setSelectedStudent, activeView, setActiveView,
    modalOpen, setModalOpen, addModalOpen, setAddModalOpen,
    guardianModalOpen, setGuardianModalOpen,
    archiveModalOpen, setArchiveModalOpen,
    editModalOpen, setEditModalOpen, editForm, setEditForm,
    editGuardianModalOpen, setEditGuardianModalOpen,
    editGuardianData, setEditGuardianData, editGuardianSaving,
    sendingProfile, uploading, setUploading,
    sendModalOpen, setSendModalOpen, sendTargets, setSendTargets,
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
  } = useStudentProfile(user, fetchStudents);

  const [formData, setFormData] = useState(defaultFormData);
  const [archive, setArchive] = useState([]);

  const fetchArchive = async () => {
    try {
      const resp = await request('/api/students/archive');
      setArchive(resp.data);
    } catch (err) { console.error(err); }
  };

  const handleAddStudent = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const fData = new FormData();
      fData.append('name', formData.name);
      fData.append('email', formData.email);
      fData.append('password', formData.password);
      fData.append('studentIdNumber', formData.studentIdNumber);
      fData.append('university', formData.university);
      fData.append('college', formData.college);
      fData.append('major', formData.major);
      fData.append('enrollmentYear', formData.enrollmentYear.toString());
      fData.append('birthDate', formData.birthDate);
      fData.append('idCardNumber', formData.idCardNumber);
      fData.append('address', formData.address);
      fData.append('studentPhoto', formData.studentPhoto);
      fData.append('roomId', formData.roomId || '');
      fData.append('billingCycle', formData.billingCycle);
      fData.append('agreedPrice', formData.agreedPrice.toString());
      fData.append('governorate', formData.governorate);
      fData.append('village', formData.village);
      fData.append('churchName', formData.churchName);
      fData.append('confessionFatherName', formData.confessionFatherName);
      fData.append('is_servant', formData.isServant.toString());
      fData.append('is_deacon', formData.isDeacon.toString());
      fData.append('servant_services', JSON.stringify(formData.servantServices));
      fData.append('deacon_rank', formData.deaconRank);
      fData.append('phoneNumbers', JSON.stringify(formData.phoneNumbers));
      Object.entries(formData.docTypes).forEach(([type, file]) => {
        if (file) { fData.append('docs', file); fData.append('doc_types', type); }
      });
      await request('/api/students-v2/register-full', { method: 'POST', body: fData });
      setAddModalOpen(false);
      setFormData(defaultFormData);
      fetchStudents();
    } catch (err: any) { showSnackbar(err.message || 'فشل إضافة الطالب', 'error'); }
  };

  const filteredStudents = students.filter((s: any) =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.student_id_number?.includes(searchTerm)
  );

  if (activeView === 'archive') {
    return (
      <StudentArchivePage
        archive={archive}
        onBack={() => setActiveView('list')}
        canAddStudent={canAddStudent}
        isBishop={user?.role === 'bishop'}
        restoreModalOpen={restoreModalOpen}
        onRestoreModalClose={() => setRestoreModalOpen(false)}
        onRestore={handleRestoreStudent}
        restoreLoading={restoreLoading}
        restoreTargetName={restoreTarget?.student_name || ''}
        restoreRoomId={restoreRoomId}
        onRoomIdChange={setRestoreRoomId}
        rooms={rooms}
        onOpenRestore={openRestoreModal}
      />
    );
  }

  if (activeView === 'profile' && selectedStudent) {
    return (
      <StudentProfileView
        selectedStudent={selectedStudent}
        onBack={() => setActiveView('list')}
        canEditStudent={canEditStudent}
        isAdmin={isAdmin}
        canManageHousing={canManageHousing}
        canManagePoints={canManagePoints}
        canManagePenalties={canManagePenalties}
        user={user}
        tabs={tabs} setTabs={setTabs}
        loadingBehavior={loadingBehavior}
        editModalOpen={editModalOpen} setEditModalOpen={setEditModalOpen}
        editForm={editForm} setEditForm={setEditForm}
        handleSaveEdit={handleSaveEdit}
        guardianModalOpen={guardianModalOpen} setGuardianModalOpen={setGuardianModalOpen}
        guardianData={guardianData} setGuardianData={setGuardianData}
        handleAddGuardian={handleAddGuardian}
        editGuardianModalOpen={editGuardianModalOpen} setEditGuardianModalOpen={setEditGuardianModalOpen}
        editGuardianData={editGuardianData} setEditGuardianData={setEditGuardianData}
        handleEditGuardian={handleEditGuardian} editGuardianSaving={editGuardianSaving}
        archiveModalOpen={archiveModalOpen} setArchiveModalOpen={setArchiveModalOpen}
        archiveData={archiveData} setArchiveData={setArchiveData}
        handleArchiveStudent={handleArchiveStudent}
        sendModalOpen={sendModalOpen} setSendModalOpen={setSendModalOpen}
        sendTargets={sendTargets} setSendTargets={setSendTargets}
        recipientSearchTerm={recipientSearchTerm} setRecipientSearchTerm={setRecipientSearchTerm}
        filteredSendOptions={filteredSendOptions}
        sendingProfile={sendingProfile} handleSendProfile={handleSendProfile}
        restoreModalOpen={restoreModalOpen} setRestoreModalOpen={setRestoreModalOpen}
        restoreRoomId={restoreRoomId} setRestoreRoomId={setRestoreRoomId}
        restoreLoading={restoreLoading}
        handleRestoreStudent={handleRestoreStudent}
        priestEditModalOpen={priestEditModalOpen} setPriestEditModalOpen={setPriestEditModalOpen}
        priestEditForm={priestEditForm} setPriestEditForm={setPriestEditForm}
        priestSaving={priestSaving} handlePriestEditSave={handlePriestEditSave}
        handleDownloadProfile={handleDownloadProfile} openSendModal={openSendModal}
        handleFileUpload={handleFileUpload} handleUploadFiles={handleUploadFiles} handleDeleteFile={handleDeleteFile}
        uploading={uploading} rooms={rooms}
        restoreTarget={restoreTarget}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      <StudentHero
        canAddStudent={canAddStudent}
        isBishop={isBishop}
        onAddStudent={() => setAddModalOpen(true)}
        onViewArchive={() => { fetchArchive(); setActiveView('archive'); }}
      />

      <StudentListView
        loading={loading}
        isAdmin={isAdmin} isBishop={isBishop}
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        showFilters={showFilters} onToggleFilters={() => setShowFilters(!showFilters)}
        filterCriteria={filterCriteria} onFilterChange={setFilterCriteria}
        filteredStudents={filteredStudents}
        expandedTenants={expandedTenants}
        onToggleTenant={(name) => setExpandedTenants(prev => ({...prev, [name]: !(prev[name] !== false)}))}
        isAdminOrBishop={isAdmin || isBishop}
        canDeleteStudent={canDeleteStudent}
        canEditStudent={canEditStudent}
        userRole={user?.role}
        toggleState={toggleState}
        onToggleDaily={handleToggleStudentDaily}
        onToggleRadio={handleToggleStudentRadio}
        onToggleGraduate={handleToggleStudentGraduate}
        onToggleTenantDaily={handleToggleTenantDaily}
        onToggleTenantRadio={handleToggleTenantRadio}
        onViewProfile={fetchStudentProfile}
        onDeleteClick={handleDeleteClick}
        page={page} totalPages={totalPages} total={total}
        onPageChange={setPage}
        confirm={confirm} showSnackbar={showSnackbar}
        request={request} setStudents={setStudents}
      />

      <AddStudentModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleAddStudent}
        formData={formData}
        setFormData={setFormData as any}
        rooms={rooms}
      />

      <ConfirmationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="حذف سجل الطالب"
        message={`هل أنت متأكد من رغبتك في حذف الطالب "${selectedStudent?.name}"؟ سيؤدي هذا إلى إزالة كافة بياناته وسجله من النظام وتحرير مكانه في الغرفة.`}
      />
    </div>
  );
}
