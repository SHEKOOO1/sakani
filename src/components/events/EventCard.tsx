import { Calendar, MapPin, Users, DollarSign, Smartphone, Eye, Check, Clock, X, ChevronLeft } from 'lucide-react';

interface EventCardProps {
  event: any;
  user: any;
  isSimpleView: boolean;
  userSub: any;
  joining: boolean;
  onMarkAttendance: (eventId: string) => void;
  onShowDetail: (event: any, sub: any) => void;
  onSelectEvent: (event: any) => void;
  request: (url: string, options?: any) => Promise<any>;
  setDetailEvent: (e: any) => void;
  setShowEventDetail: (v: boolean) => void;
  setMySubscription: (s: any) => void;
  setSelectedPaymentMethod: (m: string) => void;
  setReceiptFile: (f: any) => void;
  setReceiptPreview: (p: string) => void;
  setSubscribePaymentMethods: (m: any[]) => void;
}

export function EventCard({
  event, user, isSimpleView, userSub, joining,
  onMarkAttendance, onShowDetail, onSelectEvent,
  request, setDetailEvent, setShowEventDetail, setMySubscription,
  setSelectedPaymentMethod, setReceiptFile, setReceiptPreview,
  setSubscribePaymentMethods
}: EventCardProps) {
  const loadPaymentMethods = (e: any) => {
    const availMethods = e.available_payment_methods
      ? (typeof e.available_payment_methods === 'string' ? JSON.parse(e.available_payment_methods) : e.available_payment_methods)
      : [];
    if (availMethods.length > 0 || e.is_paid) {
      request('/api/payments/methods').then(res => {
        const allMethods = res.data || [];
        setSubscribePaymentMethods(allMethods.filter((m: any) => availMethods.length === 0 || availMethods.includes(m.id)));
      }).catch(() => {});
    }
  };

  return (
    <div
      key={event.id}
      className={`bg-white dark:bg-card-dark p-8 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm group cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] ${
        isSimpleView ? 'hover:border-primary-300 dark:hover:border-primary-500/30' : 'hover:border-white/20'
      }`}
      onClick={() => {
        if (isSimpleView) {
          setDetailEvent(event);
          setShowEventDetail(true);
          setMySubscription(userSub || null);
          setSelectedPaymentMethod('');
          setReceiptFile(null);
          setReceiptPreview('');
          loadPaymentMethods(event);
        } else {
          onSelectEvent(event);
        }
      }}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="p-4 bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-2xl group-hover:rotate-12 transition-transform">
          <Calendar size={28} />
        </div>
        <div className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {new Date(event.event_date).toLocaleDateString('ar-EG')}
        </div>
      </div>
      <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight mb-3">{event.title}</h3>
      <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <span className="flex items-center gap-1.5">
          <MapPin size={12} /> {event.location}
        </span>
        <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
        <span className="flex items-center gap-1.5">
          <Users size={12} /> {event.is_paid ? `${event.price} ج.م` : 'مجاني'}
        </span>
      </div>
      {isSimpleView ? (
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-center gap-3">
            {event.max_participants && (
              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                (event._subscription_count || 0) >= event.max_participants
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}>
                <Users size={12} className="inline ml-1" />
                {event._subscription_count || 0}/{event.max_participants}
                {(event._subscription_count || 0) >= event.max_participants && ' (ممتلئ)'}
              </span>
            )}
            {event.is_paid && (
              <span className="text-[10px] text-warm-500 font-bold">
                <DollarSign size={12} className="inline ml-1" />
                {event.price} ج.م
              </span>
            )}
            {event.is_paid && (
              <span className="text-[10px] text-emerald-500 font-bold">
                <Smartphone size={12} className="inline ml-1" />
                دفع عبر InstaPay
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {user?.role === 'student' && !event.attendance_records?.length && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkAttendance(event.id); }}
                disabled={joining}
                className="flex-1 py-3 bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-2xl border border-primary-200 dark:border-primary-500/30 font-bold text-xs hover:bg-primary-600 hover:text-white dark:hover:bg-primary-500 transition-all disabled:opacity-50"
              >
                {joining ? 'جاري...' : 'تسجيل حضور'}
              </button>
            )}
            {user?.role === 'parent' && event.parent_can_enroll && !event.attendance_records?.find((a: any) => a.parent_user_id === user?.id) && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkAttendance(event.id); }}
                disabled={joining}
                className="flex-1 py-3 bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-2xl border border-primary-200 dark:border-primary-500/30 font-bold text-xs hover:bg-primary-600 hover:text-white dark:hover:bg-primary-500 transition-all disabled:opacity-50"
              >
                {joining ? 'جاري...' : 'تسجيل حضور'}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDetailEvent(event);
                setShowEventDetail(true);
                setMySubscription(event._user_subscription || null);
                setSelectedPaymentMethod('');
                setReceiptFile(null);
                setReceiptPreview('');
                loadPaymentMethods(event);
              }}
              className={`py-3 rounded-2xl border font-bold text-xs transition-all ${
                (event.attendance_records?.length || (user?.role === 'parent' && event.attendance_records?.find((a: any) => a.parent_user_id === user?.id)))
                  ? 'flex-1 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-neon-primary/30 hover:text-neon-primary'
                  : 'w-full bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-neon-primary/30 hover:text-neon-primary'
              }`}
            >
              <Eye size={14} className="inline ml-1" /> التفاصيل والاشتراك
            </button>
          </div>
          {(user?.role === 'student' && event.attendance_records?.length) || (user?.role === 'parent' && event.attendance_records?.find((a: any) => a.parent_user_id === user?.id)) ? (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 font-bold text-xs">
              <Check size={16} /> مسجل حضورك
            </div>
          ) : null}
          {userSub && userSub.status === 'approved' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 font-bold text-xs">
              <Check size={16} /> مشترك
            </div>
          )}
          {userSub && userSub.status === 'pending' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 font-bold text-xs">
              <Clock size={14} /> قيد المراجعة
            </div>
          )}
          {userSub && userSub.status === 'rejected' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 font-bold text-xs">
              <X size={16} /> تم الرفض
            </div>
          )}
          {userSub && userSub.status === 'cancelled' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-slate-500/10 text-slate-500 rounded-2xl border border-slate-500/20 font-bold text-xs">
              تم الإلغاء
            </div>
          )}
          {user?.role === 'parent' && !event.parent_can_enroll && (
            <div className="flex items-center justify-center gap-2 py-2 bg-slate-500/10 text-slate-500 rounded-2xl border border-slate-500/20 font-bold text-xs">
              غير متاح للتسجيل
            </div>
          )}
        </div>
      ) : (
        <div className="mt-10 pt-10 border-t border-slate-100 dark:border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] font-black text-neon-primary uppercase tracking-widest">
            فتح لوحة التحكم
          </span>
          <ChevronLeft size={16} className="text-neon-primary" />
        </div>
      )}
    </div>
  );
}
