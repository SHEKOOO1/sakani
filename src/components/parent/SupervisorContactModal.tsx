import { ShieldCheck, Clock, PhoneCall, MessageCircle, X } from 'lucide-react';

interface ContactPhone {
  label?: string;
  number: string;
  isForCalls: boolean;
  isForWhatsApp: boolean;
}

interface SupervisorContact {
  supervisorName?: string;
  available_from?: string;
  available_to?: string;
  available_days?: string;
  phone_numbers?: ContactPhone[];
}

interface SupervisorContactModalProps {
  isOpen: boolean;
  contact: SupervisorContact;
  onClose: () => void;
}

export function SupervisorContactModal({ isOpen, contact, onClose }: SupervisorContactModalProps) {
  if (!isOpen) return null;

  const days: Record<string, string> = {
    sun: 'الأحد', mon: 'الإثنين', tue: 'الثلاثاء',
    wed: 'الأربعاء', thu: 'الخميس', fri: 'الجمعة', sat: 'السبت'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-xl bg-white p-6 max-w-sm w-full shadow-2xl dark:bg-card-dark border border-slate-100 dark:border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/10">
              <ShieldCheck size={20} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="font-black text-sm text-slate-900 dark:text-white">المشرف المقيم</p>
              <p className="text-xs text-slate-500 font-bold">{contact.supervisorName || 'مشرف السكن'}</p>
            </div>
          </div>
          
            <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
          
            </button>
        </div>

        {(contact.available_from || contact.available_days) && (
          <div className="rounded-xl bg-slate-50 p-4 mb-4 dark:bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={13} className="text-slate-400" />
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400">مواعيد التواصل المتاحة</p>
            </div>
            {contact.available_from && contact.available_to && (
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                من {contact.available_from} إلى {contact.available_to}
              </p>
            )}
            {contact.available_days && (
              <p className="text-[10px] text-slate-500 font-bold mt-1">
                الأيام: {contact.available_days.split(',').map((d: string) => days[d] || d).join('، ')}
              </p>
            )}
          </div>
        )}

        {contact.phone_numbers && contact.phone_numbers.length > 0 ? (
          <div className="space-y-2">
            {contact.phone_numbers.map((p: any, i: number) => (
              <div key={i} className="rounded-xl bg-slate-50 p-4 border border-slate-200 dark:bg-white/5 dark:border-white/10">
                {p.label && (
                  <p className="text-[10px] font-black text-slate-400 mb-2">{p.label}</p>
                )}
                <div className="flex items-center gap-2">
                  {p.isForCalls && (
                    <a href={`tel:${p.number}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 text-white font-black text-xs hover:bg-primary-700 transition-colors">
                      <PhoneCall size={13} /> اتصال
                    </a>
                  )}
                  {p.isForWhatsApp && (
                    <a href={`https://wa.me/${p.number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ocean-600 text-white font-black text-xs hover:bg-ocean-700 transition-colors">
                      <MessageCircle size={13} /> واتساب
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-300 font-bold text-center py-4">لم يقم المشرف بإضافة أرقام تواصل بعد.</p>
        )}
      </div>
    </div>
  );
}
