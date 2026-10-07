import { useState } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  user_title?: string;
  message: string;
  created_at: string;
  is_hidden: boolean;
}

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
}

interface ChatPanelProps {
  isLive: boolean;
  chatMessages: ChatMessage[];
  floatingReactions: FloatingReaction[];
  chatText: string;
  onChatTextChange: (value: string) => void;
  sendingChat: boolean;
  onSendChat: () => void;
  onAddReaction: (emoji: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  reactions: string[];
  timeAgo: (dateStr: string) => string;
}

export function ChatPanel({
  isLive, chatMessages, floatingReactions,
  chatText, onChatTextChange, sendingChat, onSendChat,
  onAddReaction, chatEndRef, reactions, timeAgo
}: ChatPanelProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] flex flex-col shadow-sm overflow-hidden"
      style={{ height: '480px' }}>
      <div className="shrink-0 px-5 py-4 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
            <MessageCircle size={16} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">شات المشاهدين</h3>
          <span className="mr-auto text-[9px] text-slate-500 font-bold bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">
            {chatMessages.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-5 relative">
        {!isLive ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageCircle size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-400">الشات متاح أثناء البث المباشر فقط</p>
            </div>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs font-bold text-slate-400">لا توجد رسائل بعد</p>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
              {floatingReactions.map(r => (
                <motion.span key={r.id}
                  initial={{ opacity: 1, y: 400, x: `${r.x}%` }}
                  animate={{ opacity: 0, y: -50, x: `${r.x + (Math.random() - 0.5) * 20}%` }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.5, ease: 'easeOut' }}
                  className="absolute text-2xl pointer-events-none">
                  {r.emoji}
                </motion.span>
              ))}
            </div>
            {chatMessages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl transition-all border bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/[0.04]">
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-full shrink-0 ${
                    msg.user_role === 'admin' ? 'bg-red-500' :
                    msg.user_role === 'bishop' ? 'bg-purple-500' :
                    msg.user_role === 'priest' ? 'bg-blue-500' :
                    msg.user_role === 'supervisor' ? 'bg-emerald-500' :
                    msg.user_role === 'employee' ? 'bg-amber-500' : 'bg-slate-500'
                  } flex items-center justify-center text-white text-[11px] font-black`}>
                    {msg.user_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">{msg.user_name}</span>
                      {msg.user_title && (
                        <span className="text-[8px] text-slate-500 dark:text-slate-400">{msg.user_title}</span>
                      )}
                      <span className="text-[8px] text-slate-400">{timeAgo(msg.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{msg.message}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="shrink-0 px-5 py-3 border-t border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-1.5 mb-2">
          {reactions.map(emoji => (
            <button key={emoji} onClick={() => onAddReaction(emoji)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-sm">
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={chatText}
            onChange={e => onChatTextChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSendChat()}
            placeholder="اكتب رداً..."
            className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" />
          <button onClick={onSendChat} disabled={!chatText.trim() || sendingChat || !isLive}
            className="p-2.5 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-lg shadow-md hover:shadow-primary-500/30 transition-all disabled:opacity-50">
            {sendingChat ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
