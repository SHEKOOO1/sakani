import { useState, useRef, useEffect } from "react";
import { Send, Trash2, Ban, VolumeX, ShieldAlert } from "lucide-react";
import { timeAgo, getAvatarBg } from "../radioUtils";

interface ChatUser {
  id: string;
  user_name: string;
  user_role: string;
  user_title: string;
}

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  user_title: string;
  message: string;
  created_at: string;
}

interface CommunityChatBoxProps {
  messages: ChatMessage[];
  currentUserId: string;
  canModerate: boolean;
  onSend: (message: string) => Promise<void>;
  onDelete: (msgId: string) => Promise<void>;
  onBan: (userId: string) => Promise<void>;
  onMute: (userId: string) => Promise<void>;
}

export function CommunityChatBox({ messages, currentUserId, canModerate, onSend, onDelete, onBan, onMute }: CommunityChatBoxProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [contextUser, setContextUser] = useState<ChatUser | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await onSend(input.trim());
      setInput("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-bold text-gray-800 dark:text-white">الشات</h3>
        <span className="text-xs text-gray-400">{messages.length} رسالة</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">لا توجد رسائل بعد</div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.user_id === currentUserId;
          return (
            <div key={msg.id} className={`group flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`} dir="auto">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: getAvatarBg(msg.user_name) }}
              >
                {msg.user_name.charAt(0)}
              </div>
              <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{msg.user_name}</span>
                  <span className="text-[10px] text-gray-400">{timeAgo(msg.created_at)}</span>
                </div>
                <div className={`relative px-3 py-2 rounded-2xl mt-0.5 text-sm ${
                  isOwn ? "bg-blue-500 text-white rounded-tr-md" : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-md"
                }`}>
                  {msg.message}
                </div>
                {canModerate && !isOwn && (
                  <div className="hidden group-hover:flex gap-1 mt-1">
                    <button onClick={() => onDelete(msg.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" title="حذف">
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                    <button onClick={() => setContextUser(msg)} className="p-1 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30" title="حظر/كتم">
                      <ShieldAlert size={12} className="text-orange-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالة..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button onClick={handleSend} disabled={sending || !input.trim()} className="p-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
            <Send size={18} />
          </button>
        </div>
      </div>

      {contextUser && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setContextUser(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 m-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-lg mb-4 text-gray-800 dark:text-white">إجراءات ضد {contextUser.user_name}</h4>
            <div className="space-y-2">
              <button onClick={() => { onBan(contextUser.id); setContextUser(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors">
                <Ban size={18} /><span>حظر دائم</span>
              </button>
              <button onClick={() => { onMute(contextUser.id); setContextUser(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 transition-colors">
                <VolumeX size={18} /><span>كتم 15 دقيقة</span>
              </button>
            </div>
            <button onClick={() => setContextUser(null)} className="w-full mt-4 p-2 text-gray-500 hover:text-gray-700 text-sm">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
