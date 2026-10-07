import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useApi } from '../hooks/useApi';
import { Ban } from 'lucide-react';
import { StopConfirmModal } from './studio/StopConfirmModal';
import { PostWizardModal } from './studio/PostWizardModal';
import { ArchiveBrowser } from './studio/ArchiveBrowser';
import { AutomationTriggers } from './studio/AutomationTriggers';
import { ChatPanel } from './studio/ChatPanel';
import { LiveControlHeader } from './studio/LiveControlHeader';
import { AdminLivePreviewCard } from './studio/AdminLivePreviewCard';
import { ActiveLiveStreams } from './studio/ActiveLiveStreams';
import { LiveStreamInjectionCard } from './studio/LiveStreamInjectionCard';
import { useLiveControlRoomData } from '../hooks/useLiveControlRoomData';

let liveStylesInjected = false;
function injectLiveStyles() {
  if (liveStylesInjected) return;
  liveStylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `@keyframes pulse-shadow{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}100%{box-shadow:0 0 0 20px rgba(239,68,68,0)}}.animate-pulse-shadow{animation:pulse-shadow 2s cubic-bezier(0.4,0,0.6,1) infinite}`;
  document.head.appendChild(style);
}

interface VideoItem {
  id: string; title: string; description: string; youtube_url: string;
  youtube_id: string; platform?: string; category: string; program: string;
  tags: string[]; thumbnail: string; duration: string; is_live: boolean;
  was_live: boolean; is_active?: boolean; is_featured?: boolean;
  broadcast_id?: string | null; created_at: string;
}

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=|v\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

const FLOATING_REACTIONS = ['❤️', '🙏', '✝️', '🕊️', '🔥', '💒', '⭐', '🌿'];

export function LiveControlRoom({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const { request } = useApi();

  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [masterHover, setMasterHover] = useState(false);
  const [showPostWizard, setShowPostWizard] = useState(false);
  const [archiveVideo, setArchiveVideo] = useState(true);
  const [chatReadOnly, setChatReadOnly] = useState(true);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [injectionMode, setInjectionMode] = useState<'now' | 'schedule'>('now');
  const [streamTitle, setStreamTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewYoutubeId, setPreviewYoutubeId] = useState('');
  const [previewPlatform, setPreviewPlatform] = useState<'youtube' | 'facebook' | ''>('');
  const [pinnedToTicker, setPinnedToTicker] = useState(() => {
    try { return localStorage.getItem('radioPinnedToTicker') === 'true'; }
    catch { return false; }
  });
  const [pinnedBroadcastId, setPinnedBroadcastId] = useState<string | null>(() => {
    try { return localStorage.getItem('radioPinnedBroadcastId'); }
    catch { return null; }
  });
  const [pushNotificationSent, setPushNotificationSent] = useState(false);
  const [pushSending, setPushSending] = useState(false);
  const [masterLoading, setMasterLoading] = useState(false);
  const masterVideoIdRef = useRef<string | null>(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<any>(null);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const reactIdRef = useRef(0);
  const [stopConfirmed, setStopConfirmed] = useState(false);
  const [wasLiveIdsLocal, setWasLiveIdsLocal] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('radioWasLiveIds');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const {
    videos, liveVideos,
    scheduledBroadcasts, wasLiveIds: serverWasLiveIds,
    chatMessages, streamOnline,
    mutations, invalidateAll,
  } = useLiveControlRoomData(isLive);

  const wasLiveIds = new Set([...serverWasLiveIds, ...wasLiveIdsLocal]);
  const archiveVideos = videos.filter(v => !v.is_live);

  useEffect(() => { injectLiveStyles(); }, []);

  useEffect(() => {
    localStorage.setItem('radioWasLiveIds', JSON.stringify(Array.from(wasLiveIdsLocal)));
  }, [wasLiveIdsLocal]);
  useEffect(() => {
    if (pinnedBroadcastId) localStorage.setItem('radioPinnedBroadcastId', pinnedBroadcastId);
    else localStorage.removeItem('radioPinnedBroadcastId');
    localStorage.setItem('radioPinnedToTicker', String(pinnedToTicker));
  }, [pinnedBroadcastId, pinnedToTicker]);

  useEffect(() => {
    if (isLive && liveVideos.length === 0 && videos.length > 0 && pinnedBroadcastId) {
      handleUnpinFromTickerFallback();
    }
  }, [liveVideos.length, videos.length]);

  const handleUnpinFromTickerFallback = async () => {
    try { await mutations.pinTicker.mutateAsync({ action: 'unpin', broadcastId: pinnedBroadcastId }); } catch {}
    setPinnedToTicker(false);
    setPinnedBroadcastId(null);
  };

  useEffect(() => {
    if (isLive && viewerCount > peakViewers) setPeakViewers(viewerCount);
  }, [isLive, viewerCount, peakViewers]);

  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);
      return () => clearInterval(timerRef.current);
    } else { setTimer(0); }
  }, [isLive]);

  useEffect(() => {
    if (isLive) {
      const base = Math.floor(Math.random() * 50) + 20;
      setViewerCount(base);
      const iv = setInterval(() => setViewerCount(prev => Math.max(5, prev + Math.floor(Math.random() * 7) - 3)), 5000);
      return () => clearInterval(iv);
    } else { setViewerCount(0); }
  }, [isLive]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const lastFetchedUrl = useRef('');

  useEffect(() => {
    const id = extractYoutubeId(streamUrl);
    setPreviewYoutubeId(id);
    const plat = /facebook\.com|fb\.watch|fb\.com/i.test(streamUrl) ? 'facebook' as const : id ? 'youtube' as const : '' as const;
    setPreviewPlatform(plat);
    const normalized = streamUrl.trim().toLowerCase();
    if (!normalized || normalized === lastFetchedUrl.current || streamTitle) return;
    lastFetchedUrl.current = normalized;
    const isYoutube = !!(normalized.match(/(?:youtube\.com|youtu\.be)/));
    const isFacebook = !!(normalized.match(/(?:facebook\.com|fb\.watch|fb\.com)/));
    if (isYoutube) {
      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(streamUrl.trim())}&format=json`)
        .then(r => r.json()).then(data => {
          if (data?.title && normalized === lastFetchedUrl.current) setStreamTitle(prev => prev || data.title.replace(/\([0-9]{4}\)|\[.*?\]/g, '').trim());
        }).catch(() => {});
    } else if (isFacebook) {
      fetch(`https://www.facebook.com/plugins/video/oembed.json?url=${encodeURIComponent(streamUrl.trim())}`)
        .then(r => r.json()).then(data => {
          if (data?.title && normalized === lastFetchedUrl.current) setStreamTitle(prev => prev || data.title.replace(/\([0-9]{4}\)|\[.*?\]/g, '').trim());
        }).catch(() => {
          fetch(`https://graph.facebook.com/v22.0/oembed_video?url=${encodeURIComponent(streamUrl.trim())}`)
            .then(r => r.json()).then(data => {
              if (data?.title && normalized === lastFetchedUrl.current) setStreamTitle(prev => prev || data.title);
            }).catch(() => {});
        });
    }
  }, [streamUrl]);

  const handleInjectStream = async () => {
    if (!streamTitle.trim()) { showSnackbar('يرجى إدخال عنوان البث', 'error'); return; }
    if (!streamUrl.trim()) { showSnackbar('يرجى إدخال رابط البث', 'error'); return; }
    setSaving(true);
    try {
      const existing = videos.find(v => v.youtube_url === streamUrl.trim());
      await mutations.injectStream.mutateAsync({ streamTitle, streamUrl, mode: injectionMode, existingVideo: existing });
      setStreamTitle('');
      setStreamUrl('');
      setScheduledAt('');
    } catch (err: any) { showSnackbar(err.message || 'فشل', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteArchiveVideo = async (v: VideoItem) => {
    if (!await confirm({ message: `حذف "${v.title}" نهائياً؟`, type: 'danger' })) return;
    try {
      await mutations.deleteVideo.mutateAsync(v.id);
    } catch { showSnackbar('فشل الحذف', 'error'); }
  };

  const handleToggleVideoActive = async (v: VideoItem) => {
    try {
      await mutations.toggleActive.mutateAsync(v);
    } catch { showSnackbar('فشل التحديث', 'error'); }
  };

  const handleRebroadcastArchive = async (v: VideoItem) => {
    if (!v.is_active) {
      try {
        await request(`/api/radio/videos/${v.id}`, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
      } catch { showSnackbar('فشل إظهار الفيديو', 'error'); return; }
    }
    setStreamUrl(v.youtube_url || `https://youtube.com/watch?v=${v.youtube_id}`);
    setStreamTitle(v.title);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEndLiveVideo = async (v: VideoItem) => {
    if (!await confirm({ message: `إنهاء البث المباشر "${v.title}"؟`, type: 'danger' })) return;
    try {
      await mutations.endLive.mutateAsync({ videoId: v.id, broadcastId: pinnedBroadcastId });
    } catch {}
    setPinnedBroadcastId(null);
    setPinnedToTicker(false);
    setWasLiveIdsLocal(prev => new Set(prev).add(v.id));
  };

  const handlePinToTicker = async () => {
    if (!pinnedToTicker) {
      try {
        const id = await mutations.pinTicker.mutateAsync({ action: 'pin', streamTitle, streamUrl });
        setPinnedBroadcastId(id);
        setPinnedToTicker(true);
      } catch { showSnackbar('فشل تثبيت البث في الشريط', 'error'); }
    } else if (pinnedBroadcastId) {
      try {
        await mutations.pinTicker.mutateAsync({ action: 'unpin', broadcastId: pinnedBroadcastId });
        setPinnedBroadcastId(null);
        setPinnedToTicker(false);
      } catch { showSnackbar('فشل إلغاء تثبيت البث', 'error'); }
    }
  };

  const handleSendPush = async () => {
    if (pushNotificationSent) return;
    setPushSending(true);
    try {
      const confirmed = await confirm({ message: 'هل تريد إرسال تنبيه فوري لجميع المستخدمين الآن؟', type: 'info' });
      if (!confirmed) { setPushSending(false); return; }
      const res = await mutations.sendPush.mutateAsync(streamTitle || 'راديو 5:14');
      if (res?.success) { setPushNotificationSent(true); }
      else { showSnackbar(res?.message || 'فشل إرسال الإشعار', 'error'); }
    } catch { showSnackbar('فشل إرسال الإشعار', 'error'); }
    finally { setPushSending(false); }
  };

  const handleMasterGoLive = async () => {
    if (isLive) { setShowStopConfirm(true); return; }
    if (!streamTitle.trim() || !streamUrl.trim()) {
      showSnackbar('يرجى إدخال عنوان البث ورابطه أولاً', 'error'); return;
    }
    setMasterLoading(true);
    try {
      const result = await mutations.goLive.mutateAsync({ streamTitle, streamUrl, videos });
      masterVideoIdRef.current = result.videoId;
      setIsLive(true);
      setPinnedToTicker(true);
      setPinnedBroadcastId(result.broadcastId);
      setPushNotificationSent(true);
      setPeakViewers(0);
      setTotalLikes(0);
      setWasLiveIdsLocal(prev => result.videoId ? new Set(prev).add(result.videoId) : prev);
    } catch { showSnackbar('فشل إطلاق البث المباشر', 'error'); }
    finally { setMasterLoading(false); }
  };

  const confirmStopLive = async () => {
    setShowStopConfirm(false);
    setMasterLoading(true);
    try {
      if (masterVideoIdRef.current) {
        await mutations.endLive.mutateAsync({ videoId: masterVideoIdRef.current, broadcastId: pinnedBroadcastId });
        masterVideoIdRef.current = null;
      }
      setStopConfirmed(true);
      setIsLive(false);
      setPinnedToTicker(false);
      setPushNotificationSent(false);
      setShowPostWizard(true);
    } catch { showSnackbar('فشل إنهاء البث', 'error'); setMasterLoading(false); }
  };

  const handlePostWizardSubmit = async () => {
    setWizardSaving(true);
    try {
      if (archiveVideo && streamUrl) {
        const newId = await mutations.saveArchive.mutateAsync({ streamTitle, streamUrl, timer, masterVideoId: masterVideoIdRef.current });
        if (newId) setWasLiveIdsLocal(prev => new Set(prev).add(newId));
      }
      setShowPostWizard(false);
      setStopConfirmed(false);
      setMasterLoading(false);
    } catch { showSnackbar('فشل حفظ البث في الأرشيف', 'error'); }
    finally { setWizardSaving(false); setMasterLoading(false); }
  };

  const handleSendChat = async () => {
    if (!chatText.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      await mutations.chat.mutateAsync(chatText.trim());
      setChatText('');
    } catch { showSnackbar('فشل إرسال الرسالة', 'error'); }
    finally { setSendingChat(false); }
  };

  const addFloatingReaction = (emoji: string) => {
    const id = ++reactIdRef.current;
    const x = Math.random() * 60 + 20;
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 3000);
  };

  const canManage = ['admin'].includes(user?.role || '');
  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Ban size={28} className="text-red-500" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white mb-1">عذراً، لا تمتلك صلاحية الدخول</p>
          <p className="text-xs font-bold text-slate-500">غرفة البث المباشر مخصصة للمديرين فقط</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {!compact && (
        <LiveControlHeader
          streamOnline={streamOnline}
          isLive={isLive}
          timer={timer}
          viewerCount={viewerCount}
          onRefresh={invalidateAll}
          formatDuration={formatDuration}
        />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <LiveStreamInjectionCard
            isLive={isLive}
            injectionMode={injectionMode}
            onInjectionModeChange={setInjectionMode}
            streamTitle={streamTitle}
            onStreamTitleChange={setStreamTitle}
            streamUrl={streamUrl}
            onStreamUrlChange={setStreamUrl}
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
            saving={saving}
            onInject={handleInjectStream}
            scheduledBroadcasts={scheduledBroadcasts}
            extractYoutubeId={extractYoutubeId}
          />
          <AdminLivePreviewCard
            previewYoutubeId={previewYoutubeId}
            previewPlatform={previewPlatform}
            streamUrl={streamUrl}
            onClearUrl={() => setStreamUrl('')}
          />
          <ArchiveBrowser
            archiveVideos={archiveVideos}
            archiveSearch={archiveSearch}
            onArchiveSearchChange={setArchiveSearch}
            onRebroadcast={handleRebroadcastArchive}
            onToggleActive={handleToggleVideoActive}
            onDelete={handleDeleteArchiveVideo}
            wasLiveIds={wasLiveIds}
          />
          <ActiveLiveStreams
            liveVideos={liveVideos}
            onEndLive={handleEndLiveVideo}
          />
        </div>
        <div className="lg:col-span-5 space-y-6">
          <AutomationTriggers
            pinnedToTicker={pinnedToTicker}
            onPinToTicker={handlePinToTicker}
            streamUrl={streamUrl}
            pushNotificationSent={pushNotificationSent}
            pushSending={pushSending}
            onSendPush={handleSendPush}
            isLive={isLive}
            masterLoading={masterLoading}
            onMasterGoLive={handleMasterGoLive}
            masterHover={masterHover}
            onMasterHoverChange={setMasterHover}
            timer={timer}
            viewerCount={viewerCount}
            peakViewers={peakViewers}
            formatDuration={formatDuration}
          />
          <ChatPanel
            isLive={isLive}
            chatMessages={chatMessages}
            floatingReactions={floatingReactions}
            chatText={chatText}
            onChatTextChange={setChatText}
            sendingChat={sendingChat}
            onSendChat={handleSendChat}
            onAddReaction={addFloatingReaction}
            chatEndRef={chatEndRef}
            reactions={FLOATING_REACTIONS}
            timeAgo={timeAgo}
          />
        </div>
      </div>
      <StopConfirmModal
        isOpen={showStopConfirm}
        onClose={() => setShowStopConfirm(false)}
        onConfirm={confirmStopLive}
        masterLoading={masterLoading}
      />
      <PostWizardModal
        isOpen={showPostWizard}
        onClose={() => setShowPostWizard(false)}
        onSubmit={handlePostWizardSubmit}
        wizardSaving={wizardSaving}
        archiveVideo={archiveVideo}
        onArchiveToggle={() => setArchiveVideo(!archiveVideo)}
        chatReadOnly={chatReadOnly}
        onChatReadOnlyToggle={() => setChatReadOnly(!chatReadOnly)}
        peakViewers={peakViewers}
        timer={timer}
        totalLikes={totalLikes}
        formatDuration={formatDuration}
      />
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
