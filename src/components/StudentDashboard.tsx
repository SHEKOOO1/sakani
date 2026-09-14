import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

import { MessagesSection } from './MessagesSection';
import { DailyReadingsCard } from './DailyReadingsCard';
import { motion, AnimatePresence } from 'motion/react';
import FinanceSummary from './student/FinanceSummary';
import RoomInfo from './student/RoomInfo';
import UpcomingEvents from './student/UpcomingEvents';
import RecentActivity from './student/RecentActivity';
import QRCode from 'react-qr-code';
import { 
  Trophy, Wrench, Waves, AlertTriangle,
  QrCode, RefreshCw, AlertCircle,
  CheckCircle2, Plus, Sparkles
} from 'lucide-react';

const cardVariants: any = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' }
  })
};

export function StudentDashboard({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { request } = useApi();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>({
    behavior: { points: 0, activeWarnings: 0 },
    laundryPosition: null,
    activeMaintenance: [],
    upcomingEvents: [],
    latestWarnings: [],
    recentActivity: [],
    roomInfo: null,
    finance: { totalInvoice: 0, totalPaid: 0, remaining: 0, roomPrice: 0, source: 'agreed', paymentPercent: 0, billingCycle: null, transactions: [] }
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [behaviorRes, laundryRes, maintenanceRes, eventsRes, historyRes, studentRes, financeRes] = await Promise.all([
        request('/api/students/behavior/my-summary'),
        request('/api/laundry/queue'),
        request('/api/maintenance/my'),
        request('/api/events'),
        request('/api/students/behavior/my-history'),
        request('/api/students/my-profile'),
        request('/api/students/finance/my-summary')
      ]);

      const queue = laundryRes.data || [];
      const userInQueue = queue.find((q: any) => q.user_id === user?.id);
      const position = userInQueue ? queue.indexOf(userInQueue) + 1 : null;

      setDashboardData({
        behavior: behaviorRes.data || { points: 0, activeWarnings: 0 },
        laundryPosition: position,
        activeMaintenance: (maintenanceRes.data || []).filter((r: any) => r.status !== 'completed'),
        upcomingEvents: (eventsRes.data || []).slice(0, 3),
        latestWarnings: (behaviorRes.data?.activeWarnings || 0),
        recentActivity: (historyRes.data || []).slice(0, 3),
        roomInfo: studentRes.data,
        finance: financeRes.data || { totalInvoice: 0, totalPaid: 0, remaining: 0, roomPrice: 0, source: 'agreed', paymentPercent: 0, billingCycle: null, transactions: [] }
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshing]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 500);
  };

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  if (loading) return (
    <div className="p-6 space-y-5">
      <div className="h-36 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  const hasCriticalWarnings = dashboardData.behavior.activeWarnings > 0;
  const points = dashboardData.behavior.points;
  const tier = points >= 2000 ? { label: 'بلاتيني', color: 'from-slate-700 to-slate-400', bg: 'bg-slate-500', border: 'border-slate-300' } :
               points >= 1000 ? { label: 'ذهبي', color: 'from-amber-500 to-yellow-300', bg: 'bg-amber-400', border: 'border-amber-300' } :
               points >= 500  ? { label: 'فضي', color: 'from-slate-400 to-slate-200', bg: 'bg-slate-300', border: 'border-slate-200' } :
                                { label: 'برونزي', color: 'from-orange-600 to-orange-400', bg: 'bg-orange-500', border: 'border-orange-300' };

  const paymentPercent = dashboardData.finance.totalInvoice > 0
    ? Math.min((dashboardData.finance.paymentPercent != null ? dashboardData.finance.paymentPercent : (dashboardData.finance.totalPaid / dashboardData.finance.totalInvoice) * 100), 100)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1440px] mx-auto" dir="rtl">
      <AnimatePresence>
        {refreshing && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 10 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-card-dark shadow-lg px-4 py-2.5 rounded-full border border-slate-200 dark:border-white/10 flex items-center gap-2"
          >
            <RefreshCw className="text-primary-600 animate-spin" size={15} />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">جارِ التحديث...</span>
          </motion.div>
        )}
      </AnimatePresence>
      


      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-6 text-white shadow-xl"
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-vibrant-300 rounded-full blur-3xl" />
        </div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${tier.color} p-[2px] shadow-lg`}>
              <div className="flex h-full w-full items-center justify-center rounded-[12px] bg-white/10 backdrop-blur-sm text-xl font-black">
                {user?.name?.[0]}
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black">سلام يا {user?.name?.split(' ')[0]}!</h1>
              <p className="text-white/70 font-bold text-sm">مرحباً بك في لوحة التحكم الخاصة بك</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${tier.border} bg-white/10 backdrop-blur-sm`}>
              <Trophy size={15} className="text-amber-300" />
              <span className="font-black text-sm">{tier.label}</span>
              <div className="h-4 w-px bg-white/20" />
              <span className="font-bold text-sm">{points.toLocaleString()}</span>
              <span className="text-xs text-white/60">نقطة</span>
            </div>
            
              <button onClick={handleManualRefresh} aria-label="تحديث" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><RefreshCw  size={15} className={refreshing ? 'animate-spin' : ''} />
            
              </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {hasCriticalWarnings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-xl bg-gradient-to-l from-rose-500 to-red-500 p-4 text-white shadow-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <AlertTriangle size={18} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-sm">تنبيه: لديك {dashboardData.behavior.activeWarnings} إنذار{dashboardData.behavior.activeWarnings > 1 ? 'ات' : ''} نشط{dashboardData.behavior.activeWarnings > 1 ? 'ة' : ''}</h4>
                  <p className="text-xs text-rose-100">يرجى مراجعة المشرف المقيم لتجنب اتخاذ إجراءات.</p>
                </div>
              </div>
              <button onClick={() => onNavigate?.('profile')} className="shrink-0 px-4 py-2 bg-white text-rose-600 rounded-xl font-black text-xs hover:bg-rose-50 transition-colors">عرض التفاصيل</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-50 dark:bg-ocean-500/20"><CheckCircle2 size={16} className="text-ocean-600 dark:text-ocean-400" /></div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-300">النقاط</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{points.toLocaleString()}</p>
          <div className="mt-2 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((points / 2000) * 100, 100)}%` }} className={`h-full bg-gradient-to-l ${tier.color}`} />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-medium mt-1.5">{tier.label} — الباقي {Math.max(2000 - points, 0)} للبلاتيني</p>
        </motion.div>

        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/20"><AlertCircle size={16} className="text-rose-600 dark:text-rose-400" /></div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-300">الإنذارات</span>
          </div>
          <p className={`text-2xl font-black ${dashboardData.behavior.activeWarnings > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{dashboardData.behavior.activeWarnings}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-medium mt-1.5">{dashboardData.behavior.activeWarnings > 0 ? 'إنذارات نشطة' : 'لا توجد إنذارات ✓'}</p>
        </motion.div>

        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warm-50 dark:bg-warm-500/20"><Wrench size={16} className="text-warm-600 dark:text-warm-400" /></div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-300">الصيانة</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{dashboardData.activeMaintenance.length}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-medium mt-1.5">{dashboardData.activeMaintenance.length > 0 ? 'طلبات قيد التنفيذ' : 'لا توجد طلبات ✓'}</p>
        </motion.div>

        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/20"><Waves size={16} className="text-primary-600 dark:text-primary-400" /></div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-300">المغسلة</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {dashboardData.laundryPosition ? `#${dashboardData.laundryPosition}` : '—'}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-medium mt-1.5">
            {dashboardData.laundryPosition ? 'دورك في الطابور' : 'لم تحجز اليوم'}
          </p>
        </motion.div>
      </div>

      <DailyReadingsCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <MessagesSection />
          
          <FinanceSummary finance={dashboardData.finance} paymentPercent={paymentPercent} />

          <RoomInfo roomInfo={dashboardData.roomInfo} />

          <motion.div custom={6} initial="hidden" animate="visible" variants={cardVariants} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <QrCode size={15} className="text-vibrant-600 dark:text-vibrant-400" />
              <h3 className="font-black text-sm text-slate-800 dark:text-white">كود الحضور</h3>
            </div>
            <div className="inline-block rounded-xl bg-white p-3 shadow-inner dark:bg-card-dark border-2 border-dashed border-vibrant-200 dark:border-vibrant-500/30">
              <QRCode value={user?.id || 'unknown'} size={110} viewBox="0 0 256 256" />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-300 font-medium mt-3">استخدمه لتسجيل حضورك في الفعاليات</p>
          </motion.div>
        </div>

        <UpcomingEvents events={dashboardData.upcomingEvents} onNavigate={onNavigate} />

        <div className="space-y-5">
          <RecentActivity activities={dashboardData.recentActivity} onNavigate={onNavigate} />

          <div className="grid grid-cols-2 gap-3">
            <motion.button custom={7} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate?.('maintenance')}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-rose-200 hover:shadow-md hover:bg-rose-50/30 dark:border-white/10 dark:bg-card-dark dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 group"
            >
              <div className="rounded-xl bg-rose-50 p-3 text-rose-600 transition-colors group-hover:bg-rose-600 group-hover:text-white dark:bg-rose-500/20 dark:text-rose-400 dark:group-hover:bg-rose-500 dark:group-hover:text-white">
                <Plus size={16} />
              </div>
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">طلب صيانة</span>
            </motion.button>
            
            <motion.button custom={8} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate?.('laundry')}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-primary-200 hover:shadow-md hover:bg-primary-50/30 dark:border-white/10 dark:bg-card-dark dark:hover:border-primary-500/30 dark:hover:bg-primary-500/10 group"
            >
              <div className="rounded-xl bg-primary-50 p-3 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white dark:bg-primary-500/20 dark:text-primary-400 dark:group-hover:bg-primary-500 dark:group-hover:text-white">
                <Waves size={16} />
              </div>
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">حجز غسيل</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
