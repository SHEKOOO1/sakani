import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, Clock, Info, AlertTriangle, XCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

interface NotificationBellProps {
  onNavigate?: (studentId: string) => void;
  onNavigateToEvent?: (eventId: string) => void;
  onNavigateToPage?: (page: string) => void;
  onNavigateToFinance?: (studentId: string) => void;
}

export function NotificationBell({ onNavigate, onNavigateToEvent, onNavigateToPage, onNavigateToFinance }: NotificationBellProps = {}) {
  const { request } = useApi();
  const { isLoading } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await request('/api/notifications');
      setNotifications(res?.data || []);
    } catch (err) { console.error('Fetch notifications failed:', err); }
  }, [request]);

  useEffect(() => {
    if (isLoading) return;
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(), 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications, isLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    try {
      await request('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      
      // Request browser notification permission on first interaction
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-500" size={16} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={16} />;
      case 'error': return <XCircle className="text-rose-500" size={16} />;
      default: return <Info className="text-blue-500" size={16} />;
    }
  };

  // Helper to trigger browser notification if supported
  const triggerBrowserNotify = (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-0 mt-4 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-50 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-slate-800">التنبيهات</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-[10px] font-black text-blue-600 hover:underline">
                  تحديد الكل كمقروء
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {notifications.map(n => {
                    let meta: any = null;
                    try { meta = n.metadata ? JSON.parse(n.metadata) : null; } catch {}
                    const isProfileShare = meta?.mode === 'readonly' && meta?.studentId;
                    const isFinance = n.type === 'finance' && meta?.studentId;
                    const isClickable = isProfileShare || isFinance || meta?.event_id || meta?.page;

                    const handleNotificationClick = async () => {
                      if (!isClickable) return;
                      if (!n.is_read) {
                        try { await request(`/api/notifications/${n.id}/read`, { method: 'POST' }); } catch {}
                        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
                      }
                      if (isProfileShare && onNavigate) {
                        onNavigate(meta.studentId);
                      } else if (isFinance && onNavigateToFinance) {
                        onNavigateToFinance(meta.studentId);
                      } else if (meta?.event_id && onNavigateToEvent) {
                        onNavigateToEvent(meta.event_id);
                      } else if (meta?.page && onNavigateToPage) {
                        onNavigateToPage(meta.page);
                      } else {
                        return;
                      }
                      setIsOpen(false);
                    };

                    return (
                    <div
                      key={n.id}
                      onClick={handleNotificationClick}
                      className={`p-4 pr-6 hover:bg-slate-50 transition-colors dark:hover:bg-white/5 relative ${isClickable ? 'cursor-pointer' : ''} ${!n.is_read
                        ? 'bg-blue-50/60 dark:bg-blue-500/[0.08] border-r-4 border-blue-500'
                        : 'bg-white dark:bg-transparent border-r-4 border-transparent'
                      }`}
                    >
                      <div className="flex gap-3">
                         <div className="mt-1 shrink-0">{getTypeIcon(n.type)}</div>
                         <div className="space-y-1 flex-1">
                            <p className={`text-sm ${!n.is_read ? 'font-black text-blue-900 dark:text-blue-100' : 'font-bold text-slate-800 dark:text-white'}`}>{n.title}</p>
                            <p className="text-xs text-slate-500 leading-relaxed font-bold">{n.message}</p>
                            {meta?.receipt_image && (
                              <div className="mt-2">
                                <img src={meta.receipt_image} alt="Receipt" className="w-full max-h-32 object-contain rounded-xl border border-slate-200 bg-slate-50" />
                              </div>
                            )}
                            {isProfileShare && (
                              <p className="text-[10px] font-black text-blue-500 flex items-center gap-1">
                                <ArrowLeft size={11} className="rotate-180" /> اضغط لعرض الملف
                              </p>
                            )}
                            {isFinance && (
                              <p className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                                <ArrowLeft size={11} className="rotate-180" /> اضغط للانتقال إلى كارت الحساب
                              </p>
                            )}
                            {meta?.page && (
                              <p className="text-[10px] font-black text-blue-500 flex items-center gap-1 mt-1">
                                <ArrowLeft size={11} className="rotate-180" /> اضغط للانتقال إلى {meta.page === 'laundry' ? 'المغسلة' : meta.page === 'attendance' ? 'الحضور' : meta.page === 'maintenance' ? 'الصيانة' : meta.page === 'behavior' ? 'السلوك' : 'الصفحة المعنية'}
                              </p>
                            )}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                 <Clock size={10} />
                                 <span>{new Date(n.created_at).toLocaleTimeString('ar-EG')}</span>
                              </div>
                              {!n.is_read && (
                                <span className="text-[9px] font-black text-blue-600 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                  جديد
                                </span>
                              )}
                            </div>
                         </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-10 text-center space-y-3">
                   <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <Bell size={24} />
                   </div>
                   <p className="text-sm text-slate-400 font-bold">لا توجد إشعارات جديدة</p>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-4 border-t border-slate-50 bg-slate-50/30 text-center">
                 <button onClick={() => setIsOpen(false)} className="text-xs font-black text-slate-500 hover:text-slate-800 transition-colors">عرض جميع الإشعارات</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
