import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { ALL_PERMISSIONS, getVisiblePermissions, type PermissionInfo } from './profiles/rolesConfig';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, Shield, Clock, MapPin, Save, Lock,
  Users, AlertCircle, Sparkles, Building2, DoorOpen, DoorClosed, Navigation
} from 'lucide-react';
import { CustomRolesManager } from './CustomRolesManager';
import { LocationMapPicker } from './LocationMapPicker';

type TabType = 'general' | 'permissions_map' | 'roles';

export function SettingsPage() {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [loading, setLoading] = useState(false);
  
  const [tenantConfig, setTenantConfig] = useState({
    name: '',
    open_time: '',
    curfew_time: '',
    location_radius: 50,
    is_active: true
  });

  const [locationData, setLocationData] = useState({
    entry: { lat: null as number | null, lng: null as number | null, radius: 50 },
    exit: { lat: null as number | null, lng: null as number | null, radius: 50 },
  });

  const visiblePermissionKeys = useMemo(() => {
    return getVisiblePermissions(user?.role || '', user?.custom_permissions || null);
  }, [user?.role, user?.custom_permissions]);

  const permissionGroups = useMemo(() => {
    const groups: Record<string, PermissionInfo[]> = {};
    for (const perm of ALL_PERMISSIONS) {
      if (!visiblePermissionKeys.includes(perm.key)) continue;
      if (!groups[perm.group]) groups[perm.group] = [];
      groups[perm.group].push(perm);
    }
    return groups;
  }, [visiblePermissionKeys]);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await request('/api/tenants/config');
      if (res.success && res.data) {
        setTenantConfig({
          name: res.data.name || '',
          open_time: res.data.open_time || '',
          curfew_time: res.data.curfew_time || '',
          location_radius: res.data.location_radius || 50,
          is_active: res.data.is_active ?? true
        });
        setLocationData({
          entry: {
            lat: res.data.entry_lat ?? null,
            lng: res.data.entry_lng ?? null,
            radius: res.data.entry_radius || 50,
          },
          exit: {
            lat: res.data.exit_lat ?? null,
            lng: res.data.exit_lng ?? null,
            radius: res.data.exit_radius || 50,
          },
        });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSaveConfig = async () => {
    try {
      await request('/api/tenants/config', {
        method: 'PUT',
        body: JSON.stringify({
          ...tenantConfig,
          entry_lat: locationData.entry.lat,
          entry_lng: locationData.entry.lng,
          entry_radius: locationData.entry.radius,
          exit_lat: locationData.exit.lat,
          exit_lng: locationData.exit.lng,
          exit_radius: locationData.exit.radius,
        })
      });
      showSnackbar('تم حفظ الإعدادات بنجاح', 'success');
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const tabs = [
    { id: 'general', label: 'عام', icon: Settings },
    { id: 'permissions_map', label: 'خريطة الصلاحيات', icon: Shield },
    { id: 'roles', label: 'إدارة الأدوار', icon: Users },
  ] as const;

  const canManageSettings = hasPermission(AppPermission.MANAGE_SETTINGS);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-6 text-white shadow-xl">
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black">الإعدادات</h1>
            <p className="text-white/70 font-bold text-sm">إعدادات السكن والصلاحيات والأدوار</p>
          </div>
        </div>
      </div>

      <div className="flex bg-slate-100 dark:bg-white/10 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 shadow-lg' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white'}`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'general' && (
          <motion.div key="general" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* معلومات السكن */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
                      <Building2 size={18} className="text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white">معلومات السكن</h3>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300">البيانات الأساسية</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">اسم السكن</label>
                      <input type="text" value={tenantConfig.name} onChange={e => setTenantConfig(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-blue-300 dark:focus:border-blue-500 transition-all dark:text-white"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                      <div>
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">حالة السكن</span>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300">{tenantConfig.is_active ? 'نشط' : 'متوقف'}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={tenantConfig.is_active} onChange={e => setTenantConfig(f => ({ ...f, is_active: e.target.checked }))} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* مواعيد الباب */}
                <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vibrant-50 dark:bg-vibrant-500/10">
                      <Clock size={18} className="text-vibrant-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white">مواعيد الباب</h3>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300">أوقات فتح وغلق السكن</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5 flex items-center gap-2">
                        <DoorOpen size={14} className="text-emerald-500" /> موعد فتح الباب
                      </label>
                      <input type="time" value={tenantConfig.open_time} onChange={e => setTenantConfig(f => ({ ...f, open_time: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-vibrant-300 dark:focus:border-vibrant-500 transition-all dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5 flex items-center gap-2">
                        <DoorClosed size={14} className="text-red-500" /> موعد غلق الباب
                      </label>
                      <input type="time" value={tenantConfig.curfew_time} onChange={e => setTenantConfig(f => ({ ...f, curfew_time: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-vibrant-300 dark:focus:border-vibrant-500 transition-all dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* الموقع الجغرافي */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                      <Navigation size={18} className="text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white">الموقع الجغرافي</h3>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300">نقاط الدخول والخروج GPS</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5 flex items-center gap-2">
                        <MapPin size={14} /> نصف قطر الموقع العام (متر)
                      </label>
                      <div className="flex items-center gap-4">
                        <input type="range" min={10} max={500} value={tenantConfig.location_radius} onChange={e => setTenantConfig(f => ({ ...f, location_radius: Number(e.target.value) }))}
                          className="flex-1 accent-primary-600 dark:accent-primary-400"
                        />
                        <span className="text-sm font-black text-slate-800 dark:text-white w-16 text-left">{tenantConfig.location_radius} م</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 dark:border-white/10 pt-6">
                      <p className="text-[11px] text-slate-400 dark:text-slate-300 font-bold mb-4">
                        حدد على الخريطة نقطة الدخول ونقطة الخروج من السكن مع تحديد نطاق كل نقطة
                      </p>
                      <LocationMapPicker
                        entry={locationData.entry}
                        exit={locationData.exit}
                        onEntryChange={(entry) => setLocationData(d => ({ ...d, entry }))}
                        onExitChange={(exit) => setLocationData(d => ({ ...d, exit }))}
                      />
                    </div>
                  </div>
                </div>

                {/* حفظ */}
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
                  <div>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">حفظ الإعدادات</p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300">تطبيق جميع التغييرات على السكن</p>
                  </div>
                  <button onClick={handleSaveConfig} disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-primary-700 transition-all disabled:opacity-50"
                  >
                    <Save size={16} /> حفظ الإعدادات
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'permissions_map' && (
          <motion.div key="permissions_map" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-5 flex items-center gap-3">
                <Shield size={18} className="text-vibrant-600 dark:text-vibrant-400" />
                خريطة الصلاحيات
              </h3>
              {Object.entries(permissionGroups).map(([group, perms]) => (
                <div key={group} className="mb-6 last:mb-0">
                  <h4 className="font-black text-sm text-slate-700 dark:text-slate-200 mb-3 px-1">{group}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {perms.map(perm => (
                      <div key={perm.key} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                        <Shield size={14} className="text-primary-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{perm.label}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold truncate">{perm.key}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'roles' && (
          <motion.div key="roles" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <CustomRolesManager />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
