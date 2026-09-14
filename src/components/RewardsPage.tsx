import React, { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { motion, AnimatePresence } from 'motion/react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { 
  Gift, Award, CheckCircle2, XCircle, Plus, ShoppingBag, Clock,
  UserCheck, Star, Search, ChevronLeft, Zap, Sparkles
} from 'lucide-react';

interface Reward {
  id: string;
  title: string;
  description: string;
  cost: number;
  stock: number;
  category: string;
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
  points_bonus: number;
}

const badgePresets: { name: string; icon: string; color: string; points_bonus: number }[] = [
  { name: 'نجمة الالتزام', icon: 'star', color: 'bg-amber-400', points_bonus: 50 },
  { name: 'المثالية', icon: 'award', color: 'bg-emerald-500', points_bonus: 100 },
  { name: 'التميز الأكاديمي', icon: 'graduation', color: 'bg-blue-500', points_bonus: 200 },
  { name: 'الروح الرياضية', icon: 'heart', color: 'bg-rose-500', points_bonus: 75 },
  { name: 'النظام والنظافة', icon: 'sparkles', color: 'bg-violet-500', points_bonus: 60 },
  { name: 'المبادرة التطوعية', icon: 'hand', color: 'bg-teal-500', points_bonus: 90 },
  { name: 'المواظبة على القداسات', icon: 'church', color: 'bg-orange-500', points_bonus: 150 },
  { name: 'القيادة', icon: 'crown', color: 'bg-yellow-500', points_bonus: 120 },
];

export const RewardsPage: React.FC = () => {
  const { request } = useApi();
  const { user } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState<'store' | 'requests' | 'badges'>('store');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const mounted = useMounted();

  const [formData, setFormData] = useState({
    title: '', description: '', cost: 0, stock: 0, category: 'عام'
  });

  const [badgeForm, setBadgeForm] = useState({
    name: '', icon: 'star', color: 'bg-amber-400', points_bonus: 50, student_id: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rewardRes, requestRes] = await Promise.all([
        request('/api/rewards').catch(() => null),
        request('/api/rewards/requests').catch(() => null),
      ]);
      let studentsRes = null;
      if (user?.role !== 'student') {
        studentsRes = await request('/api/behavior/students').catch(() => null);
      }
      if (!mounted.current) return;
      if (rewardRes) setRewards(rewardRes.data || []);
      if (requestRes) setRequests(requestRes.data || []);
      if (studentsRes) setStudents(studentsRes.data || []);
    } catch (err) { console.error(err); }
    finally { if (mounted.current) setLoading(false); }
  }, [request, user?.role]);

  useEffect(() => {

    fetchData();
    
  }, [fetchData]);

  const filteredStudents = students.filter((s: any) =>
    s.name?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const tabs = [
    { id: 'store', label: 'المتجر', icon: ShoppingBag },
    { id: 'requests', label: 'الطلبات', icon: Gift },
    { id: 'badges', label: 'الشارات', icon: Award },
  ] as const;

  if (loading) return <div className="p-10 space-y-4"><div className="h-32 bg-slate-100 rounded-xl animate-pulse" /><div className="h-64 bg-slate-100 rounded-xl animate-pulse" /></div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-6 text-white shadow-xl">
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black">المكافآت والشارات</h1>
            <p className="text-white/70 font-bold text-sm">متجر المكافآت، طلب المكافآت، وإدارة الشارات</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex bg-slate-100 dark:bg-white/10 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 shadow-lg' : 'text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
        {user?.role !== 'student' && (
          <button onClick={() => setShowAddRewardModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-primary-700 transition-all">
            <Plus size={16} /> إضافة مكافأة
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'store' && (
          <motion.div key="store" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            {rewards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rewards.map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-white/[0.04] dark:bg-card-dark">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-50 dark:bg-warm-500/20">
                        <Gift size={20} className="text-warm-600 dark:text-warm-400" />
                      </div>
                      <span className="rounded-full bg-primary-50 px-3 py-1 text-[10px] font-black text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">{r.category}</span>
                    </div>
                    <h3 className="font-black text-slate-800 dark:text-white mb-1">{r.title}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-300 font-bold mb-4">{r.description}</p>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <Star size={14} className="text-warm-500" />
                        <span className="font-black text-slate-800 dark:text-white">{r.cost}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-300">المتبقي: {r.stock}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-card-dark">
                <ShoppingBag size={40} className="mx-auto text-slate-200 dark:text-slate-600 mb-3" />
                <p className="font-black text-slate-400 dark:text-slate-300">لا توجد مكافآت في المتجر</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'requests' && (
          <motion.div key="requests" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            {requests.length > 0 ? (
              <div className="space-y-3">
                {requests.map((req: any) => (
                  <div key={req.id} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/20">
                          <UserCheck size={20} className="text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 dark:text-white text-sm">{req.student_name}</h4>
                          <p className="text-xs text-slate-400 dark:text-slate-300 font-bold">{req.reward_title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={11} /> {new Date(req.created_at).toLocaleDateString('ar-EG')}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              req.status === 'pending' ? 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' :
                              req.status === 'approved' ? 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400' :
                              'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            }`}>
                              {req.status === 'pending' ? 'معلق' : req.status === 'approved' ? 'مقبول' : 'مرفوض'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-black text-warm-600 dark:text-warm-400"><Star size={13} /> {req.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-card-dark">
                <Gift size={40} className="mx-auto text-slate-200 dark:text-slate-600 mb-3" />
                <p className="font-black text-slate-400 dark:text-slate-300">لا توجد طلبات مكافآت</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'badges' && (
          <motion.div key="badges" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">الشارات المتاحة</h3>
              {user?.role !== 'student' && (
                <button onClick={() => setShowBadgeModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-vibrant-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-vibrant-700 transition-all">
                  <Plus size={16} /> منح شارة
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {badgePresets.map((badge, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-white p-5 text-center shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
                  <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${badge.color} text-white shadow-sm`}>
                    <Award size={22} />
                  </div>
                  <h4 className="font-black text-slate-800 dark:text-white text-sm">{badge.name}</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-1">{badge.points_bonus} نقطة</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Reward Modal */}
      <AnimatePresence>
        {showAddRewardModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowAddRewardModal(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="rounded-xl bg-white p-6 max-w-md w-full shadow-2xl dark:bg-card-dark border border-slate-100 dark:border-white/10" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-slate-800 dark:text-white mb-5">إضافة مكافأة جديدة</h3>
              <form onSubmit={async (e) => { e.preventDefault(); try { await request('/api/rewards', { method: 'POST', body: JSON.stringify(formData) }); showSnackbar('تمت الإضافة', 'success'); setShowAddRewardModal(false); fetchData(); } catch (err: any) { showSnackbar(err.message, 'error'); } }} className="space-y-4">
                <input placeholder="العنوان" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-500 transition-all dark:text-white" />
                <textarea placeholder="الوصف" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-500 transition-all resize-none dark:text-white" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400">التكلفة</label>
                    <input type="number" value={formData.cost} onChange={e => setFormData(f => ({ ...f, cost: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400">المخزون</label>
                    <input type="number" value={formData.stock} onChange={e => setFormData(f => ({ ...f, stock: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400">التصنيف</label>
                    <input value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none dark:text-white" />
                  </div>
                </div>
                <button type="submit" className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 transition-all shadow-lg">حفظ</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge Modal */}
      <AnimatePresence>
        {showBadgeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowBadgeModal(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="rounded-xl bg-white p-6 max-w-lg w-full shadow-2xl dark:bg-card-dark border border-slate-100 dark:border-white/10" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-slate-800 dark:text-white mb-5">منح شارة لطالب</h3>
              <form onSubmit={async (e) => { e.preventDefault(); try { await request('/api/rewards/badges', { method: 'POST', body: JSON.stringify(badgeForm) }); showSnackbar('تم منح الشارة', 'success'); setShowBadgeModal(false); fetchData(); } catch (err: any) { showSnackbar(err.message, 'error'); } }} className="space-y-4">
                <div className="relative">
                  <input placeholder="ابحث عن طالب..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                    className="w-full px-5 py-3 pr-12 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-vibrant-500 transition-all dark:text-white" />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
                {studentSearch && filteredStudents.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-slate-100 p-2 dark:border-white/10">
                    {filteredStudents.slice(0, 10).map((s: any) => (
                      <button key={s.id} type="button" onClick={() => { setBadgeForm(f => ({ ...f, student_id: s.id })); setSelectedStudent(s); setStudentSearch(''); }}
                        className={`flex items-center gap-3 w-full p-3 rounded-xl text-right text-xs font-bold transition-all ${badgeForm.student_id === s.id ? 'bg-vibrant-50 text-vibrant-700 dark:bg-vibrant-500/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vibrant-50 font-black text-vibrant-600 text-xs">{s.name?.charAt(0)}</div>
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                <select value={badgeForm.name} onChange={e => {
                  const preset = badgePresets.find(b => b.name === e.target.value);
                  setBadgeForm(f => ({ ...f, name: e.target.value, icon: preset?.icon || 'star', color: preset?.color || 'bg-amber-400', points_bonus: preset?.points_bonus || 50 }));
                }} className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none dark:text-white">
                  {badgePresets.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}
                </select>
                <button type="submit" disabled={!badgeForm.student_id}
                  className="w-full py-3.5 bg-vibrant-600 text-white rounded-xl font-black text-sm hover:bg-vibrant-700 transition-all disabled:opacity-50 shadow-lg">منح الشارة</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
