import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../../hooks/useMounted';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import {
  Home, Mail, Shield, Building, MapPin, Hash, Star,
  AlertTriangle, DollarSign, QrCode, Calendar, Clock,
  ChevronDown, ChevronUp, AlertCircle, Award, BookOpen, Heart, Zap, Users
} from 'lucide-react';
import { QRCode } from 'react-qr-code';
import { RoleBadge, AvatarUpload, InfoRow, SectionCard, SaveButton, PhoneInput } from './ProfileShared';

export function StudentProfile() {
  const { user } = useAuth();
  const { request } = useApi();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [finSummary, setFinSummary] = useState<any>(null);
  const [behaviorSummary, setBehaviorSummary] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  

  const fetchProfile = useCallback(async () => {
    try {
      const [profRes, finRes, behRes, badgeRes] = await Promise.all([
        request('/api/users/profile'),
        request('/api/students/finance/my-summary').catch(() => null),
        request('/api/students/behavior/my-summary').catch(() => null),
        request('/api/badges/my').catch(() => ({ data: [] })),
      ]);
      if (!mounted.current) return;
      setProfile(profRes.data);
      setFinSummary(finRes);
      setBehaviorSummary(behRes);
      setBadges(badgeRes?.data || []);
      setPhone(profRes.data?.user?.phone || '');
      setPhotoUrl(profRes.data?.user?.photo_url || '');
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      if (mounted.current) setError(e.message || 'فشل تحميل البيانات');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await request('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ phone, photo_url: photoUrl }),
      });
      fetchProfile();
    } catch (e: any) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay message={error} onRetry={fetchProfile} />;

  const student = profile?.student;
  const room = profile?.room;
  const apartment = profile?.apartment;
  const tenant = profile?.tenant;
  const points = profile?.points || [];
  const warnings = profile?.warnings || [];

  const totalPoints = behaviorSummary?.totalPoints || 0;
  const activeWarnings = behaviorSummary?.activeWarnings || (warnings.filter((w: any) => w.status === 'active').length);

  const tier = totalPoints >= 1000 ? 'بلاتينيوم' : totalPoints >= 500 ? 'ذهبي' : totalPoints >= 200 ? 'فضي' : 'برونزي';
  const tierColor = totalPoints >= 1000 ? 'text-purple-600' : totalPoints >= 500 ? 'text-amber-600' : totalPoints >= 200 ? 'text-slate-500' : 'text-orange-600';
  const tierBg = totalPoints >= 1000 ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-200' : totalPoints >= 500 ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-200' : totalPoints >= 200 ? 'bg-slate-100 dark:bg-white/10 border-slate-200' : 'bg-orange-100 dark:bg-orange-500/10 border-orange-200';
  const tierBorder = totalPoints >= 1000 ? 'dark:border-purple-500/30' : totalPoints >= 500 ? 'dark:border-amber-500/30' : totalPoints >= 200 ? 'dark:border-white/20' : 'dark:border-orange-500/30';

  const qrData = user?.id ? JSON.stringify({ userId: user.id, name: user.name, ts: Date.now() }) : '';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="bg-gradient-to-br from-primary-600 via-vibrant-600 to-primary-700 rounded-xl p-8 relative overflow-hidden">
        <div className="absolute -top-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="relative z-10">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <AvatarUpload currentUrl={photoUrl} name={user?.name || ''} onSave={setPhotoUrl} />
          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{user?.name}</h1>
              <RoleBadge role="student" />
              <span className={`px-3 py-1 rounded-xl text-[10px] font-black border ${tierBg} ${tierColor} ${tierBorder}`}>
                {tier}
              </span>
            </div>
            <p className="text-sm text-white/70 font-bold mb-4">{user?.email}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <InfoRow icon={<Mail size={14} />} label="البريد" value={user?.email || '---'} />
              <InfoRow icon={<Shield size={14} />} label="المعرف" value={`#${user?.id?.substring(0, 8).toUpperCase() || ''}`} />
              <InfoRow icon={<Hash size={14} />} label="الرقم الطلابي" value={student?.student_id_number || '---'} />
            </div>
          </div>
        </div>
        </div>
      </div>

      <PhoneInput phone={phone} onChange={setPhone} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStat value={totalPoints} label="نقاط" color={totalPoints >= 0 ? 'emerald' : 'red'} />
        <MiniStat value={activeWarnings} label="إنذار" color={activeWarnings > 0 ? 'red' : 'emerald'} />
        <MiniStat value={behaviorSummary?.totalPenalties || 0} label="عقوبات" color="amber" />
        <MiniStat value={`${finSummary?.data?.remaining ?? 0} ج`} label="متبقي" color={(finSummary?.data?.remaining ?? 0) > 0 ? 'red' : 'emerald'} />
      </div>

      <SectionCard title="بيانات السكن" icon={<Home size={16} />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tenant && <InfoRow icon={<Building size={14} />} label="السكن" value={tenant.name} />}
          {apartment && <InfoRow icon={<MapPin size={14} />} label="الشقة" value={apartment.name} />}
          {room && <InfoRow icon={<Hash size={14} />} label="الغرفة" value={room.room_number} />}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <SectionCard title="آخر النقاط" icon={<Star size={16} className="text-amber-500" />}>
          {points.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {points.slice(0, 10).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{p.reason || 'بدون سبب'}</p>
                    <p className="text-[9px] text-slate-400">{new Date(p.created_at).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${Number(p.amount) > 0 ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                    {Number(p.amount) > 0 ? '+' : ''}{p.amount}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-bold text-center py-4">لا توجد نقاط مسجلة</p>
          )}
        </SectionCard>

        <SectionCard title="الإنذارات" icon={<AlertTriangle size={16} className="text-red-500" />}>
          {warnings.filter((w: any) => w.status === 'active').length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {warnings.filter((w: any) => w.status === 'active').map((w: any) => (
                <div key={w.id} className="p-3 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${w.level === 'critical' ? 'bg-red-200 text-red-800' : w.level === 'high' ? 'bg-orange-200 text-orange-800' : w.level === 'medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-slate-200 text-slate-700'}`}>
                      {w.level === 'critical' ? 'حرج' : w.level === 'high' ? 'عالٍ' : w.level === 'medium' ? 'متوسط' : 'بسيط'}
                    </span>
                    <span className="text-[9px] text-slate-400">{new Date(w.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{w.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Shield size={32} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-xs font-bold text-emerald-500 dark:text-emerald-400">السجل نظيف</p>
              <p className="text-[9px] text-slate-400 mt-1">لا توجد إنذارات نشطة</p>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="QR Code للحضور" icon={<QrCode size={16} />}>
        <div className="flex items-center justify-center">
          <button onClick={() => setShowQR(!showQR)}
            className={`px-6 py-3 rounded-xl font-bold text-xs border transition-colors ${
              showQR
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                : 'bg-slate-50 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-slate-300'
            }`}>
            {showQR ? 'إخفاء QR Code' : 'إظهار QR Code للتسجيل'}
          </button>
        </div>
        {showQR && (
          <div className="mt-4 flex flex-col items-center">
            <div className="p-4 bg-white rounded-2xl border-2 border-slate-200">
              <div className="w-48 h-48 bg-white flex items-center justify-center">
                <QRCode value={qrData || user?.id || ''} size={160} />
              </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-2">امسح QR Code لتسجيل حضورك في الأنشطة</p>
            <p className="text-[9px] text-slate-400 mt-1 font-mono">المعرف: {user?.id?.substring(0, 16)}</p>
          </div>
        )}
      </SectionCard>

      {finSummary?.data && (
        <SectionCard title="الملخص المالي" icon={<DollarSign size={16} />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FinStat label="إجمالي الفاتورة" value={`${finSummary.data.totalInvoice ?? finSummary.data.roomPrice ?? 0} ج`} />
            <FinStat label="المدفوع" value={`${finSummary.data.totalPaid || 0} ج`} />
            <FinStat label="نسبة السداد" value={`${Math.round(finSummary.data.paymentPercent ?? 0)}%`} />
            <FinStat label="المتبقي" value={`${finSummary.data.remaining || 0} ج`} />
          </div>
        </SectionCard>
      )}

      {badges.length > 0 && (
        <SectionCard title="الأوسمة والجوائز" icon={<Award size={16} className="text-amber-500" />}>
          <div className="space-y-4">
            {/* من إدارة التطبيق */}
            {badges.filter((b: any) => b.category === 'admin').length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-2">
                  <Shield size={14} /> جوائز وأوسمة من إدارة التطبيق
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {badges.filter((b: any) => b.category === 'admin').map((b: any) => (
                    <BadgeCard key={b.id} badge={b} />
                  ))}
                </div>
              </div>
            )}
            {/* من السكن */}
            {badges.filter((b: any) => b.category === 'housing').length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                  <Home size={14} /> جوائز وأوسمة من السكن
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {badges.filter((b: any) => b.category === 'housing').map((b: any) => (
                    <BadgeCard key={b.id} badge={b} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <SaveButton onClick={saveProfile} saving={saving} />
    </div>
  );
}

const BADGE_ICONS: Record<string, any> = { Award: Award, BookOpen: BookOpen, Heart: Heart, Zap: Zap, Shield: Shield, Users: Users };

function BadgeCard({ badge }: { badge: any }) {
  const IconComp = BADGE_ICONS[badge.icon] || Award;
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
    blue: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
    purple: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
    red: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30',
  };
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] shadow-sm text-center">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 border-2 ${colorMap[badge.color] || colorMap.amber}`}>
        <IconComp size={22} />
      </div>
      <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{badge.title}</p>
      {badge.reason && <p className="text-[8px] text-slate-400 mt-1">{badge.reason}</p>}
      <p className="text-[7px] text-slate-400 mt-1">{new Date(badge.awarded_at).toLocaleDateString('ar-EG')}</p>
    </div>
  );
}

function MiniStat({ value, label, color }: { value: number | string; label: string; color: string }) {
  const c: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  };
  return (
    <div className={`p-4 rounded-xl text-center border ${c[color] || c.blue}`}>
      <p className="text-xl font-black">{value}</p>
      <p className="text-[9px] font-bold opacity-70">{label}</p>
    </div>
  );
}

function FinStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 text-center">
      <p className="text-xs font-black text-slate-900 dark:text-white">{value}</p>
      <p className="text-[9px] text-slate-400 font-bold">{label}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
    </div>
  );
}

function ErrorDisplay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="rtl">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
        <AlertCircle size={28} className="text-red-500" />
      </div>
      <p className="text-sm font-bold text-slate-600 dark:text-slate-400 text-center max-w-xs">{message}</p>
      <button onClick={onRetry}
        className="px-6 py-3 rounded-xl bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-bold text-xs hover:brightness-110 transition-all shadow-lg shadow-primary-500/20 active:scale-95">
        إعادة المحاولة
      </button>
    </div>
  );
}
