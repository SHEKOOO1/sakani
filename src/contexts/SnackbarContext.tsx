import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info, Trash2, AlertOctagon } from 'lucide-react';

type SnackbarType = 'success' | 'error' | 'warning' | 'info';

interface SnackbarItem {
  id: string;
  message: string;
  type: SnackbarType;
  duration: number;
  paused: boolean;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface SnackbarContextValue {
  showSnackbar: (message: string, type?: SnackbarType, duration?: number) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showConfirm: (message: string) => Promise<boolean>;
}

const SnackbarContext = createContext<SnackbarContextValue>({ showSnackbar: () => {}, confirm: async () => false, showSuccess: () => {}, showError: () => {}, showWarning: () => {}, showInfo: () => {}, showConfirm: async () => false });

export const useSnackbar = () => useContext(SnackbarContext);

const icons: Record<SnackbarType, React.ReactNode> = {
  success: <CheckCircle size={20} />,
  error: <AlertCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />
};

const styles: Record<SnackbarType, { bg: string; border: string; icon: string; text: string; bar: string }> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'text-emerald-500',
    text: 'text-emerald-800',
    bar: '#10b981'
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    text: 'text-red-800',
    bar: '#ef4444'
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    text: 'text-amber-800',
    bar: '#f59e0b'
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-800',
    bar: '#3b82f6'
  }
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snacks, setSnacks] = useState<SnackbarItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const removeSnack = useCallback((id: string) => {
    setSnacks(prev => prev.filter(s => s.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const showSnackbar = useCallback((message: string, type: SnackbarType = 'info', duration: number = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSnacks(prev => [...prev, { id, message, type, duration, paused: false }]);

    const timer = setTimeout(() => removeSnack(id), duration);
    timersRef.current.set(id, timer);
  }, [removeSnack]);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      confirmResolverRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const handleConfirm = useCallback((value: boolean) => {
    confirmResolverRef.current?.(value);
    confirmResolverRef.current = null;
    setConfirmState(null);
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => showSnackbar(message, 'success', duration), [showSnackbar]);
  const showError = useCallback((message: string, duration?: number) => showSnackbar(message, 'error', duration), [showSnackbar]);
  const showWarning = useCallback((message: string, duration?: number) => showSnackbar(message, 'warning', duration), [showSnackbar]);
  const showInfo = useCallback((message: string, duration?: number) => showSnackbar(message, 'info', duration), [showSnackbar]);
  const showConfirm = useCallback((message: string): Promise<boolean> => confirm({ message }), [confirm]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const confirmStyles = {
    danger: { icon: Trash2, bg: 'bg-rose-500', hover: 'hover:bg-rose-600', ring: 'ring-rose-200', iconColor: 'text-rose-500' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-500', hover: 'hover:bg-amber-600', ring: 'ring-amber-200', iconColor: 'text-amber-500' },
    info: { icon: AlertOctagon, bg: 'bg-blue-500', hover: 'hover:bg-blue-600', ring: 'ring-blue-200', iconColor: 'text-blue-500' },
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, confirm, showSuccess, showError, showWarning, showInfo, showConfirm }}>
      {children}

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmState && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleConfirm(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/5 p-8 max-w-md w-full relative overflow-hidden"
              dir="rtl"
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${confirmState.type === 'danger' ? 'bg-rose-50 dark:bg-rose-500/10' : confirmState.type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
                  {React.createElement(confirmStyles[confirmState.type || 'info'].icon, { size: 28, className: confirmStyles[confirmState.type || 'info'].iconColor })}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-1">
                    {confirmState.title || 'تأكيد العملية'}
                  </h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                    {confirmState.message}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => handleConfirm(false)}
                  className="px-8 py-3.5 font-black text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
                >
                  {confirmState.cancelText || 'إلغاء'}
                </button>
                <button
                  onClick={() => handleConfirm(true)}
                  className={`px-8 py-3.5 font-black text-sm text-white rounded-2xl shadow-lg transition-all hover:scale-105 ${confirmStyles[confirmState.type || 'info'].bg} ${confirmStyles[confirmState.type || 'info'].hover}`}
                >
                  {confirmState.confirmText || 'تأكيد'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] flex flex-col items-center gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence mode="popLayout">
          {snacks.map(snack => {
            const s = styles[snack.type];
            return (
              <motion.div
                key={snack.id}
                layout
                initial={{ opacity: 0, y: -40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`pointer-events-auto w-full ${s.bg} ${s.border} border-2 rounded-[2rem] shadow-2xl overflow-hidden`}
                dir="rtl"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className={`shrink-0 ${s.icon}`}>
                    {icons[snack.type]}
                  </div>
                  <p className={`flex-1 text-sm font-bold ${s.text} leading-relaxed`}>
                    {snack.message}
                  </p>
                  <button
                    onClick={() => removeSnack(snack.id)}
                    className={`shrink-0 p-1 rounded-xl hover:bg-black/5 transition-colors ${s.text}`}
                  >
                    <X size={16} />
                  </button>
                </div>
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: snack.duration / 1000, ease: 'linear' }}
                  className="h-1 origin-left"
                  style={{ backgroundColor: s.bar, opacity: 0.25 }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </SnackbarContext.Provider>
  );
}
