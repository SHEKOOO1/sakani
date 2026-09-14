import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

interface VideoItem {
  id: string; title: string; description: string; youtube_url: string;
  youtube_id: string; platform?: string; category: string; program: string;
  tags: string[]; thumbnail: string; duration: string; is_live: boolean;
  was_live: boolean; is_active?: boolean; is_featured?: boolean;
  broadcast_id?: string | null; created_at: string;
}

interface ChatMessage {
  id: string; user_id: string; user_name: string; user_role: string;
  user_title?: string; message: string; created_at: string; is_hidden: boolean;
}

export function useLiveControlRoomData(isLive: boolean) {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const queryClient = useQueryClient();
  const liveVideoIdsRef = useRef<Set<string>>(new Set());

  const videosQuery = useQuery<VideoItem[]>({
    queryKey: ['radio', 'studio', 'videos'],
    queryFn: async () => {
      const [vidsRes, liveRes] = await Promise.all([
        request('/api/radio/videos?include_inactive=true').catch(() => ({ success: false, data: [] })),
        request('/api/radio/videos/live').catch(() => ({ success: false, data: [] })),
      ]);
      if (liveRes.success && Array.isArray(liveRes.data)) {
        liveVideoIdsRef.current = new Set(liveRes.data);
      }
      if (vidsRes.success) {
        return (vidsRes.data || []).map((v: any) => ({
          ...v,
          is_live: v.is_live || liveVideoIdsRef.current.has(v.id),
        }));
      }
      return [];
    },
    staleTime: 30000,
  });

  const broadcastsQuery = useQuery<any[]>({
    queryKey: ['radio', 'studio', 'broadcasts'],
    queryFn: async () => {
      const res = await request('/api/radio/broadcasts').catch(() => ({ success: false, data: [] }));
      return res.success ? (res.data || []) : [];
    },
    staleTime: 30000,
  });

  const wasLiveQuery = useQuery<string[]>({
    queryKey: ['radio', 'studio', 'was-live'],
    queryFn: async () => {
      const res = await request('/api/radio/videos/was-live').catch(() => ({ success: false, data: [] }));
      return res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30000,
  });

  const chatQuery = useQuery<ChatMessage[]>({
    queryKey: ['radio', 'chat', 'messages'],
    queryFn: async () => {
      const res = await request('/api/radio/chat/messages');
      return res?.success ? (res.data || []) : [];
    },
    enabled: isLive,
    refetchInterval: isLive ? 30000 : false,
    staleTime: 15000,
  });

  const streamStatusQuery = useQuery<boolean>({
    queryKey: ['radio', 'stream-status'],
    queryFn: async () => {
      try {
        await fetch('https://stream.radiojar.com/ps7z45v12k8uv', { method: 'HEAD', mode: 'no-cors' });
        return true;
      } catch { return false; }
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const currentTrackQuery = useQuery<any>({
    queryKey: ['radio', 'current-track'],
    queryFn: async () => {
      const res = await request('/api/radio/current-track').catch(() => ({ success: false, data: null }));
      return res?.success ? res.data : null;
    },
    staleTime: 60000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['radio', 'studio'] });
    queryClient.invalidateQueries({ queryKey: ['radio', 'chat'] });
    queryClient.invalidateQueries({ queryKey: ['radio', 'stream-status'] });
    queryClient.invalidateQueries({ queryKey: ['radio', 'current-track'] });
  };

  const injectStreamMutation = useMutation({
    mutationFn: async (params: {
      streamTitle: string; streamUrl: string; mode: 'now' | 'schedule';
      existingVideo?: VideoItem;
    }) => {
      const rawUrl = params.streamUrl.trim();
      const youtubeId = extractYoutubeId(rawUrl);
      const isFb = /facebook\.com|fb\.watch|fb\.com/i.test(rawUrl);
      const payload: any = {
        title: params.streamTitle.trim(), description: '',
        youtube_url: rawUrl,
        youtube_id: isFb ? rawUrl : (youtubeId || ''),
        tags: [], thumbnail: '', duration: '', is_featured: false,
      };
      let videoId: string | null = null;
      if (params.existingVideo) {
        await request(`/api/radio/videos/${params.existingVideo.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        videoId = params.existingVideo.id;
      } else {
        const res = await request('/api/radio/videos', { method: 'POST', body: JSON.stringify(payload) });
        videoId = res?.data?.id || null;
      }
      if (params.mode === 'now' && videoId) {
        liveVideoIdsRef.current = new Set(liveVideoIdsRef.current).add(videoId);
        await request(`/api/radio/videos/${videoId}/live`, { method: 'POST' }).catch(() => {});
      }
    },
    onSuccess: () => { invalidateAll(); },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: (videoId: string) => request(`/api/radio/videos/${videoId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateAll(); },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (video: VideoItem) => request(`/api/radio/videos/${video.id}`, {
      method: 'PUT', body: JSON.stringify({ is_active: !video.is_active }),
    }),
    onSuccess: () => { invalidateAll(); },
  });

  const endLiveMutation = useMutation({
    mutationFn: async (params: { videoId: string; broadcastId: string | null }) => {
      await request(`/api/radio/videos/${params.videoId}/unlive`, {
        method: 'POST',
        body: JSON.stringify({ broadcast_id: params.broadcastId || undefined }),
      }).catch(() => {});
      if (params.broadcastId) {
        await request(`/api/broadcasts/${params.broadcastId}`, { method: 'DELETE' }).catch(() => {});
      }
    },
    onSuccess: () => { invalidateAll(); },
  });

  const pinTickerMutation = useMutation({
    mutationFn: async (params: { action: 'pin' | 'unpin'; streamTitle?: string; streamUrl?: string; broadcastId?: string | null }) => {
      if (params.action === 'pin') {
        const res = await request('/api/broadcasts', {
          method: 'POST',
          body: JSON.stringify({
            title: `🔴 بث مباشر: ${params.streamTitle || 'راديو 5:14'}`,
            content: `⚠️ يبث الآن: انضموا إلينا في البث المرئي المباشر ${params.streamTitle ? `لعظة ${params.streamTitle}` : ''}`,
            priority: 'urgent', display_type: 'news',
            link_action: { type: 'live', url: params.streamUrl, title: params.streamTitle || 'راديو 5:14' },
          }),
        });
        return res?.data?.id || null;
      } else if (params.broadcastId) {
        await request(`/api/broadcasts/${params.broadcastId}`, { method: 'DELETE' });
        return null;
      }
      return null;
    },
  });

  const sendPushMutation = useMutation({
    mutationFn: (title: string) => request('/api/radio/push-notification', {
      method: 'POST', body: JSON.stringify({ title, artist: 'بث مرئي مباشر' }),
    }),
  });

  const saveArchiveMutation = useMutation({
    mutationFn: async (params: { streamTitle: string; streamUrl: string; timer: number; masterVideoId: string | null }) => {
      if (!params.streamUrl) return;
      const rawUrl = params.streamUrl;
      const youtubeId = extractYoutubeId(rawUrl);
      const isFb = /facebook\.com|fb\.watch|fb\.com/i.test(rawUrl);
      const duration = formatDuration(params.timer);
      const payload: any = {
        title: params.streamTitle || 'بث مباشر مسجل',
        description: `تم تسجيل هذا البث المباشر تلقائياً - ${new Date().toLocaleDateString('ar-EG')}`,
        youtube_url: rawUrl,
        youtube_id: isFb ? rawUrl : (youtubeId || ''),
        thumbnail: '', duration, is_featured: false,
      };
      if (params.masterVideoId) {
        await request(`/api/radio/videos/${params.masterVideoId}`, { method: 'PUT', body: JSON.stringify(payload) }).catch(() => {});
      } else {
        const createRes = await request('/api/radio/videos', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
        return createRes?.data?.id || null;
      }
      return null;
    },
    onSuccess: () => { invalidateAll(); },
  });

  const goLiveMutation = useMutation({
    mutationFn: async (params: {
      streamTitle: string; streamUrl: string; videos: VideoItem[];
    }) => {
      const rawUrl = params.streamUrl.trim();
      const youtubeId = extractYoutubeId(rawUrl);
      const isFb = /facebook\.com|fb\.watch|fb\.com/i.test(rawUrl);
      const payload: any = {
        title: params.streamTitle.trim(), description: '',
        youtube_url: rawUrl,
        youtube_id: isFb ? rawUrl : (youtubeId || ''),
        tags: [], thumbnail: '', duration: '', is_featured: false,
      };
      const existing = params.videos.find(v => v.youtube_url === rawUrl);
      let videoId: string | null = null;
      if (existing) {
        await request(`/api/radio/videos/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        videoId = existing.id;
      } else {
        const res = await request('/api/radio/videos', { method: 'POST', body: JSON.stringify(payload) });
        videoId = res?.data?.id || null;
      }
      if (videoId) {
        liveVideoIdsRef.current = new Set(liveVideoIdsRef.current).add(videoId);
        await request(`/api/radio/videos/${videoId}/live`, { method: 'POST' }).catch(() => {});
      }
      const broadcastRes = await request('/api/broadcasts/', {
        method: 'POST',
        body: JSON.stringify({
          title: `🔴 بث مباشر: ${params.streamTitle.trim()}`,
          content: `⚠️ يبث الآن: انضموا إلينا في البث المرئي المباشر [اضغط هنا للمشاهدة]`,
          priority: 'urgent', display_type: 'news',
          link_action: { type: 'live', url: params.streamUrl, title: params.streamTitle.trim() },
        }),
      });
      const newBroadcastId = broadcastRes?.data?.id || null;
      if (videoId && newBroadcastId) {
        await request(`/api/radio/videos/${videoId}`, {
          method: 'PUT', body: JSON.stringify({ broadcast_id: newBroadcastId }),
        }).catch(() => {});
      }
      await request('/api/radio/push-notification', {
        method: 'POST',
        body: JSON.stringify({ title: params.streamTitle.trim(), artist: 'بث مرئي مباشر' }),
      });
      return { videoId, broadcastId: newBroadcastId };
    },
    onSuccess: () => { invalidateAll(); },
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) => request('/api/radio/chat/messages', {
      method: 'POST', body: JSON.stringify({ message }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radio', 'chat', 'messages'] });
    },
  });

  const videos = videosQuery.data ?? [];
  const liveVideos = videos.filter(v => v.is_live);

  return {
    videos, liveVideos, loading: videosQuery.isLoading,
    scheduledBroadcasts: broadcastsQuery.data ?? [],
    wasLiveIds: new Set(wasLiveQuery.data ?? []),
    chatMessages: chatQuery.data ?? [],
    streamOnline: streamStatusQuery.data ?? false,
    currentTrack: currentTrackQuery.data ?? null,
    liveVideoIdsRef,
    mutations: {
      injectStream: injectStreamMutation,
      deleteVideo: deleteVideoMutation,
      toggleActive: toggleActiveMutation,
      endLive: endLiveMutation,
      pinTicker: pinTickerMutation,
      sendPush: sendPushMutation,
      saveArchive: saveArchiveMutation,
      goLive: goLiveMutation,
      chat: chatMutation,
    },
    invalidateAll,
  };
}

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=|v\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}
