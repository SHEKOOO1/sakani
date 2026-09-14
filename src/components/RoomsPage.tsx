import React, { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bed, 
  Plus, 
  Trash2, 
  Edit2, 
  Search,
  Users,
  Filter,
  X,
  Building
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { Pagination } from './Pagination';
import { RoomFormModal } from './rooms/RoomFormModal';

export function RoomsPage() {
  const { request } = useApi();
  const { hasPermission } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [rooms, setRooms] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const filteredRooms = rooms.filter((r: any) =>
    !searchQuery || r.room_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData({ 
      apartmentId: '', 
      roomNumber: '', 
      capacity: 2,
      price_daily: 0,
      price_monthly: 0,
      price_semester: 0,
      amenities: [] as string[],
      has_kitchen: false,
      kitchen_details: [] as string[],
      has_bathroom: false,
      bathroom_details: [] as string[]
    });
    setAddModalOpen(true);
  };

  const openEditModal = (room: any) => {
    setIsEditMode(true);
    setSelectedRoom(room);
    setFormData({ 
      apartmentId: room.apartment_id, 
      roomNumber: room.room_number, 
      capacity: room.capacity,
      price_daily: room.price_daily || 0,
      price_monthly: room.price_monthly || 0,
      price_semester: room.price_semester || 0,
      amenities: room.amenities ? JSON.parse(room.amenities) : [],
      has_kitchen: !!room.has_kitchen,
      kitchen_details: room.kitchen_details ? JSON.parse(room.kitchen_details) : [],
      has_bathroom: !!room.has_bathroom,
      bathroom_details: room.bathroom_details ? JSON.parse(room.bathroom_details) : []
    });
    setAddModalOpen(true);
  };
  const [formData, setFormData] = useState({
    apartmentId: '',
    roomNumber: '',
    capacity: 2,
    price_daily: 0,
    price_monthly: 0,
    price_semester: 0,
    amenities: [] as string[],
    has_kitchen: false,
    kitchen_details: [] as string[],
    has_bathroom: false,
    bathroom_details: [] as string[]
  });
  
  const canManageHousing = hasPermission(AppPermission.MANAGE_HOUSING);
  const canAddRoom = canManageHousing;
  const canEditRoom = canManageHousing;
  const canDeleteRoom = canManageHousing;
  const mounted = useMounted();

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request(`/api/rooms?page=${page}&limit=20`);
      if (mounted.current) {
        setRooms(response.data);
        setTotalPages(response.totalPages || 1);
        setTotal(response.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request, page]);

  const fetchApartments = useCallback(async () => {
    try {
      const resp = await request('/api/apartments');
      if (mounted.current) setApartments(resp.data);
    } catch (err) {
      console.error(err);
    }
  }, [request]);

  

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  const getOccupancyColor = (current: number, capacity: number) => {
    const ratio = current / capacity;
    if (ratio >= 1) return 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
    if (ratio >= 0.7) return 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
    return 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        await request(`/api/rooms/${selectedRoom.id}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
      } else {
        await request('/api/rooms', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setAddModalOpen(false);
      setFormData({ apartmentId: '', roomNumber: '', capacity: 2, price_daily: 0, price_monthly: 0, price_semester: 0, amenities: [], has_kitchen: false, kitchen_details: [], has_bathroom: false, bathroom_details: [] });
      fetchRooms();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل العملية', 'error');
    }
  };

  const handleDeleteClick = (room: any) => {
    setSelectedRoom(room);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedRoom) return;
    try {
      await request(`/api/rooms/${selectedRoom.id}`, { method: 'DELETE' });
      setRooms(rooms.filter((r: any) => r.id !== selectedRoom.id));
      setModalOpen(false);
    } catch (err: any) {
      showSnackbar(err.message || 'حدث خطأ أثناء الحذف', 'error');
      setModalOpen(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">إدارة الغرف</h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">تتبع توزيع الغرف وحالات الإشغال في السكن.</p>
        </div>
        {canAddRoom && (
          <button 
             onClick={openAddModal}
             className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 font-medium"
          >
            <Plus size={18} />
            <span>إضافة غرفة جديدة</span>
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-card-dark rounded-3xl border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-white/10 bg-slate-50/30 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="البحث برقم الغرفة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm dark:text-white"
            />
          </div>
          <button className="p-2 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
            <Filter size={20} />
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-right min-w-[700px]">
            <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-500 dark:text-slate-300 text-xs">
              <tr>
                <th className="px-8 py-4">رقم الغرفة</th>
                <th className="px-8 py-4">الشقة / العمارة</th>
                <th className="px-8 py-4">السعة</th>
                <th className="px-8 py-4">الإشغال الحالي</th>
                <th className="px-8 py-4">الحالة</th>
                <th className="px-8 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5 text-sm">
              {loading ? (
                [1,2,3].map(i =>                 <tr key={i} className="animate-pulse"><td colSpan={6} className="h-16 bg-slate-50/50 dark:bg-white/5" /></tr>)
              ) : filteredRooms.length > 0 ? filteredRooms.map((room: any) => (
                <tr key={room.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-4 font-bold text-slate-800 dark:text-white">غرفة {room.room_number}</td>
                  <td className="px-8 py-4 text-slate-500 dark:text-slate-300">
                     <div className="flex items-center gap-2">
                        <Building size={14} />
                        <span>{apartments.find((a: any) => a.id === room.apartment_id)?.name || 'غير محدد'}</span>
                     </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col gap-1.5 w-[140px]">
                      <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">إشغال الغرفة</span>
                         <span className={`text-[10px] font-black ${
                            room.current_occupancy >= room.capacity ? 'text-red-500' : 
                            (room.current_occupancy / room.capacity) >= 0.7 ? 'text-amber-500' : 'text-emerald-500'
                         }`}>
                           {Math.round((room.current_occupancy / room.capacity) * 100)}%
                         </span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden w-full relative border border-slate-200/50 dark:border-white/10">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(room.current_occupancy / room.capacity) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={`h-full rounded-full transition-all duration-500 ${getOccupancyColor(room.current_occupancy, room.capacity)}`}
                        ></motion.div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users size={10} className="text-slate-400 dark:text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{room.current_occupancy} من {room.capacity} طلاب</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      room.current_occupancy >= room.capacity ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {room.current_occupancy >= room.capacity ? 'ممتلئة' : 'متاحة'}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEditRoom && (
                        <button 
                          onClick={() => openEditModal(room)}
                          className="p-2 text-slate-400 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {canDeleteRoom && (
                        <button 
                          onClick={() => handleDeleteClick(room)}
                          className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg"
                          disabled={room.current_occupancy > 0}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-400 dark:text-slate-300">لا توجد غرف مسجلة حالياً</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </div>

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="حذف الغرفة"
        message={`هل أنت متأكد من حذف الغرفة "${selectedRoom?.room_number}"؟ لا يمكن حذف الغرف المشغولة بالطلاب.`}
      />

      <AnimatePresence>
        <RoomFormModal
          isOpen={addModalOpen}
          isEditMode={isEditMode}
          formData={formData}
          apartments={apartments}
          onFormDataChange={(data) => setFormData(data)}
          onSubmit={handleFormSubmit}
          onClose={() => setAddModalOpen(false)}
        />
      </AnimatePresence>
    </div>
  );
}
