import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { AppPermission } from '../types/permissions';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useQueryClient } from '@tanstack/react-query';
import { useRadioVideos } from '../hooks/useRadioVideos';
import { useRadioChatMessages } from '../hooks/useRadioChatMessages';
import { useRadioPlaylists } from '../hooks/useRadioPlaylists';
import { useRadioCategories } from '../hooks/useRadioCategories';
import { useRadioBroadcasts, useRadioReminders, useToggleReminder, useLiveNotification } from '../hooks/useRadioBroadcasts';
import { motion, AnimatePresence } from 'motion/react';
import { Radio } from 'lucide-react';
import {
  VideoItem, ChatMessage, Playlist, PlaylistItem, Category,
} from './radio/types';
import { getAvatarBg, timeAgo } from './radio/helpers';
import { useRadioAudio } from './radio/useRadioAudio';
import { useRadioPlayer } from './radio/useRadioPlayer';
import { RadioVideoModal } from './radio/RadioVideoModal';
import { RadioHeader } from './radio/sections/RadioHeader';
import { LiveTickerBanner } from './radio/sections/LiveTickerBanner';
import { RadioPlayerCard } from './radio/sections/RadioPlayerCard';
import { SongHistoryPanel } from './radio/sections/SongHistoryPanel';
import { LiveVideoGrid } from './radio/sections/LiveVideoGrid';
import { NoLiveBroadcast } from './radio/sections/NoLiveBroadcast';
import { ArchiveVideoGrid } from './radio/sections/ArchiveVideoGrid';
import { BroadcastSchedule } from './radio/sections/BroadcastSchedule';
import { LinkedPlaylistSection } from './radio/sections/LinkedPlaylistSection';
import { StatsCard } from './radio/sections/StatsCard';
import { LibraryMainView } from './radio/sections/LibraryMainView';
import { LibraryProgramsView } from './radio/sections/LibraryProgramsView';
import { LibraryProgramDetail } from './radio/sections/LibraryProgramDetail';
import { LibraryPlayerView } from './radio/sections/LibraryPlayerView';
import { RadioCommunityChat } from './radio/sections/RadioCommunityChat';

export function Radio514() {
  const queryClient = useQueryClient();
  const { request } = useApi();
  const { user, hasPermission, refreshPermissions } = useAuth();
  const { showSnackbar } = useSnackbar();
  const location = useLocation();
  const audio = useRadioAudio(showSnackbar);
  const player = useRadioPlayer(showSnackbar);

  useEffect(() => { refreshPermissions(); }, [refreshPermissions]);

  // React Query hooks
  const { data: videos = [], isLoading: videosLoading } = useRadioVideos(60000);
  const { data: chatMessages = [] } = useRadioChatMessages(60000);
  const { data: playlists = [] } = useRadioPlaylists();
  const { data: categories = [] } = useRadioCategories();
  const { data: broadcasts = [] } = useRadioBroadcasts();
  const { data: broadcastReminders = new Set<string>() } = useRadioReminders();
  const toggleReminderMutation = useToggleReminder();
  const toggleLiveNotif = useLiveNotification();

  const initialLoading = videosLoading;

  const [activeTab, setActiveTab] = useState<'live' | 'library'>('live');
  const [showSongHistory, setShowSongHistory] = useState(false);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Playlist | null>(null);
  const [programItems, setProgramItems] = useState<PlaylistItem[]>([]);
  const [linkedBroadcastItems, setLinkedBroadcastItems] = useState<PlaylistItem[]>([]);
  const [linkedBroadcast, setLinkedBroadcast] = useState<any | null>(null);
  const linkedPlaylistIdRef = useRef<string | null>(null);
  const [libraryView, setLibraryView] = useState<'main' | 'programs' | 'program' | 'player'>('main');
  const [programsCategoryId, setProgramsCategoryId] = useState<string | null>(null);

  // ---- Live Ticker ----
  const [showLiveTicker, setShowLiveTicker] = useState(false);
  const [liveViewerCount, setLiveViewerCount] = useState(0);
  const [liveNotificationEnabled, setLiveNotificationEnabled] = useState(false);
  const prevLiveCountRef = useRef(0);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const reactIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const navigationStateConsumedRef = useRef<{ key: string } | null>(null);

  const isModerator = hasPermission(AppPermission.MODERATE_RADIO_CHAT);

  const [publicCalView, setPublicCalView] = useState(false);
  const liveVideos = videos.filter(v => v.is_live);
  const archiveVideos = videos.filter(v => !v.is_live);
  const featuredVideos = videos.filter(v => v.is_featured);
  const randomListeners = useRef(Math.floor(Math.random() * 50) + 20);
  const randomViewers = useRef(liveVideos.length > 0 ? Math.floor(Math.random() * 30) + 10 : 0);
  const displayListeners = audio.currentTrack?.listeners || randomListeners.current;
  const displayViewers = liveVideos.length > 0 ? randomViewers.current : 0;

  const getCategoryName = useCallback((catId: string | undefined | null) =>
    categories.find(c => c.id === catId)?.name || catId || '', [categories]);

  const fetchPlaylistItems = useCallback(async (playlistId: string) => {
    try {
      const res = await request(`/api/radio/playlists/${playlistId}/items`);
      if (res.success) setProgramItems(res.data || []);
    } catch { }
  }, [request]);

  // Initial load: fetch current track + song history once, init audio
  useEffect(() => {
    audio.fetchCurrentTrack();
    audio.fetchSongHistory();
    audio.initAudio();
    fetchLiveNotification();
  }, []);

  const fetchLiveNotification = async () => {
    if (!user) return;
    try {
      const res = await request('/api/radio/live/subscribe');
      if (res?.success) setLiveNotificationEnabled(res.data.active);
    } catch {}
  };

  // Filter videos
  const filteredVideos = videos.filter(v => {
    if (categoryFilter !== 'all' && !(v.tags?.includes(categoryFilter) || v.category === categoryFilter)) return false;
    if (programFilter !== 'all' && v.program !== programFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || v.tags?.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  useEffect(() => {
    if (!initialLoading) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatMessages, initialLoading]);

  useEffect(() => {
    if (initialLoading) return;
    const navState = location.state as Record<string, any> | null;
    if (!navState) return;
    if (navigationStateConsumedRef.current?.key === location.key) return;
    navigationStateConsumedRef.current = { key: location.key };

    if (navState.autoPlayLive) {
      if (liveVideos.length > 0) {
        player.openVideoModal(liveVideos[0], audio.stopAudio);
      } else {
        setActiveTab('live');
        showSnackbar('لا توجد بثوث مباشرة حالياً', 'info');
      }
      return;
    }

    if (navState.openProgramId) {
      const program = playlists.find(p => p.id === navState.openProgramId);
      if (program) {
        setActiveTab('library');
        openProgram(program);
      }
    }
  }, [initialLoading, liveVideos.length, playlists, location.key, location.state]);

  useEffect(() => {
    if (!broadcasts.length || !playlists.length) return;
    const now = Date.now();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    const toNextDate = (day: string, time: string) => {
      const targetIdx = dayNames.indexOf(day);
      if (targetIdx === -1) return null;
      const d = new Date();
      const diff = (targetIdx + 7 - d.getDay()) % 7 || 7;
      d.setDate(d.getDate() + diff);
      const [h, m] = time.split(':');
      d.setHours(parseInt(h || '0'), parseInt(m || '0'), 0, 0);
      return d.getTime();
    };

    let best: any = null;
    let bestDiff = Infinity;

    for (const b of broadcasts) {
      if (!b.is_active || !b.playlist_id) continue;
      const scheduledTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      if (scheduledTime && Math.abs(scheduledTime - now) < bestDiff) {
        best = b;
        bestDiff = Math.abs(scheduledTime - now);
      }
      if (b.recurring && b.recurring_day && b.recurring_time) {
        const repeatTime = toNextDate(b.recurring_day, b.recurring_time);
        if (repeatTime && Math.abs(repeatTime - now) < bestDiff) {
          best = b;
          bestDiff = Math.abs(repeatTime - now);
        }
      }
    }

    if (best && best.playlist_id !== linkedPlaylistIdRef.current) {
      linkedPlaylistIdRef.current = best.playlist_id;
      setLinkedBroadcast(best);
      request(`/api/radio/playlists/${best.playlist_id}/items`).then(res => {
        if (res.success) setLinkedBroadcastItems(res.data || []);
      }).catch(() => {});
    } else if (!best) {
      linkedPlaylistIdRef.current = null;
      setLinkedBroadcast(null);
      setLinkedBroadcastItems([]);
    }
  }, [broadcasts, playlists]);

  useEffect(() => {
    player.checkStreamEnd(videos);
  }, [videos, player.checkStreamEnd]);

  useEffect(() => {
    player.startStreamTimer(liveViewerCount);
    return () => { if (player.streamTimerRef.current) { clearInterval(player.streamTimerRef.current); player.streamTimerRef.current = null; } };
  }, [player.videoModalOpen, player.selectedVideo?.is_live, player.streamEnded, liveViewerCount]);

  const handleSendChat = async () => {
    if (!chatText.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await request('/api/radio/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ message: chatText.trim() }),
      });
      if (!res || !res.success) {
        showSnackbar(res?.message || 'فشل إرسال الرسالة', 'error');
        return;
      }
      setChatText('');
      queryClient.invalidateQueries({ queryKey: ['radio', 'chat', 'messages'] });
    } catch (err: any) {
      if (err.status === 403) setIsBanned(true);
      showSnackbar(err.message || 'فشل إرسال الرسالة', 'error');
    } finally { setSendingChat(false); }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await request(`/api/radio/chat/messages/${msgId}`, { method: 'DELETE' });
      showSnackbar('تم حذف الرسالة', 'success');
    } catch { showSnackbar('فشل حذف الرسالة', 'error'); }
  };

  const handleBanUser = async (userId: string, userName: string) => {
    try {
      await request(`/api/radio/chat/users/${userId}/ban`, { method: 'POST' });
      showSnackbar(`تم حظر ${userName} من الشات`, 'success');
    } catch { showSnackbar('فشل حظر المستخدم', 'error'); }
  };

  const openProgram = async (program: Playlist) => {
    setSelectedProgram(program);
    setLibraryView('program');
    await fetchPlaylistItems(program.id);
  };

  const addFloatingReaction = (emoji: string) => {
    const id = ++reactIdRef.current;
    const x = Math.random() * 60 + 20;
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  useEffect(() => {
    setShowLiveTicker(liveVideos.length > 0);
    if (liveVideos.length > 0) {
      const base = Math.floor(Math.random() * 80) + 30;
      setLiveViewerCount(base);
      const iv = setInterval(() => {
        setLiveViewerCount(prev => Math.max(10, prev + Math.floor(Math.random() * 9) - 4));
      }, 7000);
      return () => clearInterval(iv);
    }
  }, [liveVideos.length]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showSnackbar('تم نسخ الرابط', 'success');
    } catch {
      showSnackbar('فشل نسخ الرابط', 'error');
    }
  };

  if (user?.radio_514_enabled === false) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-6">
            <Radio size={32} className="text-slate-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">راديو 5:14 غير مفعل</h2>
          <p className="text-sm text-slate-500 font-bold">لم يتم تفعيل هذه الخدمة لك. يرجى التواصل مع مدير التطبيق.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0" dir="rtl">
      <RadioHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <LiveTickerBanner
        show={showLiveTicker}
        liveVideos={liveVideos}
        liveViewerCount={liveViewerCount}
        user={user}
        liveNotificationEnabled={liveNotificationEnabled}
        onTickerClick={() => {
          const firstLive = liveVideos[0];
          if (firstLive) { player.openVideoModal(firstLive, audio.stopAudio); }
        }}
        onToggleNotification={async () => {
          const res = await toggleLiveNotif.mutateAsync();
          if (res !== undefined) setLiveNotificationEnabled(res);
        }}
      />

      <AnimatePresence mode="wait">
        {activeTab === 'live' ? (
          <motion.div key="live" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                <RadioPlayerCard
                  currentTrack={audio.currentTrack}
                  playing={audio.playing}
                  likeCounts={audio.likeCounts}
                  likedByMe={audio.likedByMe}
                  showSongHistory={showSongHistory}
                  displayListeners={displayListeners}
                  onTogglePlay={audio.togglePlay}
                  onLike={audio.handleLike}
                  onShare={handleShare}
                  onToggleSongHistory={() => setShowSongHistory(!showSongHistory)}
                />

                <SongHistoryPanel songHistory={audio.songHistory} open={showSongHistory} />

                {liveVideos.length > 0 && (
                  <LiveVideoGrid liveVideos={liveVideos} liveViewerCount={liveViewerCount} onOpenVideo={(v) => player.openVideoModal(v, audio.stopAudio)} />
                )}

                {liveVideos.length === 0 && !initialLoading && (
                  <NoLiveBroadcast
                    user={user}
                    liveNotificationEnabled={liveNotificationEnabled}
                    onToggleNotification={async () => {
                      const res = await toggleLiveNotif.mutateAsync();
                      if (res !== undefined) setLiveNotificationEnabled(res);
                    }}
                  />
                )}

                {archiveVideos.length > 0 && (
                  <ArchiveVideoGrid archiveVideos={archiveVideos} getCategoryName={getCategoryName} onOpenVideo={(v) => player.openVideoModal(v, audio.stopAudio)} />
                )}

                <BroadcastSchedule
                  broadcasts={broadcasts}
                  playlists={playlists}
                  broadcastReminders={broadcastReminders}
                  user={user}
                  publicCalView={publicCalView}
                  onToggleView={() => setPublicCalView(p => !p)}
                  onToggleReminder={(id) => toggleReminderMutation.mutate(id)}
                  onOpenProgram={(pl) => { setActiveTab('library'); openProgram(pl); }}
                />

                {linkedBroadcast && linkedBroadcastItems.length > 0 && (
                  <LinkedPlaylistSection
                    linkedBroadcast={linkedBroadcast}
                    linkedBroadcastItems={linkedBroadcastItems}
                    playlists={playlists}
                    videos={videos}
                    onOpenVideo={(v) => player.openVideoModal(v, audio.stopAudio)}
                  />
                )}
              </div>

              <div className="lg:col-span-4 space-y-6">
                <StatsCard
                  displayListeners={displayListeners}
                  liveVideosCount={liveVideos.length}
                  liveViewerCount={liveViewerCount}
                  displayViewers={displayViewers}
                />

                <RadioCommunityChat
                  isBanned={isBanned}
                  chatMessages={chatMessages}
                  chatText={chatText}
                  onChatTextChange={setChatText}
                  sendingChat={sendingChat}
                  onSendChat={handleSendChat}
                  onDeleteMessage={handleDeleteMessage}
                  onBanUser={handleBanUser}
                  isModerator={isModerator}
                  chatEndRef={chatEndRef}
                  loadingRef={loadingRef}
                  initialLoading={initialLoading}
                  getAvatarBg={getAvatarBg}
                  timeAgo={timeAgo}
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="library" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>

            {libraryView === 'main' && (
              <LibraryMainView
                featuredVideos={featuredVideos}
                categories={categories}
                playlists={playlists}
                categoryFilter={categoryFilter}
                searchQuery={searchQuery}
                initialLoading={initialLoading}
                onOpenVideo={(v) => player.openVideoModal(v, audio.stopAudio)}
                onOpenProgram={openProgram}
                onCategoryChange={(catId) => { setCategoryFilter(catId); setSelectedCategory(catId === 'all' ? null : catId); }}
                onSearchChange={setSearchQuery}
                onViewAllPrograms={(catId) => { setProgramsCategoryId(catId); setLibraryView('programs'); }}
              />
            )}

            {libraryView === 'programs' && (
              <LibraryProgramsView
                programsCategoryId={programsCategoryId}
                categories={categories}
                playlists={playlists}
                onOpenProgram={openProgram}
                onBack={() => { setLibraryView('main'); setProgramsCategoryId(null); }}
              />
            )}

            {libraryView === 'program' && selectedProgram && (
              <LibraryProgramDetail
                selectedProgram={selectedProgram}
                programItems={programItems}
                videos={videos}
                programsCategoryId={programsCategoryId}
                onOpenPlayer={(v) => { player.openPlayer(v); setLibraryView('player'); }}
                onBack={() => { setLibraryView(programsCategoryId ? 'programs' : 'main'); setSelectedProgram(null); }}
              />
            )}

            {libraryView === 'player' && player.playerVideo && (
              <LibraryPlayerView
                playerVideo={player.playerVideo}
                playerVideoComments={player.playerVideoComments}
                playerCommentText={player.playerCommentText}
                sendingPlayerComment={player.sendingPlayerComment}
                selectedProgram={selectedProgram}
                programItems={programItems}
                videos={videos}
                isModerator={isModerator}
                getCategoryName={getCategoryName}
                onBack={() => {
                  if (selectedProgram) { setLibraryView('program'); }
                  else { setLibraryView('main'); player.setPlayerVideo(null); }
                }}
                onSendComment={player.handleSendPlayerComment}
                onDeleteComment={player.handleDeletePlayerComment}
                onBanUser={handleBanUser}
                onCommentTextChange={player.setPlayerCommentText}
                onOpenPlayer={player.openPlayer}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <RadioVideoModal
        open={player.videoModalOpen}
        selectedVideo={player.selectedVideo}
        streamEnded={player.streamEnded}
        streamDuration={player.streamDuration}
        peakViewers={player.peakViewers}
        archiveVideos={archiveVideos}
        videoLoadError={player.videoLoadError}
        onVideoLoadError={player.setVideoLoadError}
        onClose={player.closeVideoModal}
        onOpenVideo={(v) => player.openVideoModal(v, audio.stopAudio)}
        chatMessages={chatMessages}
        chatLocked={player.chatLocked}
        chatText={chatText}
        onChatTextChange={setChatText}
        handleSendChat={handleSendChat}
        sendingChat={sendingChat}
        addFloatingReaction={addFloatingReaction}
        floatingReactions={floatingReactions}
        chatEndRef={chatEndRef}
        liveViewerCount={liveViewerCount}
      />

      <AnimatePresence>
        {floatingReactions.map(r => (
          <motion.span key={`float-${r.id}`}
            initial={{ opacity: 1, y: '100vh', x: `${r.x}vw` }}
            animate={{ opacity: 0, y: '-10vh', x: `${r.x + (Math.random() - 0.5) * 10}vw` }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: 'easeOut' }}
            className="fixed bottom-0 z-[200] text-3xl pointer-events-none">
            {r.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
