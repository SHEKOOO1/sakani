import React, { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building,
  Plus,
  Trash2,
  Edit2,
  LayoutGrid,
  Power,
  GripVertical,
  BedDouble,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ConfirmationModal } from './ConfirmationModal';
import { ApartmentFormModal } from './apartments/ApartmentFormModal';
import type { ApartmentRoomInput } from './apartments/ApartmentFormModal';
import { RoomFormModal } from './rooms/RoomFormModal';

type Room = {
  id: string;
  apartment_id: string;
  room_number: string;
  capacity: number;
  current_occupancy: number;
  is_active: number;
  sort_order?: number;
  price_daily?: number;
  price_monthly?: number;
  price_semester?: number;
  amenities?: string;
  has_kitchen?: number;
  kitchen_details?: string;
  has_bathroom?: number;
  bathroom_details?: string;
};

type Apartment = {
  id: string;
  name: string;
  building?: string;
  is_active: number;
  created_at: string;
  rooms_count: number;
  total_capacity: number;
  current_occupancy: number;
  available_rooms: number;
  empty_rooms: number;
  full_rooms: number;
  locked_rooms: number;
};

type RoomStatus = 'available' | 'occupied' | 'full' | 'locked';

const ROOM_STATUS: Record<RoomStatus, { label: string; dot: string; chip: string }> = {
  available: { label: 'متاحة', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' },
  occupied: { label: 'ساكنة', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30' },
  full: { label: 'ممتلئة', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30' },
  locked: { label: 'مقفولة', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15' },
};

function roomStatus(room: Room): RoomStatus {
  if (Number(room.is_active ?? 1) === 0) return 'locked';
  const occ = Number(room.current_occupancy || 0);
  const cap = Number(room.capacity || 0);
  if (cap > 0 && occ >= cap) return 'full';
  if (occ > 0) return 'occupied';
  return 'available';
}

const emptyAptForm = () => ({
  name: '',
  building: '',
  is_active: true,
  amenities: [] as string[],
  has_kitchen: false,
  kitchen_details: [] as string[],
  has_bathroom: false,
  bathroom_details: [] as string[],
  rooms: [] as ApartmentRoomInput[],
});

const emptyRoomForm = (apartmentId = '') => ({
  apartmentId,
  roomNumber: '',
  capacity: 2,
  is_active: true,
  price_daily: 0,
  price_monthly: 0,
  price_semester: 0,
  amenities: [] as string[],
  has_kitchen: false,
  kitchen_details: [] as string[],
  has_bathroom: false,
  bathroom_details: [] as string[],
});

const sortRooms = (list: Room[]) =>
  [...list].sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true });
  });

function BulkRoomsModal({
  isOpen,
  apartmentName,
  busy,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  apartmentName?: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (start: string, count: number, capacity: number) => void;
}) {
  const [start, setStart] = useState('101');
  const [count, setCount] = useState(4);
  const [capacity, setCapacity] = useState(2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-sm relative overflow-hidden text-right"
      >
        <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800 dark:text-white">إضافة دفعة غرف</h3>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600"><X /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300">الشقة: {apartmentName}</p>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">رقم البداية</label>
            <input type="text" value={start} onChange={(e) => setStart(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">العدد</label>
              <input type="number" min="1" value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold dark:text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">السعة</label>
              <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold dark:text-white" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400">سيتم إنشاء {count} غرفة بأرقام متتالية تبدأ من "{start}".</p>
          <button
            onClick={() => onConfirm(start, count, capacity)}
            disabled={busy}
            className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {busy ? 'جارٍ الإنشاء...' : 'إنشاء الغرف'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}


function SortableRoom({
  room,
  canManage,
  onEdit,
  onDelete,
  onToggle,
}: {
  room: Room;
  canManage: boolean;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  onToggle: (room: Room) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: room.id, disabled: !canManage });
  const meta = ROOM_STATUS[roomStatus(room)];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 p-3 rounded-2xl border ${meta.chip} ${isDragging ? 'opacity-70 ring-2 ring-blue-400 z-10' : ''}`}
    >
      {canManage && (
        <button {...attributes} {...listeners} aria-label="اسحب للترتيب" className="cursor-grab active:cursor-grabbing touch-none p-1 opacity-60 hover:opacity-100">
          <GripVertical size={16} />
        </button>
      )}
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="font-black text-sm truncate">غرفة {room.room_number}</div>
        <div className="text-[10px] font-bold opacity-80">{room.current_occupancy} / {room.capacity} · {meta.label}</div>
      </div>
      {canManage && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(room)}
            className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 ${Number(room.is_active ?? 1) === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}
            title={Number(room.is_active ?? 1) === 1 ? 'قفل الغرفة' : 'تفعيل الغرفة'}
          >
            <Power size={15} />
          </button>
          <button onClick={() => onEdit(room)} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-black/5 dark:hover:bg-white/10" title="تعديل">
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => onDelete(room)}
            disabled={Number(room.current_occupancy || 0) > 0}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="حذف"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function SortableApartmentCard({
  apt,
  canManage,
  expanded,
  onToggleExpand,
  onEdit,
  onToggleStatus,
  onDelete,
  rooms,
  roomsLoading,
  onAddRoom,
  onBulkHint,
  onEditRoom,
  onDeleteRoom,
  onToggleRoom,
  onReorderRooms,
}: {
  apt: Apartment;
  canManage: boolean;
  expanded: boolean;
  onToggleExpand: (apt: Apartment) => void;
  onEdit: (apt: Apartment) => void;
  onToggleStatus: (apt: Apartment) => void;
  onDelete: (apt: Apartment) => void;
  rooms: Room[];
  roomsLoading: boolean;
  onAddRoom: (apt: Apartment) => void;
  onBulkHint: (apt: Apartment) => void;
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
  onToggleRoom: (room: Room) => void;
  onReorderRooms: (apartmentId: string, ordered: Room[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: apt.id, disabled: !canManage });
  const roomSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const occupancyPct = apt.total_capacity > 0 ? Math.round((apt.current_occupancy / apt.total_capacity) * 100) : 0;

  const handleRoomDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rooms.findIndex((r) => r.id === active.id);
    const newIndex = rooms.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderRooms(apt.id, arrayMove(rooms, oldIndex, newIndex));
  };

  const stats: { label: string; value: number; className: string }[] = [
    { label: 'الغرف', value: apt.rooms_count, className: 'text-slate-700 dark:text-slate-200' },
    { label: 'الأسرّة', value: apt.total_capacity, className: 'text-slate-700 dark:text-slate-200' },
    { label: 'الطلبة', value: apt.current_occupancy, className: 'text-blue-600 dark:text-blue-400' },
    { label: 'متاحة', value: apt.available_rooms, className: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'فاضية', value: apt.empty_rooms, className: 'text-teal-600 dark:text-teal-400' },
    { label: 'ممتلئة', value: apt.full_rooms, className: 'text-red-600 dark:text-red-400' },
    { label: 'مقفولة', value: apt.locked_rooms, className: 'text-slate-500 dark:text-slate-400' },
  ];

  return (
    <motion.div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`bg-white dark:bg-card-dark p-6 rounded-3xl border border-slate-100 dark:border-white/[0.05] shadow-sm hover:shadow-md transition-all group ${isDragging ? 'opacity-80 ring-2 ring-blue-400 z-20' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          {canManage && (
            <button {...attributes} {...listeners} aria-label="اسحب لترتيب الشقق" className="cursor-grab active:cursor-grabbing touch-none p-1 text-slate-300 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-300">
              <GripVertical size={18} />
            </button>
          )}
          <div className="p-3 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Building size={24} />
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button onClick={() => onEdit(apt)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg" title="تعديل">
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => onToggleStatus(apt)}
              className={`p-2 rounded-lg transition-colors ${apt.is_active ? 'text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/20' : 'text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/20'}`}
              title={apt.is_active ? 'إيقاف الشقة' : 'تفعيل الشقة'}
            >
              <Power size={16} />
            </button>
            <button onClick={() => onDelete(apt)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg" title="حذف">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">{apt.name}</h3>
        {!apt.is_active && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">موقوفة</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300 text-sm mt-1">
        <LayoutGrid size={14} />
        <span>{apt.building || 'عمارة غير محددة'}</span>
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">إشغال الشقة</span>
          <span className={`text-[10px] font-black ${occupancyPct >= 100 ? 'text-red-500' : occupancyPct >= 70 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {occupancyPct}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden relative border border-slate-200/30 dark:border-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${occupancyPct}%` }}
            className={`h-full rounded-full ${occupancyPct >= 100 ? 'bg-red-500' : occupancyPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-slate-500 dark:text-slate-300">{apt.current_occupancy} من {apt.total_capacity} سرير</span>
          <span className="text-slate-400 dark:text-slate-300">{apt.total_capacity - apt.current_occupancy} متاح</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-50 dark:bg-white/5 rounded-xl py-2 text-center">
            <div className={`text-base font-black ${s.className}`}>{s.value}</div>
            <div className="text-[9px] font-bold text-slate-400 dark:text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-50 dark:border-white/10">
        <button
          onClick={() => onToggleExpand(apt)}
          className="w-full flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <span className="flex items-center gap-1.5">
            <BedDouble size={14} />
            {apt.rooms_count > 0 ? `عرض ${apt.rooms_count} غرفة` : 'لا توجد غرف'}
          </span>
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-dashed border-slate-100 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">الغرف</span>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => onAddRoom(apt)} className="flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline">
                      <Plus size={12} /> غرفة
                    </button>
                    <button onClick={() => onBulkHint(apt)} className="text-[10px] font-black text-slate-500 dark:text-slate-400 hover:underline">
                      دفعة
                    </button>
                  </div>
                )}
              </div>

              {roomsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 animate-pulse" />)}
                </div>
              ) : rooms.length > 0 ? (
                <DndContext sensors={roomSensors} collisionDetection={closestCenter} onDragEnd={handleRoomDragEnd}>
                  <SortableContext items={rooms.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {rooms.map((room) => (
                        <SortableRoom
                          key={room.id}
                          room={room}
                          canManage={canManage}
                          onEdit={onEditRoom}
                          onDelete={onDeleteRoom}
                          onToggle={onToggleRoom}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-center py-6 text-[11px] font-bold text-slate-400 dark:text-slate-300">
                  لا توجد غرف في هذه الشقة بعد
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {(['available', 'occupied', 'full', 'locked'] as RoomStatus[]).map((s) => (
                  <span key={s} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${ROOM_STATUS[s].dot}`} /> {ROOM_STATUS[s].label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ApartmentsPage() {
  const { request } = useApi();
  const { hasPermission } = useAuth();
  const { showSnackbar } = useSnackbar();
  const mounted = useMounted();
  const canManageHousing = hasPermission(AppPermission.MANAGE_HOUSING);

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [roomsByApt, setRoomsByApt] = useState<Record<string, Room[]>>({});
  const [roomsLoading, setRoomsLoading] = useState(false);

  const [aptModalOpen, setAptModalOpen] = useState(false);
  const [isEditingApt, setIsEditingApt] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Apartment | null>(null);
  const [aptForm, setAptForm] = useState(emptyAptForm());

  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoomForm());

  const [confirmApt, setConfirmApt] = useState<Apartment | null>(null);
  const [confirmRoom, setConfirmRoom] = useState<Room | null>(null);
  const [bulkTarget, setBulkTarget] = useState<Apartment | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const apartmentSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchApartments = useCallback(async () => {
    try {
      const response = await request('/api/apartments');
      if (mounted.current) setApartments(response.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [request, mounted]);

  const fetchRooms = useCallback(async (apartmentId: string) => {
    setRoomsLoading(true);
    try {
      const response = await request(`/api/rooms?apartmentId=${apartmentId}&limit=500`);
      if (mounted.current) {
        setRoomsByApt((prev) => ({ ...prev, [apartmentId]: sortRooms(response.data || []) }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (mounted.current) setRoomsLoading(false);
    }
  }, [request, mounted]);

  useEffect(() => {
    setLoading(true);
    fetchApartments().finally(() => { if (mounted.current) setLoading(false); });
  }, [fetchApartments, mounted]);

  const handleApartmentDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = apartments.findIndex((a) => a.id === active.id);
    const newIndex = apartments.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(apartments, oldIndex, newIndex);
    setApartments(next);
    try {
      await request('/api/apartments/reorder', { method: 'PUT', body: JSON.stringify({ order: next.map((a) => a.id) }) });
    } catch (err: any) {
      showSnackbar(err.message || 'فشل حفظ ترتيب الشقق', 'error');
      fetchApartments();
    }
  };

  const handleRoomReorder = async (apartmentId: string, ordered: Room[]) => {
    setRoomsByApt((prev) => ({ ...prev, [apartmentId]: ordered }));
    try {
      await request('/api/rooms/reorder', {
        method: 'PUT',
        body: JSON.stringify({ apartmentId, order: ordered.map((r) => r.id) }),
      });
    } catch (err: any) {
      showSnackbar(err.message || 'فشل حفظ ترتيب الغرف', 'error');
      fetchRooms(apartmentId);
    }
  };

  const toggleExpand = (apt: Apartment) => {
    if (expandedId === apt.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(apt.id);
    fetchRooms(apt.id);
  };

  const openAddApartment = () => {
    setIsEditingApt(false);
    setSelectedApt(null);
    setAptForm(emptyAptForm());
    setAptModalOpen(true);
  };

  const openEditApartment = (apt: Apartment) => {
    setIsEditingApt(true);
    setSelectedApt(apt);
    setAptForm({
      name: apt.name,
      building: apt.building || '',
      is_active: !!apt.is_active,
      amenities: (apt as any).amenities ? JSON.parse((apt as any).amenities) : [],
      has_kitchen: !!(apt as any).has_kitchen,
      kitchen_details: (apt as any).kitchen_details ? JSON.parse((apt as any).kitchen_details) : [],
      has_bathroom: !!(apt as any).has_bathroom,
      bathroom_details: (apt as any).bathroom_details ? JSON.parse((apt as any).bathroom_details) : [],
      rooms: [],
    });
    setAptModalOpen(true);
  };

  const handleApartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingApt && selectedApt) {
        await request(`/api/apartments/${selectedApt.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...aptForm,
            amenities: aptForm.amenities,
            kitchen_details: aptForm.kitchen_details,
            bathroom_details: aptForm.bathroom_details,
          }),
        });
      } else {
        await request('/api/apartments', {
          method: 'POST',
          body: JSON.stringify({
            ...aptForm,
            rooms: aptForm.rooms.filter((r) => r.roomNumber.trim()),
          }),
        });
      }
      setAptModalOpen(false);
      setAptForm(emptyAptForm());
      fetchApartments();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل حفظ بيانات السكن', 'error');
    }
  };

  const handleToggleApartmentStatus = async (apt: Apartment) => {
    try {
      const anyApt = apt as any;
      await request(`/api/apartments/${apt.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: apt.name,
          building: apt.building || '',
          is_active: !apt.is_active,
          amenities: anyApt.amenities ? JSON.parse(anyApt.amenities) : [],
          has_kitchen: !!anyApt.has_kitchen,
          kitchen_details: anyApt.kitchen_details ? JSON.parse(anyApt.kitchen_details) : [],
          has_bathroom: !!anyApt.has_bathroom,
          bathroom_details: anyApt.bathroom_details ? JSON.parse(anyApt.bathroom_details) : [],
        }),
      });
      fetchApartments();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل تحديث حالة السكن', 'error');
    }
  };

  const confirmDeleteApartment = async () => {
    if (!confirmApt) return;
    try {
      await request(`/api/apartments/${confirmApt.id}`, { method: 'DELETE' });
      setApartments(apartments.filter((a) => a.id !== confirmApt.id));
      if (expandedId === confirmApt.id) setExpandedId(null);
      setConfirmApt(null);
    } catch (err: any) {
      showSnackbar(err.message || 'حدث خطأ أثناء الحذف', 'error');
      setConfirmApt(null);
    }
  };

  const openAddRoom = (apt: Apartment) => {
    setIsEditingRoom(false);
    setSelectedRoom(null);
    setRoomForm(emptyRoomForm(apt.id));
    setRoomModalOpen(true);
  };

  const openBulkHint = (apt: Apartment) => {
    setBulkTarget(apt);
  };

  const handleBulkCreate = async (start: string, count: number, capacity: number) => {
    if (!bulkTarget) return;
    setBulkBusy(true);
    try {
      const startNum = parseInt(start, 10);
      const total = Math.max(1, Math.min(60, count));
      const cap = Math.max(1, capacity);
      for (let i = 0; i < total; i++) {
        const roomNumber = isNaN(startNum) ? `${start}-${i + 1}` : String(startNum + i);
        await request('/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ apartmentId: bulkTarget.id, roomNumber, capacity: cap }),
        });
      }
      const apartmentId = bulkTarget.id;
      setBulkTarget(null);
      fetchRooms(apartmentId);
      fetchApartments();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل إنشاء الغرف', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const openEditRoom = (room: Room) => {
    setIsEditingRoom(true);
    setSelectedRoom(room);
    setRoomForm({
      apartmentId: room.apartment_id,
      roomNumber: room.room_number,
      capacity: room.capacity,
      is_active: Number(room.is_active ?? 1) === 1,
      price_daily: Number(room.price_daily || 0),
      price_monthly: Number(room.price_monthly || 0),
      price_semester: Number(room.price_semester || 0),
      amenities: room.amenities ? JSON.parse(room.amenities) : [],
      has_kitchen: !!room.has_kitchen,
      kitchen_details: room.kitchen_details ? JSON.parse(room.kitchen_details) : [],
      has_bathroom: !!room.has_bathroom,
      bathroom_details: room.bathroom_details ? JSON.parse(room.bathroom_details) : [],
    });
    setRoomModalOpen(true);
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingRoom && selectedRoom) {
        await request(`/api/rooms/${selectedRoom.id}`, { method: 'PUT', body: JSON.stringify(roomForm) });
      } else {
        await request('/api/rooms', { method: 'POST', body: JSON.stringify(roomForm) });
      }
      const apartmentId = roomForm.apartmentId;
      setRoomModalOpen(false);
      setRoomForm(emptyRoomForm());
      if (apartmentId) fetchRooms(apartmentId);
      fetchApartments();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل العملية', 'error');
    }
  };

  const handleToggleRoom = async (room: Room) => {
    try {
      await request(`/api/rooms/${room.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          apartmentId: room.apartment_id,
          roomNumber: room.room_number,
          capacity: room.capacity,
          is_active: Number(room.is_active ?? 1) === 1 ? 0 : 1,
          price_daily: Number(room.price_daily || 0),
          price_monthly: Number(room.price_monthly || 0),
          price_semester: Number(room.price_semester || 0),
          amenities: room.amenities ? JSON.parse(room.amenities) : [],
          has_kitchen: !!room.has_kitchen,
          kitchen_details: room.kitchen_details ? JSON.parse(room.kitchen_details) : [],
          has_bathroom: !!room.has_bathroom,
          bathroom_details: room.bathroom_details ? JSON.parse(room.bathroom_details) : [],
        }),
      });
      fetchRooms(room.apartment_id);
      fetchApartments();
    } catch (err: any) {
      showSnackbar(err.message || 'فشل تحديث حالة الغرفة', 'error');
    }
  };

  const confirmDeleteRoom = async () => {
    if (!confirmRoom) return;
    try {
      await request(`/api/rooms/${confirmRoom.id}`, { method: 'DELETE' });
      fetchRooms(confirmRoom.apartment_id);
      fetchApartments();
      setConfirmRoom(null);
    } catch (err: any) {
      showSnackbar(err.message || 'حدث خطأ أثناء الحذف', 'error');
      setConfirmRoom(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">إدارة الشقق والغرف</h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">نظّم الشقق، أنشئ الغرف داخلها، ورتّبها بالسحب والإفلات.</p>
        </div>
        {canManageHousing && (
          <button
            onClick={openAddApartment}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 font-medium"
          >
            <Plus size={18} />
            <span>إضافة شقة جديدة</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-500 dark:text-slate-300">
        {(['available', 'occupied', 'full', 'locked'] as RoomStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${ROOM_STATUS[s].dot}`} />
            {ROOM_STATUS[s].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-slate-400">
          <GripVertical size={13} /> اسحب الأيقونة لترتيب الشقق والغرف
        </span>
      </div>

      <DndContext sensors={apartmentSensors} collisionDetection={closestCenter} onDragEnd={handleApartmentDragEnd}>
        <SortableContext items={apartments.map((a) => a.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-64 bg-white dark:bg-card-dark rounded-3xl animate-pulse border border-slate-100 dark:border-white/[0.05]" />)
            ) : apartments.length > 0 ? (
              apartments.map((apt) => (
                <SortableApartmentCard
                  key={apt.id}
                  apt={apt}
                  canManage={canManageHousing}
                  expanded={expandedId === apt.id}
                  onToggleExpand={toggleExpand}
                  onEdit={openEditApartment}
                  onToggleStatus={handleToggleApartmentStatus}
                  onDelete={(a) => setConfirmApt(a)}
                  rooms={roomsByApt[apt.id] || []}
                  roomsLoading={expandedId === apt.id && roomsLoading}
                  onAddRoom={openAddRoom}
                  onBulkHint={openBulkHint}
                  onEditRoom={openEditRoom}
                  onDeleteRoom={(r) => setConfirmRoom(r)}
                  onToggleRoom={handleToggleRoom}
                  onReorderRooms={handleRoomReorder}
                />
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-white dark:bg-card-dark rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10">
                <Building className="mx-auto text-slate-200 dark:text-slate-600 mb-4" size={48} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">لا توجد شقق مسجلة</h3>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <ConfirmationModal
        isOpen={!!confirmApt}
        onClose={() => setConfirmApt(null)}
        onConfirm={confirmDeleteApartment}
        title="حذف الشقة"
        message={`هل أنت متأكد من حذف هذه الشقة "${confirmApt?.name}"؟ سيتم حذف جميع الغرف المرتبطة بها أيضاً.`}
      />

      <ConfirmationModal
        isOpen={!!confirmRoom}
        onClose={() => setConfirmRoom(null)}
        onConfirm={confirmDeleteRoom}
        title="حذف الغرفة"
        message={`هل أنت متأكد من حذف الغرفة "${confirmRoom?.room_number}"؟ لا يمكن حذف الغرف المشغولة بالطلاب.`}
      />

      <ApartmentFormModal
        isOpen={aptModalOpen}
        isEditing={isEditingApt}
        formData={aptForm}
        onFormDataChange={(data) => setAptForm(data)}
        onSubmit={handleApartmentSubmit}
        onClose={() => setAptModalOpen(false)}
      />

      <AnimatePresence>
        {roomModalOpen && (
          <RoomFormModal
            isOpen={roomModalOpen}
            isEditMode={isEditingRoom}
            formData={roomForm}
            apartments={apartments}
            onFormDataChange={(data) => setRoomForm(data)}
            onSubmit={handleRoomSubmit}
            onClose={() => setRoomModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkTarget && (
          <BulkRoomsModal
            isOpen={!!bulkTarget}
            apartmentName={bulkTarget?.name}
            busy={bulkBusy}
            onClose={() => setBulkTarget(null)}
            onConfirm={handleBulkCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
