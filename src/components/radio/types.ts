export interface SongHistoryItem {
  id: string;
  title: string;
  artist: string;
  cover_url: string;
  played_at: string;
  likes: number;
  liked_by_me: boolean;
}

export interface CurrentTrack {
  id: string;
  title: string;
  artist: string;
  cover_url: string;
  description: string;
  stream_url: string;
  started_at: string;
  listeners: number;
  likes: number;
  liked_by_me: boolean;
}

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  youtube_url: string;
  youtube_id: string;
  platform?: string;
  category: string;
  program: string;
  program_name?: string;
  tags: string[];
  thumbnail: string;
  duration: string;
  is_live: boolean;
  is_featured: boolean;
  is_pinned?: boolean;
  is_active?: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  user_title?: string;
  message: string;
  created_at: string;
  is_hidden: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  category_id: string;
  is_active: boolean;
  item_count: number;
  cover_image?: string;
}

export interface PlaylistItem {
  id: string;
  item_id: string;
  item_title: string;
  item_thumbnail: string;
  item_type: string;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  cover_image: string;
  is_active: boolean;
  playlist_count: number;
}

export const DEFAULT_STREAM_URL = 'https://stream.radiojar.com/ps7z45v12k8uv';
export const DEFAULT_COVER = '/img/Radio5-14-Logo.jpg';
export const FALLBACK_COVER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const FLOATING_REACTIONS = ['❤️', '🙏', '✝️', '🕊️', '🔥', '💒', '⭐', '🌿'];
