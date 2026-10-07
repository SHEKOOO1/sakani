import { Tv, X } from 'lucide-react';
import { YouTubePreview } from './YouTubePreview';

interface AdminLivePreviewCardProps {
  previewYoutubeId: string;
  previewPlatform: 'youtube' | 'facebook' | '';
  streamUrl: string;
  onClearUrl: () => void;
}

export function AdminLivePreviewCard({ previewYoutubeId, previewPlatform, streamUrl, onClearUrl }: AdminLivePreviewCardProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/[0.08] dark:to-white/[0.03] rounded-lg">
          <Tv size={20} className="text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">معاينة البث المباشر</h3>
          <p className="text-[9px] text-slate-500 font-bold mt-0.5">شاهد ما سيراه المستخدمون قبل الإطلاق</p>
        </div>
        {previewYoutubeId && (
          <div className="mr-auto flex items-center gap-2">
            <span className="text-[9px] text-slate-400">YouTube ID: {previewYoutubeId}</span>
            
              <button onClick={onClearUrl} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
          </div>
        )}
        {previewPlatform === 'facebook' && (
          <div className="mr-auto flex items-center gap-2">
            <span className="text-[9px] text-blue-500 font-bold bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              فيسبوك
            </span>
            
              <button onClick={onClearUrl} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
          </div>
        )}
      </div>
      {previewPlatform === 'facebook' ? (
        <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
          <iframe
            src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(streamUrl)}&show_text=false&width=734`}
            className="w-full h-full"
            style={{ border: 'none', overflow: 'hidden' }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          />
        </div>
      ) : (
        <YouTubePreview youtubeId={previewYoutubeId} label="معاينة الإدارة" />
      )}
    </div>
  );
}
