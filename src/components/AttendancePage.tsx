import { useState, useEffect, useRef, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { AppPermission } from '../types/permissions';
import { motion } from 'motion/react';
import { 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  AlertCircle,
  History,
  Clock,
  ArrowRightLeft,
  Loader2,
  Plane,
  Home,
  BarChart2,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSnackbar } from '../contexts/SnackbarContext';
import { TravelModal } from './attendance/TravelModal';

export function AttendancePage() {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [checkType, setCheckType] = useState<'entry' | 'exit'>('entry');
  const [activeTab, setActiveTab] = useState<'main' | 'stats'>('main');
  const [hourlyStats, setHourlyStats] = useState([]);
  
  const watchId = useRef<number | null>(null);
  const lastState = useRef<'inside' | 'outside' | null>(null);
  const [tenantLocation, setTenantLocation] = useState<any>(null);

  // Travel state
  const [isTraveling, setIsTraveling] = useState(false);
  const [showTravelModal, setShowTravelModal] = useState(false);
  const [travelForm, setTravelForm] = useState({ destination: '', reason: '' });
  const [travelLoading, setTravelLoading] = useState(false);

  const mounted = useMounted();
  const { showSuccess, showError, showInfo, confirm } = useSnackbar();
  const fetchTenantLocation = useCallback(async () => {
    try {
      const res = await request(`/api/tenants/${user?.tenantId}`);
      if (res.success && mounted.current) setTenantLocation(res.data);
    } catch (err) { console.error(err); }
  }, [request, user?.tenantId]);

  const fetchStudentStatus = useCallback(async () => {
    try {
      const response = await request('/api/users/profile');
      if (!mounted.current || !response.data?.student) return; // Ensure student data exists
      if (response.data?.student?.is_traveling) {
        setIsTraveling(true);
      }
    } catch (err) {
      console.error(err);
    }
  }, [request]);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await request(`/api/attendance/history/${user.id}`);
      if (mounted.current) setHistory(response.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [request, user?.id]);

  const loadRef = useRef(() => {});
  loadRef.current = () => { fetchHistory(); fetchStudentStatus(); fetchTenantLocation(); };

  useEffect(() => {

    loadRef.current();
    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  // وظيفة حساب المسافة في الواجهة (للرصد الأولي)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // تفعيل وضع الرصد التلقائي (العبور الذكي)
  useEffect(() => {
    if (isAutoMode && !isTraveling && tenantLocation) {
      setStatus('checking');
      setMessage('نظام العبور الذكي نشط.. يرجى إبقاء التطبيق مفتوحاً عند نقاط الدخول.');
      showSuccess('نظام العبور الذكي نشط.');
      
      watchId.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentCoords({ lat: latitude, lng: longitude });
          
          const entryDistance = calculateDistance(latitude, longitude, tenantLocation.location_lat, tenantLocation.location_lng);
          const isInsideEntryGeofence = entryDistance <= (tenantLocation.location_radius || 50);

          let isInsideExitGeofence = false;
          let exitDistance = null;
          if (tenantLocation.exit_lat && tenantLocation.exit_lng && tenantLocation.exit_radius) {
            exitDistance = calculateDistance(latitude, longitude, tenantLocation.exit_lat, tenantLocation.exit_lng);
            isInsideExitGeofence = exitDistance <= (tenantLocation.exit_radius || 50);
          } else {
            // If no explicit exit geofence, use entry geofence for both
            isInsideExitGeofence = isInsideEntryGeofence;
          }

          // Determine current state based on geofences
          let currentState: 'inside' | 'outside' | null = null;
          if (isInsideEntryGeofence || isInsideExitGeofence) { // If within either, consider "inside" the general area
            currentState = 'inside';
          } else {
            currentState = 'outside';
          }

          // Logic for automatic check-in/check-out
          if (currentState === 'inside' && lastState.current === 'outside') {
            // Student just entered the general area (could be entry or exit geofence)
            // Prioritize check-in if within entry geofence
            if (isInsideEntryGeofence) {
              await processAutoCheck('check-in', latitude, longitude);
              lastState.current = 'inside';
              showSuccess('تم تسجيل دخولك تلقائياً.');
            }
          } else if (currentState === 'outside' && lastState.current === 'inside') {
            // Student just left the general area (could be exiting entry or exit geofence)
            // Prioritize check-out if outside exit geofence
            if (!isInsideExitGeofence) { // If outside the exit geofence
              await processAutoCheck('check-out', latitude, longitude);
              lastState.current = 'outside';
              showSuccess('تم تسجيل خروجك تلقائياً.');
            }
          } else if (lastState.current === null) {
            // Initial state setup
            lastState.current = currentState;
          }
        },
        (err) => {
          showError('فشل الوصول إلى موقعك لتفعيل العبور الذكي.');
          setStatus('error');
        },
        { enableHighAccuracy: true }
      );
    } else {
      showInfo('تم إيقاف نظام العبور الذكي.');
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    }
  }, [isAutoMode, isTraveling, tenantLocation]);

  const processAutoCheck = async (type: string, lat: number, lng: number) => {
    try {
      const response = await request('/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ lat, lng, type })
      });
      // The backend now sends notifications, so frontend message can be simpler
      // showSuccess(response.message || `تم رصد ${type === 'check-in' ? 'دخولك' : 'خروجك'} تلقائياً ✅`);
      fetchHistory();
    } catch (err: any) { showError(err.message || "فشل التسجيل التلقائي."); console.error("Auto Check Error", err); }
  };

  const handleCheckIn = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('متصفحك لا يدعم خاصية تحديد الموقع.');
      return;
    }

    setLoading(true);
    setStatus('checking');
    setMessage('جاري تحديد موقعك الجغرافي...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        
        try {
          const type = checkType === 'entry' ? 'check-in' : 'check-out';
          const response = await request('/api/attendance/check-in', {
            method: 'POST',
            body: JSON.stringify({ lat: latitude, lng: longitude, type })
          });
          showSuccess(response.message || `تم تسجيل ${type === 'check-in' ? 'دخولك' : 'خروجك'} بنجاح.`);
          fetchHistory();
        } catch (err: any) {
          showError(err.message || 'فشل تسجيل السجل. تأكد من وجودك في النطاق المحدد.');
        } finally {
          setStatus('idle'); // Reset status after manual attempt
          setMessage('');
          setLoading(false);
        }
      },
      (error) => {
        setStatus('error');
        setMessage('فشل الوصول إلى موقعك. يرجى تفعيل GPS وإعطاء الإذن للمتصفح.');
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleTravelStart = async () => {
    if (!travelForm.destination || !travelForm.reason) {
      showError('يرجى إدخال الوجهة وسبب السفر');
      return;
    }
    setTravelLoading(true);
    try {
      await request('/api/students/travel/start', {
        method: 'POST',
        body: JSON.stringify(travelForm),
      });
      setIsTraveling(true);
      setShowTravelModal(false);
      showSuccess('تم تسجيل سفرك وإبلاغ المشرف وأولياء الأمور');
    } catch (err: any) {
      showError(err.message);
    } finally {
      setTravelLoading(false);
    }
  };

  const handleTravelEnd = async () => {
    setTravelLoading(true);
    try {
      await request('/api/students/travel/end', { method: 'POST' });
      setIsTraveling(false);
      showSuccess('حمداً لله على السلامة! تم تسجيل عودتك وإبلاغ المشرف وأولياء الأمور');
    } catch (err: any) {
      showError(err.message);
    } finally {
      setTravelLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-8 sm:p-10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter">نظام الحضور والانصراف</h1>
              <p className="text-white/70 mt-1 font-bold">سجل دخولك وخروجك بدقة عالية من أي مكان.</p>
            </div>
          </div>
          
          {!isTraveling ? (
            <button 
              onClick={() => setShowTravelModal(true)}
              className="flex items-center gap-2 px-6 py-3.5 bg-white/20 backdrop-blur-sm text-white rounded-2xl font-black hover:bg-white/30 transition-all border border-white/10"
            >
              <Plane size={18} /> أنا مسافر الآن
            </button>
          ) : (
            <div className="flex items-center gap-3">
               <div className="px-5 py-3 bg-amber-400/20 backdrop-blur-sm text-amber-200 rounded-2xl text-xs font-black animate-pulse flex items-center gap-2 border border-amber-400/20">
                  <Plane size={14} /> أنت في حالة سفر حالياً
               </div>
               <button 
                  onClick={handleTravelEnd}
                  disabled={travelLoading}
                  className="px-6 py-3.5 bg-white/20 backdrop-blur-sm text-white rounded-2xl font-black hover:bg-white/30 transition-all flex items-center gap-2 border border-white/10"
               >
                 {travelLoading ? <Loader2 size={18} className="animate-spin" /> : <Home size={18} />} عدت من السفر
               </button>
            </div>
          )}
        </div>
        <div className="absolute -top-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Auto Mode Toggle */}
      <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAutoMode ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            <Clock size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">العبور الذكي (تلقائي)</h3>
            <p className="text-sm text-slate-500">تسجيل الدخول والخروج تلقائياً عند عبور نقاط السكن.</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={isAutoMode} onChange={() => setIsAutoMode(!isAutoMode)} className="sr-only peer" disabled={isTraveling} />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {activeTab === 'main' ? (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Check-in Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-card-dark p-10 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm flex flex-col items-center text-center">
            
            <div className="flex p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl mb-8 w-fit border border-slate-200 dark:border-white/10">
              <button 
                onClick={() => setCheckType('entry')}
                className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${checkType === 'entry' ? 'bg-white dark:bg-card-dark text-emerald-600 dark:text-emerald-400 shadow-lg border border-slate-200 dark:border-white/10' : 'text-slate-400 dark:text-slate-300'}`}
              >
                تسجيل دخول
              </button>
              <button 
                onClick={() => setCheckType('exit')}
                className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${checkType === 'exit' ? 'bg-white dark:bg-card-dark text-ocean-600 dark:text-ocean-400 shadow-lg border border-slate-200 dark:border-white/10' : 'text-slate-400 dark:text-slate-300'}`}
              >
                تسجيل خروج
              </button>
            </div>

            <motion.div 
              animate={status === 'checking' ? { scale: [1, 1.1, 1], rotate: [0, 360] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className={`w-28 h-28 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl transition-all duration-500 ${
                status === 'success' ? 'bg-emerald-500 text-white shadow-emerald-200' : 
                status === 'error' ? 'bg-red-500 text-white shadow-red-200' : 
                checkType === 'entry' ? 'bg-emerald-600 text-white shadow-emerald-100' : 'bg-blue-600 text-white shadow-blue-100'
              }`}
            >
              {status === 'success' ? <CheckCircle2 size={56} /> : 
               status === 'error' ? <AlertCircle size={56} /> : 
               status === 'checking' ? <Loader2 size={56} className="animate-spin" /> :
               checkType === 'entry' ? <Navigation size={56} /> : <ArrowRightLeft size={56} />}
            </motion.div>

            <h2 className="text-2xl font-black text-slate-800 mb-2">
              {status === 'success' ? 'تمت العملية' : 
               status === 'error' ? 'حدث خطأ' : 
               checkType === 'entry' ? 'سجل دخولك الآن' : 'سجل خروجك الآن'}
            </h2>
            <p className="text-slate-500 max-w-sm mb-8 font-bold text-sm">
              {message || (checkType === 'entry' ? 'تأكد من وجودك عند باب الدخول الرسمي لتسجيل حضورك.' : 'تأكد من وجودك عند نقطة الخروج ليتم تسجيل انصرافك.')}
            </p>

            <button
               onClick={handleCheckIn}
               disabled={loading || isTraveling || isAutoMode}
               className={`py-5 px-16 text-sm font-black rounded-2xl transition-all active:scale-95 shadow-lg ${
                 status === 'success' ? 'bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10 opacity-50' : 
                 checkType === 'entry' ? 'bg-gradient-to-l from-emerald-600 to-emerald-500 text-white shadow-emerald-500/20 hover:brightness-110' : 'bg-gradient-to-l from-ocean-600 to-ocean-500 text-white shadow-ocean-500/20 hover:brightness-110'
               }`}
            >
               {loading ? 'جاري التحقق...' : 
                isTraveling ? 'أنت في حالة سفر' :
                status === 'success' ? 'تم التسجيل' : 
                checkType === 'entry' ? 'تأكيد الـ Check-in' : 'تأكيد الـ Check-out'}
            </button>

            {currentCoords && (
              <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-300 font-mono">
                <MapPin size={10} />
                <span>{currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}</span>
              </div>
            )}
          </div>

          <div className="bg-ocean-50 dark:bg-ocean-500/10 p-6 rounded-xl border border-ocean-100 dark:border-ocean-500/20 flex gap-4">
              <div className="p-2 bg-ocean-100 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400 rounded-xl h-fit">
                 <AlertCircle size={20} />
              </div>
              <div className="text-sm">
                 <h4 className="font-bold text-ocean-800 dark:text-ocean-200 mb-1">كيف يعمل النظام؟</h4>
                 <p className="text-ocean-700 dark:text-ocean-300 opacity-80 leading-relaxed">
                  النظام يستخدم تقنية Geofencing للتحقق من موقعك. يجب أن تكون داخل نطاق 300 متر من الاحداثيات الرسمية للسكن ليتم قبول طلبك. يرجى تفعيل خدمات الموقع (Location Services) في هاتفك.
                </p>
             </div>
          </div>
        </div>

        {/* History Section */}
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden h-fit">
           <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/20 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                 <History className="text-primary-600" size={20} />
                 <h3 className="font-bold text-slate-800 dark:text-white">السجل الأخير</h3>
              </div>
              
              {hasPermission(AppPermission.MANAGE_ATTENDANCE) && (
                <button 
                  onClick={async () => {
                    if(!await confirm({ message: 'هل تريد إرسال تنبيهات لجميع الطلاب الغائبين حالياً؟ سيتم إخطار أولياء أمورهم وتسجيل إنذار فوري.', type: 'warning' })) return;
                    try {
                      const res: any = await request('/api/attendance/notify-missing', { method: 'POST' });
                      showSuccess(res.message);
                    } catch(err: any) {
                      showError(err.message);
                    }
                  }}
                  className="p-2 text-warm-600 hover:bg-warm-50 dark:hover:bg-warm-500/10 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase ring-1 ring-warm-200 dark:ring-warm-500/20"
                  title="تنبيه الغائبين"
                >
                  <AlertCircle size={14} /> إرسال إشعارات الغياب
                </button>
              )}
           </div>
           
           <div className="divide-y divide-slate-50">
              {history.length > 0 ? history.slice(0, 5).map((entry: any) => (
                <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${entry.type === 'entry' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                         {entry.type === 'entry' ? <Navigation size={16} /> : <ArrowRightLeft size={16} />}
                      </div>
                      <div>
                         <p className="text-sm font-black text-slate-800">
                           {new Date(entry.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                         </p>
                         <p className="text-[10px] text-slate-400 font-bold">{new Date(entry.created_at).toLocaleDateString('ar-EG')}</p>
                      </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
                        entry.status === 'late' ? 'bg-red-50 text-red-500' : 
                        entry.type === 'entry' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {entry.status === 'late' ? 'تأخير' : entry.type === 'entry' ? 'دخول' : 'خروج'}
                      </span>
                   </div>
                </div>
              )) : (
                <div className="p-12 text-center text-slate-300">
                   <p className="text-sm">لا يوجد سجلات حتى الآن</p>
                </div>
              )}
           </div>
        </div>
      </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-card-dark p-10 rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <BarChart2 className="text-primary-500" /> تحليل ساعات الذروة (اليوم)
              </h3>
              <p className="text-sm text-slate-400 font-bold mt-1">يوضح الرسم البياني كثافة حركة الطلاب على مدار الساعة.</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 px-3 py-1 rounded-lg">
                  <TrendingUp size={12} /> دخول كثيف
               </div>
            </div>
          </div>

          <div className="h-100 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="دخول" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="خروج" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
      <TravelModal
        open={showTravelModal}
        onClose={() => setShowTravelModal(false)}
        destination={travelForm.destination}
        reason={travelForm.reason}
        onDestinationChange={value => setTravelForm({...travelForm, destination: value})}
        onReasonChange={value => setTravelForm({...travelForm, reason: value})}
        loading={travelLoading}
        onSubmit={handleTravelStart}
      />
    </div>
  );
}
