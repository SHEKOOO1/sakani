import { useState, useEffect, useCallback } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { motion, AnimatePresence } from 'motion/react';

export function TenantSelector() {
  const { user, switchTenant } = useAuth();
  const { request } = useApi();
  const [tenants, setTenants] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchMyTenants = useCallback(async () => {
    try {
      const res = await request('/api/admin/my-tenants');
      const data = res.data || [];
      setTenants(data);

    } catch (err) {
      console.error(err);
    }
  }, [user?.tenantId, user?.role, request, switchTenant]);

  useEffect(() => {
    if (user?.role === 'priest' || user?.role === 'supervisor') {
      fetchMyTenants();
    }
  }, [user?.role, fetchMyTenants]);

  const currentTenant = tenants.find(t => t.id === user?.tenantId) || { name: 'لم يتم اختيار سكن' };

  if (tenants.length <= 1) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-all group max-w-[200px]"
      >
        <Building2 size={16} className="text-blue-600 shrink-0" />
        <div className="text-right min-w-0 flex-1">
           <p className="text-[10px] font-black text-slate-400 uppercase leading-tight">السكن الحالي</p>
           <p className="text-xs font-black text-slate-700 truncate leading-tight">{currentTenant.name}</p>
        </div>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-0 mt-2 w-56 sm:w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-50 bg-slate-50/50">
               <h4 className="text-xs font-black text-slate-500 uppercase">اختر السكن المراد إدارته</h4>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {tenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    switchTenant(t.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-blue-50 transition-colors text-right"
                >
                  <span className={`text-sm font-bold ${t.id === user?.tenantId ? 'text-blue-600' : 'text-slate-600'}`}>
                    {t.name}
                  </span>
                  {t.id === user?.tenantId && <Check size={16} className="text-blue-600" />}
                </button>
              ))}
              {tenants.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 italic">لا توجد سكنات مخصصة لك حالياً</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
