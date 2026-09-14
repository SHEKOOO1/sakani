import { Pause, Play, SkipBack, Heart, Share2 } from "lucide-react";
import { motion } from "motion/react";

interface LiveBroadcastCardProps {
  currentTrack: any;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onLike: () => void;
  onShare: () => void;
}

export function LiveBroadcastCard({ currentTrack, isPlaying, onTogglePlay, onLike, onShare }: LiveBroadcastCardProps) {
  if (!currentTrack) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center mb-4">
          <Play size={36} className="text-white mr-1" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-lg">الراديو غير متصل</p>
      </div>
    );
  }

  return (
    <motion.div layout className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-5">
        <motion.div
          animate={isPlaying ? { scale: [1, 1.03, 1] } : {}}
          transition={{ repeat: Infinity, duration: 3 }}
          className="relative flex-shrink-0"
        >
          <img
            src={currentTrack.cover_url || "/img/default-track.png"}
            alt={currentTrack.title}
            className="w-24 h-24 rounded-2xl object-cover shadow-md"
          />
          {isPlaying && (
            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
        </motion.div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white truncate">{currentTrack.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{currentTrack.artist || "فنان غير معروف"}</p>
          <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-400">
            <Heart size={14} className={currentTrack.liked_by_me ? "fill-red-500 text-red-500" : ""} />
            <span>{currentTrack.likes || 0}</span>
            <span className="mx-1">•</span>
            <span>{currentTrack.listeners || 0} مستمع</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onLike} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Heart size={20} className={currentTrack.liked_by_me ? "fill-red-500 text-red-500" : "text-gray-400"} />
          </button>
          <button onClick={onShare} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Share2 size={20} className="text-gray-400" />
          </button>
          <button onClick={onTogglePlay} className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all shadow-md">
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
        </div>
      </div>

      {currentTrack.description && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{currentTrack.description}</p>
      )}
    </motion.div>
  );
}
