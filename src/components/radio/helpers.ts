import { VideoItem } from './types';

export function getAvatarBg(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-red-500',
    bishop: 'bg-purple-500',
    priest: 'bg-blue-500',
    supervisor: 'bg-emerald-500',
    employee: 'bg-amber-500',
  };
  return colors[role] || 'bg-slate-500';
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} ي`;
}

export const extractYoutubeId = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : url;
};

export const detectPlatform = (url: string): 'youtube' | 'facebook' | 'unknown' => {
  if (!url) return 'unknown';
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
  if (/(?:facebook\.com|fb\.watch|fb\.com)/i.test(url)) return 'facebook';
  return 'unknown';
};

export const getVideoWatchUrl = (video: VideoItem) =>
  video.platform === 'facebook'
    ? video.youtube_url
    : `https://www.youtube.com/watch?v=${video.youtube_id}`;
