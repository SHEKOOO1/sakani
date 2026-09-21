import { useState, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { QRScanner } from '../QRScanner';
import {
  QrCode, ArrowRight, Calendar, Clock, Users, CheckCircle2, XCircle,
  Loader2, Play, Square, Camera, AlertCircle, RefreshCw, PencilLine,
  Gavel, Plus, FilePlus2
} from 'lucide-react';
import { AppPermission } from '../../types/permissions';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  present: { label: 'حاضر', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  late: { label: 'متأخر', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  absent: { label: 'غائب', cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  excused: { label: 'معذور', cls: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  travel: { label: 'سفر', cls: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300' },
};

const REVIEW_LABELS: Record<string, { label: string; cls: string }> = {
  UNEXCUSED: { label: 'غياب غير مبرر', cls: 'bg-rose-600 text-white hover:bg-rose-700' },
  EXCUSED: { label: 'معذور', cls: 'bg-sky-600 text-white hover:bg-sky-700' },
  TRAVEL: { label: 'سفر', cls: 'bg-violet-600 text-white hover:bg-violet-700' },
};

export function EventAttendanceOperatorPage() {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [manualId, setManualId] = useState('');
  const [reviewRows, setReviewRows] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickStart, setQuickStart] = useState('');

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await request('/api/events/operator/events');
      setEvents(res?.data || []);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تحميل الفعاليات');
    } finally {
      setEventsLoading(false);
    }
  }, [request]);

  const loadSessions = useCallback(async (eventId: string) => {
    setSessionsLoading(true);
    try {
      const res = await request(`/api/events/${eventId}/attendance-scan/sessions`);
      setSessions(res?.data || []);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تحميل الجلسات');
    } finally {
      setSessionsLoading(false);
    }
  }, [request]);

  const loadRoster = useCallback(async (eventId: string, sessionId: string) => {
    setRosterLoading(true);
    try {
      const res = await request(`/api/events/${eventId}/attendance-scan/sessions/${sessionId}`);
      setRoster(res?.data?.rows || []);
      setSelectedSession(res?.data?.session || null);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تحميل الحضور');
    } finally {
      setRosterLoading(false);
    }
  }, [request]);

  const loadReview = useCallback(async (eventId: string) => {
    setReviewLoading(true);
    try {
      const res = await request(`/api/events/${eventId}/attendance/review`);
      setReviewRows(res?.data || []);
    } catch {
      setReviewRows([]);
    } finally {
      setReviewLoading(false);
    }
  }, [request]);

  const classifyReview = async (atdId: string, classification: string) => {
    if (!selectedEvent) return;
    setBusy(`rev-${atdId}`);
    try {
      const res = await request(`/api/events/${selectedEvent.id}/attendance/${atdId}/review`, {
        method: 'POST',
        body: JSON.stringify({ classification, reason: reviewNote.trim() || undefined }),
      });
      flash(true, (res as any)?.message || 'تم تصنيف الغياب');
      setReviewNote('');
      loadReview(selectedEvent.id);
      if (selectedSession) await loadRoster(selectedEvent.id, selectedSession.id);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تصنيف الغياب');
    } finally {
      setBusy(null);
    }
  };

  const quickCreateSession = async () => {
    if (!selectedEvent || !quickTitle.trim() || !quickStart) return;
    setBusy('quick');
    try {
      await request(`/api/events/${selectedEvent.id}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ title: quickTitle.trim(), start_time: quickStart, type: 'lecture' }),
      });
      flash(true, 'تم إنشاء الجلسة');
      setQuickTitle('');
      setQuickStart('');
      setQuickOpen(false);
      await loadSessions(selectedEvent.id);
    } catch (e: any) {
      flash(false, (e as any)?.message || 'تعذر إنشاء الجلسة');
    } finally {
      setBusy(null);
    }
  };

  const chooseEvent = async (ev: any) => {
    setSelectedEvent(ev);
    setSelectedSession(null);
    setRoster([]);
    await loadSessions(ev.id);
    loadReview(ev.id);
  };

  const chooseSession = (s: any) => {
    setSelectedSession(s);
    loadRoster(selectedEvent.id, s.id);
    loadReview(selectedEvent.id);
  };

  const toggleSession = async (action: 'open' | 'close') => {
    if (!selectedEvent || !selectedSession) return;
    setBusy(action);
    try {
      const res = await request(`/api/events/${selectedEvent.id}/attendance-scan/sessions/${selectedSession.id}/${action}`, { method: 'POST' });
      flash(true, (res as any)?.message || (action === 'open' ? 'تم فتح الجلسة' : 'تم إغلاق الجلسة'));
      await loadSessions(selectedEvent.id);
      if (selectedSession) await loadRoster(selectedEvent.id, selectedSession.id);
      if (action === 'close') loadReview(selectedEvent.id);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تنفيذ العملية');
    } finally {
      setBusy(null);
    }
  };

  const runScan = async (qrText: string) => {
    if (!selectedEvent || !selectedSession) return;
    setBusy('scan');
    try {
      const res = await request(`/api/events/${selectedEvent.id}/attendance-scan/sessions/${selectedSession.id}/scan`, {
        method: 'POST',
        body: JSON.stringify({ qr: qrText, method: 'qr' }),
      });
      const d = res?.data || {};
      flash(true, `${(res as any)?.message || 'تم التسجيل'} — ${d.student?.name || ''}`);
      await loadRoster(selectedEvent.id, selectedSession.id);
      await loadSessions(selectedEvent.id);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تسجيل الحضور');
    } finally {
      setBusy(null);
    }
  };

  const manualSubmit = async () => {
    if (!selectedEvent || !selectedSession || !manualId.trim()) return;
    setBusy('manual');
    try {
      const res = await request(`/api/events/${selectedEvent.id}/attendance-scan/sessions/${selectedSession.id}/scan`, {
        method: 'POST',
        body: JSON.stringify({ studentId: manualId.trim(), method: 'manual' }),
      });
      setManualId('');
      flash(true, `${(res as any)?.message || 'تم التسجيل'}`);
      await loadRoster(selectedEvent.id, selectedSession.id);
      await loadSessions(selectedEvent.id);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تسجيل الحضور');
    } finally {
      setBusy(null);
    }
  };

  const renderEvents = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-800 dark:text-white">الفعاليات المكلف بها</h2>
        <button onClick={loadEvents} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors" title="تحديث">
          <RefreshCw size={16} />
        </button>
      </div>
      {eventsLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
          <AlertCircle size={28} />
          <p className="text-sm font-bold">لا توجد فعاليات مخصصة لك لتشغيل الحضور</p>
        </div>
      ) : (
        events.map((ev) => (
          <button
            key={ev.id}
            onClick={() => chooseEvent(ev)}
            className="w-full flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] hover:border-primary-300 dark:hover:border-primary-500/40 transition-all text-right"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500/15 to-vibrant-500/15 flex items-center justify-center text-primary-600 dark:text-primary-300">
                <Calendar size={20} />
              </div>
              <div>
                <p className="font-black text-sm text-slate-800 dark:text-white">{ev.title}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                  <Clock size={11} /> {ev.event_date ? new Date(ev.event_date).toLocaleDateString('ar-EG') : 'بدون تاريخ'}
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-slate-300 dark:text-white/20" />
          </button>
        ))
      )}
    </div>
  );

  const renderSessionList = () => (
    <div className="space-y-3">
      <button onClick={() => { setSelectedEvent(null); setSelectedSession(null); }} className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-300 hover:text-primary-600 transition-colors">
        <ArrowRight size={14} /> العودة للفعاليات
      </button>
      <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
        جلسات {selectedEvent?.title}
      </h2>
      {sessionsLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : sessions.length === 0 ? (
        <div className="p-8 text-center text-sm font-bold text-slate-400">لا توجد جلسات لهذه الفعالية</div>
      ) : (
        sessions.map((s) => {
          const at = s._attendance || { present: 0, late: 0, absent: 0, total: 0 };
          return (
            <button
              key={s.id}
              onClick={() => chooseSession(s)}
              className="w-full flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] hover:border-primary-300 transition-all text-right"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500"><Users size={20} /></div>
                <div>
                  <p className="font-black text-sm text-slate-800 dark:text-white">{s.title || 'جلسة'}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {s.start_time ? new Date(s.start_time).toLocaleString('ar-EG') : ''}
                    {' • '}حاضر {at.present} • متأخر {at.late} • غائب {at.absent}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${s.status === 'open' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : s.status === 'closed' ? 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300' : 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'}`}>
                {s.status === 'open' ? 'مفتوحة' : s.status === 'closed' ? 'مغلقة' : 'مجدولة'}
              </span>
            </button>
          );
        })
      )}
      {!quickOpen ? (
        <button onClick={() => setQuickOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 text-xs font-black text-slate-500 dark:text-slate-300 hover:border-primary-400 hover:text-primary-600 transition-colors">
          <FilePlus2 size={15} /> جلسة سريعة جديدة
        </button>
      ) : (
        <div className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] space-y-3">
          <p className="text-xs font-black text-slate-800 dark:text-white">جلسة سريعة جديدة</p>
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="عنوان الجلسة"
            className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/40 outline-none"
          />
          <input
            type="datetime-local"
            value={quickStart}
            onChange={(e) => setQuickStart(e.target.value)}
            className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-primary-500/40 outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={quickCreateSession}
              disabled={busy === 'quick' || !quickTitle.trim() || !quickStart}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-vibrant-600 text-white text-xs font-black hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === 'quick' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} إنشاء الجلسة
            </button>
            <button onClick={() => setQuickOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );

  const counts = (rows: any[]) => ({
    present: rows.filter((r) => r.status === 'present').length,
    late: rows.filter((r) => r.status === 'late').length,
    absent: rows.filter((r) => r.status === 'absent').length,
    total: rows.length,
  });

  const renderSession = () => {
    if (!selectedEvent || !selectedSession && roster.length === 0 && !rosterLoading) {
      return <div className="p-8 text-center text-sm font-bold text-slate-400">اختر جلسة لبدء التسجيل</div>;
    }
    const c = counts(roster);
    const isOpen = selectedSession?.status === 'open';
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedSession(null); setRoster([]); }} className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-300 hover:text-primary-600 transition-colors">
          <ArrowRight size={14} /> العودة للجلسات
        </button>

        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">{selectedSession?.title || 'جلسة'}</h2>
              <p className="text-[10px] text-slate-400 font-bold mt-1">{selectedEvent?.title}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isOpen && selectedSession?.status !== 'closed' && (
                <button
                  onClick={() => toggleSession('open')}
                  disabled={busy === 'open'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {busy === 'open' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} فتح الجلسة
                </button>
              )}
              {isOpen && (
                <>
                  <button onClick={() => setScannerOpen(true)} disabled={busy === 'scan'} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-vibrant-600 text-white text-xs font-black hover:opacity-90 transition-opacity disabled:opacity-50">
                    <Camera size={14} /> مسح QR
                  </button>
                  <button
                    onClick={() => toggleSession('close')}
                    disabled={busy === 'close'}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 transition-colors disabled:opacity-50"
                  >
                    {busy === 'close' ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} إغلاق وترحيل الغياب
                  </button>
                </>
              )}
              {selectedSession?.status === 'closed' && (
                <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-black">مغلقة - الغياب مرحّل</span>
              )}
              <button onClick={() => { if (selectedSession) loadRoster(selectedEvent.id, selectedSession.id); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-600" title="تحديث"><RefreshCw size={15} /></button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-center">
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-300">{c.present}</p>
              <p className="text-[10px] font-bold text-emerald-500/70">حاضر</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-center">
              <p className="text-lg font-black text-amber-600 dark:text-amber-300">{c.late}</p>
              <p className="text-[10px] font-bold text-amber-500/70">متأخر</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-center">
              <p className="text-lg font-black text-rose-600 dark:text-rose-300">{c.absent}</p>
              <p className="text-[10px] font-bold text-rose-500/70">غائب</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 text-center">
              <p className="text-lg font-black text-slate-600 dark:text-slate-300">{c.total}</p>
              <p className="text-[10px] font-bold text-slate-400">الإجمالي</p>
            </div>
          </div>

          {hasPermission(AppPermission.MANAGE_EVENT_ATTENDANCE) && isOpen && (
            <div className="flex gap-2 mt-3">
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="معرف الطالب (إدخال يدوي - يتطلب صلاحية)"
                className="flex-1 p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/40 outline-none"
              />
              <button onClick={manualSubmit} disabled={busy === 'manual' || !manualId.trim()} className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-white text-white dark:text-slate-800 text-xs font-black hover:bg-slate-900 disabled:opacity-40 transition-colors">
                {busy === 'manual' ? <Loader2 size={14} className="animate-spin" /> : <PencilLine size={14} />}
              </button>
            </div>
          )}
        </div>

        {rosterLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
        ) : roster.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
            <QrCode size={28} />
            <p className="text-sm font-bold">{selectedSession?.status === 'open' ? 'ابدأ بفتح الجلسة ثم امسح رموز الطلاب' : 'لا توجد سجلات حضور لهذه الجلسة'}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5">
              <p className="text-sm font-black text-slate-700 dark:text-white">سجل الحضور ({roster.length})</p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-96 overflow-y-auto custom-scrollbar">
              {roster.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.present;
                return (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-white">{r.student_name || 'طالب'}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                        {r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString('ar-EG') : '—'}
                        {r.late_minutes ? ` • متأخر ${r.late_minutes} دقيقة` : ''}
                        {r.penalty_financial ? ` • غرامة ${r.penalty_financial} ج` : ''}
                        {r.penalty_points_ledger ? ` • -${r.penalty_points_ledger} نقطة` : ''}
                        {r.final_status ? ` • ${r.final_status}` : ''}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${meta.cls}`}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasPermission(AppPermission.MANAGE_EVENT_ATTENDANCE) && (
          <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
              <p className="text-sm font-black text-slate-700 dark:text-white flex items-center gap-2">
                <Gavel size={15} className="text-rose-500" /> مراجعة الغياب المعلقة
              </p>
              <button onClick={() => selectedEvent && loadReview(selectedEvent.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600" title="تحديث">
                <RefreshCw size={13} />
              </button>
            </div>
            {reviewLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
            ) : reviewRows.length === 0 ? (
              <p className="p-6 text-center text-xs font-bold text-slate-400">لا توجد غيابات معلقة للمراجعة</p>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5">
                  <p className="text-[10px] font-bold text-slate-400 mb-1.5">ملاحظة (تُسجَّل مع التصنيف)</p>
                  <input
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="مثال: عذر طبي مرفق..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/40 outline-none"
                  />
                </div>
                <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-80 overflow-y-auto custom-scrollbar">
                  {reviewRows.map((r) => (
                    <div key={r.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800 dark:text-white truncate">{r.student_name || r.student_id}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">
                            {r.session_title || 'جلسة'} • {r.absence_reason || 'بدون سبب'} • {r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('ar-EG') : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(['UNEXCUSED', 'EXCUSED', 'TRAVEL'] as const).map((cls) => {
                            const m = REVIEW_LABELS[cls];
                            return (
                              <button key={cls} onClick={() => classifyReview(r.id, cls)} disabled={busy === `rev-${r.id}`}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-colors disabled:opacity-50 ${m.cls}`}>
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-5 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-600 to-vibrant-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
          <QrCode size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">تسجيل حضور الفعاليات</h1>
          <p className="text-[11px] text-slate-400 font-bold">المرّئون: {user?.name || ''}</p>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black ${toast.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
          {toast.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          <span>{toast.text}</span>
        </div>
      )}

      {!selectedEvent && !selectedSession && renderEvents()}
      {selectedEvent && !selectedSession && renderSessionList()}
      {selectedEvent && selectedSession && renderSession()}

      {scannerOpen && selectedSession?.status === 'open' && (
        <QRScanner
          title={`مسح QR — ${selectedSession?.title || 'جلسة'}`}
          onScan={(qr) => { setScannerOpen(false); runScan(qr); }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}