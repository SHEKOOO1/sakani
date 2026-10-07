import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Loader2, XCircle, MailWarning } from 'lucide-react';

/**
 * شاشة تفعيل الحساب — تُفتح من رابط البريد `?activate=<token>`.
 *
 * لا تستخدم `useApi` لأنها تعتمد على `useAuth` (وتُخرج المستخدم من الجلسة عند
 * أي 401)، بينما هذه الصفحة تعمل قبل تسجيل الدخول أصلاً. لذلك طلب مباشر
 * بـ fetch + `credentials: 'include'`.
 */

type Phase = 'verifying' | 'success' | 'error' | 'missing-token';

const MESSAGES: Record<string, string> = {
  ACTIVATION_INVALID: 'رابط التفعيل غير صالح. اطلب من المسؤول إرسال رابط جديد.',
  ACTIVATION_EXPIRED: 'انتهت صلاحية رابط التفعيل. اطلب من المسؤول إرسال رابط جديد.',
  ALREADY_ACTIVATED: 'هذا الحساب مُفعّل بالفعل. يمكنك تسجيل الدخول مباشرة.',
  MAILER_NOT_CONFIGURED: 'إرسال البريد غير مُهيأ حالياً. راجع المشرف لإرسال التفعيل يدوياً.',
};

function readToken(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('activate');
  } catch {
    return null;
  }
}

/** يزيل التوكن من الـ URL فوراً حتى لا يبقى في تاريخ المتصفح أو يُعاد إرساله. */
function scrubTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('activate');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch {
    /* تجاهل */
  }
}

export function ActivationPage() {
  const [phase, setPhase] = useState<Phase>('verifying');
  const [code, setCode] = useState<string | null>(null);
  const attempted = useRef(false);

  const activate = useCallback(async (token: string) => {
    setPhase('verifying');
    try {
      const response = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success) {
        setCode(null);
        setPhase('success');
      } else {
        setCode(data?.code || null);
        setPhase('error');
      }
    } catch {
      setCode(null);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = readToken();
    if (!token) {
      setPhase('missing-token');
      return;
    }
    // يُمسح التوكن من العنوان بعد قراءته، فلا يبقى قابلاً لإعادة التفعيل
    // من زر المتصفح ولا يظهر في أي سجل مشاركة للرابط.
    scrubTokenFromUrl();
    void activate(token);
  }, [activate]);

  const isVerifying = phase === 'verifying';
  const isSuccess = phase === 'success';

  const Icon = isVerifying ? Loader2 : isSuccess ? CheckCircle2 : XCircle;
  const accent = isVerifying ? 'text-white' : isSuccess ? 'text-emerald-300' : 'text-rose-300';

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-primary-900 via-vibrant-900 to-primary-800">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="absolute w-96 h-96 bg-vibrant-400 -top-20 -right-20 rounded-full blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl p-8 md:p-10 text-center">
          <motion.img
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            src="img/pwa-512x512.png"
            width={80}
            alt="SAKANI"
            className="mx-auto mb-4 drop-shadow-2xl"
          />

          <Icon size={56} className={`mx-auto mb-5 ${accent} ${isVerifying ? 'animate-spin' : ''}`} />

          <h1 className="text-xl font-black text-white mb-3">
            {isVerifying && 'جارٍ تفعيل حسابك...'}
            {isSuccess && 'تم تفعيل حسابك'}
            {phase === 'missing-token' && 'رابط التفعيل غير موجود'}
            {phase === 'error' && 'تعذّر التفعيل'}
          </h1>

          <p className="text-sm text-white/70 leading-relaxed mb-6">
            {isVerifying && 'لحظة واحدة فقط وننتهي.'}
            {isSuccess && 'حسابك مُفعّل الآن. سجّل الدخول بكلمة المرور التي حددها لك المسؤول.'}
            {phase === 'missing-token' &&
              'الرابط الذي فتحته لا يحتوي على كود تفعيل. استخدم الرابط الكامل كما وصل في رسالة البريد الإلكتروني.'}
            {phase === 'error' &&
              (code && MESSAGES[code]
                ? MESSAGES[code]
                : 'الرابط غير صالح أو منتهي. اطلب من المسؤول إرسال رابط تفعيل جديد.')}
          </p>

          {(phase === 'error' || phase === 'missing-token') && (
            <div className="mb-6 p-4 bg-amber-500/15 border border-amber-300/30 text-amber-100 rounded-xl text-sm text-right leading-relaxed">
              <div className="flex items-start gap-2 justify-end">
                <MailWarning size={18} className="shrink-0 mt-0.5" />
                <span>
                  يمكنك طلب رابط جديد بنفس البريد من صفحة الدخول، أو مراجعة المشرف لو لم تصلك رسالة أصلاً.
                </span>
              </div>
            </div>
          )}

          {!isVerifying && (
            <a
              href="/"
              className="inline-block w-full py-3.5 bg-white text-primary-800 font-black rounded-xl shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 transition-all"
            >
              {isSuccess ? 'الذهاب لتسجيل الدخول' : 'العودة لصفحة الدخول'}
            </a>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-6 font-medium">
          &copy; سكني {new Date().getFullYear()}. جميع الحقوق محفوظة.
        </p>
      </motion.div>
    </div>
  );
}
