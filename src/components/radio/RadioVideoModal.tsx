import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Tv, Clock, Eye, MessageCircle, Play,
  Wifi, ExternalLink, Lock, Send, Loader2
} from 'lucide-react';
import { VideoPlayer } from './sections/VideoPlayers';
import { VideoItem, ChatMessage, FLOATING_REACTIONS } from './types';
import { timeAgo, getVideoWatchUrl } from './helpers';

interface RadioVideoModalProps {
  open: boolean;
  selectedVideo: VideoItem | null;
  streamEnded: boolean;
  streamDuration: number;
  peakViewers: number;
  archiveVideos: VideoItem[];
  videoLoadError: boolean;
  onVideoLoadError: (err: boolean) => void;
  onClose: () => void;
  onOpenVideo: (video: VideoItem) => void;
  chatMessages: ChatMessage[];
  chatLocked: boolean;
  chatText: string;
  onChatTextChange: (text: string) => void;
  handleSendChat: () => void;
  sendingChat: boolean;
  addFloatingReaction: (emoji: string) => void;
  floatingReactions: { id: number; emoji: string; x: number }[];
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  liveViewerCount: number;
}

export function RadioVideoModal({
  open,
  selectedVideo,
  streamEnded,
  streamDuration,
  peakViewers,
  archiveVideos,
  videoLoadError,
  onVideoLoadError,
  onClose,
  onOpenVideo,
  chatMessages,
  chatLocked,
  chatText,
  onChatTextChange,
  handleSendChat,
  sendingChat,
  addFloatingReaction,
  floatingReactions,
  chatEndRef,
  liveViewerCount,
}: RadioVideoModalProps) {
  if (!open || !selectedVideo) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4">
        <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl relative overflow-hidden border border-slate-100 dark:border-white/10 flex flex-col lg:flex-row max-h-[90vh]">
          
            <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
          
            </button>

          <div className="relative lg:w-2/3 w-full">
            {streamEnded ? (
              <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col items-center justify-center p-6 md:p-10 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute inset-0 backdrop-blur-[2px]" />
                <div className="relative z-10 text-center max-w-lg">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                      <Tv size={28} className="text-white" />
                    </div>
                  </motion.div>
                  <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="text-2xl font-black text-white mb-2">
                    شكراً لمتابعتكم البث المباشر 🙏
                  </motion.h3>
                  <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="text-sm text-white/60 mb-6">
                    {selectedVideo.title} • انتهى البث
                  </motion.p>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                    {[
                      { label: 'مدة البث', value: `${Math.floor(streamDuration / 60)}:${String(streamDuration % 60).padStart(2, '0')}`, icon: Clock },
                      { label: 'ذروة المشاهدين', value: Math.max(1, peakViewers).toString(), icon: Eye },
                      { label: 'التعليقات', value: chatMessages.length.toString(), icon: MessageCircle },
                    ].map((stat, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-center">
                        <stat.icon size={16} className="mx-auto mb-1 text-white/50" />
                        <p className="text-lg font-black text-white">{stat.value}</p>
                        <p className="text-[10px] text-white/40">{stat.label}</p>
                      </div>
                    ))}
                  </motion.div>
                  {archiveVideos.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                      <p className="text-[11px] font-bold text-white/50 mb-3">فيديوهات قد تهمك</p>
                      <div className="flex gap-3 justify-center" dir="ltr">
                        {archiveVideos.slice(0, 3).map(v => (
                          <button key={v.id} onClick={() => { onOpenVideo(v); }}
                            className="group w-32 md:w-36 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all text-right">
                            <div className="aspect-video bg-slate-700/50 relative">
                              {v.thumbnail ? (
                                <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Play size={20} className="text-white/30" />
                                </div>
                              )}
                            </div>
                            <div className="p-2">
                              <p className="text-[10px] font-bold text-white line-clamp-2 text-right">{v.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            ) : !videoLoadError ? (
              <VideoPlayer platform={selectedVideo.platform} youtubeId={selectedVideo.youtube_id} facebookUrl={selectedVideo.youtube_url} onError={() => onVideoLoadError(true)} />
            ) : (
              <div className="aspect-video bg-slate-100 dark:bg-slate-800/50 flex flex-col items-center justify-center gap-4 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700/50 flex items-center justify-center">
                  <Wifi size={28} className="text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-500">البث متوقف مؤقتاً.. جاري إعادة الاتصال تلقائياً</p>
                <a href={getVideoWatchUrl(selectedVideo)} target="_blank" rel="noopener noreferrer"
                  className="px-6 py-3 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-lg transition-all">
                  <ExternalLink size={16} /> {selectedVideo.platform === 'facebook' ? 'فتح في فيسبوك' : 'فتح في يوتيوب'}
                </a>
              </div>
            )}

            {selectedVideo.is_live && !streamEnded && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                <span className="px-3 py-1.5 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 border border-red-400/30 shadow-lg">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                  مباشر
                </span>
                <span className="px-2.5 py-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 border border-white/10">
                  <Eye size={12} />
                  {liveViewerCount}
                </span>
              </div>
            )}

            {!streamEnded && (
              <div className="absolute bottom-0 right-0 left-0 z-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-black text-white drop-shadow-lg">{selectedVideo.title}</h2>
                {selectedVideo.description && (
                  <p className="text-xs text-white/70 mt-1 line-clamp-1">{selectedVideo.description}</p>
                )}
              </div>
            )}
          </div>

          <div className="lg:w-1/3 w-full flex flex-col border-t lg:border-t-0 lg:border-r border-slate-100 dark:border-white/10 bg-white dark:bg-card-dark"
            style={{ height: '500px', maxHeight: '90vh' }}>
            <div className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <MessageCircle size={16} className={chatLocked ? 'text-slate-400' : 'text-primary-500'} />
                <h3 className={`text-sm font-black ${chatLocked ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                  {chatLocked ? 'انتهت الدردشة' : 'الشات المباشر'}
                </h3>
                {chatLocked && (
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg flex items-center gap-1">
                    <Lock size={10} /> للقراءة فقط
                  </span>
                )}
                <span className="mr-auto text-[9px] text-slate-500 font-bold bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">{chatMessages.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 p-4 relative">
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                {floatingReactions.map(r => (
                  <motion.span key={r.id}
                    initial={{ opacity: 1, y: 300, x: `${r.x}%` }}
                    animate={{ opacity: 0, y: -80, x: `${r.x + (Math.random() - 0.5) * 20}%` }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.5, ease: 'easeOut' }}
                    className="absolute text-2xl pointer-events-none">
                    {r.emoji}
                  </motion.span>
                ))}
              </div>
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs font-bold text-slate-400">لا توجد رسائل بعد.. كن أول من يعلق!</p>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-2.5 rounded-xl transition-all border bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/[0.04]">
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-full shrink-0 ${
                        msg.user_role === 'admin' ? 'bg-red-500' :
                        msg.user_role === 'bishop' ? 'bg-purple-500' :
                        msg.user_role === 'priest' ? 'bg-blue-500' :
                        msg.user_role === 'supervisor' ? 'bg-emerald-500' :
                        msg.user_role === 'employee' ? 'bg-amber-500' : 'bg-slate-500'
                      } flex items-center justify-center text-white text-[10px] font-black`}>
                        {msg.user_name?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-black text-slate-900 dark:text-white">{msg.user_name}</span>
                          <span className="text-[7px] text-slate-400">{timeAgo(msg.created_at)}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">{msg.message}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-white/10 space-y-2">
              {chatLocked ? (
                <div className="flex items-center justify-center gap-2 py-3">
                  <Lock size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-400">تم قفل الدردشة - يمكنك عرض الرسائل فقط</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    {FLOATING_REACTIONS.map(emoji => (
                      <button key={emoji} onClick={() => addFloatingReaction(emoji)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-sm">
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={chatText}
                      onChange={e => onChatTextChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                      placeholder="اكتب رسالتك..."
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" />
                    <button onClick={handleSendChat} disabled={!chatText.trim() || sendingChat}
                      className="p-2 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-lg shadow-md hover:shadow-primary-500/30 transition-all disabled:opacity-50">
                      {sendingChat ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
