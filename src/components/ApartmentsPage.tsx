import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { motion } from 'motion/react';
import { 
  Building, 
  Plus, 
  Trash2, 
  Edit2, 
  Search,
  LayoutGrid,
  Power,
  Play
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { ApartmentFormModal } from './apartments/ApartmentFormModal';

export function ApartmentsPage() {
  const { request } = useApi();
  const { hasPermission } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    building: '', 
    is_active: true,
    amenities: [] as string[],
    has_kitchen: false,
    kitchen_details: [] as string[],
    has_bathroom: false,
    bathroom_details: [] as string[]
  });
  const [employees, setEmployees] = useState<any[]>([]);

  const canManageHousing = hasPermission(AppPermission.MANAGE_HOUSING);
  const mounted = useMounted();

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await request('/api/employees');
      if (mounted.current) setEmployees(response.data);
    } catch (err) {
      console.error(err);
    }
  }, [request]);

  const fetchApartments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request('/api/apartments');
      if (mounted.current) setApartments(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request]);

  const loadRef = useRef(() => {});
  loadRef.current = () => { fetchApartments(); fetchEmployees(); };

  useEffect(() => {

    loadRef.current();
    
  }, []);

  const handleAddApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedApartment) {
        await request(`/api/apartments/${selectedApartment.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...formData,
            amenities: formData.amenities,
            kitchen_details: formData.kitchen_details,
            bathroom_details: formData.bathroom_details
          })
        });
      } else {
        await request('/api/apartments', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setAddModalOpen(false);
      setIsEditing(false);
      setFormData({ 
        name: '', 
        building: '', 
        is_active: true, 
        amenities: [], 
        has_kitchen: false, 
        kitchen_details: [], 
        has_bathroom: false, 
        bathroom_details: [] 
      });
      fetchApartments();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل حفظ بيانات السكن', 'error');
    }
  };

  const handleToggleStatus = async (apt: any) => {
    try {
      await request(`/api/apartments/${apt.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...apt, is_active: !apt.is_active })
      });
      fetchApartments();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل تحديث حالة السكن', 'error');
    }
  };

  const handleEditClick = (apt: any) => {
    setSelectedApartment(apt);
    setFormData({ 
      name: apt.name, 
      building: apt.building || '', 
      is_active: !!apt.is_active,
      amenities: apt.amenities ? JSON.parse(apt.amenities) : [],
      has_kitchen: !!apt.has_kitchen,
      kitchen_details: apt.kitchen_details ? JSON.parse(apt.kitchen_details) : [],
      has_bathroom: !!apt.has_bathroom,
      bathroom_details: apt.bathroom_details ? JSON.parse(apt.bathroom_details) : []
    });
    setIsEditing(true);
    setAddModalOpen(true);
  };

  const handleDeleteClick = (apt: any) => {
    setSelectedApartment(apt);
    setModalOpen(true);
  };

  const [isEditing, setIsEditing] = useState(false);

  const confirmDelete = async () => {
    if (!selectedApartment) return;
    try {
      await request(`/api/apartments/${selectedApartment.id}`, { method: 'DELETE' });
      setApartments(apartments.filter((a: any) => a.id !== selectedApartment.id));
      setModalOpen(false);
    } catch (err: any) {
      showSnackbar(err.message || 'حدث خطأ أثناء الحذف', 'error');
      setModalOpen(false);
    }
  };

  const getOccupancyColor = (current: number, capacity: number) => {
    if (capacity === 0) return 'bg-slate-200';
    const ratio = current / capacity;
    if (ratio >= 1) return 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
    if (ratio >= 0.7) return 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
    return 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">إدارة الشقق</h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">عرض وتنظيم الشقق السكنية في النظام.</p>
        </div>
        {canManageHousing && (
          <button 
             onClick={() => { setIsEditing(false); setFormData({ name: '', building: '', is_active: true, amenities: [], has_kitchen: false, kitchen_details: [], has_bathroom: false, bathroom_details: [] }); setAddModalOpen(true); }}
             className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 font-medium"
          >
            <Plus size={18} />
            <span>إضافة شقة جديدة</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
           [1,2,3].map(i => <div key={i} className="h-64 bg-white dark:bg-card-dark rounded-3xl animate-pulse border border-slate-100 dark:border-white/[0.05]" />)
        ) : apartments.length > 0 ? apartments.map((apt: any) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={apt.id}
            className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-slate-100 dark:border-white/[0.05] shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Building size={24} />
              </div>
              {canManageHousing && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEditClick(apt)}
                    className="p-2 text-slate-400 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleToggleStatus(apt)}
                    className={`p-2 rounded-lg transition-colors ${apt.is_active ? 'text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/20' : 'text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/20'}`}
                  >
                    {apt.is_active ? <Power size={16} /> : <Play size={16} />}
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(apt)}
                    className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{apt.name}</h3>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300 text-sm mt-1">
              <LayoutGrid size={14} />
              <span>{apt.building || 'عمارة غير محددة'}</span>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">إشغال الشقة</span>
                <span className={`text-[10px] font-black ${
                   apt.current_occupancy >= apt.total_capacity && apt.total_capacity > 0 ? 'text-red-500' : 
                   (apt.current_occupancy / apt.total_capacity) >= 0.7 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {apt.total_capacity > 0 ? Math.round((apt.current_occupancy / apt.total_capacity) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden relative border border-slate-200/30 dark:border-white/10">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${apt.total_capacity > 0 ? (apt.current_occupancy / apt.total_capacity) * 100 : 0}%` }}
                  className={`h-full rounded-full transition-all duration-700 ${getOccupancyColor(apt.current_occupancy, apt.total_capacity)}`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-500 dark:text-slate-300">{apt.current_occupancy} من {apt.total_capacity} سرير</span>
                  <span className="text-slate-400 dark:text-slate-300">{(apt.total_capacity - apt.current_occupancy)} متاح</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-300">تاريخ الإضافة: {new Date(apt.created_at).toLocaleDateString('ar-EG')}</span>
              <button className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline">عرض الغرف</button>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-20 text-center bg-white dark:bg-card-dark rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10">
             <Building className="mx-auto text-slate-200 dark:text-slate-600 mb-4" size={48} />
             <h3 className="text-lg font-bold text-slate-800 dark:text-white">لا توجد شقق مسجلة</h3>
          </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="حذف الشقة"
        message={`هل أنت متأكد من حذف هذه الشقة "${selectedApartment?.name}"؟ سيتم حذف جميع الغرف المرتبطة بها أيضاً.`}
      />

      <ApartmentFormModal
        isOpen={addModalOpen}
        isEditing={isEditing}
        formData={formData}
        onFormDataChange={(data) => setFormData(data)}
        onSubmit={handleAddApartment}
        onClose={() => setAddModalOpen(false)}
      />
    </div>
  );
}
