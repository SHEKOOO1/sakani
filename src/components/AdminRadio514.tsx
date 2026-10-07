import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Radio, Tv, BarChart3, Ban, Shield } from 'lucide-react';
import { AdminRadioHeader } from './radio/AdminRadioHeader';
import { AdminTabNavigation } from './radio/AdminTabNavigation';
import { ManageRadioPermissions } from './radio/ManageRadioPermissions';
import { AppPermission } from '../types/permissions';
import { LiveControlRoom } from './LiveControlRoom';
import { BroadcastFormModal } from './radio/BroadcastFormModal';
import { VideoFormModal } from './radio/VideoFormModal';
import { CategoryFormModal } from './radio/CategoryFormModal';
import { PlaylistFormModal } from './radio/PlaylistFormModal';
import { RadioStatsPanel } from './radio/RadioStatsPanel';
import { RadioBansPanel } from './radio/RadioBansPanel';
import { AudioBroadcastTab } from './radio/admin/AudioBroadcastTab';
import { LibraryTab } from './radio/admin/LibraryTab';
import { useRadioAdminData, useRadioAdminStats } from '../hooks/useRadioAdminData';
import { useStreamStatus } from '../hooks/useStreamStatus';
import { useAutoMetadata } from '../hooks/useAutoMetadata';
import { useBannedUsers } from '../hooks/useBannedUsers';
import { useRadioCrud } from '../hooks/useRadioCrud';

const ADMIN_TABS = [
  { id: 'audio_broadcast', icon: Radio, label: 'إدارة البث الإذاعي' },
  { id: 'video_broadcast', icon: Tv, label: 'إدارة البث المرئي' },
  { id: 'library', icon: Tv, label: 'مكتبة الفيديو' },
  { id: 'stats', icon: BarChart3, label: 'إحصائيات' },
  { id: 'bans', icon: Ban, label: 'إدارة المحظورين' },
  { id: 'permissions', icon: Shield, label: 'الصلاحيات والخدام' },
];

export function AdminRadio514() {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const [activeTab, setActiveTab] = useState('audio_broadcast');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const {
    currentTrack, songHistory, broadcasts, videos, categories, playlists, loading,
    fetchAll,
  } = useRadioAdminData();
  const { radioStats, radioBroadcastStats, radioChatStats, fetchRadioStats } = useRadioAdminStats();
  const { streamOnline, streamChecking, checkStream } = useStreamStatus();
  const { autoMetadata, autoUpdatePaused, setAutoUpdatePaused, fetchAutoMetadata } = useAutoMetadata();
  const {
    bannedUsers, canUnban, expandedUserId, setExpandedUserId,
    bannedUserMessages, loadingBannedMessages,
    fetchBannedUsers, fetchBannedUserMessages, handleUnban, setBannedUserMessages,
  } = useBannedUsers();
  const {
    saving, editingId, setEditingId,
    showBroadcastForm, showVideoForm, showCategoryForm, showPlaylistForm,
    setShowBroadcastForm, setShowVideoForm, setShowCategoryForm, setShowPlaylistForm,
    broadcastForm, setBroadcastForm,
    videoForm, setVideoForm,
    categoryForm, setCategoryForm,
    playlistForm, setPlaylistForm,
    uploadingImage, addToPlaylistId, setAddToPlaylistId, fetchingVideoInfo,
    coverFileRef,
    openBroadcastForm, handleSaveBroadcast, handleDeleteBroadcast,
    handleTogglePinBroadcast, handlePublishToTicker,
    openVideoForm, handleSaveVideo, handleDeleteVideo, handleTogglePin, handleToggleFeature,
    openPlaylistForm, handleSavePlaylist, handleDeletePlaylist, handleTogglePlaylistActive,
    openCategoryForm, handleSaveCategory, handleDeleteCategory,
    handleUploadImage, fetchVideoInfo,
  } = useRadioCrud(
    selectedCategoryId, setSelectedCategoryId,
    selectedPlaylistId, setSelectedPlaylistId);

  const canManage = ['admin', 'radio_admin'].includes(user?.role as string) ||
    hasPermission(AppPermission.MANAGE_RADIO_BROADCAST) ||
    hasPermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY) ||
    hasPermission(AppPermission.MANAGE_RADIO_PLAYLISTS);

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-red-500" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white mb-1">عذراً، لا تمتلك صلاحية لدخول غرفة التحكم</p>
          <p className="text-xs font-bold text-slate-500">هذه اللوحة مخصصة لأصحاب صلاحيات الإدارة العليا فقط</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <AdminRadioHeader
        streamOnline={streamOnline}
        streamChecking={streamChecking}
        onRefresh={() => { fetchAll(); checkStream(); }}
      />

      <AdminTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={ADMIN_TABS}
      />

      <AnimatePresence mode="wait">
        {activeTab === 'video_broadcast' && (
          <motion.div key="video_broadcast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <LiveControlRoom compact />
          </motion.div>
        )}

        {activeTab === 'audio_broadcast' && (
          <motion.div key="audio_broadcast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <AudioBroadcastTab
              request={request}
              showSnackbar={showSnackbar}
              confirm={confirm}
              fetchAll={fetchAll}
              fetchAutoMetadata={fetchAutoMetadata}
              currentTrack={currentTrack}
              songHistory={songHistory}
              broadcasts={broadcasts}
              streamOnline={streamOnline}
              streamChecking={streamChecking}
              loading={loading}
              autoMetadata={autoMetadata}
              autoUpdatePaused={autoUpdatePaused}
              setAutoUpdatePaused={setAutoUpdatePaused}
              openBroadcastForm={openBroadcastForm}
              handleDeleteBroadcast={handleDeleteBroadcast}
              handlePublishToTicker={handlePublishToTicker}
              handleTogglePinBroadcast={handleTogglePinBroadcast}
            />
          </motion.div>
        )}

        {activeTab === 'library' && (
          <motion.div key="library" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <LibraryTab
              request={request}
              showSnackbar={showSnackbar}
              confirm={confirm}
              fetchAll={fetchAll}
              categories={categories}
              playlists={playlists}
              videos={videos}
              selectedCategoryId={selectedCategoryId}
              selectedPlaylistId={selectedPlaylistId}
              loading={loading}
              editingId={editingId}
              addToPlaylistId={addToPlaylistId}
              setSelectedCategoryId={setSelectedCategoryId}
              setSelectedPlaylistId={setSelectedPlaylistId}
              setAddToPlaylistId={setAddToPlaylistId}
              openCategoryForm={openCategoryForm}
              handleDeleteCategory={handleDeleteCategory}
              openPlaylistForm={openPlaylistForm}
              handleTogglePlaylistActive={handleTogglePlaylistActive}
              handleDeletePlaylist={handleDeletePlaylist}
              openVideoForm={openVideoForm}
              handleDeleteVideo={handleDeleteVideo}
              handleToggleFeature={handleToggleFeature}
              handleTogglePin={handleTogglePin}
            />
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <RadioStatsPanel
              radioStats={radioStats}
              radioBroadcastStats={radioBroadcastStats}
              radioChatStats={radioChatStats}
              fetchRadioStats={fetchRadioStats}
            />
          </motion.div>
        )}

        {activeTab === 'permissions' && ['admin'].includes(user?.role || '') && (
          <motion.div key="permissions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <ManageRadioPermissions />
          </motion.div>
        )}

        {activeTab === 'bans' && (
          <motion.div key="bans" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <RadioBansPanel
              bannedUsers={bannedUsers}
              canUnban={canUnban}
              expandedUserId={expandedUserId}
              setExpandedUserId={setExpandedUserId}
              loadingBannedMessages={loadingBannedMessages}
              bannedUserMessages={bannedUserMessages}
              fetchBannedUsers={fetchBannedUsers}
              fetchBannedUserMessages={fetchBannedUserMessages}
              setBannedUserMessages={setBannedUserMessages}
              handleUnban={handleUnban}
              request={request}
              showSnackbar={showSnackbar}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BroadcastFormModal
        isOpen={showBroadcastForm}
        onClose={() => { setShowBroadcastForm(false); setEditingId(null); }}
        formData={broadcastForm}
        onChange={setBroadcastForm}
        editingId={editingId}
        onSave={handleSaveBroadcast}
        saving={saving}
        uploadingImage={uploadingImage}
        coverFileRef={coverFileRef}
        playlists={playlists}
        onUploadImage={handleUploadImage}
      />

      <VideoFormModal
        isOpen={showVideoForm}
        onClose={() => { setShowVideoForm(false); setEditingId(null); }}
        formData={videoForm}
        onChange={setVideoForm}
        editingId={editingId}
        onSave={handleSaveVideo}
        saving={saving}
        fetchVideoInfo={fetchVideoInfo}
        fetchingVideoInfo={fetchingVideoInfo}
        uploadingImage={uploadingImage}
        coverFileRef={coverFileRef}
        categories={categories}
        addToPlaylistId={addToPlaylistId}
        onAddToPlaylistIdChange={setAddToPlaylistId}
        playlists={playlists}
        onUploadImage={handleUploadImage}
      />

      <CategoryFormModal
        isOpen={showCategoryForm}
        onClose={() => { setShowCategoryForm(false); setEditingId(null); }}
        formData={categoryForm}
        onChange={setCategoryForm}
        editingId={editingId}
        onSave={handleSaveCategory}
        saving={saving}
        uploadingImage={uploadingImage}
        coverFileRef={coverFileRef}
      />

      <PlaylistFormModal
        isOpen={showPlaylistForm}
        onClose={() => { setShowPlaylistForm(false); setEditingId(null); }}
        formData={playlistForm}
        onChange={setPlaylistForm}
        editingId={editingId}
        selectedCategoryId={selectedCategoryId}
        onSave={handleSavePlaylist}
        saving={saving}
        uploadingImage={uploadingImage}
        coverFileRef={coverFileRef}
        categories={categories}
        onUploadImage={handleUploadImage}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
      `}</style>
    </div>
  );
}
