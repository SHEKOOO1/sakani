import { motion } from 'motion/react';
import { MessageCircle, Send, Trash2, Ban, Loader2, Lock } from 'lucide-react';

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  user_title?: string;
  message: string;
  created_at: string;
}

interface RadioCommunityChatProps {
  isBanned: boolean;
  chatMessages: ChatMessage[];
  chatText: string;
  onChatTextChange: (value: string) => void;
  sendingChat: boolean;
  onSendChat: () => void;
  onDeleteMessage: (msgId: string) => void;
  onBanUser: (userId: string, userName: string) => void;
  isModerator: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  loadingRef: React.RefObject<HTMLDivElement | null>;
  initialLoading: boolean;
  getAvatarBg: (role: string) => string;
  timeAgo: (dateStr: string) => string;
}

export function RadioCommunityChat({
  isBanned, chatMessages, chatText, onChatTextChange, sendingChat,
  onSendChat, onDeleteMessage, onBanUser, isModerator,
  chatEndRef, loadingRef, initialLoading, getAvatarBg, timeAgo
}: RadioCommunityChatProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] flex flex-col shadow-sm overflow-hidden"
      style={{ height: '500px' }}>
      <div className="shrink-0 px-5 py-4 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
            <MessageCircle size={16} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">مجتمع راديو 5:14</h3>
          <span className="mr-auto text-[9px] text-slate-500 font-bold bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">{chatMessages.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-5" ref={loadingRef}>
        {initialLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700/30 rounded-xl animate-pulse" />)}
          </div>
        ) : chatMessages.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 text-center py-8">لا توجد تعليقات بعد</p>
        ) : (
          chatMessages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl transition-all border bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/[0.04]">
              <div className="flex items-start gap-2.5">
                <div className={`w-8 h-8 rounded-full shrink-0 ${getAvatarBg(msg.user_role)} flex items-center justify-center text-white text-[11px] font-black`}>
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
                {isModerator && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => onDeleteMessage(msg.id)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                      <Trash2 size={10} />
                    </button>
                    <button onClick={() => onBanUser(msg.user_id, msg.user_name)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                      <Ban size={10} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="shrink-0 px-5 py-4 border-t border-slate-100 dark:border-white/10">
        {isBanned ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg">
            <Lock size={14} className="text-red-500 dark:text-red-400 shrink-0" />
            <p className="text-[10px] font-bold text-red-600 dark:text-red-400">تم تقييد صلاحية التعليق</p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="text" value={chatText}
              onChange={e => onChatTextChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSendChat()}
              placeholder="اكتب تعليقاً..."
              className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" />
            <button onClick={onSendChat} disabled={!chatText.trim() || sendingChat}
              className="p-2.5 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-lg shadow-md hover:shadow-primary-500/30 transition-all disabled:opacity-50">
              {sendingChat ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
