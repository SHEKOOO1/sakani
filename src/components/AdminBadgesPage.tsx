import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { Award, Plus, X, Search, Check, Star, BookOpen, Heart, Zap, Shield, Users, AlertCircle } from 'lucide-react';

const ICON_OPTIONS = [
  { value: 'Award', label: 'نجمة', icon: Star },
  { value: 'BookOpen', label: 'كتاب', icon: BookOpen },
  { value: 'Heart', label: 'قلب', icon: Heart },
  { value: 'Zap', label: 'صاعقة', icon: Zap },
  { value: 'Shield', label: 'درع', icon: Shield },
  { value: 'Users', label: 'مجموعة', icon: Users },
];

const COLOR_OPTIONS = [
  { value: 'amber', label: 'ذهبي', class: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'emerald', label: 'أخضر', class: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'blue', label: 'أزرق', class: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'purple', label: 'بنفسجي', class: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'red', label: 'أحمر', class: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'cyan', label: 'سماوي', class: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
];

export function AdminBadgesPage() {
  const { request } = useApi();
  const { user } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const [badges, setBadges] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', icon: 'Award', color: 'amber', category: 'admin' });
  const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const tabsRef = useRef(true);

  useEffect(() => { return () => { tabsRef.current = false; }; }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        request('/api/badges'),
        request('/api/students'),
      ]);
      if (!tabsRef.current) return;
      setBadges(bRes.data || []);
      setStudents(sRes.data || []);
    } catch (err) { console.error(err); } finally { if (tabsRef.current) setLoading(false); }
  }, [request]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await request('/api/badges', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm({ title: '', description: '', icon: 'Award', color: 'amber', category: 'admin' });
      fetchData();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ message: 'هل أنت متأكد من حذف هذه الوسام؟', type: 'danger' })) return;
    try {
      await request(`/api/badges/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const handleAssign = async () => {
    if (!showAssign || assignStudentIds.length === 0) return;
    try {
      await request('/api/badges/assign', {
        method: 'POST',
        body: JSON.stringify({ badgeId: showAssign, studentIds: assignStudentIds, reason: '' }),
      });
      setShowAssign(null);
      setAssignStudentIds([]);
      showSnackbar('تم منح الشارة بنجاح', 'success');
    } catch (err: any) { showSnackbar(err.message, 'error'); }
  };

  const filteredStudents = students.filter((s: any) =>
    s.name?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">إدارة الأوسمة والشارات</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 font-bold mt-1">إنشاء وتوزيع الأوسمة على الطلاب</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg">
          <Plus size={18} /> وسام جديد
        </button>
      </div>

      {/* القائمة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {badges.map((badge: any) => {
          const colorClass = COLOR_OPTIONS.find(c => c.value === badge.color)?.class || 'bg-amber-100 text-amber-700';
          const IconComp = ICON_OPTIONS.find(i => i.value === badge.icon)?.icon || Star;
          return (
            <div key={badge.id} className="bg-white dark:bg-card-dark rounded-[2.5rem] p-6 border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClass} border-2`}>
                  <IconComp size={28} />
                </div>
                <button onClick={() => handleDelete(badge.id)}
                  className="text-slate-400 dark:text-slate-300 hover:text-red-500 transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              <h3 className="font-black text-lg text-slate-900 dark:text-white mb-1">{badge.title}</h3>
              {badge.description && (
                <p className="text-xs text-slate-500 dark:text-slate-300 font-bold mb-3">{badge.description}</p>
              )}
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-[9px] px-2 py-1 rounded-lg font-bold ${badge.category === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {badge.category === 'admin' ? 'إدارة التطبيق' : 'السكن'}
                </span>
              </div>
              <button onClick={() => setShowAssign(badge.id)}
                className="w-full py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2">
                <Users size={14} /> منح للطلاب
              </button>
            </div>
          );
        })}
        {badges.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <Award size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-400 dark:text-slate-300 font-bold">لا توجد أوسمة بعد. أنشئ أول وسام الآن!</p>
          </div>
        )}
      </div>

      {/* Modal إنشاء وسام */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-card-dark rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-black text-lg text-slate-900 dark:text-white">وسام جديد</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 dark:text-slate-300"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-1">اسم الوسام</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  placeholder="مثال: الطالب المثالي" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-1">الوصف</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 h-20 resize-none"
                  placeholder="وصف الوسام..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-1">الأيقونة</label>
                  <div className="flex gap-2">
                    {ICON_OPTIONS.map(opt => {
                      const IconComp = opt.icon;
                      const isSelected = form.icon === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => setForm({ ...form, icon: opt.value })}
                          className={`p-2 rounded-xl border transition-all ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400 dark:text-slate-300 hover:border-slate-300'}`}>
                          <IconComp size={18} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-1">اللون</label>
                  <div className="flex gap-2">
                    {COLOR_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setForm({ ...form, color: opt.value })}
                        className={`w-8 h-8 rounded-xl border-2 transition-all ${form.color === opt.value ? 'border-slate-900 scale-110' : 'border-transparent'} ${opt.class.split(' ')[0]}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-1">الفئة</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none">
                    <option value="admin">إدارة التطبيق</option>
                    <option value="housing">السكن</option>
                  </select>
                </div>
              </div>
              <button type="submit"
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg">
                إنشاء الوسام
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal منح وسام */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-card-dark rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-black text-lg text-slate-900 dark:text-white">منح الوسام للطلاب</h2>
              <button onClick={() => { setShowAssign(null); setAssignStudentIds([]); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white outline-none"
                  placeholder="ابحث عن طالب..." />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredStudents.map((s: any) => {
                  const isSelected = assignStudentIds.includes(s.id);
                  return (
                    <div key={s.id} onClick={() => setAssignStudentIds(prev =>
                      isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]
                    )}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300'}`}>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{s.name}</span>
                      {isSelected && <Check size={16} className="text-blue-600" />}
                    </div>
                  );
                })}
              </div>
              <button onClick={handleAssign} disabled={assignStudentIds.length === 0}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50">
                منح ({assignStudentIds.length} طالب)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
