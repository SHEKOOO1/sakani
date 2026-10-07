import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Wrench, Trophy, Clock, Waves, 
  Calendar, ChevronLeft, Bell, Star,
  Plane, Home, MessageSquare, AlertCircle, Megaphone,
  X, CheckCircle2, Loader2, BookOpen, Sparkles
} from 'lucide-react';
import { useSnackbar } from '../contexts/SnackbarContext';

export function Dashboard({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { request } = useApi();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joiningLaundry, setJoiningLaundry] = useState(false);
  const [isTraveling, setIsTraveling] = useState(false);
  const [showTravelModal, setShowTravelModal] = useState(false);
  const [travelForm, setTravelForm] = useState({ destination: '', reason: '' });
  const [travelLoading, setTravelLoading] = useState(false);
  const [dailyReadings, setDailyReadings] = useState<any>(null);
  const [dailyReadingsLoading, setDailyReadingsLoading] = useState(false);
  const [dailyReadingsError, setDailyReadingsError] = useState<string | null>(null);
  const { showSuccess, showError } = useSnackbar();

  const mounted = useMounted();

  const fetchStats = useCallback(async () => {
    try {
      const resp = await request('/api/dashboard/student-summary');
      if (!mounted.current) return;
      setStats(resp.data);
      if (resp.data?.isTraveling) setIsTraveling(true);
    } catch (err) { console.error(err); showError('فشل تحميل بيانات لوحة التحكم'); }
    finally { if (mounted.current) setLoading(false); }
  }, [request]);

  const fetchDailyReadings = useCallback(async () => {
    if (user?.daily_readings_enabled === false) return;
    setDailyReadingsLoading(true);
    setDailyReadingsError(null);
    try {
      const resp = await request('/api/dashboard/daily-readings');
      if (!mounted.current) return;
      if (resp.success && resp.data && resp.data.enabled) setDailyReadings(resp.data);
      else if (resp.success && resp.data && resp.data.enabled === false) setDailyReadings({ disabled: true });
      else setDailyReadingsError(resp.message || 'فشل تحميل قراءة اليوم');
    } catch (err: any) { setDailyReadingsError(err.message || 'فشل تحميل قراءة اليوم'); }
    finally { if (mounted.current) setDailyReadingsLoading(false); }
  }, [request, user?.daily_readings_enabled]);

  useEffect(() => {

    fetchStats();
    fetchDailyReadings();
    
  }, [fetchStats, fetchDailyReadings]);

  const handleJoinLaundry = async () => {
    setJoiningLaundry(true);
    try {
      await request('/api/laundry/queue/join', { method: 'POST', body: JSON.stringify({}) });
      await fetchStats();
    } catch (err: any) { showError(err.message || 'فشل الانضمام للطابور'); }
    finally { setJoiningLaundry(false); }
  };

  const handleTravelStart = async () => {
    if (!travelForm.destination || !travelForm.reason) { showError('يرجى إدخال الوجهة وسبب السفر'); return; }
    setTravelLoading(true);
    try {
      await request('/api/students/travel/start', { method: 'POST', body: JSON.stringify(travelForm) });
      setIsTraveling(true);
      setShowTravelModal(false);
      showSuccess('تم تسجيل سفرك بنجاح وإبلاغ الأهل والمشرف');
      fetchStats();
    } catch (err: any) { showError(err.message); }
    finally { setTravelLoading(false); }
  };

  const handleTravelEnd = async () => {
    setTravelLoading(true);
    try {
      await request('/api/students/travel/end', { method: 'POST' });
      setIsTraveling(false);
      showSuccess('مرحباً بعودتك! تم إخطار الجميع بسلامة وصولك');
      fetchStats();
    } catch (err: any) { showError(err.message); }
    finally { setTravelLoading(false); }
  };

  if (loading) return <div className="p-10 animate-pulse text-slate-400 dark:text-slate-300 font-bold">جاري تحميل بياناتك الشخصية...</div>;

  return (
    <div className="space-y-5" dir="rtl">

      {/* Daily Messages */}
      {stats?.dailyMessages?.length > 0 && (
        <div className="space-y-3">
          {stats.dailyMessages.map((msg: any) => (
            <div key={msg.id} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-6 text-white shadow-xl">
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                  <Megaphone size={28} />
                </div>
                <div>
                  <h3 className="font-black mb-1">{msg.title}</h3>
                  <p className="text-white/70 font-bold text-sm leading-relaxed">{msg.content || msg.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Welcome Header */}
      <div className={`relative overflow-hidden rounded-xl p-6 text-white shadow-xl transition-colors duration-500 ${isTraveling ? 'bg-gradient-to-br from-vibrant-800 to-primary-900' : 'bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700'}`}>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">أهلاً بك، {user?.name?.split(' ')[0] || 'مستخدم'}!</h2>
              <p className="text-white/70 font-bold text-sm">
                {isTraveling 
                  ? 'أنت الآن في وضع السفر، رحلة سعيدة وعودة حميدة بإذن الله.'
                  : `لديك ${stats?.activeMaintenance} بلاغات صيانة نشطة و ${stats?.totalPoints} نقطة سلوك.`}
              </p>
            </div>
          </div>
          
          {!isTraveling ? (
            <button onClick={() => setShowTravelModal(true)}
              className="flex items-center gap-2 rounded-xl bg-white/15 px-6 py-3 text-xs font-black backdrop-blur-sm transition-all hover:bg-white/25"
            >
              <Plane size={18} /> أنا مسافر الآن
            </button>
          ) : (
            <button onClick={handleTravelEnd} disabled={travelLoading}
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-xs font-black text-primary-700 shadow-lg transition-all hover:bg-slate-100"
            >
              {travelLoading ? <Loader2 size={18} className="animate-spin" /> : <Home size={18} />} عدت من السفر
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Quick Attendance Card */}
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-50 text-ocean-600 dark:bg-ocean-500/10 dark:text-ocean-400"><MapPin size={20} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-300">الحضور اليومي</span>
          </div>
          <h3 className="font-black text-slate-800 dark:text-white mb-1">
            {isTraveling ? 'معفى (مسافر)' : stats?.attendanceStatus === 'check-in' ? 'أنت داخل السكن' : 'خارج السكن حالياً'}
          </h3>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-300 mb-4">آخر تحديث: {stats?.lastCheckIn ? new Date(stats.lastCheckIn).toLocaleTimeString('ar-EG') : 'لم يتم التسجيل'}</p>
          <button onClick={() => onNavigate?.('attendance')} disabled={isTraveling}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-3 text-xs font-black text-slate-600 transition-all hover:bg-primary-600 hover:text-white dark:bg-white/5 dark:text-slate-300 dark:hover:bg-primary-600 dark:hover:text-white"
          >
            فتح صفحة التحضير <ChevronLeft size={15} />
          </button>
        </div>

        {/* Points Summary */}
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-50 text-warm-600 dark:bg-warm-500/10 dark:text-warm-400"><Trophy size={20} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-300">رصيد السلوك</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800 dark:text-white">{stats?.totalPoints}</span>
            <span className="text-sm font-bold text-slate-400 dark:text-slate-300">نقطة</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-l from-primary-500 to-vibrant-500" style={{ width: `${Math.min((stats?.totalPoints || 0) / 2000 * 100, 100)}%` }} />
          </div>
        </div>

        {/* Quick Action: Laundry */}
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"><Waves size={20} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-300">المغسلة</span>
          </div>
          
          {stats?.laundry?.userPosition ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-primary-600 dark:text-primary-400">#{stats.laundry.userPosition}</span>
                <span className="text-xs font-bold text-slate-400">دورك في الطابور</span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">الحالة: {stats.laundry.status === 'washing' ? 'جاري الغسيل الآن' : 'قيد الانتظار'}</p>
              <button onClick={() => onNavigate?.('laundry')} className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline">عرض تفاصيل الطابور</button>
            </div>
          ) : (
            <>
              <h3 className="font-black text-slate-800 dark:text-white mb-1">اريد الغسيل الان</h3>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-300 mb-4">يوجد حالياً {stats?.laundry?.totalInQueue || 0} طلاب في قائمة الانتظار.</p>
              <button onClick={handleJoinLaundry} disabled={joiningLaundry}
                className="w-full rounded-xl bg-primary-600 py-3 text-xs font-black text-white shadow-lg transition-all hover:bg-primary-700 disabled:opacity-50"
              >
                {joiningLaundry ? 'جاري الحجز...' : 'احجز دوري الآن'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Daily Readings */}
      {dailyReadings?.disabled ? null : dailyReadings ? (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-ocean-600 to-ocean-700 p-6 text-white shadow-xl">
          <div className="relative z-10 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <BookOpen size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black mb-0.5">قراءة اليوم</h3>
              {dailyReadings.bibleVerse && (
                <p className="text-white/80 text-sm leading-relaxed font-medium mt-2">
                  &ldquo;{dailyReadings.bibleVerse.length > 300 ? dailyReadings.bibleVerse.substring(0, 300) + '...' : dailyReadings.bibleVerse}&rdquo;
                </p>
              )}
              {dailyReadings.gospelOfTheDay && <p className="text-white/50 text-xs font-bold mt-2">— {dailyReadings.gospelOfTheDay}</p>}
            </div>
          </div>
        </div>
      ) : dailyReadingsLoading ? (
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse dark:bg-white/5" />
      ) : null}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction icon={<Wrench size={20} />} label="طلب صيانة" onClick={() => onNavigate?.('maintenance')} color="rose" />
        <QuickAction icon={<Calendar size={20} />} label="الفعاليات" onClick={() => onNavigate?.('events')} color="primary" />
        <QuickAction icon={<MessageSquare size={20} />} label="الرسائل" onClick={() => onNavigate?.('messages')} color="vibrant" />
        <QuickAction icon={<Star size={20} />} label="المكافآت" onClick={() => onNavigate?.('rewards')} color="warm" />
      </div>

      {/* Travel Modal */}
      <AnimatePresence>
        {showTravelModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowTravelModal(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="rounded-xl bg-white p-6 max-w-md w-full shadow-2xl dark:bg-card-dark border border-slate-100 dark:border-white/10" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/20"><Plane size={20} className="text-primary-600 dark:text-primary-400" /></div>
                  <h3 className="font-black text-slate-800 dark:text-white">تسجيل سفر</h3>
                </div>
                <button onClick={() => setShowTravelModal(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">الوجهة</label>
                  <input type="text" value={travelForm.destination} onChange={e => setTravelForm(f => ({ ...f, destination: e.target.value }))} placeholder="مثال: المنيا"
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-300 transition-all dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">سبب السفر</label>
                  <textarea value={travelForm.reason} onChange={e => setTravelForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="اذكر سبب السفر..."
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-300 transition-all resize-none dark:text-white" />
                </div>
                <button onClick={handleTravelStart} disabled={travelLoading}
                  className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 transition-all disabled:opacity-50 shadow-lg"
                >
                  {travelLoading ? 'جاري التسجيل...' : 'تأكيد السفر'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickAction({ icon, label, onClick, color }: any) {
  const colors: any = {
    rose: 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white dark:group-hover:bg-rose-500',
    primary: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white dark:group-hover:bg-primary-500',
    vibrant: 'bg-vibrant-50 dark:bg-vibrant-500/20 text-vibrant-600 dark:text-vibrant-400 group-hover:bg-vibrant-600 group-hover:text-white dark:group-hover:bg-vibrant-500',
    warm: 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400 group-hover:bg-warm-600 group-hover:text-white dark:group-hover:bg-warm-500',
  };
  return (
    <button onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-card-dark"
    >
      <div className={`rounded-xl p-3 transition-colors ${colors[color]}`}>{icon}</div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</span>
    </button>
  );
}
