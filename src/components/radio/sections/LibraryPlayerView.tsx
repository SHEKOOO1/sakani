import { ChevronRight, Clock, MessageCircle, Send, Loader2, Trash2, Ban, Play } from 'lucide-react';
import { VideoItem, Playlist, PlaylistItem, ChatMessage } from '../types';
import { VideoPlayer } from './VideoPlayers';
import { timeAgo, getAvatarBg } from '../helpers';

interface LibraryPlayerViewProps {
  playerVideo: VideoItem;
  playerVideoComments: ChatMessage[];
  playerCommentText: string;
  sendingPlayerComment: boolean;
  selectedProgram: Playlist | null;
  programItems: PlaylistItem[];
  videos: VideoItem[];
  isModerator: boolean;
  getCategoryName: (catId: string | undefined | null) => string;
  onBack: () => void;
  onSendComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onBanUser: (userId: string, userName: string) => void;
  onCommentTextChange: (text: string) => void;
  onOpenPlayer: (video: VideoItem) => void;
}

export function LibraryPlayerView({ playerVideo, playerVideoComments, playerCommentText, sendingPlayerComment, selectedProgram, programItems, videos, isModerator, getCategoryName, onBack, onSendComment, onDeleteComment, onBanUser, onCommentTextChange, onOpenPlayer }: LibraryPlayerViewProps) {
  return (
    <div className="space-y-6">
      <button onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all">
        <ChevronRight size={16} />
        {selectedProgram ? 'العودة إلى البرنامج' : 'العودة إلى المكتبة'}
      </button>

      <VideoPlayer platform={playerVideo.platform} youtubeId={playerVideo.youtube_id} facebookUrl={playerVideo.youtube_url} />

      {/* Video Info */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2">{playerVideo.title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-4">{playerVideo.description}</p>
        <div className="flex items-center gap-3 flex-wrap">
          {playerVideo.tags?.map(tag => (
            <span key={tag} className="px-3 py-1.5 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-bold">{getCategoryName(tag)}</span>
          ))}
          {(!playerVideo.tags || playerVideo.tags.length === 0) && playerVideo.category && (
            <span className="px-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-lg text-xs font-bold text-slate-500">
              {getCategoryName(playerVideo.category)}
            </span>
          )}
          {playerVideo.duration && (
            <span className="px-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-lg text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Clock size={12} /> {playerVideo.duration}
            </span>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageCircle size={16} className="text-primary-500" />
          التعليقات
        </h3>

        {/* Comment Input */}
        <div className="flex items-center gap-2 mb-4">
          <input type="text" value={playerCommentText}
            onChange={e => onCommentTextChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSendComment()}
            placeholder="اكتب تعليقاً..."
            className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" />
          <button onClick={onSendComment} disabled={!playerCommentText.trim() || sendingPlayerComment}
            className="p-2.5 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-lg shadow-md hover:shadow-primary-500/30 transition-all disabled:opacity-50">
            {sendingPlayerComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        {playerVideoComments.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 text-center py-6">لا توجد تعليقات على هذا الفيديو</p>
        ) : (
          <div className="space-y-3">
            {playerVideoComments.slice(0, 20).map(c => (
              <div key={c.id} className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] rounded-lg group">
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-full shrink-0 ${getAvatarBg(c.user_role)} flex items-center justify-center text-white text-[10px] font-black`}>
                    {c.user_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">{c.user_name}</span>
                      {c.user_title && (
                        <span className="text-[8px] text-slate-500 dark:text-slate-400">{c.user_title}</span>
                      )}
                      <span className="text-[8px] text-slate-400">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{c.message}</p>
                  </div>
                  {isModerator && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onDeleteComment(c.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="حذف التعليق">
                        <Trash2 size={12} />
                      </button>
                      <button onClick={() => onBanUser(c.user_id, c.user_name)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="حظر المستخدم">
                        <Ban size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Related Episodes from same program */}
      {selectedProgram && programItems.length > 1 && (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">حلقات أخرى من {selectedProgram.name}</h3>
          <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
            {programItems.sort((a, b) => a.sort_order - b.sort_order).filter(item => item.item_id !== playerVideo.id).map(item => {
              const video = videos.find(v => v.id === item.item_id) || videos.find(v => v.youtube_id === item.item_id);
              const isFbItem = /facebook\.com|fb\.watch|fb\.com/i.test(item.item_id);
              const fallbackVideo: VideoItem = {
                id: item.item_id, title: item.item_title, description: '',
                youtube_url: isFbItem ? item.item_id : `https://www.youtube.com/watch?v=${item.item_id}`,
                youtube_id: isFbItem ? item.item_id : item.item_id,
                platform: isFbItem ? 'facebook' as const : 'youtube' as const,
                category: '', program: '', tags: [],
                thumbnail: item.item_thumbnail || '', duration: '', is_live: false, is_featured: false, created_at: ''
              };
              return (
                <button key={item.id} onClick={() => { if (video) onOpenPlayer(video); else if (fallbackVideo) onOpenPlayer(fallbackVideo); }}
                  className="shrink-0 w-48 group bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] rounded-xl overflow-hidden text-right hover:shadow-md transition-all">
                  <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
                    {item.item_thumbnail && <img src={item.item_thumbnail} alt={item.item_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={16} fill="white" className="text-white mr-0.5" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] font-black text-slate-900 dark:text-white line-clamp-2">{item.item_title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
