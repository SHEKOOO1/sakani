import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppPermission } from '../types/permissions';
import { useLaundrySocket } from '../hooks/useLaundrySocket';
import {
  LayoutDashboard, Users, Building, Bed, CreditCard, Calendar, Settings,
  LogOut, Bell, Search, Wrench, MapPin, Waves, BarChart3, UserCog,
  Package, Trophy, Target, History as HistoryIcon, ClipboardList,
  UserCheck, LayoutGrid, Sun, Moon, Menu, X, Gift, Award, Wallet,
  ShieldCheck, Church, UserCircle, Radio, Film, Tv, ChevronLeft, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { PageHelmet } from './PageHelmet';

const Dashboard = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })));
const FinancePage = lazy(() => import('./FinancePage').then(m => ({ default: m.FinancePage })));
const EventsPage = lazy(() => import('./EventsPage').then(m => ({ default: m.EventsPage })));
const StudentsPage = lazy(() => import('./StudentsPage').then(m => ({ default: m.StudentsPage })));
const MaintenancePage = lazy(() => import('./MaintenancePage').then(m => ({ default: m.MaintenancePage })));
const SettingsPage = lazy(() => import('./SettingsPage').then(m => ({ default: m.SettingsPage })));
const ApartmentsPage = lazy(() => import('./ApartmentsPage').then(m => ({ default: m.ApartmentsPage })));
const RoomsPage = lazy(() => import('./RoomsPage').then(m => ({ default: m.RoomsPage })));
const AttendancePage = lazy(() => import('./AttendancePage').then(m => ({ default: m.AttendancePage })));
const LaundryPage = lazy(() => import('./LaundryPage').then(m => ({ default: m.LaundryPage })));
const BishopReportsPage = lazy(() => import('./BishopReportsPage').then(m => ({ default: m.BishopReportsPage })));
const EmployeesPage = lazy(() => import('./EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const AdminSystemPage = lazy(() => import('./AdminSystemPage').then(m => ({ default: m.AdminSystemPage })));
const BehaviorDashboard = lazy(() => import('./BehaviorDashboard').then(m => ({ default: m.BehaviorDashboard })));
const CompetitionsManagement = lazy(() => import('./CompetitionsManagement').then(m => ({ default: m.CompetitionsManagement })));
const DecisionsLog = lazy(() => import('./DecisionsLog').then(m => ({ default: m.DecisionsLog })));
const NotificationBell = lazy(() => import('./NotificationBell').then(m => ({ default: m.NotificationBell })));
const TenantSelector = lazy(() => import('./TenantSelector').then(m => ({ default: m.TenantSelector })));
const ProfilePage = lazy(() => import('./ProfilePage').then(m => ({ default: m.ProfilePage })));
const RewardsPage = lazy(() => import('./RewardsPage').then(m => ({ default: m.RewardsPage })));
const AdminBadgesPage = lazy(() => import('./AdminBadgesPage').then(m => ({ default: m.AdminBadgesPage })));
const PaymentMethodsManager = lazy(() => import('./PaymentMethodsManager').then(m => ({ default: m.PaymentMethodsManager })));
const BroadcastManagement = lazy(() => import('./BroadcastManagement').then(m => ({ default: m.BroadcastManagement })));
const PriestDashboard = lazy(() => import('./PriestDashboard').then(m => ({ default: m.PriestDashboard })));
const ParentDashboard = lazy(() => import('./ParentDashboard').then(m => ({ default: m.ParentDashboard })));
const AdminDashboard = lazy(() => import('./AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const BishopDashboard = lazy(() => import('./BishopDashboard').then(m => ({ default: m.BishopDashboard })));
const SupervisorDashboard = lazy(() => import('./SupervisorDashboard').then(m => ({ default: m.SupervisorDashboard })));
const EmployeeDashboard = lazy(() => import('./EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })));
const StudentDashboard = lazy(() => import('./StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const SharedStudentProfile = lazy(() => import('./SharedStudentProfile').then(m => ({ default: m.SharedStudentProfile })));
const SharedStudentProfileList = lazy(() => import('./SharedStudentProfileList').then(m => ({ default: m.SharedStudentProfileList })));
const UnifiedActivitiesPage = lazy(() => import('./UnifiedActivitiesPage').then(m => ({ default: m.UnifiedActivitiesPage })));
const CompetitionResultsPage = lazy(() => import('./CompetitionResultsPage').then(m => ({ default: m.default })));
import { NotFoundPage } from './NotFoundPage';
import { NotAuthorizedPage } from './NotAuthorizedPage';
const AdminGuard = lazy(() => import('./AdminGuard').then(m => ({ default: m.AdminGuard })));
const Radio514 = lazy(() => import('./Radio').then(m => ({ default: m.Radio514 })));
const AdminRadio514 = lazy(() => import('./AdminRadio514').then(m => ({ default: m.AdminRadio514 })));
const BroadcastTicker = lazy(() => import('./BroadcastTicker').then(m => ({ default: m.BroadcastTicker })));

export function Layout({ children }: { children?: React.ReactNode }) {
  const { user, logout, hasPermission, refreshPermissions } = useAuth();

  useEffect(() => {
    refreshPermissions();
    const onFocus = () => refreshPermissions();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshPermissions]);
  useLaundrySocket();
  const navigate = useNavigate();
  const location = useLocation();

  const initialView =
    user?.role === 'parent' ? 'parent_dashboard' :
    user?.role === 'priest' ? 'priest_dashboard' :
    user?.role === 'bishop' ? 'bishop_dashboard' :
    user?.role === 'admin' ? 'admin_dashboard' : 'dashboard';

  const [currentView, setCurrentView] = useState(initialView);
  const [sharedProfileStudentId, setSharedProfileStudentId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const isStudent = user?.role?.toLowerCase() === 'student';
  const isParent = user?.role?.toLowerCase() === 'parent';

  const allMenuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة القيادة', permission: AppPermission.VIEW_DASHBOARD, path: '/dashboard', hide: user?.role === 'bishop' || user?.role === 'priest' },
    { id: 'bishop_dashboard', icon: Church, label: 'لوحة الإيبارشية', permission: AppPermission.VIEW_DASHBOARD, path: '/bishop-dashboard', hide: user?.role !== 'bishop' },
    { id: 'priest_dashboard', icon: ShieldCheck, label: 'لوحة الأب المسؤول', permission: AppPermission.VIEW_PRIEST_DASHBOARD, path: '/priest-dashboard', hide: user?.role !== 'priest' },
    { id: 'students', icon: Users, label: 'الطلاب', permission: AppPermission.VIEW_STUDENT, path: '/students', hide: isStudent || isParent },
    { id: 'apartments', icon: Building, label: 'الشقق', permission: AppPermission.VIEW_HOUSING, path: '/apartments', hide: isParent },
    { id: 'rooms', icon: Bed, label: 'الغرف', permission: AppPermission.VIEW_ROOMS, path: '/rooms', hide: isParent },
    { id: 'users', icon: UserCog, label: 'إدارة المستخدمين', permission: AppPermission.VIEW_USERS, path: '/users', hide: isStudent || isParent },
    { id: 'attendance', icon: MapPin, label: 'تسجيل حضور', permission: AppPermission.CHECKIN_ATTENDANCE, path: '/attendance', hide: false },
    { id: 'laundry', icon: Waves, label: 'الغسيل', permission: AppPermission.VIEW_LAUNDRY_QUEUE, path: '/laundry', hide: isParent },
    { id: 'maintenance', icon: Wrench, label: 'الصيانة', permission: AppPermission.VIEW_MAINTENANCE, path: '/maintenance', hide: isParent, allowStudent: isStudent && hasPermission(AppPermission.REQUEST_MAINTENANCE) },
    { id: 'finance', icon: CreditCard, label: 'النظام المالي', permission: AppPermission.VIEW_FINANCE, path: '/finance', hide: isStudent || isParent },

    { id: 'all_activities', icon: Trophy, label: 'الأنشطة والمسابقات', permission: AppPermission.VIEW_EVENTS, path: '/all-activities', hide: !isStudent },
    { id: 'competition_results', icon: Award, label: 'نتائج المسابقات', permission: AppPermission.VIEW_EVENTS, path: '/competition-results', hide: !isStudent },

    { id: 'events', icon: Calendar, label: 'إدارة الأنشطة', permission: AppPermission.VIEW_EVENTS, path: '/admin/activities', hide: isStudent || isParent },
    { id: 'competitions', icon: Trophy, label: 'إدارة المسابقات', permission: AppPermission.VIEW_COMPETITIONS, path: '/admin/competitions', hide: isStudent || isParent },
    { id: 'broadcasts', icon: Target, label: 'الإعلانات', permission: AppPermission.SEND_BROADCAST, path: '/admin/broadcasts', hide: isStudent || isParent },

    { id: 'behavior', icon: Target, label: 'المكافآت والجزاءات', permission: AppPermission.VIEW_POINTS, path: '/behavior', hide: !['supervisor', 'assistant_supervisor', 'priest'].includes(user?.role?.toLowerCase() || '') },
    { id: 'rewards', icon: Gift, label: 'الجوائز والأوسمة', permission: AppPermission.VIEW_POINTS, path: '/rewards', hide: isParent || user?.role === 'admin' },
    { id: 'badges_admin', icon: Award, label: 'إدارة الأوسمة', permission: AppPermission.MANAGE_REWARDS, path: '/admin/badges', hide: !['supervisor', 'priest'].includes(user?.role?.toLowerCase() || '') },
    { id: 'decisions', icon: HistoryIcon, label: 'سجل القرارات', permission: AppPermission.VIEW_DECISION_LOG, path: '/decisions' },
    { id: 'bishop_reports', icon: BarChart3, label: 'تقارير الأبرشية', permission: AppPermission.VIEW_GLOBAL_REPORTS, path: '/bishop-reports' },
    { id: 'shared_profiles', icon: Users, label: 'الملفات المشتركة', permission: AppPermission.VIEW_STUDENT, path: '/shared-profiles', hide: !['bishop', 'priest'].includes(user?.role?.toLowerCase() || '') },
    { id: 'parent_dashboard', icon: LayoutDashboard, label: 'متابعة الأبناء', permission: AppPermission.VIEW_STUDENT, path: '/parent-dashboard', hide: !isParent },
    { id: 'parent_events', icon: Calendar, label: 'فعاليات الأبناء', permission: AppPermission.VIEW_EVENTS, path: '/parent-events', hide: !isParent },
    { id: 'admin_management', icon: Settings, label: 'إدارة المنظومة', permission: AppPermission.MANAGE_GLOBAL_TENANTS, path: '/admin-management' },
    { id: 'profile', icon: UserCircle, label: 'الملف الشخصي', permission: AppPermission.VIEW_DASHBOARD, path: '/profile' },
    { id: 'payment_methods', icon: Wallet, label: 'وسائل الدفع', permission: AppPermission.MANAGE_SETTINGS, path: '/admin/payments', hide: !['supervisor', 'priest'].includes(user?.role?.toLowerCase() || '') },
    { id: 'radio', icon: Radio, label: 'راديو 5:14', permission: AppPermission.VIEW_RADIO, path: '/radio', hide: isParent || user?.radio_514_enabled === false },
    { id: 'admin_radio', icon: Tv, label: 'إدارة الراديو', permission: AppPermission.MANAGE_RADIO_BROADCAST, path: '/admin/radio', hide: isStudent || isParent },
    { id: 'settings', icon: Settings, label: 'الإعدادات', permission: AppPermission.VIEW_SETTINGS, path: '/settings', hide: user?.role === 'bishop' },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (item.allowStudent) return true;
    return hasPermission(item.permission) && !item.hide;
  });

  useEffect(() => {
    // عند تسجيل الدخول (أو إعادة تحميل الصفحة) ابدأ دائماً من الصفحة الرئيسية لحساب المستخدم الحالي
    setCurrentView(initialView);
    navigate('/', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const matched = allMenuItems.find(m => m.path === location.pathname);
    if (matched) setCurrentView(matched.id);
    if (matched && matched.id !== 'shared_profile') setSharedProfileStudentId(null);
  }, [location.pathname]);

  const defaultDashboard = useMemo(() => {
    if (!user) return null;
    switch (user.role) {
      case 'admin': return <AdminDashboard />;
      case 'bishop': return <BishopDashboard />;
      case 'supervisor': return <SupervisorDashboard onNavigate={setCurrentView} />;
      case 'priest': return <PriestDashboard />;
      case 'parent': return <ParentDashboard />;
      case 'employee': return <EmployeeDashboard onNavigate={setCurrentView} />;
      case 'student': return <StudentDashboard onNavigate={setCurrentView} />;
      default: return <StudentDashboard onNavigate={setCurrentView} />;
    }
  }, [user?.role, user?.id]);

  const viewTitles: Record<string, string> = {
    dashboard: 'لوحة التحكم', admin_dashboard: 'لوحة التحكم', bishop_dashboard: 'لوحة التحكم',
    priest_dashboard: 'لوحة التحكم', parent_dashboard: 'لوحة التحكم', student_dashboard: 'لوحة التحكم',
    employee_dashboard: 'لوحة التحكم', supervisor_dashboard: 'لوحة التحكم',
    finance: 'المالية', behavior: 'نقاط السلوك', rewards: 'المكافآت',
    all_activities: 'النشاطات', competition_results: 'نتائج المسابقات',
    broadcasts: 'الإرساليات', competitions: 'المسابقات', competitions_teams: 'فرق المسابقات',
    decisions: 'سجل القرارات', events: 'الفعاليات', events_attendance: 'حضور الفعاليات',
    students: 'الطلاب', attendance: 'الحضور', maintenance: 'الصيانة',
    inventory: 'المخزون', reports: 'التقارير', laundry: 'المغسلة',
    admin_management: 'إدارة النظام', employees: 'الموظفون', badges_admin: 'الشارات',
    payment_methods: 'طرق الدفع', bishop_reports: 'تقارير الأسقف',
    settings: 'الإعدادات', apartments: 'الشقق', profile: 'الملف الشخصي',
    users: 'المستخدمون', rooms: 'الغرف', shared_profiles: 'الملفات المشتركة',
    radio: 'الراديو', admin_radio: 'إدارة الراديو',
    shared_profile: 'الملف المشترك',
  };

  const renderView = () => {
    switch (currentView) {
      case 'shared_profile':
        if (sharedProfileStudentId) {
          return <SharedStudentProfile studentId={sharedProfileStudentId} onBack={() => { setSharedProfileStudentId(null); setCurrentView(initialView); }} />;
        }
        return defaultDashboard;
      case 'dashboard':
      case 'admin_dashboard':
      case 'bishop_dashboard':
      case 'priest_dashboard':
      case 'parent_dashboard':
        return defaultDashboard;
      case 'parent_events':
        return hasPermission(AppPermission.VIEW_EVENTS) ? <EventsPage /> : defaultDashboard;

      case 'finance': return hasPermission(AppPermission.VIEW_FINANCE) ? <FinancePage /> : defaultDashboard;
      case 'behavior': return hasPermission(AppPermission.VIEW_POINTS) && ['supervisor', 'assistant_supervisor', 'priest'].includes(user?.role?.toLowerCase() || '') ? <BehaviorDashboard /> : defaultDashboard;
      case 'rewards': return hasPermission(AppPermission.VIEW_POINTS) ? <RewardsPage /> : defaultDashboard;
      case 'all_activities': return <UnifiedActivitiesPage />;
      case 'competition_results': return <CompetitionResultsPage />;
      case 'broadcasts': return hasPermission(AppPermission.SEND_BROADCAST) ? <BroadcastManagement /> : defaultDashboard;
      case 'competitions': return hasPermission(AppPermission.VIEW_COMPETITIONS) ? <CompetitionsManagement /> : defaultDashboard;
      case 'competitions_teams': return hasPermission(AppPermission.VIEW_COMPETITIONS) ? <CompetitionsManagement defaultView="teams" /> : defaultDashboard;
      case 'decisions': return hasPermission(AppPermission.VIEW_DECISION_LOG) ? <DecisionsLog /> : defaultDashboard;
      case 'events': return hasPermission(AppPermission.VIEW_EVENTS) ? <EventsPage /> : defaultDashboard;
      case 'events_attendance': return hasPermission(AppPermission.MANAGE_EVENT_ATTENDANCE) ? <EventsPage defaultView="attendance" /> : defaultDashboard;
      case 'students': return hasPermission(AppPermission.VIEW_STUDENT) ? <StudentsPage /> : defaultDashboard;
      case 'attendance': return hasPermission(AppPermission.CHECKIN_ATTENDANCE) ? <AttendancePage /> : defaultDashboard;
      case 'maintenance': return (hasPermission(AppPermission.VIEW_MAINTENANCE) || (isStudent && hasPermission(AppPermission.REQUEST_MAINTENANCE))) ? <MaintenancePage /> : defaultDashboard;
      case 'inventory': return hasPermission(AppPermission.VIEW_INVENTORY) ? <div className="p-10 text-center"><p className="text-lg font-bold text-slate-400">لا توجد بيانات متاحة حالياً</p></div> : defaultDashboard;
      case 'reports': return hasPermission(AppPermission.VIEW_REPORTS) ? <div className="p-10 text-center"><p className="text-lg font-bold text-slate-400">لا توجد بيانات متاحة حالياً</p></div> : defaultDashboard;
      case 'laundry': return hasPermission(AppPermission.VIEW_LAUNDRY_QUEUE) ? <LaundryPage /> : defaultDashboard;
      case 'admin_management': return hasPermission(AppPermission.MANAGE_GLOBAL_TENANTS) ? <AdminGuard onBack={() => setCurrentView(initialView)} allowedRoles={['admin', 'bishop']}><AdminSystemPage /></AdminGuard> : defaultDashboard;
      case 'employees': return hasPermission(AppPermission.MANAGE_EMPLOYEES) ? <EmployeesPage /> : defaultDashboard;
      case 'badges_admin': return hasPermission(AppPermission.MANAGE_REWARDS) ? <AdminBadgesPage /> : defaultDashboard;
      case 'payment_methods': return hasPermission(AppPermission.MANAGE_SETTINGS) ? <div className="max-w-3xl mx-auto"><PaymentMethodsManager /></div> : defaultDashboard;
      case 'bishop_reports': return hasPermission(AppPermission.VIEW_GLOBAL_REPORTS) ? <BishopReportsPage /> : defaultDashboard;
      case 'settings': return hasPermission(AppPermission.VIEW_SETTINGS) ? <SettingsPage /> : defaultDashboard;
      case 'apartments': return hasPermission(AppPermission.VIEW_HOUSING) ? <ApartmentsPage /> : defaultDashboard;
      case 'profile': return <ProfilePage />;
      case 'users': return hasPermission(AppPermission.VIEW_USERS) ? <EmployeesPage /> : defaultDashboard;
      case 'rooms': return hasPermission(AppPermission.VIEW_ROOMS) ? <RoomsPage /> : defaultDashboard;
      case 'shared_profiles': return <SharedStudentProfileList onSelect={(sid) => { setSharedProfileStudentId(sid); setCurrentView('shared_profile'); }} />;
      case 'radio': return hasPermission(AppPermission.VIEW_RADIO) ? <Radio514 /> : defaultDashboard;
      case 'admin_radio': return hasPermission(AppPermission.MANAGE_RADIO_BROADCAST) ? <AdminRadio514 /> : defaultDashboard;
      case 'unauthorized': return <NotAuthorizedPage onBack={() => setCurrentView(initialView)} />;
      default: return <NotFoundPage onBack={() => setCurrentView(initialView)} />;
    }
  };

  const handleMenuItemClick = (item: any) => {
    setCurrentView(item.id);
    setIsSidebarOpen(false);
    setSharedProfileStudentId(null);
    if (item.path) navigate(item.path);
  };

  const sidebarWidth = isSidebarCollapsed ? 'w-20' : 'w-72';

  return (
    <>
      <PageHelmet title={viewTitles[currentView]} description={currentView === 'radio' ? 'راديو 5:14 — استمع إلى البث المباشر والبرامج المسيحية' : undefined} />
      <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark' : ''} bg-surface dark:bg-surface-dark`} dir="rtl">
      <div className="fixed inset-0 bg-surface dark:bg-surface-dark transition-colors duration-500 -z-10" />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <motion.aside
        animate={{ width: isSidebarCollapsed ? 80 : 288 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`
          fixed md:static inset-y-0 right-0 z-50 flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}
      >
        <div className={`flex flex-col h-full bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.04] shadow-2xl dark:shadow-black/50 overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'mx-2 my-2' : 'm-3'}`}>
          {/* Logo */}
          <div className={`flex items-center justify-between px-5 py-5 border-b border-slate-50 dark:border-white/5 ${isSidebarCollapsed ? 'flex-col gap-2' : ''}`}>
            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'flex-col' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-vibrant-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/20 shrink-0">
                <Sparkles size={20} />
              </div>
              {!isSidebarCollapsed && (
                <div>
                  <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white block leading-none">سكني</span>
                  <span className="text-[9px] font-bold text-primary-500 dark:text-primary-400 uppercase tracking-widest leading-none">Sakani</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMenuItemClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  currentView === item.id
                    ? 'bg-gradient-to-r from-primary-500/10 to-vibrant-500/10 text-primary-700 dark:text-primary-300 font-bold shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.03] hover:text-slate-700 dark:hover:text-slate-200'
                } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <div className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${currentView === item.id ? 'scale-110' : ''}`}>
                  <item.icon size={isSidebarCollapsed ? 22 : 20} />
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-sm font-bold tracking-tight whitespace-nowrap">{item.label}</span>
                )}
                {currentView === item.id && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gradient-to-b from-primary-500 to-vibrant-500 ${isSidebarCollapsed ? 'hidden' : ''}`}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className={`p-3 border-t border-slate-50 dark:border-white/5 space-y-1 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-all text-xs font-bold ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? 'توسيع' : 'طي'}
            >
              <ChevronLeft size={16} className={`transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
              {!isSidebarCollapsed && <span>طي القائمة</span>}
            </button>

            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all font-bold ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="خروج آمن"
            >
              <LogOut size={18} className="rotate-180 shrink-0" />
              {!isSidebarCollapsed && <span className="text-sm">خروج آمن</span>}
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.04] shadow-sm dark:shadow-black/20 flex items-center justify-between px-3 sm:px-6 mx-3 mt-3 transition-all duration-500 min-h-16 md:h-16">
          <div className="flex items-center gap-2 sm:gap-4 flex-1">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 bg-surface dark:bg-white/5 text-slate-600 dark:text-white rounded-xl md:hidden hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
            >
              <Menu size={20} />
            </button>

            <div className="relative w-full max-w-sm hidden md:block">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery('');
                  }
                }}
                placeholder="ابحث عن الغرف، الطلاب، أو التقارير..."
                className="w-full pr-10 pl-4 py-2.5 bg-surface dark:bg-white/[0.03] border border-transparent focus:border-primary-300/30 rounded-xl outline-none text-sm transition-all dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4">

            <div className="flex items-center gap-1 sm:gap-3">
              <TenantSelector />
              <div className="hidden sm:block">
                <NotificationBell onNavigate={(sid) => { setSharedProfileStudentId(sid); setCurrentView('shared_profile'); }} onNavigateToFinance={(sid) => {
                  const role = user?.role?.toLowerCase();
                  if (role === 'parent') {
                    setCurrentView('parent_dashboard');
                  } else if (role === 'student') {
                    setCurrentView('dashboard');
                  } else {
                    setSharedProfileStudentId(sid);
                    setCurrentView('shared_profile');
                  }
                }} onNavigateToEvent={(eventId) => {
                  const targetView = user?.role === 'parent' || user?.role === 'student' ? 'parent_events' : 'events';
                  sessionStorage.setItem('sakani_pending_event', eventId);
                  setCurrentView(targetView);
                  window.dispatchEvent(new CustomEvent('openEvent', { detail: { eventId } }));
                }} onNavigateToPage={(page) => {
                  const item = allMenuItems.find(m => m.id === page);
                  if (item) handleMenuItemClick(item);
                }} />
              </div>

              <button
                className="flex items-center gap-3 group"
                onClick={() => setCurrentView('profile')}
              >
                <div className="text-left hidden xl:block text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-0.5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{user?.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user?.role}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-vibrant-500 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-primary-500/20 group-hover:shadow-xl group-hover:shadow-primary-500/30 transition-all shrink-0">
                  {user?.name?.[0]}
                </div>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="min-h-full p-3 md:p-4 lg:p-5">
            <ErrorBoundary fallback={null}><Suspense fallback={null}><BroadcastTicker /></Suspense></ErrorBoundary>
            {children && React.Children.count(children) > 0 ? children : (
              <ErrorBoundary key={currentView}>
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-bold text-slate-400">جاري التحميل...</p>
                    </div>
                  </div>
                }>
                  <motion.div
                    key={currentView}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {renderView()}
                  </motion.div>
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        </main>
      </div>
        <PwaInstallPrompt />
      </div>
    </>
  );
}
