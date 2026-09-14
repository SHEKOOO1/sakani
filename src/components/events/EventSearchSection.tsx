import { Search, Calendar } from 'lucide-react';
import { EventCard } from './EventCard';

interface EventSearchSectionProps {
  events: any[];
  eventSearch: string;
  onSearchChange: (val: string) => void;
  user: any;
  joining: boolean;
  onMarkAttendance: (eventId: string) => void;
  onSelectEvent: (event: any) => void;
  request: any;
  setDetailEvent: (e: any) => void;
  setShowEventDetail: (v: boolean) => void;
  setMySubscription: (s: any) => void;
  setSelectedPaymentMethod: (v: string) => void;
  setReceiptFile: (f: File | null) => void;
  setReceiptPreview: (v: string) => void;
  setSubscribePaymentMethods: (m: any[]) => void;
}

export function EventSearchSection({
  events, eventSearch, onSearchChange, user, joining, onMarkAttendance, onSelectEvent, request,
  setDetailEvent, setShowEventDetail, setMySubscription, setSelectedPaymentMethod, setReceiptFile, setReceiptPreview, setSubscribePaymentMethods
}: EventSearchSectionProps) {
  return (
    <>
      <div className="relative max-w-md">
        <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={eventSearch} onChange={e => onSearchChange(e.target.value)}
          placeholder="ابحث عن فعالية..."
          className="w-full pr-12 pl-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-400/50 font-bold" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {events.filter((e: any) => {
        if (!eventSearch) return true;
        const q = eventSearch.toLowerCase();
        return e.title?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q);
      }).map((event: any) => {
        const isSimpleView = user?.role === 'parent' || user?.role === 'student';
        const userSub = event._user_subscription;
        return (
          <EventCard
            key={event.id}
            event={event}
            user={user}
            isSimpleView={isSimpleView}
            userSub={userSub}
            joining={joining}
            onMarkAttendance={onMarkAttendance}
            onShowDetail={(e, sub) => {
              setDetailEvent(e);
              setShowEventDetail(true);
              setMySubscription(sub);
            }}
            onSelectEvent={onSelectEvent}
            request={request}
            setDetailEvent={setDetailEvent}
            setShowEventDetail={setShowEventDetail}
            setMySubscription={setMySubscription}
            setSelectedPaymentMethod={setSelectedPaymentMethod}
            setReceiptFile={setReceiptFile}
            setReceiptPreview={setReceiptPreview}
            setSubscribePaymentMethods={setSubscribePaymentMethods}
          />
        );
      })}
      {events.filter((e: any) => {
        if (!eventSearch) return true;
        const q = eventSearch.toLowerCase();
        return e.title?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q);
      }).length === 0 && (
        <div className="col-span-full py-40 neon-card border-dashed flex flex-col items-center gap-6">
          <div className="p-8 bg-slate-100 dark:bg-white/5 rounded-full text-slate-400">
            <Calendar size={60} />
          </div>
          <div className="text-center">
            <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">لا توجد فعاليات</h4>
            <p className="text-slate-400 font-bold">ابدأ بإضافة أول فعالية للمجمع السكني</p>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
