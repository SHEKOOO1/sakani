import React, { useState } from 'react';
import {
  ArrowRight, PenSquare, FileText, Send, Archive,
  Search, UserCircle, Camera, Phone, MessageSquareShare,
  Plane, Map, Cross, UserCheck, Heart, Clock, AlertCircle,
  Plus, Mail, ShieldAlert, QrCode, Trash2, FileText as FileTextIcon,
  TrendingUp, DoorOpen, Building, Home, UserX, Users, Sparkles,
  GraduationCap, UserCog, Loader2
} from 'lucide-react';
import { QRCode } from 'react-qr-code';
import { StudentNotesSection } from '../StudentNotesSection';
import { StudentFinanceCard } from './StudentFinanceCard';
import { FileViewerModal, type ViewableFile, normalizeFilePath, isImageFile } from './FileViewerModal';
import { RestoreStudentModal } from './modals/RestoreStudentModal';
import { GuardianModal } from './modals/GuardianModal';
import { GuardianEditModal } from './modals/GuardianEditModal';
import { ArchiveModal } from './modals/ArchiveModal';
import { EditStudentModal } from './modals/EditStudentModal';
import { SendProfileModal } from './modals/SendProfileModal';
import { PriestEditModal } from './modals/PriestEditModal';

interface Guardian {
  id: string;
  name: string;
  relation_type: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  photo?: string;
  occupation?: string;
  user_id?: string;
}

interface Delay {
  id: string;
  actual_entry_time: string;
  curfew_time: string;
}

interface PhoneEntry {
  phoneType: string;
  label: string;
  phoneNumber: string;
}

interface BehaviorSummary {
  totalPoints: number;
  activeWarnings: number;
}

interface StudentFile {
  id: string;
  file_name: string;
  doc_type: string;
}

interface Document {
  id: string;
  file_path: string;
  doc_type: string;
  file_name: string;
}

interface SelectedStudent {
  id: string;
  name: string;
  email: string;
  student_id_number?: string;
  id_card_number?: string;
  room_number?: string;
  apartment_name?: string;
  room_id?: string;
  college?: string;
  university?: string;
  major?: string;
  phones?: PhoneEntry[];
  enrollment_year?: string;
  is_traveling?: number;
  travel_destination?: string;
  travel_start_time?: string;
  student_photo?: string;
  photo_url?: string;
  governorate?: string;
  village?: string;
  church_name?: string;
  confession_father_name?: string;
  confession_father_phone?: string;
  confession_father_whatsapp?: string;
  confession_father_service?: string;
  is_servant?: number;
  servant_services?: string;
  is_deacon?: number;
  deacon_rank?: string;
  deacon_details?: string;
  birth_date?: string;
  address?: string;
  guardians?: Guardian[];
  delays?: Delay[];
  behaviorSummary?: BehaviorSummary;
  files?: StudentFile[];
  documents?: Document[];
}

interface GuardianData {
  email: string;
  relationType: 'father' | 'mother' | 'other';
  phone: string;
  whatsapp: string;
  occupation: string;
}

interface ArchiveData {
  reason: string;
  notes: string;
}

interface SendTargets {
  toBishop: boolean;
  priestIds: string[];
  supervisorIds: string[];
  employeeIds: string[];
}

interface FilteredSendOptions {
  bishop: { id: string; name: string } | null;
  priests: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
  employees: { id: string; name: string }[];
}

interface EditForm {
  [key: string]: any;
}

interface PriestEditForm {
  [key: string]: any;
}

interface RestoreTarget {
  student_name?: string;
}

interface StudentProfileViewProps {
  selectedStudent: SelectedStudent;
  onBack: () => void;
  canEditStudent: boolean;
  isAdmin: boolean;
  canManageHousing: boolean;
  canManagePoints: boolean;
  canManagePenalties: boolean;
  user: any;

  tabs: string;
  setTabs: (tabs: any) => void;
  loadingBehavior: boolean;

  editModalOpen: boolean;
  setEditModalOpen: (open: boolean) => void;
  editForm: EditForm;
  setEditForm: (form: any) => void;
  handleSaveEdit: () => void;

  guardianModalOpen: boolean;
  setGuardianModalOpen: (open: boolean) => void;
  guardianData: GuardianData;
  setGuardianData: (data: any) => void;
  handleAddGuardian: () => void;

  editGuardianModalOpen: boolean;
  setEditGuardianModalOpen: (open: boolean) => void;
  editGuardianData: any;
  setEditGuardianData: (data: any) => void;
  handleEditGuardian: () => void;
  editGuardianSaving: boolean;

  archiveModalOpen: boolean;
  setArchiveModalOpen: (open: boolean) => void;
  archiveData: ArchiveData;
  setArchiveData: (data: any) => void;
  handleArchiveStudent: () => void;

  sendModalOpen: boolean;
  setSendModalOpen: (open: boolean) => void;
  sendTargets: SendTargets;
  setSendTargets: (targets: any) => void;
  recipientSearchTerm: string;
  setRecipientSearchTerm: (term: string) => void;
  filteredSendOptions: FilteredSendOptions;
  sendingProfile: boolean;
  handleSendProfile: () => void;

  restoreModalOpen: boolean;
  setRestoreModalOpen: (open: boolean) => void;
  restoreRoomId: string;
  setRestoreRoomId: (id: string) => void;
  restoreLoading: boolean;
  restoreTarget: RestoreTarget | null;
  handleRestoreStudent: () => void;

  priestEditModalOpen: boolean;
  setPriestEditModalOpen: (open: boolean) => void;
  priestEditForm: PriestEditForm;
  setPriestEditForm: (form: any) => void;
  priestSaving: boolean;
  handlePriestEditSave: () => void;

  handleDownloadProfile: () => void;
  openSendModal: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, docType: string) => void;
  handleUploadFiles: (items: { file: File; name: string }[]) => Promise<void>;
  handleDeleteFile: (fileId: string) => void;
  uploading: boolean;
  rooms: any[];
}

export function StudentProfileView({
  selectedStudent,
  onBack,
  canEditStudent,
  isAdmin,
  canManageHousing,
  canManagePoints,
  canManagePenalties,
  user,
  tabs,
  setTabs,
  loadingBehavior,
  editModalOpen,
  setEditModalOpen,
  editForm,
  setEditForm,
  handleSaveEdit,
  guardianModalOpen,
  setGuardianModalOpen,
  guardianData,
  setGuardianData,
  handleAddGuardian,
  editGuardianModalOpen,
  setEditGuardianModalOpen,
  editGuardianData,
  setEditGuardianData,
  handleEditGuardian,
  editGuardianSaving,
  archiveModalOpen,
  setArchiveModalOpen,
  archiveData,
  setArchiveData,
  handleArchiveStudent,
  sendModalOpen,
  setSendModalOpen,
  sendTargets,
  setSendTargets,
  recipientSearchTerm,
  setRecipientSearchTerm,
  filteredSendOptions,
  sendingProfile,
  handleSendProfile,
  restoreModalOpen,
  setRestoreModalOpen,
  restoreRoomId,
  setRestoreRoomId,
  restoreLoading,
  restoreTarget,
  handleRestoreStudent,
  priestEditModalOpen,
  setPriestEditModalOpen,
  priestEditForm,
  setPriestEditForm,
  priestSaving,
  handlePriestEditSave,
  handleDownloadProfile,
  openSendModal,
  handleFileUpload,
  handleUploadFiles,
  handleDeleteFile,
  uploading,
  rooms,
}: StudentProfileViewProps) {
  const [pendingFiles, setPendingFiles] = useState<{ file: File; name: string }[]>([]);
  const [viewerFile, setViewerFile] = useState<ViewableFile | null>(null);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="w-14 h-14 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-blue-600 transition-all shadow-sm">
            <ArrowRight size={24} />
          </button>
          <div>
            <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{selectedStudent.name}</h1>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-blue-600 dark:text-blue-400 text-xs font-black bg-blue-50 dark:bg-blue-500/20 px-3 py-1 rounded-lg tracking-wider uppercase">{selectedStudent.email}</span>
              <span className="text-slate-400 dark:text-slate-300 text-xs font-bold">الرقم القومي: {selectedStudent.id_card_number || '---'}</span>
              {selectedStudent.room_number && (
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-black bg-emerald-50 dark:bg-emerald-500/20 px-3 py-1 rounded-lg tracking-wider">
                  {selectedStudent.apartment_name || 'شقة'} - غرفة {selectedStudent.room_number}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canEditStudent && (
            <button onClick={() => {
              setEditForm({ ...selectedStudent, phoneNumbers: selectedStudent.phones || [] });
              setEditModalOpen(true);
            }} className="neon-btn neon-btn-secondary neon-btn-sm">
              <PenSquare size={16} /> تعديل
            </button>
          )}
          {user?.role === 'priest' && (
            <button onClick={() => {
              setPriestEditForm({ ...selectedStudent });
              setPriestEditModalOpen(true);
            }} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2">
              <PenSquare size={14} /> تعديل البيانات
            </button>
          )}
          <button onClick={handleDownloadProfile} className="neon-btn neon-btn-secondary neon-btn-sm">
            <FileText size={16} /> تحميل الملف الشخصي
          </button>
          <button onClick={openSendModal} className="neon-btn neon-btn-info neon-btn-sm">
            <Send size={16} /> إرسال الملف
          </button>
          {!isAdmin && user?.role !== 'bishop' && (
            <button onClick={() => setArchiveModalOpen(true)} className="neon-btn neon-btn-danger neon-btn-sm">
              <Archive size={16} /> أرشفة / مغادرة المسكن
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {canManageHousing || canManagePoints || canManagePenalties ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 rounded-[2rem] p-2 shadow-sm">
            <button
              onClick={() => setTabs('overview')}
              className={`px-5 py-2 rounded-[2rem] text-xs font-black transition-all ${
                tabs === 'overview' ? 'bg-slate-900 text-white' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              نظرة عامة
            </button>
            <button
              onClick={() => setTabs('supervisor')}
              className={`px-5 py-2 rounded-[2rem] text-xs font-black transition-all ${
                tabs === 'supervisor' ? 'bg-neon-primary text-black' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              مشرف السكن
            </button>
          </div>
          {loadingBehavior && (
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">جارٍ تحميل بيانات السلوك...</span>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Column 1 - Main */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-card-dark p-4 sm:p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            <div className="flex flex-col items-center gap-4 border-l border-slate-50 dark:border-white/10 pl-8">
              <div className="w-32 h-32 bg-slate-100 dark:bg-white/10 rounded-[2.5rem] overflow-hidden border-4 border-slate-50 dark:border-white/10 shadow-inner relative group">
                {selectedStudent.student_photo || selectedStudent.photo_url ? (
                  <img src={selectedStudent.student_photo || selectedStudent.photo_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-500">
                    <UserCircle size={64} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <Camera size={24} className="text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-black text-slate-800 dark:text-white">صورة الطالب</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">DormMaster 2024</p>
              </div>
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-6 content-center">
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 dark:text-slate-300 font-black uppercase tracking-widest">الكلية والجامعة</p>
                <p className="font-black text-slate-700 dark:text-slate-200">{selectedStudent.college || 'غير محدد'} - {selectedStudent.university}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 dark:text-slate-300 font-black uppercase tracking-widest">التخصص</p>
                <p className="font-black text-slate-700 dark:text-slate-200">{selectedStudent.major || '---'}</p>
              </div>
              <div className="space-y-1 text-slate-500 dark:text-slate-300 font-bold">
                {selectedStudent.phones?.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg">
                    {p.phoneType === 'whatsapp' ? <MessageSquareShare size={12} className="text-emerald-500" /> : <Phone size={12} className="text-slate-400 dark:text-slate-300" />}
                    <span className="text-slate-400 dark:text-slate-300">{p.label}:</span>
                    <span className="text-slate-700 dark:text-slate-200">{p.phoneNumber}</span>
                  </div>
                ))}
                {!selectedStudent.phones?.length && (
                  <div className="text-[10px] text-slate-300 dark:text-slate-500 italic">لا توجد هواتف مسجلة</div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 dark:text-slate-300 font-black uppercase tracking-widest">سنة الالتحاق</p>
                <p className="font-black text-slate-700 dark:text-slate-200">{selectedStudent.enrollment_year || '---'}</p>
              </div>
              {selectedStudent.is_traveling === 1 && (
                <div className="col-span-full mt-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                      <Plane size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-amber-800 dark:text-amber-200 tracking-tighter">الطالب في حالة سفر حالياً</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">الوجهة: {selectedStudent.travel_destination}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] text-amber-500 dark:text-amber-400 font-black uppercase tracking-widest">بدأ السفر</p>
                    <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {selectedStudent.travel_start_time ? new Date(selectedStudent.travel_start_time).toLocaleString('ar-EG') : '---'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Student Finance Card */}
          {user?.role && ['admin', 'bishop', 'priest', 'supervisor'].includes(user.role) && (
            <StudentFinanceCard studentId={selectedStudent.id} role={user.role} />
          )}

          {/* Additional Info Section */}
          <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <Search size={20} className="text-blue-500" />
              البيانات الجغرافية والروحية (من القاعدة)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-bold text-sm">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Map size={16} /> المحافظة والقرية</div>
                <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.governorate} {selectedStudent.village ? ` - ${selectedStudent.village}` : ''}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Cross size={16} /> الكنيسة</div>
                <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.church_name || '---'}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><UserCheck size={16} /> أب الاعتراف</div>
                <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.confession_father_name || '---'}</span>
              </div>
              {selectedStudent.confession_father_phone && (
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Phone size={16} /> تليفون أب الاعتراف</div>
                  <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.confession_father_phone}</span>
                </div>
              )}
              {selectedStudent.confession_father_whatsapp && (
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><MessageSquareShare size={16} /> واتساب أب الاعتراف</div>
                  <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.confession_father_whatsapp}</span>
                </div>
              )}
              {selectedStudent.confession_father_service && (
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Heart size={16} /> خدمة أب الاعتراف</div>
                  <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.confession_father_service}</span>
                </div>
              )}
              {selectedStudent.is_servant === 1 && (
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><UserCheck size={16} /> خادم</div>
                  <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.servant_services || 'نعم'}</span>
                </div>
              )}
              {selectedStudent.is_deacon === 1 && (
                <>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Cross size={16} /> رتبة الشموسية</div>
                    <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.deacon_rank || '---'}</span>
                  </div>
                  {selectedStudent.deacon_details && (
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><FileTextIcon size={16} /> تفاصيل الشموسية</div>
                      <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.deacon_details}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                <span className="text-slate-400 dark:text-slate-300">تاريخ الميلاد</span>
                <span className="text-slate-700 dark:text-slate-200 font-black">{selectedStudent.birth_date ? new Date(selectedStudent.birth_date).toLocaleDateString('ar-EG') : '---'}</span>
              </div>
              <div className="col-span-full space-y-2">
                <p className="text-[10px] text-slate-400 dark:text-slate-300 font-black tracking-widest pr-2">العنوان الدائم</p>
                <p className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-slate-700 dark:text-slate-200 font-black">{selectedStudent.address || 'لا يوجد عنوان مسجل'}</p>
              </div>
            </div>
          </div>

          {/* Delays List Section */}
          <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50/50 dark:bg-red-500/10 rounded-bl-[5rem] -mr-10 -mt-10" />
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3 relative z-10">
              <Clock size={20} className="text-red-500" />
              سجل التأخيرات (الـ Curfew)
            </h3>

            <div className="space-y-4 relative z-10">
              {selectedStudent.delays && selectedStudent.delays.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {selectedStudent.delays.map((delay: any) => (
                    <div key={delay.id} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 flex items-center justify-between group hover:bg-red-50/10 dark:hover:bg-red-500/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white dark:bg-card-dark rounded-xl flex items-center justify-center text-red-500 shadow-sm">
                          <AlertCircle size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-white">
                            {new Date(delay.actual_entry_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{new Date(delay.actual_entry_time).toLocaleDateString('ar-EG')}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] text-slate-400 dark:text-slate-300 font-black uppercase tracking-widest">توقيت الغلق</p>
                        <p className="text-xs font-black text-red-600">{delay.curfew_time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-slate-50 dark:border-white/10 rounded-[2.5rem]">
                  <p className="text-sm text-slate-300 dark:text-slate-500 font-bold">لا يوجد سجل تأخيرات لهذا الطالب</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Guardians Section */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-800 dark:text-white">أولياء الأمور</h3>
              {!isAdmin && user?.role !== 'bishop' && (
                <button onClick={() => setGuardianModalOpen(true)} className="p-2 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-all">
                  <Plus size={20} />
                </button>
              )}
            </div>

            <div className="space-y-4">
              {selectedStudent.guardians?.map((guardian: any) => (
                <div key={guardian.id} className="p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/10 relative group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-card-dark rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-300 border border-slate-100 dark:border-white/10 overflow-hidden shadow-sm">
                      {guardian.photo ? <img src={guardian.photo} className="w-full h-full object-cover" /> : <UserCircle size={24} />}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 dark:text-white text-sm">{guardian.name}</p>
                      <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase">{guardian.relation_type === 'father' ? 'الأب' : guardian.relation_type === 'mother' ? 'الأم' : 'ولي أمر'}</p>
                    </div>
                    {canEditStudent && (
                      <button
                        onClick={() => {
                          setEditGuardianData({
                            id: guardian.id,
                            name: guardian.name,
                            email: guardian.email,
                            phone: guardian.phone,
                            whatsapp: guardian.whatsapp || '',
                            occupation: guardian.occupation || '',
                            relationType: guardian.relation_type || 'father',
                            password: ''
                          });
                          setEditGuardianModalOpen(true);
                        }}
                        className="mr-auto p-2 text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <PenSquare size={16} />
                      </button>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white dark:border-white/10 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-300">
                    <div className="flex items-center gap-1"><Phone size={10} /> {guardian.phone}</div>
                    <div className="flex items-center gap-1"><MessageSquareShare size={10} /> {guardian.whatsapp || '---'}</div>
                    <div className="col-span-full truncate"><Mail size={10} className="inline mr-1" /> {guardian.email}</div>
                  </div>
                </div>
              ))}
              {(!selectedStudent.guardians || selectedStudent.guardians.length === 0) && (
                <div className="py-10 text-center border-2 border-dashed border-slate-100 dark:border-white/10 rounded-[2.5rem]">
                  <UserX size={32} className="mx-auto text-slate-100 dark:text-white/10 mb-2" />
                  <p className="text-xs text-slate-300 dark:text-slate-500 font-bold whitespace-pre-wrap">لا يوجد أولياء أمور مسجلين{"\n"}لهذا الطالب حتى الآن</p>
                </div>
              )}
            </div>
          </div>

          {/* System Account Info */}
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert size={20} className="text-amber-400" />
              <h3 className="text-lg font-black tracking-tight">حساب الطالب</h3>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-300 font-bold leading-relaxed mb-6">هذه هي بيانات الدخول للتطبيق التي يمكن للطالب استخدامها.</p>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">اسم المستخدم (الإيميل)</p>
                <p className="text-sm font-black text-blue-400 mt-1">{selectedStudent.email}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">كلمة المرور المؤقتة</p>
                <p className="text-sm font-black text-slate-300 mt-1 tracking-tighter">123456</p>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <Camera size={20} className="text-blue-500" />
              الملفات والوثائق
            </h3>
            {canEditStudent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 cursor-pointer hover:border-blue-300 transition-colors">
                    <Camera size={24} className="text-slate-300 dark:text-slate-500 mb-2" />
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">بطاقة الطالب (وجه)</span>
                    <input type="file" hidden accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'id_front')} />
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 cursor-pointer hover:border-blue-300 transition-colors">
                    <Camera size={24} className="text-slate-300 dark:text-slate-500 mb-2" />
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">بطاقة الطالب (ظهر)</span>
                    <input type="file" hidden accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'id_back')} />
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 cursor-pointer hover:border-blue-300 transition-colors">
                    <Camera size={24} className="text-slate-300 dark:text-slate-500 mb-2" />
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">بطاقة ولي الأمر (وجه)</span>
                    <input type="file" hidden accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'parent_id_front')} />
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 cursor-pointer hover:border-blue-300 transition-colors">
                    <Camera size={24} className="text-slate-300 dark:text-slate-500 mb-2" />
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">بطاقة ولي الأمر (ظهر)</span>
                    <input type="file" hidden accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'parent_id_back')} />
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 cursor-pointer hover:border-blue-300 transition-colors col-span-2">
                    <FileText size={24} className="text-slate-300 dark:text-slate-500 mb-2" />
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">جواب التذكية</span>
                    <input type="file" hidden accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'church_recom')} />
                  </label>
                </div>
                <div className="border-t border-slate-100 dark:border-white/10 pt-4">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-300 mb-3">ملفات أخرى (يمكنك اختيار عدة ملفات دفعة واحدة)</p>
                  <label className="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors font-black text-xs">
                    <Plus size={16} /> اختيار ملفات
                    <input type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden"
                      onChange={(e) => {
                        if (!e.target.files?.length) return;
                        const added = Array.from(e.target.files).map(f => ({ file: f, name: '' }));
                        setPendingFiles(prev => [...prev, ...added]);
                        e.target.value = '';
                      }} />
                  </label>
                </div>
                {pendingFiles.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {pendingFiles.map((item, idx) => {
                      const isImage = isImageFile({ file_name: item.file.name, file_path: item.file.name });
                      const preview = isImage ? URL.createObjectURL(item.file) : null;
                      return (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-white/10">
                          {preview ? (
                            <img src={preview} alt="" className="w-16 h-16 object-cover rounded-xl border border-white/10" />
                          ) : (
                            <div className="w-16 h-16 flex items-center justify-center bg-white/10 rounded-xl border border-white/10 text-slate-400 dark:text-slate-300">
                              <FileTextIcon size={22} />
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-300 truncate">{item.file.name}</p>
                            <input type="text" value={item.name}
                              onChange={(e) => {
                                const updated = [...pendingFiles];
                                updated[idx].name = e.target.value;
                                setPendingFiles(updated);
                              }}
                              placeholder="اسم الملف (اختياري)"
                              className="w-full p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white focus:ring-2 focus:ring-blue-400/30" />
                          </div>
                          <button onClick={() => setPendingFiles(pendingFiles.filter((_, i) => i !== idx))}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    <button disabled={uploading}
                      onClick={async () => { await handleUploadFiles(pendingFiles); setPendingFiles([]); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition-all">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      رفع كل الملفات ({pendingFiles.length})
                    </button>
                  </div>
                )}
                {uploading && <p className="text-[10px] font-black text-blue-500 mt-2">جاري الرفع...</p>}
              </div>
            )}
            {selectedStudent.files && selectedStudent.files.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">الملفات المرفوعة:</p>
                {selectedStudent.files.map((file: any) => {
                  const filePath = file.file_path;
                  const isImg = isImageFile({ file_name: file.file_name, file_path: filePath });
                  return (
                    <button key={file.id}
                      onClick={() => filePath && setViewerFile({ id: file.id, file_name: file.file_name, doc_type: file.doc_type, file_path: filePath })}
                      className="w-full text-left flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-2xl group hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {isImg && filePath ? (
                          <img src={normalizeFilePath(filePath)} alt="" className="w-10 h-10 object-cover rounded-lg border border-white/10" />
                        ) : (
                          <FileText size={14} className="text-slate-400 dark:text-slate-300" />
                        )}
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{file.file_name}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-300 shrink-0">({file.doc_type})</span>
                      </div>
                      {canEditStudent && (
                        <span onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <Trash2 size={14} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Behavior Summary */}
          {selectedStudent.behaviorSummary && (
            <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                <Heart size={20} className="text-emerald-500" />
                ملخص السلوك
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-bold text-sm">
                <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-white dark:border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><TrendingUp size={16} /> إجمالي النقاط</div>
                  <span className="text-emerald-700 dark:text-emerald-300 font-black text-lg">{selectedStudent.behaviorSummary.totalPoints}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-white dark:border-red-500/20">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400"><AlertCircle size={16} /> إنذارات نشطة</div>
                  <span className="text-red-700 dark:text-red-300 font-black text-lg">{selectedStudent.behaviorSummary.activeWarnings}</span>
                </div>
              </div>
            </div>
          )}

          {/* Uploaded Documents */}
          {selectedStudent.documents && selectedStudent.documents.length > 0 && (
            <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                <Camera size={20} className="text-blue-500" />
                الوثائق المرفوعة
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedStudent.documents.map((doc: any) => {
                  const docSrc = normalizeFilePath(doc.file_path);
                  const isImg = isImageFile({ file_name: doc.file_name, file_path: doc.file_path });
                  return (
                    <button key={doc.id}
                      onClick={() => setViewerFile({ id: doc.id, file_name: doc.file_name, doc_type: doc.doc_type, file_path: doc.file_path })}
                      className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left">
                      {isImg && docSrc ? (
                        <img src={docSrc} alt="" className="w-12 h-12 object-cover rounded-xl border border-white/10" />
                      ) : (
                        <FileText size={20} className="text-slate-400 dark:text-slate-300" />
                      )}
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{doc.doc_type} - {doc.file_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Student QR Code */}
        <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
          <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
            <QrCode size={20} className="text-purple-500" />
            رمز QR الخاص بالطالب
          </h3>
          <div className="flex flex-col items-center justify-center space-y-4">
            {selectedStudent.id && (
              <QRCode
                value={selectedStudent.id}
                size={256}
                viewBox={`0 0 256 256`}
                className="p-4 bg-white rounded-xl shadow-md"
              />
            )}
            <p className="text-sm text-slate-500 dark:text-slate-300 font-bold">امسح هذا الرمز لتسجيل الحضور في الفعاليات</p>
          </div>
        </div>
      </div>

      <GuardianModal
        isOpen={guardianModalOpen}
        onClose={() => setGuardianModalOpen(false)}
        data={guardianData}
        onChange={setGuardianData}
        onSave={handleAddGuardian}
      />

      <GuardianEditModal
        isOpen={editGuardianModalOpen}
        onClose={() => { setEditGuardianModalOpen(false); setEditGuardianData({}); }}
        data={editGuardianData}
        onChange={setEditGuardianData}
        onSave={handleEditGuardian}
        saving={editGuardianSaving}
      />

      {(isAdmin || user?.role === 'priest' || user?.role === 'supervisor' || user?.role === 'bishop') && (
        <StudentNotesSection studentId={selectedStudent.id} />
      )}

      {/* Archive Modal */}
      <ArchiveModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        reason={archiveData.reason}
        notes={archiveData.notes}
        onReasonChange={(reason) => setArchiveData({ ...archiveData, reason })}
        onNotesChange={(notes) => setArchiveData({ ...archiveData, notes })}
        onArchive={handleArchiveStudent}
      />

      <EditStudentModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editForm={editForm}
        setEditForm={setEditForm}
        handleSaveEdit={handleSaveEdit}
        isAdmin={isAdmin}
        rooms={rooms}
      />

      <SendProfileModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        sendTargets={sendTargets}
        setSendTargets={setSendTargets}
        recipientSearchTerm={recipientSearchTerm}
        setRecipientSearchTerm={setRecipientSearchTerm}
        filteredSendOptions={filteredSendOptions}
        sendingProfile={sendingProfile}
        handleSendProfile={handleSendProfile}
      />

      <RestoreStudentModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        onRestore={handleRestoreStudent}
        loading={restoreLoading}
        studentName={restoreTarget?.student_name || ''}
        roomId={restoreRoomId}
        onRoomIdChange={setRestoreRoomId}
        rooms={rooms}
      />

      <PriestEditModal
        isOpen={priestEditModalOpen}
        onClose={() => setPriestEditModalOpen(false)}
        form={priestEditForm}
        onChange={setPriestEditForm}
        onSave={handlePriestEditSave}
        saving={priestSaving}
      />

      <FileViewerModal file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  );
}