import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export function QRScanner({ onScan, onClose, title = "ماسح الـ QR Code" }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Check if the reader element exists in the DOM before initializing
    const scannerElement = document.getElementById("reader");
    if (!scannerElement) return;

    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        handleScanSuccess(decodedText);
      },
      (errorMessage) => {
        // Silently ignore scan errors (they happen every frame if no QR found)
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, []);

  const handleScanSuccess = (text: string) => {
    // Play a subtle beep sound if possible, or just visual feedback
    setSuccess(true);
    // Pause briefly to show success state before triggering callback
    setTimeout(() => {
      onScan(text);
      setSuccess(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 sm:p-10" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-card-dark rounded-card border border-white/10 shadow-huge overflow-hidden relative"
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neon-primary/20 rounded-2xl flex items-center justify-center text-neon-primary shadow-glow-sm">
                 <Camera size={24} />
              </div>
              <div>
                 <h2 className="text-2xl font-black text-white leading-none">{title}</h2>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">وجه الكاميرا نحو كود الطالب</p>
              </div>
           </div>
           
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
           
              </button>
        </div>

        <div className="p-8 relative">
           <div id="reader" className="overflow-hidden rounded-card border-2 border-dashed border-white/10 bg-black/40 aspect-square sm:aspect-video flex items-center justify-center">
              {/* html5-qrcode will render here */}
           </div>

           <AnimatePresence>
             {success && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.5 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.5 }}
                 className="absolute inset-0 z-10 flex items-center justify-center bg-neon-primary/20 backdrop-blur-md"
               >
                  <div className="bg-neon-primary text-black p-8 rounded-full shadow-huge transform animate-bounce">
                     <CheckCircle2 size={60} />
                  </div>
               </motion.div>
             )}
           </AnimatePresence>

           {error && (
             <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500">
                <AlertCircle size={20} />
                <span className="text-sm font-bold">{error}</span>
             </div>
           )}
        </div>

        <div className="p-8 bg-white/[0.01] border-t border-white/5">
           <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 bg-neon-primary rounded-full animate-pulse shadow-neon-primary/50 shadow-glow"></div>
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">الكاميرا قيد التشغيل...</span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold max-w-[250px] text-center sm:text-right">
                 تأكد من وجود إضاءة كافية ومن وضوح الكود داخل المربع المخصص للحصول على أفضل النتائج.
              </p>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
