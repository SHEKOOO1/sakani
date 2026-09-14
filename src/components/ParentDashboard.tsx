import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

import { MessagesSection } from './MessagesSection';
import { DailyReadingsCard } from './DailyReadingsCard';
import { MiniStatCard } from './parent/MiniStatCard';
import { SupervisorContactModal } from './parent/SupervisorContactModal';
import { FileViewerModal, normalizeFilePath, isImageFile, type ViewableFile } from './student/FileViewerModal';
import {
  User, Clock, MapPin, AlertTriangle, CheckCircle2, ArrowRightLeft,
  ShieldCheck, PhoneCall, MessageCircle, CreditCard, Receipt, Star,
  Gavel, ChevronDown, X, Sparkles, FileText, Scale, TrendingUp, TrendingDown, PenLine
} from 'lucide-react';

function formatDateTime(d: string | null | undefined) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function ParentDashboard() {
  const { request } = useApi();
  const { showSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [viewerFile, setViewerFile] = useState<ViewableFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [supervisorContact, setSupervisorContact] = useState<any>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const mounted = useMounted();

  const child = children[selectedChildIndex] || null;

  const fetchChildData = useCallback(async (childId: string) => {
    const [reportRes, financeRes, docsRes] = await Promise.all([
      request(`/api/parents/child/${childId}/report`),
      request(`/api/parents/child/${childId}/finance`),
      request(`/api/parents/child/${childId}/documents`)
    ]);
    if (mounted.current) {
      setReport(reportRes.data || null);
      setFinanceData(financeRes.data || null);
      setDocuments((docsRes.data || []).filter((d: any) => d?.file_path));
    }
  }, [request]);

  const fetchSupervisorContact = useCallback(async (tenantId: string) => {
    try {
      const res = await request(`/api/supervisor/${tenantId}/contact`);
      if (mounted.current && res.data) {
        setSupervisorContact(res.data);
      }
    } catch (e) { console.error('Fetch supervisor contact failed:', e); }
  }, [request]);

  const fetchChildren = useCallback(async () => {
    try {
      setLoading(true);
      const res = await request('/api/parents/children');
      if (!mounted.current) return;
      if (res.success && res.data?.length > 0) {
        setChildren(res.data);
        await fetchChildData(res.data[0].id);
        if (res.data[0].tenant_id) fetchSupervisorContact(res.data[0].tenant_id);
      }
    } catch (err) {
      console.error('Error fetching parent dashboard data', err);
      showSnackbar('فشل تحميل البيانات', 'error');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request, fetchChildData]);

  const switchChild = useCallback(async (idx: number) => {
    if (idx === selectedChildIndex || !children[idx]) return;
    setSelectedChildIndex(idx);
    setReport(null);
    setFinanceData(null);
    setLoading(true);
    await fetchChildData(children[idx].id);
    setLoading(false);
  }, [selectedChildIndex, children, fetchChildData]);

  useEffect(() => {

    fetchChildren();
    
  }, [fetchChildren]);

  const points = report?.behavior?.points || [];
  const warnings = report?.behavior?.warnings || [];
  const attendance = report?.attendance || [];
  const totalPoints = points.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const activeWarnings = warnings.filter((w: any) => w.status === 'active').length;

  if (loading && !child) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="font-black text-slate-400 dark:text-slate-300 animate-pulse">جاري التحميل...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">


      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 p-8 text-white shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black">مرحباً، أ/ {user?.name}</h1>
              <p className="text-white/70 font-bold text-sm">نظام متابعة الأبناء</p>
            </div>
          </div>

          {children.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {children.map((c: any, idx: number) => (
                <button
                  key={c.id}
                  onClick={() => switchChild(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    idx === selectedChildIndex
                      ? 'bg-white text-primary-700 shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {child && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">حالة الطالب</p>
            <p className={`text-sm font-black ${child?.is_traveling ? 'text-warm-500' : 'text-ocean-500'}`}>
              {child?.is_traveling ? 'في حالة سفر' : 'داخل السكن'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">السكن</p>
            <p className="text-sm font-black text-slate-800 dark:text-white">{child?.tenant_name || '---'}</p>
          </div>
          {child?.apartment_name && (
            <div className="rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">الموقع</p>
              <p className="text-sm font-black text-slate-800 dark:text-white">{child.apartment_name} - غرفة {child.room_number}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStatCard label="آخر التحاضير" value={attendance.length} icon={<CheckCircle2 size={18} />} color="ocean" />
        <MiniStatCard label="إجمالي النقاط" value={totalPoints} icon={<Star size={18} />} color="warm" />
        <MiniStatCard label="إنذارات نشطة" value={activeWarnings} icon={<Gavel size={18} />} color="rose" />
        <MiniStatCard
          label="المتبقي"
          value={financeData ? `${financeData.remaining.toLocaleString()} ج.م` : '---'}
          icon={<CreditCard size={18} />}
          color="primary"
        />
      </div>

      <DailyReadingsCard />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                <ArrowRightLeft className="text-primary-500" size={20} />
                سجل التحركات
              </h3>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-300">آخر 10 تحركات</span>
            </div>
            {loading && !report ? (
              <div className="py-10 text-center text-slate-300 dark:text-slate-400 animate-pulse font-bold">جاري التحميل...</div>
            ) : attendance.length > 0 ? (
              <div className="space-y-2">
                {attendance.map((move: any) => (
                  <div key={move.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${move.type === 'check-in' ? 'bg-ocean-100 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400' : 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'}`}>
                        {move.type === 'check-in' ? <CheckCircle2 size={18} /> : <ArrowRightLeft size={18} className="rotate-180" />}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-white text-sm">
                          {move.type === 'check-in' ? 'تسجيل دخول للسكن' : 'تسجيل خروج من السكن'}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">
                          {new Date(move.created_at).toLocaleDateString('ar-EG')} | {new Date(move.created_at).toLocaleTimeString('ar-EG')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${move.status === 'late' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/30' : 'bg-white dark:bg-card-dark text-slate-400 dark:text-slate-300 border border-slate-100 dark:border-white/10'}`}>
                      {move.status === 'late' ? 'تأخير' : 'طبيعي'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-300 dark:text-slate-400 italic font-bold">لا توجد تحركات مسجلة</div>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-5 flex items-center gap-3">
              <Star className="text-warm-500" size={20} />
              سجل السلوك
            </h3>
            {loading && !report ? (
              <div className="py-10 text-center text-slate-300 dark:text-slate-400 animate-pulse font-bold">جاري التحميل...</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pl-2">
                {[...points, ...warnings.map((w: any) => ({ ...w, _type: 'warning' }))]
                  .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 10)
                  .map((item: any, idx: number) => (
                  <div key={item.id || idx} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-black text-sm ${
                      item._type === 'warning' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-ocean-100 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400'
                    }`}>
                      {item._type === 'warning' ? <Gavel size={16} /> : <Star size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 dark:text-white text-sm truncate">{item.reason || item.description || 'تسجيل'}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">
                        {new Date(item.created_at).toLocaleDateString('ar-EG')} | {new Date(item.created_at).toLocaleTimeString('ar-EG')}
                        {item._type === 'warning' && <span className="text-rose-500 dark:text-rose-400 mr-2">إنذار</span>}
                      </p>
                    </div>
                    {!item._type && (
                      <span className="text-sm font-black text-ocean-600 dark:text-ocean-400">+{item.amount}</span>
                    )}
                  </div>
                ))}
                {(points.length === 0 && warnings.length === 0) && (
                  <div className="py-12 text-center text-slate-300 dark:text-slate-400 italic font-bold">لا توجد أحداث سلوكية مسجلة</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <MessagesSection />

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <h3 className="font-black text-slate-800 dark:text-white mb-5 flex items-center gap-3">
              <MapPin className="text-primary-500" size={18} />
              بيانات السكن
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400"><MapPin size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">السكن</p>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">{child?.tenant_name || '---'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vibrant-50 text-vibrant-600 dark:bg-vibrant-500/20 dark:text-vibrant-400"><User size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">الموقع</p>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">{child?.apartment_name || 'أ'} - غرفة {child?.room_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-50 text-warm-600 dark:bg-warm-500/20 dark:text-warm-400"><Clock size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">موعد غلق الباب</p>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">{child?.curfew_time || 'غير محدد'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <h3 className="font-black text-slate-800 dark:text-white mb-5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-3">
                <CreditCard className="text-ocean-500" size={18} />
                المصروفات
              </span>
              {financeData && financeData.debtStatus === 'debt' && (
                <span className="text-[9px] bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 px-2.5 py-1 rounded-full font-black">مدين</span>
              )}
              {financeData && financeData.debtStatus === 'credit' && (
                <span className="text-[9px] bg-teal-100 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300 px-2.5 py-1 rounded-full font-black">دائن</span>
              )}
              {financeData && financeData.debtStatus === 'paid' && financeData.invoice > 0 && (
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 px-2.5 py-1 rounded-full font-black">مدفوع ✓</span>
              )}
            </h3>
            {financeData ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                  <span className="text-xs font-black text-slate-500 dark:text-slate-300">إجمالي الفاتورة</span>
                  <div className="flex items-center gap-2">
                    {financeData.billingCycle && (
                      <span className="text-[9px] bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-full font-bold text-slate-500 dark:text-slate-300">
                        {financeData.billingCycle === 'daily' ? 'يومي' : financeData.billingCycle === 'monthly' ? 'شهري' : 'فصل دراسي'}
                      </span>
                    )}
                    <span className="text-lg font-black text-slate-800 dark:text-white">{financeData.invoice.toLocaleString()} ج.م</span>
                  </div>
                </div>

                {financeData.source === 'agreed' && financeData.invoice > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[9px] text-amber-600 dark:text-amber-300 font-bold">
                    الفاتورة محسوبة من اتفاق الطالب (سعر الغرفة غير مسجل)
                  </div>
                )}

                <div className="flex justify-between items-center rounded-xl bg-ocean-50 p-4 dark:bg-ocean-500/10">
                  <span className="text-xs font-black text-ocean-600 dark:text-ocean-400">المدفوع</span>
                  <span className="text-lg font-black text-ocean-700 dark:text-ocean-300">{financeData.totalPaid.toLocaleString()} ج.م</span>
                </div>

                {financeData.totalPenalties > 0 && (
                  <div className="flex justify-between items-center rounded-xl bg-rose-50 p-4 dark:bg-rose-500/10">
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <AlertTriangle size={13} /> جزاءات
                    </span>
                    <span className="text-lg font-black text-rose-600 dark:text-rose-400">{financeData.totalPenalties.toLocaleString()} ج.م</span>
                  </div>
                )}

                <div className={`flex justify-between items-center rounded-xl p-4 ${
                  (financeData.balance ?? financeData.remaining) > 0 ? 'bg-warm-50 dark:bg-warm-500/10' : (financeData.balance ?? 0) < 0 ? 'bg-teal-50 dark:bg-teal-500/10' : 'bg-ocean-50 dark:bg-ocean-500/10'
                }`}>
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">{(financeData.balance ?? 0) < 0 ? 'رصيد دائن (لصالح الابن)' : 'المتبقي'}</span>
                  <span className={`text-lg font-black ${
                    (financeData.balance ?? financeData.remaining) > 0 ? 'text-warm-600 dark:text-warm-400' : (financeData.balance ?? 0) < 0 ? 'text-teal-600 dark:text-teal-400' : 'text-ocean-600 dark:text-ocean-400'
                  }`}>
                    {(financeData.balance ?? 0) < 0
                      ? `${(financeData.creditAmount ?? -(financeData.balance ?? 0)).toLocaleString()} ج.م`
                      : (financeData.balance ?? financeData.remaining) > 0
                        ? `${financeData.remaining.toLocaleString()} ج.م`
                        : 'مدفوع ✓'}
                  </span>
                </div>

                {(financeData.balance ?? 0) < 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-teal-50 dark:bg-teal-500/10 px-4 py-2.5 text-[10px] text-teal-700 dark:text-teal-300 font-bold">
                    <Scale size={13} className="shrink-0" />
                    الابن دائن بمبلغ {(financeData.creditAmount ?? -(financeData.balance ?? 0)).toLocaleString()} ج.م — دفع زيادة عن الفاتورة.
                  </div>
                )}

                {/* شريط نسبة السداد */}
                <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-l from-ocean-500 to-ocean-400 rounded-full transition-all duration-500" style={{ width: `${financeData.paymentPercent}%` }} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-slate-400 dark:text-slate-300 font-bold">نسبة السداد</span>
                  <span className="text-[9px] font-black text-ocean-500 dark:text-ocean-400">{Math.round(financeData.paymentPercent)}%</span>
                </div>

                {financeData.transactions?.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Receipt size={12} className="text-slate-400 dark:text-slate-300" />
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">سجل المعاملات ({financeData.transactions.length})</p>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                      {financeData.transactions.map((t: any) => {
                        const isEdit = t.kind === 'edit';
                        const isExpense = !isEdit && t.type === 'expense';
                        const positive = t.sign === 'increase';
                        return (
                          <div key={t.id} className={`flex items-center justify-between rounded-xl p-3 ${isEdit ? 'bg-violet-50 dark:bg-violet-500/10' : 'bg-slate-50 dark:bg-white/5'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${isEdit ? 'bg-violet-100 dark:bg-violet-500/20' : isExpense ? 'bg-red-100 dark:bg-red-500/15' : 'bg-ocean-50 dark:bg-ocean-500/10'}`}>
                                {isEdit ? <PenLine size={11} className="text-violet-500 dark:text-violet-300" /> : isExpense ? <TrendingDown size={11} className="text-red-500 dark:text-red-400" /> : <TrendingUp size={11} className="text-ocean-500 dark:text-ocean-400" />}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[11px] text-slate-500 dark:text-slate-300 truncate font-black block flex items-center gap-1">
                                  <span className="truncate">{t.description || t.category || (isExpense ? 'خصم' : 'دفعة')}</span>
                                  {isEdit && <span className="text-[7px] bg-violet-200 dark:bg-violet-500/30 text-violet-600 dark:text-violet-200 px-1.5 py-0.5 rounded-full font-black shrink-0">تعديل</span>}
                                  {isEdit && t.editor_name && <span className="text-[7px] bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-bold shrink-0">{t.editor_name}</span>}
                                </span>
                                <p className="text-[8px] text-slate-400 dark:text-slate-300">{formatDateTime(t.created_at)}{isEdit && t.summary ? ` · ${t.summary.substring(0, 45)}${t.summary.length > 45 ? '…' : ''}` : ''}</p>
                                {!isEdit && t.payment_method_name && (
                                  <span className="inline-block mt-0.5 text-[8px] bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-black">
                                    {t.payment_method_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              {isEdit ? (
                                t.sign ? (
                                  <span className={`text-xs font-black ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {positive ? '+' : '−'}{Number(t.amount).toLocaleString()} ج.م
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black text-violet-500 dark:text-violet-300">تعديل</span>
                                )
                              ) : (
                                <span className={`text-xs font-black ${isExpense ? 'text-red-500 dark:text-red-400' : 'text-ocean-600 dark:text-ocean-400'}`}>
                                  {isExpense ? '−' : '+'}{Number(t.amount).toLocaleString()} ج.م
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-300 font-bold text-center py-6">لا توجد بيانات</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <h3 className="font-black text-slate-800 dark:text-white mb-5 flex items-center gap-3">
              <FileText className="text-primary-500" size={18} />
              وثائق وملفات الابن
            </h3>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-300 font-bold text-center py-6">لا توجد وثائق مرفوعة بعد</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => {
                  const src = normalizeFilePath(doc.file_path);
                  const isImg = isImageFile(doc);
                  return (
                    <button key={doc.id}
                      onClick={() => setViewerFile({ id: doc.id, file_name: doc.file_name, doc_type: doc.doc_type, file_path: doc.file_path })}
                      className="w-full text-left flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                      {isImg && src ? (
                        <img src={src} alt="" className="w-10 h-10 object-cover rounded-lg border border-white/10" />
                      ) : (
                        <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
                          <FileText size={16} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{doc.file_name || 'ملف'}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-300 font-bold">{doc.doc_type || 'ملف'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-gradient-to-br from-primary-600 to-vibrant-600 p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={20} />
              <p className="font-black text-sm">التواصل مع الإدارة</p>
            </div>
            <p className="text-[10px] text-white/70 font-bold leading-relaxed mb-5">
              في حال وجود استفسارات بخصوص ابنكم، يرجى التواصل مع المشرف المسؤول.
            </p>
            <button onClick={() => setShowContactModal(true)}
              className="w-full py-3.5 bg-white/10 hover:bg-white/20 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2">
              <PhoneCall size={13} /> اتصل بالمشرف المقيم
            </button>
          </div>

          <SupervisorContactModal
            isOpen={showContactModal}
            contact={supervisorContact || {}}
            onClose={() => setShowContactModal(false)}
          />

          <FileViewerModal file={viewerFile} onClose={() => setViewerFile(null)} />

          {activeWarnings > 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-6 dark:border-rose-500/30 dark:bg-rose-500/10">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="text-rose-600 dark:text-rose-400" size={20} />
                <h3 className="font-black text-rose-800 dark:text-rose-300">تنبيهات</h3>
              </div>
              <div className="rounded-xl border border-rose-200 bg-white p-4 dark:border-rose-500/30 dark:bg-card-dark">
                <p className="text-xs font-black text-rose-700 dark:text-rose-300">تم تسجيل {activeWarnings} إنذارات نشطة</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1">يرجى مراجعة سجل السلوك في الملف الكامل.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
