import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, ChevronDown, ChevronUp, CheckCheck, AlertTriangle, AlertCircle, Info, Volume2, FileText, Link2, Image, Video, File, ExternalLink, X, Send } from 'lucide-react';
import { io } from 'socket.io-client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

export function MessagesSection() {
  const { request } = useApi();
  const { user, isLoading } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyForId, setReplyForId] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await request('/api/broadcasts/messages');
      if (res.data) setMessages(Array.isArray(res.data) ? res.data : [res.data]);
    } catch {} finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (isLoading) return;
    fetchMessages();
    const interval = setInterval(() => fetchMessages(), 120000);
    return () => clearInterval(interval);
  }, [fetchMessages, isLoading]);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socket.on('broadcast-visibility-changed', (data: any) => {
      if (data.visible_in_messages === 0) {
        setMessages(prev => prev.filter(m => m.id !== data.id));
      }
    });
    return () => { socket.disconnect(); };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await request(`/api/broadcasts/${id}/read`, { method: 'POST' });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
    } catch {}
  };

  // الرد مسموح فقط على الرسائل الخاصة التي أرسلها مشرف (كلا الطرفين يرد، والأسقف/الكاهن إرسال فقط)
  const canReply = (msg: any) => {
    if (!msg.private_recipient_id) return false;
    if (msg.sender_role !== 'supervisor' && msg.sender_role !== 'assistant_supervisor') return false;
    if (!user) return false;
    return msg.private_recipient_id === user.id || msg.sender_id === user.id;
  };

  const sendReply = async (msg: any) => {
    if (!replyText.trim() || replySending) return;
    setReplySending(true);
    try {
      const rootId = msg.parent_message_id || msg.id;
      await request(`/api/broadcasts/private/${rootId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText.trim() }),
      });
      setReplyText('');
      setReplyForId(null);
      fetchMessages();
    } catch {} finally {
      setReplySending(false);
    }
  };

  const toggleExpand = (id: string) => {
    const currentlyExpanded = expandedId === id;
    setExpandedId(currentlyExpanded ? null : id);
    if (currentlyExpanded) { setReplyForId(null); setReplyText(''); }
    const msg = messages.find(m => m.id === id);
    if (msg && !msg.is_read) markAsRead(id);
  };

  const priorityConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    urgent: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', label: 'عاجل' },
    important: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', label: 'مهم' },
    normal: { icon: Info, color: 'text-neon-primary', bg: 'bg-green-50 dark:bg-neon-primary/5', label: 'عادي' },
  };

  const typeIcons: Record<string, any> = {
    image: Image, video: Video, voice: Volume2, file: File, link: Link2,
  };

  const sorted = [...messages].sort((a, b) => {
    const order: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-card-dark rounded-card border border-slate-100 dark:border-white/[0.05] p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-neon-primary" />
          <h3 className="font-bold text-slate-900 dark:text-white">الرسائل</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (messages.length === 0) return null;

  return (
    <div className="bg-white dark:bg-card-dark rounded-card border border-slate-100 dark:border-white/[0.05] overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-neon-primary" />
          <h3 className="font-bold text-slate-900 dark:text-white">الرسائل</h3>
        </div>
        <span className="text-xs text-slate-400">{messages.filter(m => !m.is_read).length} غير مقروء</span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
        {sorted.map(msg => {
          const cfg = priorityConfig[msg.priority] || priorityConfig.normal;
          const Icon = cfg.icon;
          const isExpanded = expandedId === msg.id;

          return (
            <div key={msg.id} className={`transition-colors ${!msg.is_read ? cfg.bg : ''}`}>
              <button
                onClick={() => toggleExpand(msg.id)}
                className="w-full p-4 flex items-start gap-3 text-right hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className={`mt-0.5 ${cfg.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} border-current/20`}>
                      {cfg.label}
                    </span>
                    {msg.private_recipient_id && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-300 dark:border-blue-500/40 text-blue-500 bg-blue-50 dark:bg-blue-500/10">
                        خاصة
                      </span>
                    )}
                    {!msg.is_read && <span className="w-1.5 h-1.5 rounded-full bg-neon-primary" />}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{msg.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{msg.sender_name} • {new Date(msg.created_at).toLocaleDateString('ar-SA')}</p>
                </div>
                <div className="text-slate-300 dark:text-slate-400">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pr-11">
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      {msg.attachments?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {msg.attachments.map((att: any) => {
                            const AIcon = typeIcons[att.type] || File;
                            return (
                              <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-xs text-neon-primary hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">
                                <AIcon size={14} />
                                <span className="truncate max-w-[120px]">{att.original_name}</span>
                                <ExternalLink size={12} />
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {canReply(msg) && (
                        <div className="mt-3">
                          <textarea
                            value={replyForId === msg.id ? replyText : ''}
                            onChange={e => { setReplyForId(msg.id); setReplyText(e.target.value); }}
                            placeholder="اكتب رداً..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50 resize-none"
                          />
                          <div className="flex justify-end mt-1.5">
                            <button onClick={() => sendReply(msg)} disabled={replySending || !replyText.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-primary text-black text-xs font-black hover:bg-neon-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                              <Send size={13} />
                              {replySending && replyForId === msg.id ? 'جاري الإرسال...' : 'إرسال الرد'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
