import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, CheckCircle2, XCircle, Loader2, BellRing } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { getBestFix, isNativeApp } from '../../utils/location';

interface RollCallCard {
  rollCall: { id: string; lock_date: string; lock_time: string | null; state: string; notes: string | null };
  entry: {
    id: string;
    mark: string;
    presence_status: string | null;
    is_traveling: boolean;
    answer_at: string | null;
    answer_mark: string | null;
    answer_inside: number | boolean | null;
  };
}

type GeoState = 'idle' | 'loading' | 'inside' | 'outside' | 'unknown';

/**
 * The mandatory night roll-call popup shown to students.
 *
 * When the dorm closes, the server pushes a `roll-call-required` event and this
 * component raises a top-layer card ("are you inside the dorm?") that cannot be
 * dismissed until answered. It also reports whether the device is actually
 * inside the dorm geofence (server verdict). Traveling students are exempt and
 * never see it. Once answered, the card shows the recorded answer back.
 */
export function RollCallPrompt() {
  const { user, isLoading } = useAuth();
  const { request } = useApi();
  const isStudent = !isLoading && user?.role?.toLowerCase() === 'student';

  const [card, setCard] = useState<RollCallCard | null>(null);
  const [geo, setGeo] = useState<GeoState>('idle');
  const [distance, setDistance] = useState<number | null>(null);
  const [answering, setAnswering] = useState<null | 'present' | 'absent'>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await request('/api/students/roll-call/pending');
      setCard(res?.data ?? null);
    } catch {
      /* a failed poll just means we try again next tick */
    }
  }, [request]);

  // Fetch on mount + when the student identity settles.
  useEffect(() => {
    if (!isStudent) { setCard(null); return; }
    void fetchPending();
  }, [isStudent, fetchPending]);

  // Real-time: wake up / refresh the moment a new roll-call is pushed.
  useEffect(() => {
    if (!isStudent || !user?.id) return;
    const socket: Socket = io({ transports: ['websocket', 'polling'], withCredentials: true });
    socket.on('connect', () => {
      socket.emit('join-user', user.id);
      if (user.tenantId) socket.emit('join-tenant', user.tenantId);
    });
    socket.on('roll-call-required', () => {
      setDismissedFor(null);
      setGeo('idle');
      void fetchPending();
    });
    return () => { socket.disconnect(); };
  }, [isStudent, user?.id, user?.tenantId, fetchPending]);

  // Polling fallback so a dropped socket still surfaces the card.
  useEffect(() => {
    if (!isStudent) return;
    const id = setInterval(() => { void fetchPending(); }, 60_000);
    return () => clearInterval(id);
  }, [isStudent, fetchPending]);

  const needsAnswer = !!card && card.rollCall.state === 'open' && !card.entry.answer_at;
  const cardId = card?.rollCall.id;

  // Resolve the geofence once while a question is pending.
  // Resolve the geofence once while a question is pending.
  useEffect(() => {
    if (!needsAnswer || geo !== 'idle') return;
    if (!isNativeApp() && (typeof navigator === 'undefined' || !navigator.geolocation)) { setGeo('unknown'); return; }
    let cancelled = false;
    setGeo('loading');
    (async () => {
      try {
        const fix = await getBestFix({ highAccuracy: true, timeoutMs: 10000, maximumAgeMs: 30_000 });
        if (cancelled) return;
        coordsRef.current = { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy };
        const res = await request('/api/attendance/presence', {
          method: 'POST',
          body: JSON.stringify({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy }),
        });
        if (cancelled) return;
        setDistance(res?.data?.distance ?? null);
        setGeo(res?.data?.inside ? 'inside' : 'outside');
      } catch {
        if (!cancelled) setGeo('unknown');
      }
    })();
    return () => { cancelled = true; };
  }, [needsAnswer, geo, request]);

  // Reset transient state whenever a different roll-call becomes active.
  useEffect(() => {
    setGeo('idle');
    setDistance(null);
    coordsRef.current = null;
  }, [cardId]);

  const answer = async (value: 'present' | 'absent') => {
    if (!card) return;
    setAnswering(value);
    try {
      await request(`/api/students/roll-call/${card.rollCall.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ answer: value, ...(coordsRef.current || {}) }),
      });
      await fetchPending();
    } catch {
      /* keep the card; the student can retry */
    } finally {
      setAnswering(null);
    }
  };

  if (!isStudent || !card || card.rollCall.state !== 'open') return null;

  const answered = !!card.entry.answer_at;
  const inside =
    card.entry.answer_inside === 1 || card.entry.answer_inside === true ? 'inside'
    : card.entry.answer_inside === 0 || card.entry.answer_inside === false ? 'outside'
    : 'unknown';

  // Answered → a friendly confirmation the student can close. Unanswered → the
  // blocking question (no close, no escape, no backdrop dismissal).
  const visible = answered ? dismissedFor !== card.rollCall.id : true;
  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="roll-call-prompt"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-card-dark p-6 shadow-2xl border border-slate-100 dark:border-white/10"
            role="dialog"
            aria-modal="true"
            aria-label="نداء الليلة"
          >
            {!answered ? (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center animate-pulse">
                    <BellRing size={30} />
                  </div>
                  <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">نداء الليلة 🔔</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
                    ميعاد غلق السكن حان. من فضلك أكّد: هل أنت موجود في السكن الآن؟
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-center gap-2 text-xs font-black rounded-xl py-2.5 px-3 bg-slate-50 dark:bg-white/5">
                  {geo === 'loading' && <><Loader2 size={14} className="animate-spin text-slate-400" /><span className="text-slate-500 dark:text-slate-300">جاري التحقق من موقعك…</span></>}
                  {geo === 'inside' && <><MapPin size={14} className="text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">أنت داخل نطاق السكن ✓{distance != null ? ` (${distance}م)` : ''}</span></>}
                  {geo === 'outside' && <><MapPin size={14} className="text-rose-500" /><span className="text-rose-600 dark:text-rose-400">أنت خارج نطاق السكن{distance != null ? ` (${distance}م)` : ''}</span></>}
                  {geo === 'unknown' && <><MapPin size={14} className="text-amber-500" /><span className="text-amber-600 dark:text-amber-400">تعذّر تحديد موقعك بدقة</span></>}
                  {geo === 'idle' && <><MapPin size={14} className="text-slate-400" /><span className="text-slate-400">الموقع غير معروف</span></>}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <button
                    onClick={() => answer('present')}
                    disabled={!!answering}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 disabled:opacity-60 shadow-lg shadow-emerald-600/20"
                  >
                    {answering === 'present' ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    موجود في السكن
                  </button>
                  <button
                    onClick={() => answer('absent')}
                    disabled={!!answering}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white dark:bg-white/5 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 font-black hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-60"
                  >
                    {answering === 'absent' ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                    غير موجود
                  </button>
                </div>
                <p className="mt-3 text-center text-[11px] font-bold text-slate-400">
                  لازم تجيب على النداء ده — مش هتقدر تكمل غير لما تختار.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${card.entry.answer_mark === 'present' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                    {card.entry.answer_mark === 'present' ? <CheckCircle2 size={30} /> : <XCircle size={30} />}
                  </div>
                  <h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
                    تم تسجيل إجابتك: {card.entry.answer_mark === 'present' ? 'موجود في السكن' : 'غير موجود'}
                  </h2>
                  <div className="mt-2 text-xs font-black">
                    {inside === 'inside' && <span className="text-emerald-600 dark:text-emerald-400">وأنت داخل نطاق السكن ✓</span>}
                    {inside === 'outside' && <span className="text-rose-600 dark:text-rose-400">وأنت خارج نطاق السكن</span>}
                    {inside === 'unknown' && <span className="text-slate-400">تعذّر تحديد موقعك</span>}
                  </div>
                </div>
                <button
                  onClick={() => setDismissedFor(card.rollCall.id)}
                  className="mt-5 w-full py-3.5 rounded-2xl bg-primary-600 text-white font-black hover:bg-primary-700 shadow-lg shadow-primary-600/20"
                >
                  تمام
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
