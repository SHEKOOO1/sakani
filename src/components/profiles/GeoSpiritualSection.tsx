import { Search, Map, Cross, UserCheck, Phone, MessageSquareShare, Heart, Calendar, FileText } from 'lucide-react';

interface GeoSpiritualSectionProps {
  editMode: boolean;
  formData: any;
  student: any;
  onUpdateField: (field: string, value: any) => void;
}

export function GeoSpiritualSection({ editMode, formData, student, onUpdateField }: GeoSpiritualSectionProps) {
  const labelClass = "text-[10px] text-slate-400 dark:text-slate-300 font-black uppercase tracking-widest block mb-1";
  const inputClass = "w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all";

  return (
    <div className={`bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm ${editMode ? 'ring-2 ring-blue-200' : ''}`}>
      <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
        <Search size={20} className="text-blue-500 dark:text-blue-400" />
        البيانات الجغرافية والروحية
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-bold text-sm">
        {/* Governorate */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Map size={16} /> المحافظة</div>
          {editMode ? (
            <input className="text-left w-40 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.governorate} onChange={e => onUpdateField('governorate', e.target.value)} />
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">{student.governorate || '---'}</span>
          )}
        </div>
        {/* Village */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Map size={16} /> القرية</div>
          {editMode ? (
            <input className="text-left w-40 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.village} onChange={e => onUpdateField('village', e.target.value)} />
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">{student.village || '---'}</span>
          )}
        </div>
        {/* Church */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Cross size={16} /> الكنيسة</div>
          {editMode ? (
            <input className="text-left w-40 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.churchName} onChange={e => onUpdateField('churchName', e.target.value)} />
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">{student.church_name || '---'}</span>
          )}
        </div>
        {/* Confession Father Name */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><UserCheck size={16} /> أب الاعتراف</div>
          {editMode ? (
            <input className="text-left w-40 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.confessionFatherName} onChange={e => onUpdateField('confessionFatherName', e.target.value)} />
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">{student.confession_father_name || '---'}</span>
          )}
        </div>
        {/* Confession Father Phone */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Phone size={16} /> تليفون أب الاعتراف</div>
          {editMode ? (
            <input className="text-left w-40 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.confession_father_phone} onChange={e => onUpdateField('confession_father_phone', e.target.value)} />
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">{student.confession_father_phone || '---'}</span>
          )}
        </div>
        {/* Confession Father WhatsApp */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><MessageSquareShare size={16} /> واتساب أب الاعتراف</div>
          {editMode ? (
            <input className="text-left w-40 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.confession_father_whatsapp} onChange={e => onUpdateField('confession_father_whatsapp', e.target.value)} />
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">{student.confession_father_whatsapp || '---'}</span>
          )}
        </div>
        {/* Confession Father Service */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Heart size={16} /> خدمة أب الاعتراف</div>
          {editMode ? (
            <input className="text-left w-40 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.confession_father_service} onChange={e => onUpdateField('confession_father_service', e.target.value)} />
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">{student.confession_father_service || '---'}</span>
          )}
        </div>
        {/* Birth Date (read only) */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Calendar size={16} /> تاريخ الميلاد</div>
          <span className="text-slate-700 dark:text-slate-200 font-black">{student.birth_date ? new Date(student.birth_date).toLocaleDateString('ar-EG') : '---'}</span>
        </div>
        {/* Is Servant */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><UserCheck size={16} /> خادم</div>
          {editMode ? (
            <div className="flex items-center gap-2">
              <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-400" checked={formData.isServant} onChange={e => onUpdateField('isServant', e.target.checked)} />
              {formData.isServant && (
                <input className="w-28 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  placeholder="خدمات" value={formData.servantServices} onChange={e => onUpdateField('servantServices', e.target.value)} />
              )}
            </div>
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">
              {student.is_servant === 1 ? (student.servant_services || 'نعم') : '---'}
            </span>
          )}
        </div>
        {/* Is Deacon */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><Cross size={16} /> رتبة الشموسية</div>
          {editMode ? (
            <div className="flex items-center gap-2">
              <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-400" checked={formData.isDeacon} onChange={e => onUpdateField('isDeacon', e.target.checked)} />
              {formData.isDeacon && (
                <>
                  <input className="w-24 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    placeholder="الرتبة" value={formData.deaconRank} onChange={e => onUpdateField('deaconRank', e.target.value)} />
                  <input type="date" className="w-28 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    value={formData.deacon_ordination_date} onChange={e => onUpdateField('deacon_ordination_date', e.target.value)} />
                </>
              )}
            </div>
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-black">
              {student.is_deacon === 1 ? (student.deacon_rank || 'نعم') : '---'}
            </span>
          )}
        </div>
        {editMode && formData.isDeacon && (
          <div className="col-span-full flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><FileText size={16} /> تفاصيل الشموسية</div>
            <input className="text-left w-full sm:w-60 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.deacon_details} onChange={e => onUpdateField('deacon_details', e.target.value)} />
          </div>
        )}
        {/* Service Training Certificate */}
        {editMode && (
          <div className="col-span-full flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><FileText size={16} /> شهادة تدريب الخدمة</div>
            <input className="text-left w-full sm:w-60 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              value={formData.serviceTrainingCertificate} onChange={e => onUpdateField('serviceTrainingCertificate', e.target.value)} />
          </div>
        )}
        {!editMode && student.service_training_certificate && (
          <div className="col-span-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300"><FileText size={16} /> شهادة تدريب الخدمة</div>
            <span className="text-slate-700 dark:text-slate-200 font-black">{student.service_training_certificate}</span>
          </div>
        )}
        {/* Address */}
        <div className="col-span-full space-y-2">
          <p className="text-[10px] text-slate-400 dark:text-slate-300 font-black tracking-widest pr-2">العنوان الدائم</p>
          {editMode ? (
            <textarea className={`w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40`} rows={3}
              value={formData.address} onChange={e => onUpdateField('address', e.target.value)} />
          ) : (
            <p className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-slate-700 dark:text-slate-200 font-black">{student.address || 'لا يوجد عنوان مسجل'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
