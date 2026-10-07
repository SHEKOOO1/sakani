import { motion } from 'motion/react';
import { Play, Pause, Volume2, Heart, Share2, List, Wifi } from 'lucide-react';
import { CurrentTrack, DEFAULT_COVER, FALLBACK_COVER } from '../types';

interface RadioPlayerCardProps {
  currentTrack: CurrentTrack | null;
  playing: boolean;
  likeCounts: Record<string, number>;
  likedByMe: Record<string, boolean>;
  showSongHistory: boolean;
  displayListeners: number;
  onTogglePlay: () => void;
  onLike: (songId: string) => void;
  onShare: () => void;
  onToggleSongHistory: () => void;
}

export function RadioPlayerCard({ currentTrack, playing, likeCounts, likedByMe, showSongHistory, displayListeners, onTogglePlay, onLike, onShare, onToggleSongHistory }: RadioPlayerCardProps) {
  return (
    <div className="relative bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 md:p-6 shadow-sm">
      {playing && (
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      )}
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Cover Image */}
        <div className="relative shrink-0">
          <div className={`w-28 h-28 md:w-36 md:h-36 rounded-xl overflow-hidden shadow-lg transition-all duration-500 ${
            playing ? 'shadow-primary-500/30 ring-2 ring-primary-500/30' : 'ring-1 ring-slate-100 dark:ring-white/10'
          }`}>
            <img
              src={currentTrack?.cover_url || DEFAULT_COVER}
              alt={currentTrack?.title || 'راديو 5:14'}
              className="w-full h-full object-cover"
              onError={(e) => { const el = e.target as HTMLImageElement; el.src = FALLBACK_COVER; }}
            />
          </div>
          {playing && (
            <>
              <div className="absolute -inset-2 pointer-events-none">
                {[0, 1].map(i => (
                  <motion.div key={i}
                    className="absolute inset-0 rounded-xl border border-primary-500/30"
                    initial={{ opacity: 0.5, scale: 1 }}
                    animate={{ opacity: 0, scale: 1 + (i + 1) * 0.15 }}
                    transition={{ duration: 1.5 + i * 0.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                ))}
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 flex items-end gap-[2px] p-1.5 bg-white/80 dark:bg-white/5 backdrop-blur-md rounded-lg border border-slate-100 dark:border-white/10">
                {[1, 2, 3].map(i => (
                  <motion.div key={i}
                    className="w-[2px] bg-primary-500 rounded-full"
                    animate={{ height: [4 + i * 2, 12 + i * 3, 4 + i * 2] }}
                    transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Track Info & Controls */}
        <div className="flex-1 min-w-0 space-y-3">
          {currentTrack ? (
            <>
              <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white truncate">
                {currentTrack.title}
              </h2>
              <p className="text-sm font-bold text-primary-600 dark:text-primary-400 truncate">
                {currentTrack.artist || 'راديو 5:14'}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">راديو 5:14</h2>
              <p className="text-sm font-bold text-primary-600 dark:text-primary-400">بث مباشر • ترانيم وتسابيح</p>
            </>
          )}

          {/* Controls Row */}
          <div className="flex items-center gap-2.5 pt-1">
            <button onClick={onTogglePlay}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
                playing
                  ? 'bg-red-500 text-white shadow-red-500/30'
                  : 'bg-gradient-to-br from-primary-600 to-vibrant-600 text-white hover:shadow-primary-500/30 hover:scale-105'
              }`}>
              {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="mr-0.5" />}
            </button>

            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/10 rounded-lg">
              <Volume2 size={14} className="text-primary-500" />
              <div className="w-16 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full bg-primary-500 rounded-full transition-all duration-500 ${playing ? 'w-3/4' : 'w-0'}`} />
              </div>
            </div>

            <button onClick={() => currentTrack?.id && onLike(currentTrack.id)}
              className={`p-2 border rounded-lg transition-all ${
                currentTrack?.id && likedByMe[currentTrack.id]
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-500'
                  : 'bg-slate-50 dark:bg-white/[0.05] border-slate-100 dark:border-white/10 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              }`}>
              <Heart size={16} fill={currentTrack?.id && likedByMe[currentTrack.id] ? 'currentColor' : 'none'} />
              {currentTrack?.id && (
                <span className="text-[8px] mr-1">{likeCounts[currentTrack.id] > 0 ? likeCounts[currentTrack.id] : ''}</span>
              )}
            </button>

            <button onClick={onShare}
              className="p-2 bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/10 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all">
              <Share2 size={16} />
            </button>

            <button onClick={onToggleSongHistory}
              className="p-2 bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/10 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all text-[10px] font-bold">
              <List size={16} />
            </button>
          </div>

          {/* Status Bar */}
          <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold">
            <span className="flex items-center gap-1">
              <Wifi size={10} className="text-emerald-500" />
              320kbps HD
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Live Connection
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>{displayListeners} مستمع</span>
          </div>
        </div>
      </div>
    </div>
  );
}
