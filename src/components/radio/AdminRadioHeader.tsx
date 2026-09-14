import { RadioTower, Loader2, Wifi, RefreshCw } from 'lucide-react';

interface AdminRadioHeaderProps {
  streamOnline: boolean;
  streamChecking: boolean;
  onRefresh: () => void;
}

export function AdminRadioHeader({ streamOnline, streamChecking, onRefresh }: AdminRadioHeaderProps) {
  return (
    <div className="relative bg-gradient-to-br from-indigo-900 via-vibrant-900 to-primary-900 rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(217,70,239,0.1),transparent_50%)]" />
      <div className="relative p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-xl border border-white/20">
              <RadioTower size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">لوحة تحكم راديو 5:14</h1>
              <p className="text-sm text-white/60 font-bold mt-1">الإدارة العليا للبثوث المباشرة، مكتبة الفيديو، قوائم التشغيل، والصلاحيات</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md ${
              streamOnline ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}>
              {streamChecking ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${streamOnline ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${streamOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </span>
              )}
              <Wifi size={14} />
              <span className="text-[10px] font-bold">{streamChecking ? 'فحص...' : streamOnline ? 'البث نشط' : 'متوقف'}</span>
            </div>
            
              <button onClick={onRefresh} aria-label="تحديث" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><RefreshCw  size={18} />
            
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
