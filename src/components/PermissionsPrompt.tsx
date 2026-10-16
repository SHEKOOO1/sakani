import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BellRing, MapPin, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const DISMISS_KEY = 'sakani-perms-dismissed';

/**
 * First-run prompt that asks for the two permissions the app relies on:
 * notifications (Web Push) and location (attendance / events / maps).
 *
 * Browsers forbid granting these without an explicit user tap, so this banner
 * surfaces a single "enable" button right after login — the closest thing to
 * "enabled by default" that is technically allowed. Dismissing it is remembered
 * on the device so it never nags.
 */
export function PermissionsPrompt() {
  const { supported, permission, subscribed, busy, enable } = usePushNotifications(true);
  const [show, setShow] = useState(false);
  const [geoState, setGeoState] = useState<PermissionState | 'unknown'>('unknown');

  const dismiss = useCallback(() => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let dismissed = false;
      try { dismissed = !!localStorage.getItem(DISMISS_KEY); } catch { /* ignore */ }
      if (dismissed) return;

      const geoSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
      let geo: PermissionState | 'unknown' = 'unknown';
      try {
        const anyNav = navigator as any;
        if (anyNav.permissions?.query) {
          geo = (await anyNav.permissions.query({ name: 'geolocation' })).state;
        }
      } catch { /* query unsupported (e.g. Safari) — treat as unknown */ }

      if (cancelled) return;
      setGeoState(geo);

      const needsNotifications = supported && permission !== 'granted' && !subscribed;
      const needsLocation = geoSupported && geo !== 'granted';
      if (needsNotifications || needsLocation) setShow(true);
    })();
    return () => { cancelled = true; };
    // Re-evaluate once the push hook finishes resolving permission/subscription.
  }, [supported, permission, subscribed]);

  const requestLocation = () =>
    new Promise<void>((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve();
      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        () => resolve(),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
      );
    });

  const handleEnable = async () => {
    // اطلب الإشعارات أولًا (نافذة السماح)، وبعدها الموقع — بالتتابع حتى لا
    // يتداخل الاثنان في نفس اللحظة.
    if (supported && permission !== 'granted') {
      await enable();
    }
    await requestLocation();
    try {
      const anyNav = navigator as any;
      if (anyNav.permissions?.query) {
        const st = await anyNav.permissions.query({ name: 'geolocation' });
        setGeoState(st.state);
      }
    } catch { /* ignore */ }
    dismiss();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.96 }}
          className="fixed top-4 left-4 right-4 z-[120] max-w-md mx-auto"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-2xl p-5" dir="rtl">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-vibrant-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
                <BellRing size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">فعّل الإشعارات والموقع</h4>
                  <button onClick={dismiss} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1 leading-relaxed">
                  عشان تيجيلك تنبيهات الأوردر والحضور على طول، وعشان نحدد مكانك في الحضور والفعاليات، اسمح بالإشعارات والموقع.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => { void handleEnable(); }}
                    disabled={busy}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {busy ? 'جارٍ التفعيل...' : (<><MapPin size={14} /> تفعيل</>)}
                  </button>
                  <button
                    onClick={dismiss}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-all"
                  >
                    لاحقًا
                  </button>
                </div>
                {geoState === 'denied' && (
                  <p className="text-[10px] font-bold text-amber-600 mt-2">
                    الموقع محظور — اسمح به من إعدادات المتصفح لهذا الموقع.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
