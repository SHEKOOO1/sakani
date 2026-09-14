import React, { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { motion } from 'motion/react';
import { Mail, Lock, User, ShieldCheck } from 'lucide-react';

function FloatingShape({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 0.15, scale: 1 }}
      transition={{ duration: 1.5, delay, ease: "easeOut" }}
      className={`absolute rounded-full blur-3xl ${className}`}
    />
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const { request } = useApi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mounted = useMounted();

  const checkSetup = useCallback(async () => {
    try {
      const response = await request('/api/auth/setup-status', { method: 'GET' });
      if (mounted.current) setNeedsSetup(response.needsSetup);
    } catch {
      if (mounted.current) setNeedsSetup(false);
    }
  }, [request]);

  useEffect(() => {

    checkSetup();
    
  }, [checkSetup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      let response;
      if (needsSetup) {
        if (!name.trim()) throw new Error('يرجى إدخال اسم المدير.');
        if (password !== confirmPassword) throw new Error('كلمتا المرور غير متطابقتين.');
        response = await request('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, name, gender }),
        });
      } else {
        response = await request('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      }

      if (response.success) {
        login(response.data.user);
      }
    } catch (err: any) {
      setError(err.message || (needsSetup ? 'فشل إنشاء الحساب' : 'فشل تسجيل الدخول'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-primary-900 via-vibrant-900 to-primary-800">
      <FloatingShape className="w-96 h-96 bg-vibrant-400 -top-20 -right-20" delay={0} />
      <FloatingShape className="w-80 h-80 bg-primary-400 -bottom-32 -left-32" delay={0.3} />
      <FloatingShape className="w-64 h-64 bg-warm-400 top-1/2 left-1/3" delay={0.6} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl p-8 md:p-10">
          <div className="text-center mb-8">
            <motion.img
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
              src="img/pwa-512x512.png" width={80} alt="SAKANI"
              className="mx-auto mb-4 drop-shadow-2xl"
            />
            <motion.img
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              src="img/sakani-logo-word.png" width={220} alt="SAKANI"
              className="mx-auto brightness-0 invert opacity-90"
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-white/60 text-sm mt-3 font-medium"
            >
              {needsSetup ? 'إنشاء حساب المدير الأول' : 'سجل دخولك للمتابعة'}
            </motion.p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-500/20 border border-rose-300/30 text-rose-200 rounded-xl text-sm text-center font-medium"
            >
              {error}
            </motion.div>
          )}

          {needsSetup === null ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50 text-sm">جارٍ التحقق من حالة النظام...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {needsSetup && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-white/70 mb-1.5 mr-1">اسم المدير</label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm"
                        placeholder="الاسم الكامل"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-white/70 mb-1.5 mr-1">النوع</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setGender('male')}
                        className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                          gender === 'male'
                            ? 'bg-white/20 border-white/40 text-white'
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70'
                        }`}>
                        ذكر
                      </button>
                      <button type="button" onClick={() => setGender('female')}
                        className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                          gender === 'female'
                            ? 'bg-white/20 border-white/40 text-white'
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70'
                        }`}>
                        أنثى
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-bold text-white/70 mb-1.5 mr-1">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm"
                    placeholder="user@dorm.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-white/70 mb-1.5 mr-1">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {needsSetup && (
                <div>
                  <label className="block text-sm font-bold text-white/70 mb-1.5 mr-1">تأكيد كلمة المرور</label>
                  <div className="relative">
                    <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pr-10 pl-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm"
                      placeholder="أعد كتابة كلمة المرور"
                      required
                    />
                  </div>
                </div>
              )}

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 bg-white text-primary-800 font-black rounded-xl shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              >
                {isSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-primary-800 border-t-transparent rounded-full animate-spin" /> جاري التحميل...</>
                ) : (
                  <><Lock size={18} /> {needsSetup ? 'إنشاء حساب مدير التطبيق' : 'تسجيل الدخول'}</>
                )}
              </motion.button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-6 font-medium">
          &copy; سكني {new Date().getFullYear()}. جميع الحقوق محفوظة.
        </p>
      </motion.div>
    </div>
  );
}
