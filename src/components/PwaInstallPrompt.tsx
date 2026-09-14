import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share2, Smartphone } from 'lucide-react';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice || isSafari) {
      const dismissed = sessionStorage.getItem('pwa-ios-dismissed');
      if (!dismissed) {
        setTimeout(() => setShow(true), 3000);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShow(false);
      setDeferredPrompt(null);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    if (isIOS) {
      sessionStorage.setItem('pwa-ios-dismissed', 'true');
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          className="fixed bottom-4 left-4 right-4 z-[100] max-w-sm mx-auto"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-vibrant-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
                {isIOS ? <Share2 size={20} className="text-white" /> : <Download size={20} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {isIOS ? 'ثبّت سكني على جهازك' : 'ثبّت تطبيق سكني'}
                  </h4>
                  
                    <button onClick={handleDismiss} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X  size={16} />
                  
                    </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1 leading-relaxed">
                  {isIOS
                    ? 'اضغط على زر المشاركة  ⎋  ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)'
                    : 'حمل التطبيق على جهازك للوصول السريع والتصفح بدون إنترنت'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {isIOS ? (
                    <button onClick={handleDismiss}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2">
                      <Smartphone size={14} /> فهمت
                    </button>
                  ) : (
                    <button onClick={handleInstall}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2">
                      <Download size={14} /> تثبيت التطبيق
                    </button>
                  )}
                  <button onClick={handleDismiss}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-all">
                    لاحقاً
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
