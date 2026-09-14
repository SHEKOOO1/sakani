import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Users, UserCircle, DoorOpen, Clock, ArrowLeft } from 'lucide-react';

interface SharedStudentProfileListProps {
  onSelect: (studentId: string) => void;
}

export const SharedStudentProfileList: React.FC<SharedStudentProfileListProps> = ({ onSelect }) => {
  const { request } = useApi();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await request('/api/students/shared-with-me');
        if (!cancelled && res.success) setProfiles(res.data);
      } catch { } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [request]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
          <Users size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800">الملفات المشتركة</h2>
          <p className="text-sm text-slate-500 font-bold">ملفات الطلاب التي تم مشاركتها معك</p>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-white p-16 rounded-[3rem] border border-slate-100 shadow-sm text-center">
          <Users size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-lg font-black text-slate-400">لا توجد ملفات مشتركة</p>
          <p className="text-sm text-slate-300 font-bold mt-2">عند مشاركة ملف طالب معك ستظهر هنا</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((p: any) => (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                  <UserCircle size={32} />
                </div>
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-lg">{p.name}</p>
                  {p.room_number && (
                    <p className="text-xs font-bold text-slate-500 flex items-center gap-1 mt-1">
                      <DoorOpen size={12} /> غرفة {p.room_number}
                    </p>
                  )}
                </div>
                <ArrowLeft size={20} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                <Clock size={10} />
                <span>مشاركة منذ: {new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
