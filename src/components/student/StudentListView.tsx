import { useState } from 'react';
import {
  Search, Filter, Building, Trash2, UserCircle, GraduationCap,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { ServiceToggle } from './ServiceToggle';
import { FilterPanel } from './FilterPanel';
import { EmptyStudentsState } from './EmptyStudentsState';
import { ConfirmationModal } from '../ConfirmationModal';
import { Pagination } from '../Pagination';

interface StudentListViewProps {
  loading: boolean;
  isAdmin: boolean;
  isBishop: boolean;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filterCriteria: any;
  onFilterChange: (c: any) => void;
  filteredStudents: any[];
  expandedTenants: Record<string, boolean>;
  onToggleTenant: (name: string) => void;
  isAdminOrBishop: boolean;
  canDeleteStudent: boolean;
  canEditStudent: boolean;
  userRole?: string;
  canDeleteFromBishop?: boolean;
  toggleState: Record<string, {daily?: boolean; radio?: boolean}>;
  onToggleDaily: (studentId: string, studentName: string, current: boolean, tenantId?: string) => void;
  onToggleRadio: (studentId: string, studentName: string, current: boolean, tenantId?: string) => void;
  onToggleGraduate: (studentId: string, studentName: string, current: boolean) => void;
  onToggleTenantDaily: (tenantName: string, tenantId: string, current: boolean) => void;
  onToggleTenantRadio: (tenantName: string, tenantId: string, current: boolean) => void;
  onViewProfile: (studentId: string) => void;
  onDeleteClick: (student: any) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
  confirm: any;
  showSnackbar: any;
  request: any;
  setStudents: any;
}

export function StudentListView({
  loading, isAdmin, isBishop, searchTerm, onSearchChange, showFilters, onToggleFilters,
  filterCriteria, onFilterChange, filteredStudents, expandedTenants, onToggleTenant,
  isAdminOrBishop, canDeleteStudent, canEditStudent, userRole, canDeleteFromBishop,
  toggleState,
  onToggleDaily, onToggleRadio, onToggleGraduate, onToggleTenantDaily, onToggleTenantRadio,
  onViewProfile, onDeleteClick, page, totalPages, total, onPageChange,
}: StudentListViewProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
          <input
            type="text"
            placeholder="البحث بالاسم أو الرقم الجامعي..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pr-12 pl-6 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium dark:text-white"
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onToggleFilters} className="flex items-center gap-2 px-4 py-2.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 font-bold text-xs transition-all">
            <Filter size={16} />
            <span>{showFilters ? 'إخفاء الفلتر' : 'فلتر'}</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <FilterPanel criteria={filterCriteria} onChange={onFilterChange} />
      )}

      <div className="overflow-auto text-right">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#FAFBFC] dark:bg-white/5 text-slate-400 dark:text-slate-300 text-[10px] uppercase font-black tracking-widest border-b border-slate-50 dark:border-white/10">
            <tr>
              <th className="px-8 py-5">الطالب</th>
              {isAdmin && <th className="px-8 py-5">السكن / المحافظة / الأسقف / المشرف</th>}
              <th className="px-8 py-5">الرقم الجامعي</th>
              <th className="px-8 py-5">الجامعة والاتصال</th>
              <th className="px-8 py-5">توزيع الغرف</th>
              <th className="px-8 py-5">الحالة</th>
              <th className="px-8 py-5 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-white/10">
            {loading ? (
              [1,2,3].map(i => <tr key={i} className="animate-pulse"><td colSpan={isAdmin ? 7 : 6} className="h-16 bg-slate-50/50 dark:bg-white/5" /></tr>)
            ) : filteredStudents.length > 0 ? (
              isAdmin || isBishop ? (() => {
                const colCount = isAdmin ? 7 : 6;
                const groups: Record<string, any[]> = {};
                filteredStudents.forEach((s: any) => {
                  const key = s.tenant_name || 'بدون سكن';
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(s);
                });
                const tenantKeys = Object.keys(groups).sort();
                return tenantKeys.flatMap(tenantName => {
                  const group = groups[tenantName];
                  const first = group[0];
                  const isOpen = expandedTenants[tenantName] !== false;
                  return [
                    <tr key={`group-${tenantName}`} className="bg-slate-100/60 dark:bg-white/[0.03] cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/[0.06] select-none" onClick={() => onToggleTenant(tenantName)}>
                      <td colSpan={colCount} className="px-8 py-3">
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          <Building size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="font-black text-sm text-slate-800 dark:text-white">{first.tenant_name || 'بدون سكن'}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">
                            {first.tenant_governorate ? `📍 ${first.tenant_governorate}` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">
                            {first.bishop_name ? `👤 الأسقف: ${first.bishop_name}` : ''}
                          </span>
                          {isAdmin && (
                            <div className="flex items-center gap-4 mr-4 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              <ServiceToggle checked={first.tenant_daily_readings === 1 || first.tenant_daily_readings === true} label="قراءة اليوم" onClick={e => { e.stopPropagation(); onToggleTenantDaily(tenantName, first.tenant_id, first.tenant_daily_readings === 1 || first.tenant_daily_readings === true); }} />
                              <ServiceToggle checked={first.tenant_radio_514 === 1 || first.tenant_radio_514 === true} label="راديو 5:14" onClick={e => { e.stopPropagation(); onToggleTenantRadio(tenantName, first.tenant_id, first.tenant_radio_514 === 1 || first.tenant_radio_514 === true); }} />
                            </div>
                          )}
                          <span className="mr-auto text-[10px] font-bold text-slate-500 dark:text-slate-400">{group.length} طالب</span>
                        </div>
                      </td>
                    </tr>,
                    ...(isOpen ? group.map((student: any) => (
                      <tr key={student.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-500/10 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 font-black shadow-sm group-hover:scale-110 transition-transform">
                              {student.name[0]}
                            </div>
                            <div>
                              <p className="font-black text-slate-800 dark:text-white text-sm leading-tight flex items-center gap-2 flex-wrap">{student.name}
                                {(student.is_graduate === 1 || student.is_graduate === true) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 rounded-full text-[9px] font-black">
                                    <GraduationCap size={11} /> خريج
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-1 tracking-wide uppercase">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-8 py-6">
                            <div className="space-y-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                              <p>🏠 {student.tenant_name || '---'}</p>
                              <p>📍 {student.tenant_governorate || '---'}</p>
                              <p>👤 الأسقف: {student.bishop_name || '---'}</p>
                              <p>👨‍💼 المشرف: {student.supervisor_names || '---'}</p>
                            </div>
                          </td>
                        )}
                        <td className="px-8 py-6">
                          <span className="font-mono text-sm font-bold text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-xl">{student.student_id_number}</span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{student.university || 'غير محدد'}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-300 font-medium">الهاتف: {student.phone || '---'}</p>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          {student.room_number ? (
                            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-black text-xs bg-blue-50 dark:bg-blue-500/20 px-4 py-2 rounded-2xl w-fit">
                              <Building size={14} />
                              <span>{student.apartment_name || 'شقة'} - غرفة {student.room_number}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-500 text-xs font-bold">غير مسكن بعد</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit text-[10px] font-black uppercase ${
                            student.room_id ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${student.room_id ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span>{student.room_id ? 'مُسكن' : 'قيد المعالجة'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-center gap-2 translate-x-2">
                            {isAdmin && (
                              <div className="flex flex-col gap-1 items-center ml-2">
                                <ServiceToggle checked={toggleState[student.id]?.daily ?? (student.daily_readings_enabled !== 0)} label="قراءة" onClick={e => { e.stopPropagation(); onToggleDaily(student.id, student.name, toggleState[student.id]?.daily ?? (student.daily_readings_enabled !== 0)); }} />
                                <ServiceToggle checked={toggleState[student.id]?.radio ?? (student.radio_514_enabled !== 0)} label="راديو" onClick={e => { e.stopPropagation(); onToggleRadio(student.id, student.name, toggleState[student.id]?.radio ?? (student.radio_514_enabled !== 0)); }} />
                              </div>
                            )}
                            {canEditStudent && userRole !== 'bishop' && (
                              <div className="flex flex-col gap-1 items-center ml-2">
                                <ServiceToggle checked={student.is_graduate === 1 || student.is_graduate === true} label="خريج" onClick={e => { e.stopPropagation(); onToggleGraduate(student.id, student.name, student.is_graduate === 1 || student.is_graduate === true); }} />
                              </div>
                            )}
                            <button onClick={() => onViewProfile(student.id)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-xl transition-all">
                              <UserCircle size={18} />
                            </button>
                            {canDeleteStudent && userRole !== 'bishop' && (
                              <button onClick={() => onDeleteClick(student)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-xl transition-all">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : [])
                  ];
                });
              })() : (filteredStudents.map((student: any) => (
                <tr key={student.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-500/10 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 font-black shadow-sm group-hover:scale-110 transition-transform">
                        {student.name[0]}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-white text-sm leading-tight flex items-center gap-2 flex-wrap">{student.name}
                          {(student.is_graduate === 1 || student.is_graduate === true) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 rounded-full text-[9px] font-black">
                              <GraduationCap size={11} /> خريج
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-1 tracking-wide uppercase">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-mono text-sm font-bold text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-xl">{student.student_id_number}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{student.university || 'غير محدد'}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-300 font-medium">الهاتف: {student.phone || '---'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {student.room_number ? (
                      <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-black text-xs bg-blue-50 dark:bg-blue-500/20 px-4 py-2 rounded-2xl w-fit">
                        <Building size={14} />
                        <span>{student.apartment_name || 'شقة'} - غرفة {student.room_number}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-500 text-xs font-bold">غير مسكن بعد</span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit text-[10px] font-black uppercase ${
                      student.room_id ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${student.room_id ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span>{student.room_id ? 'مُسكن' : 'قيد المعالجة'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-center gap-2 translate-x-2">
                      {canEditStudent && userRole !== 'bishop' && (
                        <ServiceToggle checked={student.is_graduate === 1 || student.is_graduate === true} label="خريج" onClick={e => { e.stopPropagation(); onToggleGraduate(student.id, student.name, student.is_graduate === 1 || student.is_graduate === true); }} />
                      )}
                      <button onClick={() => onViewProfile(student.id)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-xl transition-all">
                        <UserCircle size={18} />
                      </button>
                      {canDeleteStudent && userRole !== 'bishop' && (
                        <button onClick={() => onDeleteClick(student)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-xl transition-all">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )))
            ) : (
              <EmptyStudentsState colSpan={isAdmin ? 7 : 6} />
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} />
    </div>
  );
}
