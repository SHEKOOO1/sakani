import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { motion } from 'motion/react';
import { 
  Wrench, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Plus,
  MessageSquare,
  Play,
  MapPin,
  Flame,
  MoreVertical,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { MaintenanceRequestModal } from './maintenance/MaintenanceRequestModal';
import { UpdateStatusModal } from './maintenance/UpdateStatusModal';

export function MaintenancePage() {
  const { request } = useApi();
  const { user } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [studentProfile, setStudentProfile] = useState<any>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    description: '',
    priority: 'medium',
    room_id: ''
  });

  const [editData, setEditData] = useState({
    status: 'pending',
    assignedTo: ''
  });

  const isStudent = user?.role === 'student';

  // استخدام useCallback لمنع إعادة تعريف الدوال في كل render
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = ['admin', 'supervisor', 'employee', 'priest', 'assistant_supervisor'].includes(user?.role as string)
        ? '/api/maintenance'
        : '/api/maintenance/my';
      const response = await request(endpoint);
      setRequests(response.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [request, user?.role]);

  useEffect(() => {
    fetchRequests();
    if (!isStudent) {
      fetchLocationData();
      if (['admin', 'supervisor', 'priest'].includes(user?.role as string)) {
          fetchStaff();
      }
    } else {
      fetchStudentProfile();
    }
  }, [fetchRequests, user?.id, user?.role, isStudent]);

  const fetchStudentProfile = async () => {
    try {
      const resp = await request('/api/students/my-profile');
      if (resp.data) {
        setStudentProfile(resp.data);
        if (resp.data.room_id) {
          setFormData(prev => ({ ...prev, room_id: resp.data.room_id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLocationData = async () => {
    try {
      const roomResp = await request('/api/rooms');
      setRooms(roomResp.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    try {
      const resp = await request('/api/users');
      setStaff((resp.data || []).filter((u: any) => ['supervisor', 'employee', 'admin', 'priest'].includes(u.role)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('description', formData.description);
      fd.append('priority', formData.priority);
      if (formData.room_id) fd.append('roomId', formData.room_id);
      selectedFiles.forEach(file => fd.append('files', file));

      await request('/api/maintenance', {
        method: 'POST',
        body: fd,
        headers: {}
      });
      setModalOpen(false);
      setFormData({ description: '', priority: 'medium', room_id: isStudent ? studentProfile?.room_id || '' : '' });
      setSelectedFiles([]);
      fetchRequests();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل إرسال البلاغ', 'error');
    }
  };

  const handleQuickComplete = async (requestId: string) => {
    try {
      await request(`/api/maintenance/${requestId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' })
      });
      fetchRequests();
    } catch (err: any) {
      showSnackbar('فشل تحديث الحالة', 'error');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      const response = await request(`/api/maintenance/${selectedRequest.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(editData)
      });
      showSnackbar(response.message || 'تم تحديث بيانات البلاغ وتنبيه الموظف بنجاح', 'success');
      setEditModalOpen(false);
      fetchRequests();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل تحديث الحالة', 'error');
    }
  };

  const getResponseTime = (createdAt: string, completedAt: string) => {
    if (!createdAt || !completedAt) return null;
    const start = new Date(createdAt);
    const end = new Date(completedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} دقيقة`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) return `${hours} ساعة و ${mins} دقيقة`;
    return `${Math.floor(hours / 24)} يوم`;
  };

  const openEditModal = (req: any) => {
    setSelectedRequest(req);
    setEditData({
      status: req.status || 'pending',
      assignedTo: req.assigned_to || ''
    });
    setEditModalOpen(true);
  };

  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case 'urgent': return { color: 'bg-rose-50 text-rose-600 border-rose-200', icon: <Flame size={12} />, label: 'عاجل جداً' };
      case 'high': return { color: 'bg-orange-50 text-orange-600 border-orange-200', icon: <AlertCircle size={12} />, label: 'أولوية عالية' };
      case 'medium': return { color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Clock size={12} />, label: 'عادي' };
      default: return { color: 'bg-slate-50 text-slate-500 border-slate-200', icon: <Clock size={12} />, label: 'منخفض' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700';
      case 'in-progress': return 'bg-blue-50 text-blue-700';
      case 'pending': return 'bg-amber-50 text-amber-700';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-8 sm:p-10">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter">إدارة الصيانة</h1>
              <p className="text-white/70 mt-1 font-bold">متابعة وإدارة البلاغات الفنية للأعطال داخل المجمع السكني.</p>
            </div>
          </div>
          <button 
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-primary-600 rounded-2xl hover:bg-primary-50 transition-all font-black shadow-lg active:scale-95"
          >
            <Plus size={22} />
            <span>بلاغ صيانة جديد</span>
          </button>
        </div>
        <div className="absolute -top-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
             [1,2,3].map(i => <div key={i} className="h-64 bg-white dark:bg-card-dark rounded-xl animate-pulse border border-slate-100 dark:border-white/[0.05]" />)
        ) : requests.length > 0 ? requests.map((req: any) => {
          const priority = getPriorityInfo(req.priority);
          return (
            <motion.div 
              key={req.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-card-dark p-8 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm hover:shadow-xl transition-all duration-300 relative group flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                 <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase ${priority.color}`}>
                    {priority.icon}
                    <span>{priority.label}</span>
                 </div>
                  {['admin', 'supervisor', 'employee', 'priest'].includes(user?.role as string) && (
                   <button 
                    onClick={() => openEditModal(req)}
                    className="text-slate-400 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl"
                   >
                      <MoreVertical size={18} />
                   </button>
                 )}
              </div>

              <div className="flex items-start gap-4 mb-6">
                 <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-slate-400 dark:text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <Wrench size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg leading-tight mb-2">{req.description}</h3>
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300 text-xs font-bold">
                       <MapPin size={12} />
                       <span>{req.apartment_name ? `عمارة ${req.apartment_name}` : 'غير محدد'} • غرفة {req.room_number || '?'}</span>
                    </div>
                 </div>
              </div>

              {/* Attachments Preview */}
              {(req.photo_url || (req.attachments && req.attachments.length > 0)) && (
                <div className="mb-6 grid grid-cols-2 gap-2">
                  {req.photo_url && (
                    <img src={req.photo_url} className="w-full h-32 object-cover rounded-2xl cursor-pointer" onClick={() => window.open(req.photo_url, '_blank')} />
                  )}
                  {req.attachments?.map((att: any, idx: number) => (
                    <div key={idx} className="relative h-32 rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/10 group/att border border-slate-50 dark:border-white/5">
                      {att.file_type?.includes('video') || att.file_path?.match(/\.(mp4|mov|webm)$/i) ? (
                        <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => window.open(att.file_path, '_blank')}>
                           <video src={att.file_path} className="w-full h-full object-cover opacity-60" />
                           <div className="absolute inset-0 flex items-center justify-center text-white bg-black/20">
                              <Play size={20} fill="currentColor" />
                           </div>
                        </div>
                      ) : (
                        <img src={att.file_path} className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform" onClick={() => window.open(att.file_path, '_blank')} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 mt-auto pt-6 border-t border-slate-50 dark:border-white/5">
                 <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-black text-slate-500">
                       {req.requester_name?.[0] || '؟'}
                    </div>
                    <div className="text-[10px]">
                       <p className="font-bold text-slate-700 dark:text-slate-200">{req.requester_name}</p>
                       <p className="text-slate-400 dark:text-slate-300 italic">بواسطة {req.assignee_name || 'طاقم الصيانة'}</p>
                    </div>
                 </div>
                 <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase ${getStatusColor(req.status)}`}>
                    {req.status === 'completed' ? 'تم الإصلاح' : req.status === 'pending' ? 'قيد الانتظار' : 'جاري العمل'}
                 </div>
                  {req.status === 'completed' && req.completed_at && (
                    <div className="flex flex-col items-end border-r border-slate-100 dark:border-white/10 pr-4">
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-tighter">مدة الإصلاح</span>
                     <span className="text-[10px] font-black text-emerald-600">
                       {getResponseTime(req.created_at, req.completed_at)}
                     </span>
                   </div>
                 )}
                 {user?.role === 'employee' && req.status !== 'completed' && (
                   <button 
                    onClick={() => handleQuickComplete(req.id)}
                    className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                    title="تحديد كمكتمل"
                   >
                      <CheckCircle2 size={18} />
                   </button>
                 )}
              </div>
            </motion.div>
          );
        }) : (
          <div className="col-span-full py-20 text-center bg-white dark:bg-card-dark rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5">
             <div className="w-24 h-24 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 dark:text-slate-600">
                <Wrench size={48} />
             </div>
             <h3 className="text-xl font-black text-slate-800 dark:text-white">لا توجد بلاغات نشطة</h3>
             <p className="text-slate-400 dark:text-slate-300 mt-2 font-medium">كل المرافق تعمل بكفاءة عالية حالياً.</p>
          </div>
        )}
      </div>

      <MaintenanceRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        formData={formData}
        onFormDataChange={setFormData}
        selectedFiles={selectedFiles}
        onFilesChange={setSelectedFiles}
        onSubmit={handleAddRequest}
        isStudent={isStudent}
        studentProfile={studentProfile}
        rooms={rooms}
      />

      <UpdateStatusModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editData={editData}
        onEditDataChange={setEditData}
        onSubmit={handleUpdateStatus}
        staff={staff}
      />
    </div>
  );
}
