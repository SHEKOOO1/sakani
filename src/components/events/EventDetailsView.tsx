import { motion } from 'motion/react';
import { Calendar, MapPin, UserPlus, Users, Plus, ShieldAlert } from 'lucide-react';
import QRCode from 'react-qr-code';
import { AppPermission } from '../../types/permissions';

interface EventDetailsViewProps {
  selectedEvent: any;
  hasPermission: (perm: AppPermission) => boolean;
  handleToggleParentEnroll: () => void;
  user: any;
  setFormData: (data: any | ((prev: any) => any)) => void;
  setTargeting: (data: any) => void;
  setPaymentMethods: (data: any) => void;
  setIsEditing: (val: boolean) => void;
  setModalOpen: (val: boolean) => void;
  loadTargetData: () => void;
  request: (url: string, options?: any) => Promise<any>;
  showSnackbar: (message: string, type?: any) => void;
  detailedAttendance: any[];
}

export function EventDetailsView({
  selectedEvent, hasPermission, handleToggleParentEnroll, user,
  setFormData, setTargeting, setPaymentMethods, setIsEditing, setModalOpen,
  loadTargetData, request, showSnackbar, detailedAttendance,
}: EventDetailsViewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="details" className="space-y-10">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none">{selectedEvent.title}</h2>
          <p className="text-slate-500 font-bold mt-4 max-w-xl">{selectedEvent.description}</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="p-6 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 shadow-lg">
            <QRCode value={selectedEvent.qr_code} size={150} fgColor="#fff" bgColor="transparent" />
          </div>
          {(hasPermission(AppPermission.EDIT_EVENT) || selectedEvent.canManage) && (
            <button onClick={async () => {
              const availMethods = selectedEvent.available_payment_methods
                ? (typeof selectedEvent.available_payment_methods === 'string' ? JSON.parse(selectedEvent.available_payment_methods) : selectedEvent.available_payment_methods) : [];
              const targetingData = selectedEvent.targeting
                ? (typeof selectedEvent.targeting === 'string' ? JSON.parse(selectedEvent.targeting) : selectedEvent.targeting) : {};

              setFormData({
                title: selectedEvent.title || '',
                description: selectedEvent.description || '',
                event_date: selectedEvent.event_date ? selectedEvent.event_date.split('T')[0] : '',
                location: selectedEvent.location || '',
                price: selectedEvent.price || 0,
                is_paid: !!selectedEvent.is_paid,
                is_competition: !!selectedEvent.is_competition,
                winning_threshold: selectedEvent.winning_threshold || 100,
                max_score: selectedEvent.max_score || 200,
                responsibleIds: [],
                location_lat: selectedEvent.location_lat?.toString() || '',
                location_lng: selectedEvent.location_lng?.toString() || '',
                location_radius: selectedEvent.location_radius || 50,
                qr_code: selectedEvent.qr_code || '',
                type: selectedEvent.type || 'event',
                registration_deadline: selectedEvent.registration_deadline ? selectedEvent.registration_deadline.split('T')[0] : '',
                available_payment_methods: availMethods,
                max_participants: selectedEvent.max_participants?.toString() || '',
              });
              setTargeting(targetingData);

              try {
                const resp = await request(`/api/events/${selectedEvent.id}/responsible`);
                if (resp.success) {
                  setFormData((prev: any) => ({
                    ...prev,
                    responsibleIds: (resp.data || []).map((r: any) => ({ id: r.user_id, name: r.name })),
                  }));
                }
              } catch (e) { console.error('Load responsible persons failed:', e); showSnackbar('فشل تحميل المسؤولين', 'error'); }
              await request('/api/payments/methods').then(res => {
                setPaymentMethods(res.data || []);
              }).catch(e => { console.error('Load payment methods failed:', e); showSnackbar('فشل تحميل وسائل الدفع', 'error'); });
              loadTargetData();

              setIsEditing(true);
              setModalOpen(true);
            }} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-500 hover:text-black transition-all text-xs font-black">
              <Plus size={14} />
              تعديل الفعالية
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-primary-50 dark:bg-primary-500/10 rounded-xl border border-primary-100 dark:border-primary-500/20 space-y-3">
          <Calendar className="text-primary-600 dark:text-primary-400" size={24} />
          <div>
            <p className="text-[10px] text-primary-500 dark:text-primary-400 font-black uppercase tracking-widest">تاريخ الفعالية</p>
            <h4 className="text-lg font-black text-slate-800 dark:text-white">{new Date(selectedEvent.event_date || Date.now()).toLocaleDateString('ar-EG', { dateStyle: 'full' })}</h4>
          </div>
        </div>
        <div className="p-6 bg-ocean-50 dark:bg-ocean-500/10 rounded-xl border border-ocean-100 dark:border-ocean-500/20 space-y-3">
          <MapPin className="text-ocean-600 dark:text-ocean-400" size={24} />
          <div>
            <p className="text-[10px] text-ocean-500 dark:text-ocean-400 font-black uppercase tracking-widest">المكان</p>
            <h4 className="text-lg font-black text-slate-800 dark:text-white">{selectedEvent.location}</h4>
          </div>
        </div>
        <div className="p-6 bg-warm-50 dark:bg-warm-500/10 rounded-xl border border-warm-100 dark:border-warm-500/20 space-y-3">
          <UserPlus className="text-warm-600 dark:text-warm-400" size={24} />
          <div>
            <p className="text-[10px] text-warm-500 dark:text-warm-400 font-black uppercase tracking-widest">المشتركين</p>
            <h4 className="text-3xl font-black text-slate-800 dark:text-white">
              {selectedEvent._subscription_count || 0}{selectedEvent.max_participants ? ` / ${selectedEvent.max_participants}` : ''}
            </h4>
          </div>
        </div>
        <div className="p-6 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-100 dark:border-rose-500/20 space-y-3">
          <Users className="text-rose-600 dark:text-rose-400" size={24} />
          <div>
            <p className="text-[10px] text-rose-500 dark:text-rose-400 font-black uppercase tracking-widest">إجمالي الحاضرين</p>
            <h4 className="text-3xl font-black text-slate-800 dark:text-white">{detailedAttendance.filter(a => a.status === 'present').length}</h4>
          </div>
        </div>
      </div>

      {(user?.role === 'supervisor' || user?.role === 'priest' || selectedEvent.canManage) && (
        <div className="p-6 bg-warm-50 dark:bg-warm-500/10 rounded-xl border border-warm-100 dark:border-warm-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ShieldAlert className="text-warm-500" size={24} />
              <div>
                <p className="text-[10px] text-warm-500 font-black uppercase tracking-widest">صلاحية ولي الأمر</p>
                <h4 className="text-lg font-black text-slate-800 dark:text-white">السماح باشتراك ولي الأمر</h4>
              </div>
            </div>
            <button
              onClick={handleToggleParentEnroll}
              className={`relative w-16 h-8 rounded-full transition-all ${
                selectedEvent.parent_can_enroll ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${
                  selectedEvent.parent_can_enroll ? 'right-1' : 'right-9'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-500 font-bold pr-1">
            {selectedEvent.parent_can_enroll
              ? 'ولي الأمر يمكنه تسجيل ابنه في هذه الفعالية'
              : 'ولي الأمر لا يمكنه تسجيل ابنه في هذه الفعالية'}
          </p>
        </div>
      )}
    </motion.div>
  );
}
