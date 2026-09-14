import { useState, useCallback, useRef } from 'react';
import { useApi } from '../../hooks/useApi';
import { VideoItem, ChatMessage, Playlist, PlaylistItem } from './types';

export function useRadioPlayer(showSnackbar: (message: string, type?: any) => void) {
  const { request } = useApi();
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [playerVideo, setPlayerVideo] = useState<VideoItem | null>(null);
  const [playerVideoComments, setPlayerVideoComments] = useState<ChatMessage[]>([]);
  const [playerCommentText, setPlayerCommentText] = useState('');
  const [sendingPlayerComment, setSendingPlayerComment] = useState(false);

  const fetchPlayerComments = useCallback(async (videoId: string) => {
    try {
      const res = await request(`/api/radio/videos/${videoId}/comments`);
      if (res.success) setPlayerVideoComments(res.data || []);
      else setPlayerVideoComments([]);
    } catch { setPlayerVideoComments([]); }
  }, [request]);

  const handleSendPlayerComment = useCallback(async () => {
    if (!playerCommentText.trim() || !playerVideo || sendingPlayerComment) return;
    setSendingPlayerComment(true);
    try {
      const res = await request(`/api/radio/videos/${playerVideo.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message: playerCommentText.trim() }),
      });
      if (!res?.success) {
        showSnackbar(res?.message || 'فشل إرسال التعليق', 'error');
        return;
      }
      setPlayerCommentText('');
      fetchPlayerComments(playerVideo.id);
    } catch (err: any) {
      showSnackbar(err?.message || 'فشل إرسال التعليق', 'error');
    } finally { setSendingPlayerComment(false); }
  }, [playerCommentText, playerVideo, sendingPlayerComment, request, showSnackbar, fetchPlayerComments]);

  const handleDeletePlayerComment = useCallback(async (commentId: string) => {
    if (!playerVideo) return;
    try {
      await request(`/api/radio/videos/${playerVideo.id}/comments/${commentId}`, { method: 'DELETE' });
      setPlayerVideoComments(prev => prev.filter(c => c.id !== commentId));
      showSnackbar('تم حذف التعليق', 'success');
    } catch { showSnackbar('فشل حذف التعليق', 'error'); }
  }, [playerVideo, request, showSnackbar]);

  const openVideoModal = useCallback((video: VideoItem, stopAudio: () => void) => {
    stopAudio();
    setStreamEnded(false);
    setChatLocked(false);
    setSelectedVideo(video);
    setVideoLoadError(false);
    setVideoModalOpen(true);
  }, []);

  const closeVideoModal = useCallback(() => {
    setVideoModalOpen(false);
    setSelectedVideo(null);
  }, []);

  const checkStreamEnd = useCallback((videos: VideoItem[]) => {
    if (!videoModalOpen || !selectedVideo) {
      if (streamEnded) setStreamEnded(false);
      return;
    }
    if (!selectedVideo.is_live) return;
    const stillLive = videos.find(v => v.id === selectedVideo.id);
    if (!stillLive || !stillLive.is_live) {
      setStreamEnded(true);
      setChatLocked(true);
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    }
  }, [videoModalOpen, selectedVideo, streamEnded]);

  const startStreamTimer = useCallback((liveViewerCount: number) => {
    if (videoModalOpen && selectedVideo?.is_live && !streamEnded) {
      setStreamDuration(0);
      setPeakViewers(liveViewerCount);
      streamTimerRef.current = setInterval(() => {
        setStreamDuration(prev => prev + 1);
        setPeakViewers(prev => Math.max(prev, liveViewerCount));
      }, 1000);
    } else {
      if (streamTimerRef.current) { clearInterval(streamTimerRef.current); streamTimerRef.current = null; }
    }
  }, [videoModalOpen, selectedVideo?.is_live, streamEnded]);

  const openPlayer = useCallback((video: VideoItem) => {
    setPlayerVideo(video);
    fetchPlayerComments(video.id);
  }, [fetchPlayerComments]);

  return {
    selectedVideo, setSelectedVideo,
    videoModalOpen, setVideoModalOpen,
    videoLoadError, setVideoLoadError,
    streamEnded, streamDuration, peakViewers, chatLocked,
    streamTimerRef,
    playerVideo, setPlayerVideo,
    playerVideoComments, setPlayerVideoComments,
    playerCommentText, setPlayerCommentText,
    sendingPlayerComment, setSendingPlayerComment,
    fetchPlayerComments, handleSendPlayerComment,
    handleDeletePlayerComment, openVideoModal, closeVideoModal,
    checkStreamEnd, startStreamTimer, openPlayer,
  };
}
