import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { AnimatePresence, motion } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageHelmet } from './components/PageHelmet';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { Sparkles } from 'lucide-react';

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <>
        <PageHelmet title="جاري التحميل" />
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-900 via-vibrant-900 to-primary-800">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
              <Sparkles className="text-white" size={32} />
            </div>
            <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="w-1/2 h-full bg-white/40 rounded-full"
              />
            </div>
            <p className="text-white/50 text-sm font-bold">جاري تحميل سكني...</p>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title={!user ? 'تسجيل الدخول' : undefined} description="سكني — نظام إدارة سكن الطلاب الذكي" />
      <ErrorBoundary>
        <div className="min-h-screen bg-surface dark:bg-surface-dark font-sans text-slate-900 dark:text-white">
          <AnimatePresence mode="wait">
            {!user ? (
              <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LoginPage />
              </motion.div>
            ) : (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Layout />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ErrorBoundary>
      <PwaInstallPrompt />
    </>
  );
}
