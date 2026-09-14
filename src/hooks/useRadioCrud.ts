import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import { useSnackbar } from '../contexts/SnackbarContext';

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

interface BroadcastForm {
  title: string; cover_image: string; host_name: string; guest_name: string;
  type: 'audio' | 'video' | 'both'; scheduled_at: string; recurring: boolean;
  recurring_day: string; recurring_time: string; playlist_id: string;
}

interface VideoForm {
  title: string; description: string; youtube_url: string; tags: string[]; is_live: boolean; thumbnail: string;
}

interface CategoryForm {
  name: string; description: string; cover_image: string;
}

interface PlaylistForm {
  name: string; description: string; cover_image: string;
}

const defaultBroadcastForm: BroadcastForm = { title: '', cover_image: '', host_name: '', guest_name: '', type: 'audio', scheduled_at: '', recurring: false, recurring_day: '', recurring_time: '', playlist_id: '' };
const defaultVideoForm: VideoForm = { title: '', description: '', youtube_url: '', tags: [], is_live: false, thumbnail: '' };
const defaultCategoryForm: CategoryForm = { name: '', description: '', cover_image: '' };
const defaultPlaylistForm: PlaylistForm = { name: '', description: '', cover_image: '' };

export function useRadioCrud(
  selectedCategoryId: string | null, setSelectedCategoryId: (id: string | null) => void,
  selectedPlaylistId: string | null, setSelectedPlaylistId: (id: string | null) => void,
) {
  const { request } = useApi();
  const { showSnackbar, confirm } = useSnackbar();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState<BroadcastForm>(defaultBroadcastForm);
  const [videoForm, setVideoForm] = useState<VideoForm>(defaultVideoForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(defaultCategoryForm);
  const [playlistForm, setPlaylistForm] = useState<PlaylistForm>(defaultPlaylistForm);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [addToPlaylistId, setAddToPlaylistId] = useState('');
  const [fetchingVideoInfo, setFetchingVideoInfo] = useState(false);

  const fetchTimerRef = useRef<any>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const invalidateAdmin = () => queryClient.invalidateQueries({ queryKey: ['radio', 'admin'] });

  const fetchVideoInfo = useCallback(async (url: string) => {
    const isYt = !!extractYoutubeId(url);
    const isFb = /facebook\.com|fb\.watch|fb\.com/i.test(url);
    if (!isYt && !isFb) return;
    setFetchingVideoInfo(true);
    try {
      const res = await request(`/api/radio/fetch-video-info?url=${encodeURIComponent(url)}`);
      if (res.success && res.data) {
        setVideoForm(prev => ({
          ...prev,
          title: prev.title || res.data.title,
          description: prev.description || res.data.description,
        }));
      }
    } catch {} finally {
      setFetchingVideoInfo(false);
    }
  }, [request]);

  useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    if (!editingId && videoForm.youtube_url.trim()) {
      fetchTimerRef.current = setTimeout(() => fetchVideoInfo(videoForm.youtube_url), 800);
    }
    return () => { if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current); };
  }, [videoForm.youtube_url, editingId, fetchVideoInfo]);

  const handleUploadImage = async (file: File, onUrl: (url: string) => void) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await request('/api/radio/upload-image', { method: 'POST', body: formData, headers: {} });
      if (res.success && res.data?.url) {
        onUrl(res.data.url);
        showSnackbar('تم رفع الصورة', 'success');
      }
    } catch { showSnackbar('فشل رفع الصورة', 'error'); }
    finally { setUploadingImage(false); }
  };

  const saveBroadcastMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: broadcastForm.title.trim(),
        cover_image: broadcastForm.cover_image.trim() || undefined,
        host_name: broadcastForm.host_name.trim() || undefined,
        guest_name: broadcastForm.guest_name.trim() || undefined,
        type: broadcastForm.type,
        scheduled_at: broadcastForm.scheduled_at || undefined,
        recurring: broadcastForm.recurring,
        recurring_day: broadcastForm.recurring_day || undefined,
        recurring_time: broadcastForm.recurring_time || undefined,
        playlist_id: broadcastForm.playlist_id || undefined,
      };
      if (editingId) {
        await request(`/api/radio/broadcasts/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await request('/api/radio/broadcasts', { method: 'POST', body: JSON.stringify(payload) });
      }
    },
    onSuccess: () => {
      showSnackbar(editingId ? 'تم تحديث البرنامج' : 'تم إضافة البرنامج', 'success');
      setShowBroadcastForm(false);
      invalidateAdmin();
    },
    onError: (err: any) => { showSnackbar(err.message || 'فشل الحفظ', 'error'); },
    onSettled: () => { setSaving(false); },
  });

  const deleteBroadcastMutation = useMutation({
    mutationFn: (id: string) => request(`/api/radio/broadcasts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSnackbar('تم حذف البرنامج', 'success');
      invalidateAdmin();
    },
    onError: (err: any) => {
      if (err?.status === 429) showSnackbar('السيرفر مشغول، حاول مرة أخرى بعد لحظات', 'error');
      else showSnackbar('فشل الحذف', 'error');
    },
  });

  const togglePinBroadcastMutation = useMutation({
    mutationFn: (broadcast: any) => request(`/api/radio/broadcasts/${broadcast.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_pinned: !broadcast.is_pinned }),
    }),
    onSuccess: (_: any, broadcast: any) => {
      showSnackbar(broadcast.is_pinned ? 'تم إلغاء التثبيت' : 'تم تثبيت البث في الأعلى', 'success');
      invalidateAdmin();
    },
    onError: () => { showSnackbar('فشل التحديث', 'error'); },
  });

  const publishToTickerMutation = useMutation({
    mutationFn: (b: any) => {
      const playlistId = b.playlist_id?.trim();
      return request('/api/broadcasts/', {
        method: 'POST',
        body: JSON.stringify({
          title: `📺 برنامج: ${b.title}`,
          content: `موعد جديد لبرنامج "${b.title}"${b.host_name ? ` مع المذيع ${b.host_name}` : ''}${b.guest_name ? ` والضيف ${b.guest_name}` : ''}`,
          priority: 'normal',
          display_type: 'news',
          link_action: playlistId ? { type: 'program', id: playlistId } : undefined,
        }),
      });
    },
    onSuccess: () => { showSnackbar('تم نشر الإعلان في شريط الأخبار', 'success'); },
    onError: () => { showSnackbar('فشل نشر الإعلان', 'error'); },
  });

  const saveVideoMutation = useMutation({
    mutationFn: async () => {
      const rawUrl = videoForm.youtube_url.trim();
      const youtubeId = extractYoutubeId(rawUrl);
      const isFb = /facebook\.com|fb\.watch|fb\.com/i.test(rawUrl);
      const customThumb = videoForm.thumbnail.trim();
      const payload: any = {
        title: videoForm.title.trim(), description: videoForm.description.trim(),
        youtube_url: rawUrl,
        youtube_id: isFb ? (rawUrl.replace(/\/$/, '').split('/').pop() || rawUrl) : youtubeId,
        tags: videoForm.tags,
        thumbnail: customThumb || '', duration: '',
        program: addToPlaylistId || undefined,
        category: selectedCategoryId || undefined,
      };
      let videoId = editingId;
      if (editingId) {
        await request(`/api/radio/videos/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        const res = await request('/api/radio/videos', { method: 'POST', body: JSON.stringify(payload) });
        if (res.success) videoId = res.data?.id;
      }
      if (addToPlaylistId && videoId) {
        await request(`/api/radio/playlists/${addToPlaylistId}/items`, {
          method: 'POST',
          body: JSON.stringify({
            item_type: 'video',
            item_id: videoId,
            item_title: videoForm.title.trim(),
            item_thumbnail: customThumb || (isFb ? '' : `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`),
          }),
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      showSnackbar(editingId ? 'تم تحديث الفيديو' : 'تم إضافة الفيديو', 'success');
      setShowVideoForm(false);
      setAddToPlaylistId('');
      invalidateAdmin();
    },
    onError: (err: any) => { showSnackbar(err.message || 'فشل الحفظ', 'error'); },
    onSettled: () => { setSaving(false); },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: (videoId: string) => request(`/api/radio/videos/${videoId}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSnackbar('تم حذف الفيديو', 'success');
      invalidateAdmin();
    },
    onError: () => { showSnackbar('فشل الحذف', 'error'); },
  });

  const togglePinVideoMutation = useMutation({
    mutationFn: (video: any) => request(`/api/radio/videos/${video.id}`, {
      method: 'PUT', body: JSON.stringify({ is_pinned: !video.is_pinned }),
    }),
    onSuccess: (_: any, video: any) => {
      showSnackbar(video.is_pinned ? 'تم إلغاء التثبيت' : 'تم تثبيت الفيديو', 'success');
      invalidateAdmin();
    },
    onError: () => { showSnackbar('فشل التحديث', 'error'); },
  });

  const toggleFeatureVideoMutation = useMutation({
    mutationFn: (video: any) => request(`/api/radio/videos/${video.id}`, {
      method: 'PUT', body: JSON.stringify({ is_featured: !video.is_featured }),
    }),
    onSuccess: (_: any, video: any) => {
      showSnackbar(video.is_featured ? 'تم إزالة التميز' : 'تم تعيين الفيديو كمميز', 'success');
      invalidateAdmin();
    },
    onError: () => { showSnackbar('فشل التحديث', 'error'); },
  });

  const savePlaylistMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { name: playlistForm.name.trim(), description: playlistForm.description.trim(), cover_image: playlistForm.cover_image.trim() || undefined };
      if (selectedCategoryId && !editingId) payload.category_id = selectedCategoryId;
      if (editingId) {
        await request(`/api/radio/playlists/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await request('/api/radio/playlists', { method: 'POST', body: JSON.stringify(payload) });
      }
    },
    onSuccess: () => {
      showSnackbar(editingId ? 'تم تحديث البرنامج' : 'تم إنشاء البرنامج', 'success');
      setShowPlaylistForm(false);
      invalidateAdmin();
    },
    onError: (err: any) => { showSnackbar(err.message || 'فشل الحفظ', 'error'); },
    onSettled: () => { setSaving(false); },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (params: { id: string; name: string }) => {
      await request(`/api/radio/playlists/${params.id}`, { method: 'DELETE' });
      return params;
    },
    onSuccess: (params) => {
      showSnackbar(`تم حذف "${params.name}"`, 'success');
      if (selectedPlaylistId === params.id) setSelectedPlaylistId(null);
      invalidateAdmin();
    },
    onError: () => { showSnackbar('فشل الحذف', 'error'); },
  });

  const togglePlaylistActiveMutation = useMutation({
    mutationFn: (params: { id: string; isActive: boolean }) => request(`/api/radio/playlists/${params.id}`, {
      method: 'PUT', body: JSON.stringify({ is_active: params.isActive ? 0 : 1 }),
    }),
    onSuccess: () => { invalidateAdmin(); },
    onError: () => { showSnackbar('فشل التحديث', 'error'); },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { name: categoryForm.name.trim(), description: categoryForm.description.trim(), cover_image: categoryForm.cover_image.trim() || undefined };
      if (editingId) {
        await request(`/api/radio/categories/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await request('/api/radio/categories', { method: 'POST', body: JSON.stringify(payload) });
      }
    },
    onSuccess: () => {
      showSnackbar(editingId ? 'تم تحديث التصنيف' : 'تم إنشاء التصنيف', 'success');
      setShowCategoryForm(false);
      invalidateAdmin();
    },
    onError: (err: any) => { showSnackbar(err.message || 'فشل الحفظ', 'error'); },
    onSettled: () => { setSaving(false); },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (params: { id: string; name: string }) => {
      await request(`/api/radio/categories/${params.id}`, { method: 'DELETE' });
      return params;
    },
    onSuccess: (params) => {
      showSnackbar(`تم حذف التصنيف "${params.name}"`, 'success');
      if (selectedCategoryId === params.id) setSelectedCategoryId(null);
      invalidateAdmin();
    },
    onError: () => { showSnackbar('فشل الحذف', 'error'); },
  });

  const openBroadcastForm = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setBroadcastForm({
        title: item.title, cover_image: item.cover_image || '',
        host_name: item.host_name || '', guest_name: item.guest_name || '',
        type: item.type || 'audio', scheduled_at: item.scheduled_at?.split('.')[0] || '',
        recurring: !!item.recurring, recurring_day: item.recurring_day || '',
        recurring_time: item.recurring_time || '', playlist_id: item.playlist_id || '',
      });
    } else {
      setEditingId(null);
      setBroadcastForm(defaultBroadcastForm);
    }
    setShowBroadcastForm(true);
  };

  const handleSaveBroadcast = async () => {
    if (!broadcastForm.title.trim()) {
      showSnackbar('يرجى ملء اسم البرنامج', 'error'); return;
    }
    setSaving(true);
    try { await saveBroadcastMutation.mutateAsync(); } catch {}
  };

  const handleDeleteBroadcast = async (id: string) => {
    const ok = await confirm({ message: 'هل أنت متأكد من حذف هذا البرنامج؟', title: 'تأكيد الحذف' });
    if (!ok) return;
    try { await deleteBroadcastMutation.mutateAsync(id); } catch {}
  };

  const handleTogglePinBroadcast = async (broadcast: any) => {
    try { await togglePinBroadcastMutation.mutateAsync(broadcast); } catch {}
  };

  const handlePublishToTicker = async (b: any) => {
    try { await publishToTickerMutation.mutateAsync(b); } catch {}
  };

  const openVideoForm = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setVideoForm({ title: item.title, description: item.description, youtube_url: item.youtube_url, tags: item.tags || [], is_live: item.is_live, thumbnail: item.thumbnail || '' });
    } else {
      setEditingId(null);
      setVideoForm(defaultVideoForm);
    }
    setAddToPlaylistId('');
    setShowVideoForm(true);
  };

  const handleSaveVideo = async () => {
    if (!videoForm.title.trim() || !videoForm.youtube_url.trim()) {
      showSnackbar('يرجى ملء العنوان ورابط الفيديو', 'error'); return;
    }
    setSaving(true);
    try { await saveVideoMutation.mutateAsync(); } catch {}
  };

  const handleDeleteVideo = async (videoId: string, title: string) => {
    if (!await confirm({ message: `حذف "${title}" نهائياً؟`, type: 'danger' })) return;
    try { await deleteVideoMutation.mutateAsync(videoId); } catch {}
  };

  const handleTogglePin = async (video: any) => {
    try { await togglePinVideoMutation.mutateAsync(video); } catch {}
  };

  const handleToggleFeature = async (video: any) => {
    try { await toggleFeatureVideoMutation.mutateAsync(video); } catch {}
  };

  const openPlaylistForm = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setPlaylistForm({ name: item.name, description: item.description, cover_image: item.cover_image || '' });
    } else {
      setEditingId(null);
      setPlaylistForm(defaultPlaylistForm);
    }
    setShowPlaylistForm(true);
  };

  const handleSavePlaylist = async () => {
    if (!playlistForm.name.trim()) { showSnackbar('اسم قائمة التشغيل مطلوب', 'error'); return; }
    setSaving(true);
    try { await savePlaylistMutation.mutateAsync(); } catch {}
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    if (!await confirm({ message: `حذف "${name}" وكل محتوياتها؟`, type: 'danger' })) return;
    try { await deletePlaylistMutation.mutateAsync({ id, name }); } catch {}
  };

  const handleTogglePlaylistActive = async (id: string, isActive: boolean) => {
    try { await togglePlaylistActiveMutation.mutateAsync({ id, isActive }); } catch {}
  };

  const openCategoryForm = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setCategoryForm({ name: item.name, description: item.description || '', cover_image: item.cover_image || '' });
    } else {
      setEditingId(null);
      setCategoryForm(defaultCategoryForm);
    }
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) { showSnackbar('اسم التصنيف مطلوب', 'error'); return; }
    setSaving(true);
    try { await saveCategoryMutation.mutateAsync(); } catch {}
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!await confirm({ message: `حذف التصنيف "${name}" وجميع برامجه؟`, type: 'danger' })) return;
    try { await deleteCategoryMutation.mutateAsync({ id, name }); } catch {}
  };

  return {
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
  };
}
