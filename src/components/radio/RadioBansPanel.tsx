import { motion } from 'motion/react';
import { Ban, RefreshCw, Shield, X, ChevronLeft, Loader2, Volume2, Undo2 } from 'lucide-react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} ي`;
}

interface RadioBansPanelProps {
  bannedUsers: any[];
  canUnban: boolean;
  expandedUserId: string | null;
  setExpandedUserId: (id: string | null) => void;
  loadingBannedMessages: boolean;
  bannedUserMessages: any[];
  fetchBannedUsers: () => void;
  fetchBannedUserMessages: (userId: string) => void;
  setBannedUserMessages: (msgs: any[]) => void;
  handleUnban: (userId: string) => void;
  request: (url: string, opts?: any) => Promise<any>;
  showSnackbar: (msg: string, type: 'success' | 'error') => void;
}

export function RadioBansPanel({
  bannedUsers, canUnban, expandedUserId, setExpandedUserId,
  loadingBannedMessages, bannedUserMessages, setBannedUserMessages,
  fetchBannedUsers, fetchBannedUserMessages, handleUnban,
  request, showSnackbar
}: RadioBansPanelProps) {
  return (
    <motion.div key="bans" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 dark:bg-red-500/10 rounded-lg">
              <Ban size={22} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">إدارة المحظورين</h3>
              <p className="text-[10px] font-bold text-slate-500">عرض وإلغاء حظر المستخدمين في الشات</p>
            </div>
          </div>
          {canUnban && (
            <button onClick={fetchBannedUsers} aria-label="تحديث" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><RefreshCw size={16} /></button>
          )}
        </div>

        {bannedUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-emerald-500" />
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white mb-1">لا يوجد محظورون</p>
            <p className="text-[11px] font-bold text-slate-500">لم يتم حظر أي مستخدم في الشات حتى الآن</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bannedUsers.map(bu => (
              <div key={bu.id} className="border border-slate-100 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black ${
                      ['admin', 'bishop'].includes(bu.user_role) ? 'bg-red-500' :
                      bu.user_role === 'student' ? 'bg-emerald-500' : 'bg-primary-500'
                    }`}>
                      {bu.user_name?.[0] || '؟'}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{bu.user_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">{bu.user_role}</span>
                        <span className="text-[8px] text-slate-400">|</span>
                        <span className="text-[10px] text-red-500 font-bold">{bu.hidden_messages_count} رسالة</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 ml-2">{timeAgo(bu.created_at)}</span>
                    {canUnban && (
                      <>
                        <button onClick={async () => {
                          await request(`/api/radio/chat/users/${bu.user_id}/kick`, { method: 'POST' });
                          showSnackbar('تم طرد المستخدم 5 دقائق', 'success');
                          fetchBannedUsers();
                        }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 rounded-lg text-[9px] font-bold hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all">
                          <Ban size={10} /> طرد
                        </button>
                        <div className="relative group">
                          <button
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 rounded-lg text-[9px] font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-all">
                            <Volume2 size={10} /> كتم
                          </button>
                          <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-10">
                            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 rounded-xl shadow-xl p-1 min-w-[120px]">
                              {[5, 15, 30, 60].map(m => (
                                <button key={m} onClick={async () => {
                                  await request(`/api/radio/chat/users/${bu.user_id}/mute`, { method: 'POST', body: JSON.stringify({ duration: m }) });
                                  showSnackbar(`تم كتم المستخدم ${m} دقيقة`, 'success');
                                  fetchBannedUsers();
                                }}
                                  className="w-full text-right px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all">
                                  {m} دقيقة
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => handleUnban(bu.user_id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all">
                          <Undo2 size={12} />
                          <span>إلغاء الحظر</span>
                        </button>
                      </>
                    )}
                    {expandedUserId === bu.user_id ? (
                      <button onClick={() => { setExpandedUserId(null); setBannedUserMessages([]); }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-all">
                        <X size={14} />
                      </button>
                    ) : (
                      <button onClick={() => { setExpandedUserId(bu.user_id); fetchBannedUserMessages(bu.user_id); }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-all">
                        <ChevronLeft size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {expandedUserId === bu.user_id && (
                  <div className="border-t border-slate-100 dark:border-white/10 bg-white dark:bg-card-dark">
                    {loadingBannedMessages ? (
                      <div className="p-6 text-center">
                        <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
                      </div>
                    ) : bannedUserMessages.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">لا توجد رسائل محذوفة</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-64 overflow-y-auto">
                        {bannedUserMessages.map(msg => (
                          <div key={msg.id} className="p-3 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                            <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed">{msg.message}</p>
                            <span className="text-[9px] text-slate-400 mt-1 block">{timeAgo(msg.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
