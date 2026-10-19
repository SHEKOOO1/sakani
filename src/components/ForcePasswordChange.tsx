import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { motion } from 'motion/react';
import { Lock, ShieldAlert, Loader2, LogOut } from 'lucide-react';

/**
 * Hard gate shown right after login when the account still uses the shared
 * DEFAULT_USER_PASSWORD (must_change_password = true). The user cannot reach
 * the app until they set their own password.
 */
export function ForcePasswordChange() {
  const { refreshPermissions, logout, user } = useAuth();
  const { request } = useApi();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('كلمة المرور الجديدة لازم تكون مختلفة عن الحالية.');
      return;
    }

    setSubmitting(true);
    try {
      await request('/api/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      // Reload the session so must_change_password becomes false and the app unlocks.
      await refreshPermissions();
    } catch (err: any) {
      setError(err?.message || 'فشل تغيير كلمة المرور. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-primary-900 via-vibrant-900 to-primary-800 px-4">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl p-8 md:p-10">
          <div className="text-center mb-7">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-warm-400/20 border border-warm-400/40 flex items-center justify-center">
              <ShieldAlert className="text-warm-300" size={32} />
            </div>
            <h1 className="text-white text-xl font-black">لازم تغيّر كلمة المرور</h1>
            <p className="text-white/60 text-sm mt-2 leading-relaxed">
              حسابك دلوقتي شغّال بكلمة المرور الافتراضية.
              <br />
              اختار كلمة مرور خاصة بك قبل ما تكمل.
            </p>
            {user?.name && (
              <p className="text-white/40 text-xs mt-2">أهلاً {user.name}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-white/70 mb-1.5 mr-1">كلمة المرور الحالية</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 pr-11 pl-4 py-3 outline-none focus:border-white/50 transition"
                  placeholder="كلمة المرور الافتراضية"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-white/70 mb-1.5 mr-1">كلمة المرور الجديدة</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 pr-11 pl-4 py-3 outline-none focus:border-white/50 transition"
                  placeholder="8 أحرف على الأقل"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-white/70 mb-1.5 mr-1">تأكيد كلمة المرور الجديدة</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 pr-11 pl-4 py-3 outline-none focus:border-white/50 transition"
                  placeholder="أعد كتابة كلمة المرور"
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-primary-900 font-black py-3 hover:bg-white/90 transition disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
              {submitting ? 'جاري الحفظ...' : 'حفظ كلمة المرور والمتابعة'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => logout()}
            className="mt-4 w-full flex items-center justify-center gap-2 text-white/50 hover:text-white/80 text-sm transition"
          >
            <LogOut size={15} />
            تسجيل الخروج
          </button>
        </div>
      </motion.div>
    </div>
  );
}
