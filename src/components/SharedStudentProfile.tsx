import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { StudentNotesSection } from './StudentNotesSection';
import { StudentGuardians } from './profiles/StudentGuardians';
import { StudentFinanceCard } from './student/StudentFinanceCard';
import { FileViewerModal, type ViewableFile, normalizeFilePath, isImageFile } from './student/FileViewerModal';
import { GeoSpiritualSection } from './profiles/GeoSpiritualSection';
import QRCode from 'react-qr-code';
import {
  ArrowRight, UserCircle, Camera, Plane,
  Phone, MessageSquareShare,
  FileText, AlertCircle, QrCode,
  ShieldAlert, Building, Edit3, X, CheckCircle,
  Save, Upload
} from 'lucide-react';

interface SharedStudentProfileProps {
  studentId: string;
  onBack: () => void;
}

export const SharedStudentProfile: React.FC<SharedStudentProfileProps> = ({ studentId, onBack }) => {
  const { request } = useApi();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadFiles, setUploadFiles] = useState<{ file: File; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewerFile, setViewerFile] = useState<ViewableFile | null>(null);

  const isPriest = user?.role === 'priest';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await request(`/api/students/${studentId}/shared-profile`);
      if (res.success) {
        setProfile(res.data);
        const s = res?.data?.student || {};
        setFormData({
          name: s.name || '',
          email: s.email || '',
          governorate: s.governorate || '',
          village: s.village || '',
          churchName: s.church_name || '',
          confessionFatherName: s.confession_father_name || '',
          confession_father_phone: s.confession_father_phone || '',
          confession_father_whatsapp: s.confession_father_whatsapp || '',
          confession_father_service: s.confession_father_service || '',
          isServant: s.is_servant === 1,
          servantServices: s.servant_services || '',
          isDeacon: s.is_deacon === 1,
          deaconRank: s.deacon_rank || '',
          deacon_details: s.deacon_details || '',
          deacon_ordination_date: s.deacon_ordination_date ? s.deacon_ordination_date.split('T')[0] : '',
          serviceTrainingCertificate: s.service_training_certificate || '',
          address: s.address || ''
        });
      }
      else setError(res.message || 'حدث خطأ');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل الملف');
    } finally {
      setLoading(false);
    }
  }, [request, studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const body: any = { ...formData };
      delete body.phone;
      delete body.whatsappNumber;
      body.isServant = formData.isServant ? 1 : 0;
      body.isDeacon = formData.isDeacon ? 1 : 0;
      body.deacon_ordination_date = body.deacon_ordination_date || null;
      const res = await request(`/api/students/${studentId}/priest-edit`, { method: 'PUT', body: JSON.stringify(body) });
      if (res.success) {
        setSaveMessage({ type: 'success', text: 'تم حفظ التعديلات بنجاح وإخطار المشرفين' });
        setEditMode(false);
        fetchData();
      } else {
        setSaveMessage({ type: 'error', text: res.message || 'حدث خطأ أثناء الحفظ' });
      }
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء الحفظ' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFiles.length) return;
    setUploading(true);
    setSaveMessage(null);
    try {
      const fd = new FormData();
      uploadFiles.forEach(item => fd.append('files', item.file));
      uploadFiles.forEach(() => fd.append('doc_types', 'other'));
      uploadFiles.forEach(item => fd.append('file_labels', item.name.trim() || item.file.name));
      const res = await request(`/api/students/${studentId}/priest-upload`, { method: 'POST', body: fd });
      if (res.success) {
        setSaveMessage({ type: 'success', text: 'تم رفع الملفات بنجاح' });
        setUploadFiles([]);
        fetchData();
      } else {
        setSaveMessage({ type: 'error', text: res.message || 'حدث خطأ في رفع الملفات' });
      }
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'حدث خطأ في رفع الملفات' });
    } finally {
      setUploading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white dark:bg-card-dark rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm text-center">
        <p className="text-lg font-black text-red-500 mb-4">{error}</p>
        <button onClick={onBack} className="neon-btn neon-btn-primary px-8 py-4 text-sm shadow-glow">
          العودة
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const { student, guardians, files } = profile;

  const inputClass = "w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all";
  const labelClass = "text-[10px] text-slate-400 dark:text-slate-300 font-black uppercase tracking-widest block mb-1";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Save message toast */}
      {saveMessage && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold transition-all ${
          saveMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {saveMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {saveMessage.text}
          <button onClick={() => setSaveMessage(null)} className="mr-4 opacity-50 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors font-bold text-sm">
          <ArrowRight size={18} /> العودة
        </button>
        {isPriest && !editMode && (
          <button onClick={() => setEditMode(true)} className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md">
            <Edit3 size={16} /> تعديل البيانات
          </button>
        )}
        {isPriest && editMode && (
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
              حفظ التعديلات
            </button>
            <button onClick={() => { setEditMode(false); fetchData(); }} disabled={saving} className="flex items-center gap-2 px-5 py-3 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all">
              إلغاء
            </button>
          </div>
        )}
      </div>

      <div className={`bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 rounded-[2rem] p-6 flex items-center gap-4 ${editMode ? 'ring-2 ring-blue-400/50' : ''}`}>
        <div className={`p-3 rounded-2xl ${editMode ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
          {editMode ? <Edit3 size={24} /> : <Building size={24} />}
        </div>
        <div>
          <p className="text-sm font-black text-amber-800 dark:text-amber-200">
            {editMode ? 'تعديل بيانات الطالب' : 'عرض الملف الشخصي - قراءة فقط'}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
            {editMode ? 'سيتم إخطار المشرفين بعد حفظ التعديلات' : 'تمت مشاركة هذا الملف معك لمشاهدة بيانات الطالب'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Identity */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center gap-4 border-l border-slate-50 dark:border-white/5 pl-8">
              <div className="w-32 h-32 bg-slate-100 dark:bg-white/10 rounded-[2.5rem] overflow-hidden border-4 border-slate-50 dark:border-white/5 shadow-inner">
                {student.student_photo || student.photo_url ? (
                  <img src={student.student_photo || student.photo_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-400">
                    <UserCircle size={64} />
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-800 dark:text-white">صورة الطالب</p>
              </div>
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-6 content-center">
              {editMode ? (
                <>
                  <div className="space-y-1">
                    <p className={labelClass}>الاسم</p>
                    <input className={inputClass} value={formData.name} onChange={e => updateField('name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <p className={labelClass}>الإيميل</p>
                    <input className={inputClass} value={formData.email} onChange={e => updateField('email', e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">الكلية والجامعة</p>
                    <p className="font-black text-slate-700 dark:text-slate-200">{student.college || 'غير محدد'} - {student.university}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">التخصص</p>
                    <p className="font-black text-slate-700 dark:text-slate-200">{student.major || '---'}</p>
                  </div>
                  <div className="space-y-1 text-slate-500 dark:text-slate-300 font-bold">
                    {student.phones?.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-[10px] bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg">
                        {p.phoneType === 'whatsapp' ? <MessageSquareShare size={12} className="text-emerald-500" /> : <Phone size={12} className="text-slate-400" />}
                        <span className="text-slate-400 dark:text-slate-300">{p.label}:</span>
                        <span className="text-slate-700 dark:text-slate-200">{p.phoneNumber}</span>
                      </div>
                    ))}
                    {!student.phones?.length && (
                      <div className="text-[10px] text-slate-300 dark:text-slate-400 italic">لا توجد هواتف مسجلة</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">سنة الالتحاق</p>
                    <p className="font-black text-slate-700 dark:text-slate-200">{student.enrollment_year || '---'}</p>
                  </div>
                </>
              )}
              {student.is_traveling === 1 && (
                <div className="col-span-full mt-4 p-4 bg-amber-50 dark:bg-amber-500/20 border border-amber-100 dark:border-amber-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                      <Plane size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-amber-800 dark:text-amber-200 tracking-tighter">الطالب في حالة سفر حالياً</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">الوجهة: {student.travel_destination}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest">بدأ السفر</p>
                    <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {student.travel_start_time ? new Date(student.travel_start_time).toLocaleString('ar-EG') : '---'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <GeoSpiritualSection
            editMode={editMode}
            formData={formData}
            student={student}
            onUpdateField={updateField}
          />

          {(user?.role === 'priest' || user?.role === 'supervisor' || user?.role === 'bishop') && (
            <StudentNotesSection studentId={studentId} />
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-8">
          {/* Guardians */}
          <StudentGuardians guardians={guardians} />

          {/* System Account */}
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert size={20} className="text-amber-400" />
              <h3 className="text-lg font-black tracking-tight">حساب الطالب</h3>
            </div>
            <p className="text-xs text-slate-400 font-bold leading-relaxed mb-6">هذه هي بيانات الدخول للتطبيق.</p>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black text-slate-500 uppercase">الإيميل</p>
                <p className="text-sm font-black text-blue-400 mt-1">{student.email}</p>
              </div>
            </div>
          </div>

          {/* Finance Card */}
          {user?.role && ['admin', 'bishop', 'priest', 'supervisor'].includes(user.role) && (
            <div className="space-y-8">
              <StudentFinanceCard studentId={studentId} role={user.role} />
            </div>
          )}

          {/* Files */}
          <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <Camera size={20} className="text-blue-500 dark:text-blue-400" />
              الملفات والوثائق
            </h3>
            {files?.length > 0 && (
              <div className="space-y-2 mb-4">
                {files.map((file: any) => {
                  const filePath = file.file_path;
                  const isImg = isImageFile({ file_name: file.file_name, file_path: filePath });
                  return (
                    <button key={file.id}
                      onClick={() => filePath && setViewerFile({ id: file.id, file_name: file.file_name, doc_type: file.doc_type, file_path: filePath })}
                      className="w-full text-left flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group">
                      {isImg && filePath ? (
                        <img src={normalizeFilePath(filePath)} alt="" className="w-11 h-11 object-cover rounded-xl border border-white/10" />
                      ) : (
                        <FileText size={20} className="text-slate-400 dark:text-slate-300 group-hover:text-blue-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file.file_name || 'ملف'}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-300">{file.doc_type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {(!files || files.length === 0) && (
              <div className="py-6 text-center border-2 border-dashed border-slate-100 dark:border-white/10 rounded-[2.5rem] mb-4">
                <p className="text-xs text-slate-300 dark:text-slate-400 font-bold">لا توجد ملفات</p>
              </div>
            )}
            {isPriest && editMode && (
              <div className="p-4 bg-blue-50 dark:bg-blue-500/20 rounded-2xl border border-blue-100 dark:border-blue-500/30">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-3">رفع ملفات جديدة (يمكن اختيار عدة ملفات باسم لكل ملف)</p>
                <input type="file" multiple className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-100 dark:file:bg-blue-500/20 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-200 file:cursor-pointer"
                  onChange={e => setUploadFiles(Array.from(e.target.files || []).map(f => ({ file: f, name: '' })))} />
                {uploadFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadFiles.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 truncate w-1/3">{item.file.name}</span>
                        <input type="text" value={item.name}
                          onChange={(e) => {
                            const updated = [...uploadFiles];
                            updated[idx].name = e.target.value;
                            setUploadFiles(updated);
                          }}
                          placeholder="اسم الملف"
                          className="flex-1 px-3 py-2 bg-white dark:bg-white/10 border border-blue-100 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-400/30" />
                        <button onClick={() => setUploadFiles(uploadFiles.filter((_, i) => i !== idx))}
                          className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={handleFileUpload} disabled={uploading}
                      className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all">
                      {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={14} />}
                      رفع {uploadFiles.length} ملف
                    </button>
                  </div>
                )}
              </div>
            )}

            <FileViewerModal file={viewerFile} onClose={() => setViewerFile(null)} />
          </div>

          {/* QR Code */}
          <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <QrCode size={20} className="text-purple-500" />
              رمز QR
            </h3>
            <div className="flex flex-col items-center space-y-4">
              {student.id && (
                <QRCode value={student.id} size={200} viewBox="0 0 256 256"
                  className="p-4 bg-white rounded-xl shadow-md" />
              )}
              <p className="text-xs text-slate-500 dark:text-slate-300 font-bold">رمز QR الخاص بالطالب</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
