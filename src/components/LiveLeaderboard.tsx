import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, Flame, Sword, Zap, Star, Target, Users, X } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  total_score: number;
  members_count?: number;
}

interface LiveLeaderboardProps {
  teams: Team[];
  eventTitle: string;
  winningThreshold: number;
  maxScore: number;
}

export const LiveLeaderboard: React.FC<LiveLeaderboardProps> = ({ 
  teams, 
  eventTitle, 
  winningThreshold, 
  maxScore 
}) => {
  const sortedTeams = [...teams].sort((a, b) => b.total_score - a.total_score);
  
  return (
    <div className="min-h-screen bg-[#050608] text-white p-8 lg:p-16 font-sans overflow-hidden relative" dir="rtl">
      {/* Exit Button */}
      <button 
        onClick={() => window.dispatchEvent(new CustomEvent('closeLeaderboard'))}
        className="fixed top-8 left-8 z-[110] p-4 bg-white/5 border border-white/10 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md"
        title="إغلاق"
      >
        <X size={24} />
      </button>

      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-amber-400/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
      
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-8 mb-20">
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 px-4 py-2 bg-amber-400/10 border border-amber-400/20 rounded-full w-fit"
          >
            <Flame size={16} className="text-amber-400 animate-bounce" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">تحدي مباشر الآن</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl lg:text-8xl font-black tracking-tighter"
          >
            {eventTitle}
          </motion.h1>
        </div>

        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 p-8 rounded-card backdrop-blur-xl flex items-center gap-8"
        >
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">درجة الحسم</p>
                <p className="text-4xl font-black text-amber-400">{winningThreshold}</p>
            </div>
            <div className="w-px h-12 bg-white/10"></div>
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الدرجة النهائية</p>
                <p className="text-4xl font-black text-white">{maxScore}</p>
            </div>
        </motion.div>
      </div>

      {/* Leaderboard Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-6 relative">
        {sortedTeams.map((team, idx) => {
          const isWinner = team.total_score >= winningThreshold;
          const progress = Math.min((team.total_score / winningThreshold) * 100, 100);
          const isFirst = idx === 0;

          return (
            <motion.div
              layout
              key={team.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative p-1 rounded-[32px] transition-all ${isWinner ? 'bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_20px_50px_rgba(251,191,36,0.3)]' : 'bg-white/5'}`}
            >
              <div className={`p-8 rounded-[28px] flex items-center gap-8 ${isWinner ? 'bg-black/90' : 'bg-[#0A0C10] border border-white/5 shadow-huge'}`}>
                {/* Rank Indicator */}
                <div className="flex flex-col items-center justify-center w-24 h-24 relative">
                   {isFirst ? (
                     <motion.div 
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="absolute -top-6 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)] cursor-default"
                     >
                        <Crown size={48} fill="currentColor" />
                     </motion.div>
                   ) : (
                     <span className="text-2xl font-black text-slate-400 italic">#{idx + 1}</span>
                   )}
                   <span className={`text-5xl font-black mt-2 ${isWinner ? 'text-amber-400' : 'text-white'}`}>{team.total_score}</span>
                </div>

                {/* Team Info */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isWinner ? 'bg-amber-400 text-black' : 'bg-white/5 text-slate-400'}`}>
                           {isFirst ? <Trophy size={28} /> : <Sword size={28} />}
                        </div>
                        <div>
                           <h2 className="text-3xl font-black text-white group-hover:text-amber-400 transition-colors uppercase tracking-tight">{team.name}</h2>
                           <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                              <span className="flex items-center gap-2"><Users size={12} /> {team.members_count || 0} عضو</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                              <span className="flex items-center gap-2"><Target size={12} /> {isWinner ? 'مستوى احتراف' : 'مستوى ناشئ'}</span>
                           </div>
                        </div>
                     </div>
                     {isWinner && (
                       <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="px-6 py-2 bg-amber-400 text-black text-[12px] font-black rounded-full shadow-[0_0_20px_rgba(251,191,36,0.4)]"
                       >
                         تم تحقيق الهدف 🏆
                       </motion.div>
                     )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                       <span>التحرك نحو النصر</span>
                       <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1 shadow-inner">
                       <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full relative ${isWinner ? 'bg-amber-400' : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]'}`}
                       >
                          <div className="absolute inset-x-0 bottom-0 h-full bg-white/20 animate-pulse"></div>
                       </motion.div>
                    </div>
                  </div>
                </div>

                {/* Status Icon */}
                <div className="hidden lg:flex flex-col items-center gap-3">
                   {isFirst ? (
                     <div className="w-20 h-20 bg-amber-400/10 rounded-full flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.1)]">
                        <Zap size={40} className="animate-pulse" />
                     </div>
                   ) : (
                     <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-slate-300">
                        <Star size={24} />
                     </div>
                   )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {teams.length === 0 && (
          <div className="py-40 text-center space-y-6">
             <div className="w-24 h-24 bg-white/5 rounded-full mx-auto flex items-center justify-center">
                <Trophy size={48} className="text-slate-300" />
             </div>
             <p className="text-slate-400 font-bold uppercase tracking-[0.3em]">في انتظار بدء المنافسة...</p>
          </div>
        )}
      </div>

      {/* Decorative Elements */}
      <div className="fixed bottom-20 left-20 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full"></div>
      <div className="fixed top-40 right-20 w-48 h-48 bg-amber-400/5 blur-[80px] rounded-full"></div>
    </div>
  );
};

export default LiveLeaderboard;
