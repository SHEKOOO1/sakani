import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Radio, Music, RefreshCw, Loader2, Wifi, Image, Upload, Save,
  Plus, CalendarDays, Clock, Heart, Edit3, Trash2, Bell, Link2,
  Volume2, Tv, Repeat, List, X, Pin, PinOff, Lock, Ban,
  Search, Star, BookOpen, Film, GripVertical, Youtube, Eye, EyeOff
} from 'lucide-react';

interface CurrentTrack {
  id: string; title: string; artist: string; cover_url: string;
  description: string; stream_url: string; started_at: string;
}

interface SongHistoryItem {
  id: string; title: string; artist: string; cover_url: string;
  played_at: string; likes: number; liked_by_me: boolean;
}

interface Broadcast {
  id: string; title: string; description: string; cover_image: string;
  host_name: string; guest_name: string; stream_url: string;
  type: 'audio' | 'video' | 'both'; is_active: boolean; is_pinned: boolean;
  scheduled_at: string; recurring: boolean; recurring_day: string;
  recurring_time: string; playlist_id: string; created_at: string;
}

interface AudioBroadcastTabProps {
  request: (url: string, options?: any) => Promise<any>;
  showSnackbar: (msg: string, type: 'success' | 'error' | 'info') => void;
  confirm: (opts: any) => Promise<boolean>;
  fetchAll: () => void;
  fetchAutoMetadata: () => void;
  currentTrack: CurrentTrack | null;
  songHistory: SongHistoryItem[];
  broadcasts: Broadcast[];
  streamOnline: boolean;
  streamChecking: boolean;
  loading: boolean;
  autoMetadata: { title: string; artist: string } | null;
  autoUpdatePaused: boolean;
  setAutoUpdatePaused: (v: boolean) => void;
  openBroadcastForm: (item?: Broadcast) => void;
  handleDeleteBroadcast: (id: string) => Promise<void>;
  handlePublishToTicker: (b: Broadcast) => Promise<void>;
  handleTogglePinBroadcast: (broadcast: Broadcast) => Promise<void>;
}

const DEFAULT_COVER = '/img/Radio5-14-Logo.jpg';
const FALLBACK_COVER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} ي`;
}

export function AudioBroadcastTab({
  request, showSnackbar, confirm, fetchAll, fetchAutoMetadata,
  currentTrack, songHistory, broadcasts,
  streamOnline, streamChecking, loading, autoMetadata, autoUpdatePaused,
  setAutoUpdatePaused,
  openBroadcastForm, handleDeleteBroadcast, handlePublishToTicker, handleTogglePinBroadcast,
}: AudioBroadcastTabProps) {
  const [calView, setCalView] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [filteredHistory, setFilteredHistory] = useState<SongHistoryItem[]>([]);
  const [manualStreamUrl, setManualStreamUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCoverUrl, setManualCoverUrl] = useState('');
  const [manualOverriding, setManualOverriding] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showLivePulse, setShowLivePulse] = useState(true);
  const [showInTicker, setShowInTicker] = useState(false);
  const [sendPushNotification, setSendPushNotification] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!historySearch.trim()) {
      setFilteredHistory(songHistory);
    } else {
      const q = historySearch.trim().toLowerCase();
      setFilteredHistory(songHistory.filter(s =>
        s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
      ));
    }
  }, [songHistory, historySearch]);

  const handleManualOverride = async () => {
    if (!manualTitle.trim()) { showSnackbar('يرجى إدخال اسم الترنيمة', 'error'); return; }
    setManualOverriding(true);
    try {
      await request('/api/radio/current-track', {
        method: 'PUT',
        body: JSON.stringify({
          title: manualTitle.trim(),
          artist: manualArtist.trim(),
          cover_url: manualCoverUrl.trim() || undefined,
          description: manualDescription.trim() || undefined,
          stream_url: manualStreamUrl.trim() || undefined,
          show_live_pulse: showLivePulse,
          show_in_ticker: showInTicker,
          send_push_notification: sendPushNotification,
        }),
      });
      setAutoUpdatePaused(true);
      showSnackbar('تم تحديث بيانات البث فوراً — تم إيقاف التحديث التلقائي من Radiojar', 'success');
      if (sendPushNotification) {
        try {
          await request('/api/radio/push-notification', {
            method: 'POST',
            body: JSON.stringify({ title: manualTitle.trim(), artist: manualArtist.trim() }),
          });
          showSnackbar('تم إرسال الإشعار للمستخدمين', 'success');
        } catch { showSnackbar('فشل إرسال الإشعار', 'error'); }
      }
      fetchAll();
    } catch (err: any) { showSnackbar(err.message || 'فشل التحديث', 'error'); }
    finally { setManualOverriding(false); }
  };

  const handleUploadCover = async (file: File) => {
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await request('/api/radio/upload-cover', { method: 'POST', body: formData, headers: {} });
      if (res.success && res.data?.url) {
        setManualCoverUrl(res.data.url);
        showSnackbar('تم رفع الصورة', 'success');
      }
    } catch { showSnackbar('فشل رفع الصورة', 'error'); }
    finally { setUploadingCover(false); }
  };

  return (
    <motion.div key="audio_broadcast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right: Audio Metadata + Stream URL (5 cols) */}
        <div className="lg:col-span-5 space-y-6 order-first lg:order-last">
          {/* Audio: Live Metadata Control */}
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
                <Radio size={22} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">التحكم في بيانات البث</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">إذاعي — Radio Metadata Control</p>
              </div>
            </div>

            {/* Auto Metadata Display — Radiojar */}
            <div className="p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl mb-5">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={12} className={`${autoUpdatePaused ? '' : 'text-primary-500 animate-spin-slow'}`} />
                <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">Radiojar — البث التلقائي</span>
                {autoUpdatePaused ? (
                  <span className="mr-auto px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 rounded text-[8px] font-bold text-amber-700 dark:text-amber-400">متوقف</span>
                ) : (
                  <span className="mr-auto px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 rounded text-[8px] font-bold text-emerald-700 dark:text-emerald-400">مباشر</span>
                )}
              </div>
              {autoMetadata ? (
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">{autoMetadata.title || '—'}</p>
                  <p className="text-xs font-bold text-slate-500 truncate">{autoMetadata.artist || '—'}</p>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400">جاري جلب البيانات...</p>
              )}
              {autoUpdatePaused && (
                <button onClick={async () => {
                  try { await request('/api/radio/radiojar/resume', { method: 'POST' }); setAutoUpdatePaused(false); fetchAutoMetadata(); showSnackbar('تم استئناف التحديث التلقائي', 'success'); }
                  catch { showSnackbar('فشل استئناف التحديث', 'error'); }
                }}
                  className="mt-3 w-full px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5">
                  <RefreshCw size={12} /> استئناف التحديث التلقائي
                </button>
              )}
            </div>

            {/* Manual Override */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
                    <Music size={12} className="text-primary-500" />
                    اسم الترنيمة / البرنامج الحالي
                  </label>
                  <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all"
                    placeholder="مثال: مجداً لملاكك" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
                    <Volume2 size={12} className="text-primary-500" />
                    اسم المرتل / المذيع
                  </label>
                  <input type="text" value={manualArtist} onChange={e => setManualArtist(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all"
                    placeholder="مثال: فرقة الكرم" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-2">الوصف</label>
                  <input type="text" value={manualDescription} onChange={e => setManualDescription(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all"
                    placeholder="وصف المادة الحالية" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
                    <Image size={12} className="text-primary-500" />
                    رابط صورة الغلاف
                  </label>
                  <div className="flex gap-2">
                    <input type="url" value={manualCoverUrl} onChange={e => setManualCoverUrl(e.target.value)}
                      className="flex-1 p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="https://example.com/cover.jpg" />
                    <button onClick={() => coverFileRef.current?.click()} disabled={uploadingCover}
                      className="shrink-0 px-3 py-3 bg-slate-200 dark:bg-white/10 rounded-xl hover:bg-slate-300 dark:hover:bg-white/15 transition-all disabled:opacity-40">
                      {uploadingCover ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                    </button>
                    <input type="file" ref={coverFileRef} accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadCover(f); }} />
                  </div>
                </div>
              </div>
              <button onClick={handleManualOverride} disabled={manualOverriding}
                className="w-full py-3 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-primary-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {manualOverriding ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                تطبيق التغييرات
              </button>
            </div>
          </div>
        </div>

        {/* Left: Stream URL + Song History + Schedule (7 cols) */}
        <div className="lg:col-span-7 space-y-6 order-last lg:order-first">
          {/* Stream URL */}
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-sky-50 dark:bg-sky-500/10 rounded-lg">
                <Wifi size={18} className="text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">رابط البث الإذاعي</h3>
                <p className="text-[8px] text-slate-400 font-bold">الرابط الصوتي للبث المباشر — Radiojar Stream URL</p>
              </div>
              <div className="mr-auto flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border ${
                  streamOnline ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${streamOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  {streamOnline ? 'متصل' : 'منقطع'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl font-mono text-xs text-slate-500">
              <Link2 size={14} className="shrink-0 text-slate-400" />
              <span className="truncate direction-ltr text-left">https://stream.radiojar.com/ps7z45v12k8uv</span>
            </div>
          </div>

          {/* Song History */}
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
                  <Music size={18} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">أرشيف وتاريخ الترانيم</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">سجل الترانيم التي تم بثها — {songHistory.length} ترنيمة</p>
                </div>
              </div>
              <div className="mr-auto relative w-full sm:w-64">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                  placeholder="ابحث في السجل..."
                  className="w-full pr-9 pl-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" />
              </div>
            </div>
            {loading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700/30 rounded-xl animate-pulse" />)}</div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
                <Clock size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-400">{historySearch ? 'لا توجد نتائج للبحث' : 'لا توجد مواد سابقة'}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                {filteredHistory.map((item, idx) => (
                  <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                    className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all group">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-white/10">
                      <img src={item.cover_url || DEFAULT_COVER} alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { const el = e.target as HTMLImageElement; el.src = FALLBACK_COVER; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-xs font-bold text-slate-500 truncate">{item.artist || 'راديو 5:14'}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold hidden sm:block">{timeAgo(item.played_at)}</span>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-lg">
                      <Heart size={12} className={item.liked_by_me ? 'fill-amber-500 text-amber-500' : 'text-slate-400'} />
                      <span className="text-[10px] font-bold text-slate-500">{item.likes}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Broadcast Schedule Summary */}
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                  <CalendarDays size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">جدول البرنامج الأسبوعي</h3>
                  <p className="text-[8px] text-slate-400 font-bold">مواعيد البث المبرمجة — سمعي / مرئي</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCalView(p => !p)}
                  className={"px-2.5 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 " + (calView ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20')}>
                  <CalendarDays size={12} /> {calView ? 'عرض القائمة' : 'عرض التقويم'}
                </button>
                <button onClick={() => openBroadcastForm()}
                  className="px-3 py-2 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow-primary-500/30 transition-all flex items-center gap-1.5">
                  <Plus size={14} /> إضافة برنامج
                </button>
              </div>
            </div>
            {calView ? (
              (() => {
                const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0,0,0,0);
                const weekDates = Array.from({length:7}, (_,i) => {
                  const d = new Date(startOfWeek);
                  d.setDate(startOfWeek.getDate() + i);
                  return d;
                });
                const handleDrop = async (e: React.DragEvent, dayIdx: number) => {
                  const bid = e.dataTransfer.getData('text/plain');
                  if (!bid) return;
                  const targetDate = weekDates[dayIdx];
                  const broadcast = broadcasts.find(b2 => b2.id === bid);
                  if (!broadcast || !broadcast.scheduled_at) return;
                  const oldTime = new Date(broadcast.scheduled_at);
                  const newDate = new Date(targetDate);
                  newDate.setHours(oldTime.getHours(), oldTime.getMinutes(), 0, 0);
                  await request(`/api/radio/broadcasts/${bid}`, {
                    method: 'PUT',
                    body: JSON.stringify({ scheduled_at: newDate.toISOString() }),
                  });
                  showSnackbar('تم تغيير الميعاد', 'success');
                  fetchAll();
                };
                return (
                  <div className="grid grid-cols-7 gap-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {weekDates.map((date, i) => {
                      const dateStr = date.toLocaleDateString('en-CA');
                      const dayBroadcasts = broadcasts.filter(b => b.is_active && b.scheduled_at).filter(b => {
                        const bd = new Date(b.scheduled_at);
                        return bd.toLocaleDateString('en-CA') === dateStr;
                      }).sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                      const isToday = date.toLocaleDateString('en-CA') === now.toLocaleDateString('en-CA');
                      return (
                        <div key={i} onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e,i)}
                          className={"rounded-xl border p-2 min-h-[120px] transition-all " + (isToday ? 'bg-primary-50 dark:bg-primary-500/5 border-primary-200 dark:border-primary-500/20' : 'bg-white dark:bg-card-dark border-slate-100 dark:border-white/[0.06]')}>
                          <div className={"text-center mb-2 pb-2 border-b border-dashed " + (isToday ? 'border-primary-200 dark:border-primary-500/20' : 'border-slate-100 dark:border-white/10')}>
                            <p className={"text-[8px] font-bold " + (isToday ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400')}>{dayNames[i]}</p>
                            <p className={"text-[15px] font-black " + (isToday ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300')}>{date.getDate()}</p>
                          </div>
                          <div className="space-y-1">
                            {dayBroadcasts.length === 0 ? (
                              <p className="text-[7px] text-slate-300 dark:text-slate-600 text-center py-3">—</p>
                            ) : dayBroadcasts.map(b => (
                              <div key={b.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain',b.id)}
                                className="group relative p-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-grab active:cursor-grabbing transition-all">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-[8px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{b.title}</span>
                                  {b.type === 'video' ? <Tv size={8} className="shrink-0 text-red-500" /> : b.type === 'both' ? null : <Radio size={8} className="shrink-0 text-primary-500" />}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock size={7} className="text-slate-400" />
                                  <span className="text-[7px] font-bold text-slate-500 font-mono">
                                    {new Date(b.scheduled_at).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' })}
                                  </span>
                                </div>
                                <div className="absolute top-0.5 left-0.5 hidden group-hover:flex gap-0.5">
                                  <button onClick={e => { e.stopPropagation(); openBroadcastForm(b); }}
                                    className="p-0.5 rounded bg-white dark:bg-slate-800 shadow text-slate-400 hover:text-primary-600">
                                    <Edit3 size={7} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : broadcasts.filter(b => b.is_active).length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-4">لا توجد برامج مجدولة</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pl-1">
                {broadcasts.filter(b => b.is_active).sort((a: any, b: any) => {
                  const dayOrder = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                  if (!a.scheduled_at) return 1; if (!b.scheduled_at) return -1;
                  const aDate = new Date(a.scheduled_at); const bDate = new Date(b.scheduled_at);
                  const aDay = dayOrder.indexOf(aDate.toLocaleDateString('en-US', { weekday: 'long' }));
                  const bDay = dayOrder.indexOf(bDate.toLocaleDateString('en-US', { weekday: 'long' }));
                  if (aDay !== bDay) return aDay - bDay;
                  return aDate.getTime() - bDate.getTime();
                }).map(b => {
                  const dt = b.scheduled_at ? new Date(b.scheduled_at) : null;
                  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                  const type = b.type || 'audio';
                  return (
                    <div key={b.id} className="flex items-start gap-4 p-4 rounded-xl border transition-all group bg-white dark:bg-card-dark border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-white/10">
                        <img src={b.cover_image || DEFAULT_COVER} alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { const el = e.target as HTMLImageElement; el.src = FALLBACK_COVER; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{b.title}</p>
                          {type === 'video' ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 rounded text-[8px] font-bold text-red-600 dark:text-red-400"><Tv size={10} /> مرئي</span>
                          ) : type === 'both' ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 rounded text-[8px] font-bold text-purple-600 dark:text-purple-400">سمعي + مرئي</span>
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-500/10 rounded text-[8px] font-bold text-primary-600 dark:text-primary-400"><Radio size={10} /> إذاعي</span>
                          )}
                          {b.recurring ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 rounded text-[8px] font-bold text-emerald-600 dark:text-emerald-400"><Repeat size={10} /> أسبوعي</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {dt && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{dayNames[dt.getDay()]}</span>}
                          {dt && <span className="text-[10px] font-bold text-slate-500 font-mono" dir="ltr">{dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        {(b.host_name || b.guest_name) && (
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {b.host_name && <span className="text-[9px] font-bold text-slate-500">المذيع: {b.host_name}</span>}
                            {b.guest_name && <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">الضيف: {b.guest_name}</span>}
                          </div>
                        )}
                        {b.recurring && b.recurring_day && b.recurring_time && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Repeat size={10} className="text-amber-500" />
                            <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400">
                              إعادة: {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(b.recurring_day)]} {b.recurring_time}
                            </span>
                          </div>
                        )}
                        {b.playlist_id && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <List size={10} className="text-primary-500" />
                            <span className="text-[8px] font-bold text-primary-600 dark:text-primary-400">
                              قائمة تشغيل مرتبطة
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        <button onClick={() => openBroadcastForm(b)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-all">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={() => handlePublishToTicker(b)}
                          title="نشر في شريط الأخبار"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-all">
                          <Bell size={12} />
                        </button>
                        <button onClick={() => handleDeleteBroadcast(b.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[8px] text-slate-400 font-bold mt-4 text-center">إجمالي {broadcasts.filter(b => b.is_active).length} برنامج مجدول</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
